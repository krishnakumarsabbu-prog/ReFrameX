"""Dependency discovery engine.

Discovers relationships from stored components and their evidence references.
Relationships are derived from the parser-extracted component data —
specifically from detected_properties and evidence_refs that the parsers
already record per component. This service correlates those records into
typed source→target dependency edges.

Idempotent: re-discovery deletes prior dependencies and creates new ones with
stable, deterministic IDs. Unresolved targets (CALL to a program with no
source, missing copybook) are stored as explicit placeholder components
with classification Unknown, never dropped.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.models import Artifact, Component, Dependency


# Relationship type constants
REL_CALLS_STATIC = "program-to-program (static CALL)"
REL_CALLS_DYNAMIC = "program-to-program (dynamic CALL)"
REL_COPIES = "program-to-copybook (COPY)"
REL_ACCESSES_TABLE = "program-to-table (SQL)"
REL_USES_FILE = "program-to-file (SELECT/FD)"
REL_CICS_TRANSACTION = "program-to-transaction (CICS)"
REL_CICS_MAP = "program-to-BMS-map (CICS SEND/RECEIVE)"
REL_CICS_FILE = "program-to-file (CICS)"
REL_IMS_DLI = "program-to-IMS-database (DL/I)"
REL_JOB_EXEC_PROGRAM = "job-to-program (EXEC PGM)"
REL_JOB_EXEC_PROC = "job-to-proc (EXEC PROC)"
REL_JOB_DATASET_INPUT = "job-to-dataset (input)"
REL_JOB_DATASET_OUTPUT = "job-to-dataset (output)"
REL_JOB_FILE = "job-to-file (DD)"
REL_TRANSACTION_MAP = "transaction-to-BMS-map"


def _dep_id(app_id: str, source_id: str, target_id: str, rel_type: str, line: int) -> str:
    raw = f"{app_id}|{source_id}|{target_id}|{rel_type}|{line}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _parse_json(val: str, default):
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _make_evidence_ref(component: Component) -> dict:
    refs = _parse_json(component.evidence_refs, [])
    if refs and isinstance(refs, list) and len(refs) > 0:
        ref = refs[0]
        return {
            "artifact_id": ref.get("artifact_id", component.source_artifact_id),
            "line_start": ref.get("line_start", component.line_start),
            "line_end": ref.get("line_end", component.line_end),
            "rule": ref.get("rule", ""),
            "snippet": ref.get("snippet", ""),
        }
    return {
        "artifact_id": component.source_artifact_id,
        "line_start": component.line_start,
        "line_end": component.line_end,
        "rule": "",
        "snippet": "",
    }


def _find_or_create_placeholder(
    db: Session,
    app_id: str,
    name: str,
    comp_type: str,
    technology: str,
    source_artifact_id: str,
    source_filename: str,
    ref_component: Component,
) -> Component:
    """Find an existing component by name+type within the app, or create a placeholder.

    A placeholder is an explicit component with evidence_class=Unknown that
    represents an unresolved target (e.g. CALL to a program with no source
    artifact uploaded, a missing copybook). Placeholders are never dropped.
    """
    # Look for any existing component with the same name and type in this app
    existing = db.query(Component).filter(
        Component.application_id == app_id,
        Component.name == name,
        Component.component_type == comp_type,
    ).first()
    if existing:
        return existing

    # Create placeholder with Unknown classification
    raw = f"{app_id}|placeholder|{comp_type}|{name}|{ref_component.id}"
    ph_id = hashlib.sha256(raw.encode()).hexdigest()[:16]
    placeholder = Component(
        id=ph_id,
        application_id=app_id,
        name=name,
        component_type=comp_type,
        technology=technology,
        source_artifact_id=source_artifact_id,
        source_filename=source_filename,
        line_start=0,
        line_end=0,
        detected_properties=json.dumps({"placeholder": "yes", "unresolved": "yes"}),
        evidence_class="Unknown",
        evidence_refs=json.dumps([{
            "artifact_id": source_artifact_id,
            "line_start": ref_component.line_start,
            "line_end": ref_component.line_end,
            "rule": "UNRESOLVED_TARGET",
            "snippet": f"Referenced as {name} but no source artifact found",
        }]),
        warnings=json.dumps(["Unresolved target — no source artifact available"]),
        parser_name="dependency_discovery",
        parser_version="1.0.0",
    )
    db.add(placeholder)
    db.flush()
    return placeholder


def discover_dependencies(db: Session, application_id: str) -> int:
    """Discover dependencies for an application from stored components.

    Idempotent: existing dependencies are deleted first.
    Returns the number of dependencies created.
    """
    # Delete existing dependencies
    db.query(Dependency).filter(Dependency.application_id == application_id).delete()
    db.flush()

    # Also delete placeholder components from prior discovery runs
    db.query(Component).filter(
        Component.application_id == application_id,
        Component.parser_name == "dependency_discovery",
    ).delete()
    db.flush()

    components = db.query(Component).filter(
        Component.application_id == application_id
    ).all()

    # Build lookup indexes
    by_name_type: dict[tuple[str, str], list[Component]] = defaultdict(list)
    by_name: dict[str, list[Component]] = defaultdict(list)
    program_components: list[Component] = []
    job_components: list[Component] = []

    for c in components:
        by_name_type[(c.name.upper(), c.component_type)].append(c)
        by_name[c.name.upper()].append(c)
        if c.component_type == "PROGRAM" and c.technology == "COBOL":
            program_components.append(c)
        elif c.component_type == "JOB":
            job_components.append(c)

    deps_created = 0

    for comp in components:
        props = _parse_json(comp.detected_properties, {})
        ev_ref = _make_evidence_ref(comp)

        # --- COBOL: CALL static → program-to-program ---
        if comp.component_type == "PROGRAM" and props.get("call_type") == "static":
            target_comp = _resolve_target(db, application_id, comp.name, "PROGRAM", by_name_type, comp)
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                dep = _create_dependency(
                    db, application_id, source_prog, target_comp,
                    REL_CALLS_STATIC, "static_extraction",
                    target_comp.evidence_class if target_comp.evidence_class != "Unknown" else "Evidence-based",
                    comp, ev_ref,
                    f"Static CALL to {comp.name}",
                )
                if dep:
                    deps_created += 1

        # --- COBOL: CALL dynamic → program-to-program (Inferred or Unknown) (A5) ---
        elif comp.component_type == "PROGRAM" and props.get("call_type") in ("dynamic", "dynamic_resolved", "dynamic_unresolved"):
            is_unresolved = props.get("call_type") == "dynamic_unresolved" or comp.evidence_class == "Unknown"
            target_comp = _resolve_target(db, application_id, comp.name, "PROGRAM", by_name_type, comp)
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                dep_ev_class = "Unknown" if is_unresolved else "Inferred"
                desc = (
                    f"Unresolved dynamic CALL via variable {props.get('target_variable', comp.name)}"
                    if is_unresolved else
                    f"Dynamic CALL to {comp.name} via variable {props.get('target_variable', '')}"
                )
                dep = _create_dependency(
                    db, application_id, source_prog, target_comp,
                    REL_CALLS_DYNAMIC, "static_extraction",
                    dep_ev_class,
                    comp, ev_ref,
                    desc,
                )
                if dep:
                    deps_created += 1

        # --- COBOL: COPY → program-to-copybook ---
        elif comp.component_type == "COPYBOOK":
            target_comp = _resolve_target(db, application_id, comp.name, "COPYBOOK", by_name_type, comp)
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                dep = _create_dependency(
                    db, application_id, source_prog, target_comp,
                    REL_COPIES, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    f"COPY {comp.name}" + (" with REPLACING" if props.get("replacing") == "yes" else ""),
                )
                if dep:
                    deps_created += 1

        # --- COBOL: EXEC SQL → program-to-table ---
        elif comp.component_type == "TABLE" and comp.technology == "SQL":
            tables_str = props.get("tables", "")
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog and tables_str:
                for table_name in tables_str.split(","):
                    table_name = table_name.strip()
                    if not table_name:
                        continue
                    target_comp = _resolve_target(db, application_id, table_name, "TABLE", by_name_type, comp)
                    dep = _create_dependency(
                        db, application_id, source_prog, target_comp,
                        REL_ACCESSES_TABLE, "static_extraction",
                        "Evidence-based",
                        comp, ev_ref,
                        f"EXEC SQL {props.get('sql_statement', 'SQL')} on {table_name}",
                    )
                    if dep:
                        deps_created += 1
            elif source_prog:
                # SQL statement without explicit table names
                dep = _create_dependency(
                    db, application_id, source_prog, comp,
                    REL_ACCESSES_TABLE, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    f"EXEC SQL {props.get('sql_statement', 'SQL')}",
                )
                if dep:
                    deps_created += 1

        # --- COBOL: SELECT/ASSIGN/FD → program-to-file ---
        elif comp.component_type == "FILE" and comp.technology == "COBOL":
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                dep = _create_dependency(
                    db, application_id, source_prog, comp,
                    REL_USES_FILE, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    f"File {comp.name}" + (f" ({props.get('organization', '')})" if props.get("organization") else ""),
                )
                if dep:
                    deps_created += 1

        # --- CICS: program-to-transaction, program-to-map, program-to-file ---
        elif comp.component_type == "TRANSACTION" and comp.technology == "CICS":
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                trans_str = props.get("transactions", "")
                maps_str = props.get("maps", "")
                files_str = props.get("files", "")

                # Transaction references
                if trans_str:
                    for trans_id in trans_str.split(","):
                        trans_id = trans_id.strip()
                        if not trans_id:
                            continue
                        target_comp = _resolve_target(db, application_id, trans_id, "TRANSACTION", by_name_type, comp)
                        dep = _create_dependency(
                            db, application_id, source_prog, target_comp,
                            REL_CICS_TRANSACTION, "static_extraction",
                            "Evidence-based",
                            comp, ev_ref,
                            f"CICS transaction {trans_id}",
                        )
                        if dep:
                            deps_created += 1

                # Map references
                if maps_str:
                    for map_name in maps_str.split(","):
                        map_name = map_name.strip()
                        if not map_name:
                            continue
                        target_comp = _resolve_target(db, application_id, map_name, "MAP", by_name_type, comp)
                        dep = _create_dependency(
                            db, application_id, source_prog, target_comp,
                            REL_CICS_MAP, "static_extraction",
                            "Evidence-based",
                            comp, ev_ref,
                            f"CICS map {map_name}",
                        )
                        if dep:
                            deps_created += 1

                # File references via CICS
                if files_str:
                    for file_name in files_str.split(","):
                        file_name = file_name.strip()
                        if not file_name:
                            continue
                        target_comp = _resolve_target(db, application_id, file_name, "FILE", by_name_type, comp)
                        dep = _create_dependency(
                            db, application_id, source_prog, target_comp,
                            REL_CICS_FILE, "static_extraction",
                            "Evidence-based",
                            comp, ev_ref,
                            f"CICS file {file_name}",
                        )
                        if dep:
                            deps_created += 1

                # If no specific sub-references, link program to the CICS call itself
                if not trans_str and not maps_str and not files_str:
                    dep = _create_dependency(
                        db, application_id, source_prog, comp,
                        REL_CICS_TRANSACTION, "static_extraction",
                        "Evidence-based",
                        comp, ev_ref,
                        f"CICS {props.get('cics_commands', 'CALL')}",
                    )
                    if dep:
                        deps_created += 1

        # --- IMS DL/I → program-to-IMS-database ---
        elif comp.component_type == "EXTERNAL_SYSTEM" and comp.technology == "IMS":
            source_prog = _find_source_program(db, application_id, comp, by_name_type)
            if source_prog:
                dep = _create_dependency(
                    db, application_id, source_prog, comp,
                    REL_IMS_DLI, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    "IMS DL/I call detected",
                )
                if dep:
                    deps_created += 1

        # --- JCL: EXEC PGM → job-to-program ---
        elif comp.component_type == "PROGRAM" and comp.technology == "JCL":
            source_job = _find_source_job(db, application_id, comp, by_name_type)
            if source_job:
                target_comp = _resolve_target(db, application_id, comp.name, "PROGRAM", by_name_type, comp)
                # If target is the same as the JCL-extracted program component, link to it;
                # otherwise try to find a COBOL program with that name
                dep = _create_dependency(
                    db, application_id, source_job, target_comp,
                    REL_JOB_EXEC_PROGRAM, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    f"EXEC PGM={comp.name}",
                )
                if dep:
                    deps_created += 1

        # --- JCL: EXEC PROC → job-to-proc ---
        elif comp.component_type == "PROC" and comp.technology == "JCL":
            source_job = _find_source_job(db, application_id, comp, by_name_type)
            if source_job:
                dep = _create_dependency(
                    db, application_id, source_job, comp,
                    REL_JOB_EXEC_PROC, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    f"EXEC PROC={comp.name}",
                )
                if dep:
                    deps_created += 1

        # --- JCL: DD → job-to-dataset / job-to-file ---
        elif comp.component_type in ("DATASET", "FILE") and comp.technology == "JCL":
            source_job = _find_source_job(db, application_id, comp, by_name_type)
            if source_job:
                io_class = props.get("io_class", "")
                dsn = props.get("dsn", "")
                if comp.component_type == "DATASET":
                    rel_type = REL_JOB_DATASET_INPUT if io_class == "input" else (
                        REL_JOB_DATASET_OUTPUT if io_class == "output" else "job-to-dataset"
                    )
                    desc = f"DD {comp.name}" + (f" DSN={dsn}" if dsn else "")
                else:
                    rel_type = REL_JOB_FILE
                    desc = f"DD {comp.name}" + (" (SYSOUT)" if props.get("sysout") == "yes" else "")

                dep = _create_dependency(
                    db, application_id, source_job, comp,
                    rel_type, "static_extraction",
                    "Evidence-based",
                    comp, ev_ref,
                    desc,
                )
                if dep:
                    deps_created += 1

    db.commit()
    return deps_created


def _resolve_target(
    db: Session,
    app_id: str,
    name: str,
    comp_type: str,
    by_name_type: dict[tuple[str, str], list[Component]],
    ref_component: Component | None = None,
) -> Component:
    """Resolve a target component by name+type. If not found, create a placeholder."""
    key = (name.upper(), comp_type)
    candidates = by_name_type.get(key, [])
    if candidates:
        # Prefer non-placeholder, non-JCL technology components
        for c in candidates:
            if c.evidence_class != "Unknown" and c.technology != "JCL":
                return c
        for c in candidates:
            if c.evidence_class != "Unknown":
                return c
        return candidates[0]

    # Try by name only for PROGRAM type (JCL PGM → COBOL program cross-reference)
    if comp_type == "PROGRAM":
        name_matches = by_name.get(name.upper(), [])
        for c in name_matches:
            if c.component_type == "PROGRAM" and c.technology != "JCL":
                return c
        for c in name_matches:
            if c.component_type == "PROGRAM":
                return c

    # Create placeholder — unresolved target
    ref = ref_component or Component(
        id="placeholder_ref", line_start=0, line_end=0,
        source_artifact_id="", evidence_refs="[]",
    )
    return _find_or_create_placeholder(
        db, app_id, name, comp_type, "",
        ref.source_artifact_id,
        ref.source_filename,
        ref,
    )


def _find_source_program(
    db: Session,
    app_id: str,
    ref_component: Component,
    by_name_type: dict[tuple[str, str], list[Component]],
) -> Component | None:
    """Find the PROGRAM component that contains the given reference component.

    The source program is the one extracted from the same artifact as the
    reference component. We look for a PROGRAM with technology=COBOL from
    the same source_artifact_id.
    """
    # All components from the same artifact
    same_artifact = db.query(Component).filter(
        Component.application_id == app_id,
        Component.source_artifact_id == ref_component.source_artifact_id,
        Component.component_type == "PROGRAM",
        Component.technology == "COBOL",
    ).first()
    return same_artifact


def _find_source_job(
    db: Session,
    app_id: str,
    ref_component: Component,
    by_name_type: dict[tuple[str, str], list[Component]],
) -> Component | None:
    """Find the JOB component that contains the given JCL reference component."""
    return db.query(Component).filter(
        Component.application_id == app_id,
        Component.source_artifact_id == ref_component.source_artifact_id,
        Component.component_type == "JOB",
        Component.technology == "JCL",
    ).first()


def _create_dependency(
    db: Session,
    app_id: str,
    source: Component,
    target: Component,
    rel_type: str,
    method: str,
    evidence_class: str,
    ref_component: Component,
    ev_ref: dict,
    description: str,
) -> Dependency | None:
    """Create a dependency record if it doesn't duplicate an existing one."""
    if source.id == target.id:
        return None

    dep_id = _dep_id(app_id, source.id, target.id, rel_type, ref_component.line_start)

    # Check if already created in this run
    existing = db.query(Dependency).filter(Dependency.id == dep_id).first()
    if existing:
        return None

    dep = Dependency(
        id=dep_id,
        application_id=app_id,
        source_component_id=source.id,
        target_component_id=target.id,
        relationship_type=rel_type,
        detection_method=method,
        evidence_class=evidence_class if target.evidence_class != "Unknown" else "Unknown",
        source_artifact_id=ref_component.source_artifact_id,
        source_line_number=ref_component.line_start,
        evidence_ref=json.dumps(ev_ref),
        description=description,
    )
    db.add(dep)
    db.flush()
    return dep


def get_dependencies(db: Session, application_id: str) -> list[Dependency]:
    """Get all dependencies for an application."""
    return db.query(Dependency).filter(
        Dependency.application_id == application_id
    ).order_by(Dependency.relationship_type).all()


def get_dependency_summary(db: Session, application_id: str) -> dict:
    """Get a summary of dependencies for an application."""
    deps = get_dependencies(db, application_id)
    by_rel: dict[str, int] = {}
    by_evidence: dict[str, int] = {}
    unresolved = 0

    comp_ids = set()
    for d in deps:
        by_rel[d.relationship_type] = by_rel.get(d.relationship_type, 0) + 1
        by_evidence[d.evidence_class] = by_evidence.get(d.evidence_class, 0) + 1
        comp_ids.add(d.source_component_id)
        comp_ids.add(d.target_component_id)
        if d.evidence_class == "Unknown":
            unresolved += 1

    # Check for circular dependencies and single points
    graph_analysis = _build_adjacency(deps)
    circular_count = _count_circular(graph_analysis)
    single_points = _count_single_points(db, application_id, deps, graph_analysis)

    return {
        "application_id": application_id,
        "total_dependencies": len(deps),
        "by_relationship_type": by_rel,
        "by_evidence_class": by_evidence,
        "unresolved_targets": unresolved,
        "circular_dependencies": circular_count,
        "single_points": single_points,
    }


def get_graph_data(
    db: Session,
    application_id: str,
    node_limit: int = 300,
) -> dict:
    """Get graph data (nodes + edges) for an application.

    Applies a sensible render limit. Returns truncated=True if the full
    graph exceeds the limit.
    """
    deps = get_dependencies(db, application_id)
    comp_ids = set()
    for d in deps:
        comp_ids.add(d.source_component_id)
        comp_ids.add(d.target_component_id)

    components = db.query(Component).filter(
        Component.id.in_(list(comp_ids)) if comp_ids else False
    ).all() if comp_ids else []

    comp_map = {c.id: c for c in components}

    total_nodes = len(comp_ids)
    total_edges = len(deps)
    truncated = total_nodes > node_limit

    # If truncated, prioritize nodes with most connections
    if truncated:
        degree: dict[str, int] = defaultdict(int)
        for d in deps:
            degree[d.source_component_id] += 1
            degree[d.target_component_id] += 1
        top_ids = sorted(degree.keys(), key=lambda x: degree[x], reverse=True)[:node_limit]
        top_set = set(top_ids)
        deps = [d for d in deps if d.source_component_id in top_set and d.target_component_id in top_set]
        comp_ids = top_set

    nodes = []
    for cid in comp_ids:
        c = comp_map.get(cid)
        if c:
            nodes.append({
                "id": c.id,
                "name": c.name,
                "component_type": c.component_type,
                "technology": c.technology,
                "evidence_class": c.evidence_class,
                "source_filename": c.source_filename,
                "source_artifact_id": c.source_artifact_id,
                "line_start": c.line_start,
                "line_end": c.line_end,
            })

    edges = []
    for d in deps:
        edges.append({
            "id": d.id,
            "source": d.source_component_id,
            "target": d.target_component_id,
            "relationship_type": d.relationship_type,
            "evidence_class": d.evidence_class,
            "detection_method": d.detection_method,
            "source_line_number": d.source_line_number,
            "description": d.description,
        })

    return {
        "application_id": application_id,
        "nodes": nodes,
        "edges": edges,
        "truncated": truncated,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
    }


def get_component_dependencies(db: Session, component_id: str) -> dict:
    """Get all dependencies for a specific component (incoming + outgoing)."""
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        return None

    incoming = db.query(Dependency).filter(
        Dependency.target_component_id == component_id
    ).all()
    outgoing = db.query(Dependency).filter(
        Dependency.source_component_id == component_id
    ).all()

    return {
        "component": component,
        "incoming": incoming,
        "outgoing": outgoing,
    }


def get_component_impact(db: Session, component_id: str) -> dict | None:
    """Compute impact analysis for a specific component."""
    comp_data = get_component_dependencies(db, component_id)
    if comp_data is None:
        return None

    component = comp_data["component"]
    all_deps = db.query(Dependency).filter(
        Dependency.application_id == component.application_id
    ).all()

    adj = _build_adjacency(all_deps)
    reverse_adj = _build_reverse_adjacency(all_deps)

    direct_deps = len(comp_data["outgoing"])
    upstream = _bfs_count(component_id, reverse_adj)
    downstream = _bfs_count(component_id, adj)
    indirect_up = upstream - len(comp_data["incoming"])
    indirect_down = downstream - len(comp_data["outgoing"])

    # Dependency depth (longest path from this node)
    depth = _max_depth(component_id, adj, set())

    # Circular detection
    circular_paths = _find_circular_paths(component_id, adj)

    # Shared components (components reachable from both upstream and downstream)
    up_set = _bfs_set(component_id, reverse_adj)
    down_set = _bfs_set(component_id, adj)
    shared = len(up_set & down_set)

    # Single point of dependency: this component is the only path to downstream
    single_point = _is_single_point(component_id, adj, reverse_adj)

    # Connected components
    connected = _connected_components(component_id, adj, reverse_adj)

    # Associated artifacts
    artifacts = db.query(Artifact).filter(
        Artifact.id == component.source_artifact_id
    ).all()
    artifact_ids = [a.id for a in artifacts]

    # Risk indicators
    risks = []
    if circular_paths:
        risks.append("Circular dependency detected")
    if single_point:
        risks.append("Potential single point of dependency")
    if component.evidence_class == "Unknown":
        risks.append("Unresolved component — no source artifact")
    if indirect_down > 20:
        risks.append(f"High blast radius — {indirect_down} indirect downstream dependencies")
    if depth > 5:
        risks.append(f"Deep dependency chain — {depth} levels")

    # Serialize incoming/outgoing
    incoming_out = [_dep_to_dict(d) for d in comp_data["incoming"]]
    outgoing_out = [_dep_to_dict(d) for d in comp_data["outgoing"]]

    return {
        "component_id": component.id,
        "component_name": component.name,
        "component_type": component.component_type,
        "direct_dependencies": direct_deps,
        "upstream_count": len(comp_data["incoming"]),
        "downstream_count": direct_deps,
        "indirect_upstream": max(0, indirect_up),
        "indirect_downstream": max(0, indirect_down),
        "shared_components": shared,
        "dependency_depth": depth,
        "circular": len(circular_paths) > 0,
        "circular_paths": circular_paths[:5],
        "single_point_of_dependency": single_point,
        "incoming": incoming_out,
        "outgoing": outgoing_out,
        "connected_components": connected[:20],
        "associated_artifacts": artifact_ids,
        "risk_indicators": risks,
    }


# ---- Graph analysis helpers ----

def _build_adjacency(deps: list[Dependency]) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = defaultdict(list)
    for d in deps:
        adj[d.source_component_id].append(d.target_component_id)
    return dict(adj)


def _build_reverse_adjacency(deps: list[Dependency]) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = defaultdict(list)
    for d in deps:
        adj[d.target_component_id].append(d.source_component_id)
    return dict(adj)


def _bfs_count(start: str, adj: dict[str, list[str]]) -> int:
    visited: set[str] = set()
    queue = [start]
    while queue:
        node = queue.pop(0)
        if node in visited:
            continue
        visited.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                queue.append(neighbor)
    return len(visited) - 1


def _bfs_set(start: str, adj: dict[str, list[str]]) -> set[str]:
    visited: set[str] = set()
    queue = [start]
    while queue:
        node = queue.pop(0)
        if node in visited:
            continue
        visited.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                queue.append(neighbor)
    return visited - {start}


def _max_depth(node: str, adj: dict[str, list[str]], visited: set[str]) -> int:
    if node in visited:
        return 0
    visited.add(node)
    children = adj.get(node, [])
    if not children:
        visited.discard(node)
        return 0
    max_child = 0
    for child in children:
        if child not in visited:
            child_depth = _max_depth(child, adj, visited)
            max_child = max(max_child, child_depth)
    visited.discard(node)
    return max_child + 1


def tarjan_scc(adj: dict[str, list[str]]) -> list[list[str]]:
    """Compute strongly connected components using Tarjan's algorithm (A7)."""
    index = 0
    indices: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    sccs: list[list[str]] = []

    all_nodes = set(adj.keys())
    for nbrs in adj.values():
        all_nodes.update(nbrs)

    def strongconnect(v: str):
        nonlocal index
        indices[v] = index
        lowlinks[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in adj.get(v, []):
            if w not in indices:
                strongconnect(w)
                lowlinks[v] = min(lowlinks[v], lowlinks[w])
            elif w in on_stack:
                lowlinks[v] = min(lowlinks[v], indices[w])

        if lowlinks[v] == indices[v]:
            scc = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == v:
                    break
            sccs.append(scc)

    for node in sorted(all_nodes):
        if node not in indices:
            strongconnect(node)

    return sccs


def find_cycles_tarjan(adj: dict[str, list[str]]) -> list[dict]:
    """Find cycles using Tarjan SCC (A7).
    Reports each SCC with > 1 node, and self-loops (node with edge to itself),
    with size, members, and one example cycle path via BFS within the SCC.
    """
    sccs = tarjan_scc(adj)
    cycles = []
    for scc in sccs:
        if len(scc) > 1:
            example_path = _find_scc_cycle_path(scc[0], set(scc), adj)
            cycles.append({
                "size": len(scc),
                "members": sorted(scc),
                "is_self_loop": False,
                "example_path": example_path,
                "example_cycle_path": example_path,
            })
        elif len(scc) == 1:
            node = scc[0]
            if node in adj.get(node, []):
                cycles.append({
                    "size": 1,
                    "members": [node],
                    "is_self_loop": True,
                    "example_path": [node, node],
                    "example_cycle_path": [node, node],
                })
    return cycles


def _find_scc_cycle_path(start: str, scc_set: set[str], adj: dict[str, list[str]]) -> list[str]:
    """Find an example cycle path through start using BFS within scc_set."""
    for first_step in adj.get(start, []):
        if first_step not in scc_set:
            continue
        if first_step == start:
            return [start, start]
        visited = {first_step}
        queue = [[start, first_step]]
        while queue:
            path = queue.pop(0)
            curr = path[-1]
            for nbr in adj.get(curr, []):
                if nbr == start:
                    return path + [start]
                if nbr in scc_set and nbr not in visited:
                    visited.add(nbr)
                    queue.append(path + [nbr])
    return list(scc_set) + [start]


def _find_circular_paths(start: str, adj: dict[str, list[str]]) -> list[list[str]]:
    """Find circular paths starting and ending at the given node using Tarjan SCC."""
    cycles = find_cycles_tarjan(adj)
    paths = []
    for c in cycles:
        if start in c["members"]:
            paths.append(c["example_path"])
    return paths


def _is_choke_point(node: str, adj: dict[str, list[str]], reverse_adj: dict[str, list[str]]) -> bool:
    """Choke point (dominance-based) (A8).
    A node is a choke point if it has at least one upstream and one downstream component
    and removing it disconnects every upstream-to-downstream path for at least one such pair.
    If a bypass path exists between that pair, it is NOT a choke point for that pair.
    """
    upstream = _bfs_set(node, reverse_adj)
    downstream = _bfs_set(node, adj)
    if not upstream or not downstream:
        return False

    # Check if removing node disconnects all paths for at least one (u, w) pair
    for u in upstream:
        for w in downstream:
            # Does a path exist from u to w in G?
            if not _can_reach_without_node(u, w, adj, blocked=""):
                continue
            # Does a bypass path exist from u to w in G \ {node}?
            if not _can_reach_without_node(u, w, adj, blocked=node):
                # Every path from u to w passed through node! Node is a choke point.
                return True

    return False


def _can_reach_without_node(start: str, target: str, adj: dict[str, list[str]], blocked: str) -> bool:
    """Check if target is reachable from start without visiting blocked node."""
    if start == blocked or target == blocked:
        return False
    visited: set[str] = {blocked} if blocked else set()
    queue = [start]
    while queue:
        curr = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)
        if curr == target:
            return True
        for nbr in adj.get(curr, []):
            if nbr not in visited:
                queue.append(nbr)
    return False


# Backward compatibility alias
_is_single_point = _is_choke_point


def _count_circular(adj: dict[str, list[str]]) -> int:
    """Count nodes that participate in circular dependencies via Tarjan SCC."""
    cycles = find_cycles_tarjan(adj)
    nodes = set()
    for c in cycles:
        nodes.update(c["members"])
    return len(nodes)


def _count_choke_points(db: Session, app_id: str, deps: list[Dependency], adj: dict[str, list[str]]) -> int:
    """Count choke points (dominance-based) across the dependency graph (A8)."""
    reverse_adj = _build_reverse_adjacency(deps)
    count = 0
    for node in adj:
        if _is_choke_point(node, adj, reverse_adj):
            count += 1
    return count


_count_single_points = _count_choke_points


def _dep_to_dict(d: Dependency) -> dict:
    ev = _parse_json(d.evidence_ref, {})
    return {
        "id": d.id,
        "application_id": d.application_id,
        "source_component_id": d.source_component_id,
        "target_component_id": d.target_component_id,
        "relationship_type": d.relationship_type,
        "detection_method": d.detection_method,
        "evidence_class": d.evidence_class,
        "source_artifact_id": d.source_artifact_id,
        "source_line_number": d.source_line_number,
        "evidence_ref": ev,
        "description": d.description,
    }
