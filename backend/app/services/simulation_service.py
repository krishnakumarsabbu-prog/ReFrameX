"""Refactoring Impact Simulator service (Phase 8).

Hypothetical planning tool — never modifies source code, never assumes a
target platform. Computes impact from the real dependency graph and produces
scenario-specific analysis for three options:

  A. Extract to Distributed Service
  B. Refactor in Place
  C. Retain on Mainframe

All conclusions are classified Evidence-based / Inferred / Assumed / Unknown
and cite their artifact, line/record, and rule. No fabricated cost, delivery
time, savings or performance gains. Graph connectivity is not proof of
runtime impact.
"""

from __future__ import annotations

import json
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import (
    Application,
    Artifact,
    AssessmentRecord,
    Component,
    Dependency,
    Finding,
    SimulationScenario,
)
from app.services.dependency_service import (
    _build_adjacency,
    _build_reverse_adjacency,
    _bfs_set,
    _find_circular_paths,
    _is_single_point,
    _parse_json,
    REL_CALLS_STATIC,
    REL_CALLS_DYNAMIC,
    REL_COPIES,
    REL_ACCESSES_TABLE,
    REL_USES_FILE,
    REL_CICS_TRANSACTION,
    REL_CICS_MAP,
    REL_CICS_FILE,
    REL_IMS_DLI,
    REL_JOB_EXEC_PROGRAM,
    REL_JOB_EXEC_PROC,
    REL_JOB_DATASET_INPUT,
    REL_JOB_DATASET_OUTPUT,
    REL_JOB_FILE,
)


SCENARIO_TYPES = {
    "extract_service": "Extract to Distributed Service",
    "refactor_in_place": "Refactor in Place",
    "retain_mainframe": "Retain on Mainframe",
}


# ---- Public API ----

def get_simulate_impact(db: Session, application_id: str, component_id: str) -> dict | None:
    """Compute the full impact profile for a component, using the real graph.

    Returns component metadata, dependency counts, upstream/downstream paths,
    shared resources, connected jobs, database deps, external interfaces,
    transaction-boundary concerns, unresolved deps, and evidence gaps.
    """
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        return None

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return None

    all_deps = db.query(Dependency).filter(
        Dependency.application_id == application_id
    ).all()

    components = db.query(Component).filter(
        Component.application_id == application_id
    ).all()
    comp_map = {c.id: c for c in components}

    adj = _build_adjacency(all_deps)
    reverse_adj = _build_reverse_adjacency(all_deps)

    direct_out = [d for d in all_deps if d.source_component_id == component_id]
    direct_in = [d for d in all_deps if d.target_component_id == component_id]

    downstream_set = _bfs_set(component_id, adj)
    upstream_set = _bfs_set(component_id, reverse_adj)

    indirect_down = downstream_set - {d.target_component_id for d in direct_out}
    indirect_up = upstream_set - {d.source_component_id for d in direct_in}

    circular_paths = _find_circular_paths(component_id, adj)
    single_point = _is_single_point(component_id, adj, reverse_adj)

    # Categorize dependencies by type
    shared_resources = _categorize_shared_resources(direct_out, direct_in, comp_map)
    connected_jobs = _find_connected_jobs(component_id, all_deps, comp_map, adj, reverse_adj)
    database_deps = _find_database_deps(direct_out, direct_in, comp_map)
    external_interfaces = _find_external_interfaces(direct_out, direct_in, comp_map)

    # Transaction-boundary concerns: CICS transactions, IMS DL/I
    transaction_concerns = _find_transaction_concerns(direct_out, direct_in, comp_map)

    # Unresolved dependencies
    unresolved = [
        {
            "dependency_id": d.id,
            "target_name": comp_map.get(d.target_component_id, None).name if d.target_component_id in comp_map else "unknown",
            "target_component_id": d.target_component_id,
            "relationship_type": d.relationship_type,
            "evidence_class": d.evidence_class,
            "description": d.description or "",
        }
        for d in direct_out if d.evidence_class == "Unknown"
    ]

    # Evidence gaps from findings
    evidence_gaps = _find_evidence_gaps(db, application_id, component_id)

    # Upstream/downstream paths (limited)
    upstream_paths = _trace_paths(component_id, reverse_adj, comp_map, max_paths=10, max_depth=6)
    downstream_paths = _trace_paths(component_id, adj, comp_map, max_paths=10, max_depth=6)

    # Component assessment scores (from latest assessment)
    complexity, confidence, readiness = _get_component_scores(db, application_id, component)

    impact = {
        "component_id": component.id,
        "component_name": component.name,
        "component_type": component.component_type,
        "technology": component.technology,
        "evidence_class": component.evidence_class,
        "source_filename": component.source_filename,
        "source_artifact_id": component.source_artifact_id,
        "line_start": component.line_start,
        "line_end": component.line_end,
        "complexity_classification": complexity,
        "confidence_classification": confidence,
        "readiness_classification": readiness,
        "directly_impacted": len(direct_out),
        "indirectly_impacted": len(indirect_down),
        "potential_impact_requiring_validation": len(indirect_up) + len(indirect_down),
        "shared_data_dependencies": shared_resources,
        "connected_jobs": connected_jobs,
        "database_dependencies": database_deps,
        "external_interfaces": external_interfaces,
        "possible_transaction_boundary_concerns": transaction_concerns,
        "unresolved_dependencies": unresolved,
        "evidence_gaps": evidence_gaps,
        "upstream_paths": upstream_paths,
        "downstream_paths": downstream_paths,
        "upstream_count": len(direct_in),
        "downstream_count": len(direct_out),
        "indirect_upstream": len(indirect_up),
        "indirect_downstream": len(indirect_down),
        "circular": len(circular_paths) > 0,
        "circular_paths": [[comp_map.get(cid, None).name if cid in comp_map else cid for cid in p] for p in circular_paths[:5]],
        "single_point_of_dependency": single_point,
        "graph_connectivity_note": "Graph connectivity is not proof of runtime impact. These are static extraction results.",
    }
    return impact


def run_simulation(
    db: Session,
    application_id: str,
    component_id: str,
    scenario_type: str,
    input_assumptions: dict | None = None,
) -> dict | None:
    """Run a simulation for a component + scenario, persist, and return result."""
    if scenario_type not in SCENARIO_TYPES:
        return None

    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        return None

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return None

    impact = get_simulate_impact(db, application_id, component_id)
    if impact is None:
        return None

    assumptions = input_assumptions or {}
    scenario = _build_scenario_analysis(scenario_type, impact, component, assumptions)

    # Persist
    record = SimulationScenario(
        id=str(uuid.uuid4()),
        application_id=application_id,
        component_id=component_id,
        scenario_type=scenario_type,
        input_assumptions=json.dumps(assumptions),
        impact_json=json.dumps(impact),
        scenario_json=json.dumps(scenario),
    )
    db.add(record)
    db.commit()

    return {
        "simulation_id": record.id,
        "application_id": application_id,
        "component_id": component_id,
        "component_name": component.name,
        "component_type": component.component_type,
        "scenario_type": scenario_type,
        "scenario_label": SCENARIO_TYPES[scenario_type],
        "input_assumptions": assumptions,
        "impact": impact,
        "scenario": scenario,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def get_simulations(db: Session, application_id: str) -> list[dict]:
    """Get all persisted simulations for an application, newest first."""
    records = db.query(SimulationScenario).filter(
        SimulationScenario.application_id == application_id
    ).order_by(SimulationScenario.created_at.desc()).all()

    results = []
    for r in records:
        comp = db.query(Component).filter(Component.id == r.component_id).first()
        results.append({
            "simulation_id": r.id,
            "application_id": r.application_id,
            "component_id": r.component_id,
            "component_name": comp.name if comp else "unknown",
            "component_type": comp.component_type if comp else "",
            "scenario_type": r.scenario_type,
            "scenario_label": SCENARIO_TYPES.get(r.scenario_type, r.scenario_type),
            "input_assumptions": _parse_json(r.input_assumptions, {}),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return results


def get_simulation(db: Session, simulation_id: str) -> dict | None:
    """Get a single persisted simulation with full detail."""
    r = db.query(SimulationScenario).filter(SimulationScenario.id == simulation_id).first()
    if not r:
        return None
    comp = db.query(Component).filter(Component.id == r.component_id).first()
    return {
        "simulation_id": r.id,
        "application_id": r.application_id,
        "component_id": r.component_id,
        "component_name": comp.name if comp else "unknown",
        "component_type": comp.component_type if comp else "",
        "scenario_type": r.scenario_type,
        "scenario_label": SCENARIO_TYPES.get(r.scenario_type, r.scenario_type),
        "input_assumptions": _parse_json(r.input_assumptions, {}),
        "impact": _parse_json(r.impact_json, {}),
        "scenario": _parse_json(r.scenario_json, {}),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ---- Impact helpers ----

def _categorize_shared_resources(
    direct_out: list[Dependency],
    direct_in: list[Dependency],
    comp_map: dict[str, Component],
) -> list[dict]:
    """Find shared data resources (tables, files, datasets) connected to this component."""
    resource_types = {"TABLE", "FILE", "DATASET", "DATABASE"}
    seen: set[str] = set()
    resources: list[dict] = []
    for d in direct_out + direct_in:
        # Get the "other end" of this dependency relative to our component
        if d.source_component_id == d.target_component_id:
            continue
        # For outgoing deps, the other end is the target; for incoming, it's the source
        other_id = d.target_component_id
        if d in direct_in:
            other_id = d.source_component_id
        other = comp_map.get(other_id)
        if not other:
            continue
        if other.component_type in resource_types and other.id not in seen:
            seen.add(other.id)
            resources.append({
                "component_id": other.id,
                "name": other.name,
                "component_type": other.component_type,
                "technology": other.technology,
                "evidence_class": other.evidence_class,
                "relationship_type": d.relationship_type,
            })
    return resources


def _find_connected_jobs(
    component_id: str,
    all_deps: list[Dependency],
    comp_map: dict[str, Component],
    adj: dict[str, list[str]],
    reverse_adj: dict[str, list[str]],
) -> list[dict]:
    """Find batch jobs connected to this component (directly or via graph traversal)."""
    reachable = _bfs_set(component_id, adj) | _bfs_set(component_id, reverse_adj)
    jobs: list[dict] = []
    seen: set[str] = set()
    for cid in reachable | {component_id}:
        comp = comp_map.get(cid)
        if comp and comp.component_type == "JOB" and comp.id not in seen:
            seen.add(comp.id)
            jobs.append({
                "component_id": comp.id,
                "name": comp.name,
                "technology": comp.technology,
                "evidence_class": comp.evidence_class,
            })
    # Also check direct: jobs that exec this component
    for d in all_deps:
        if d.target_component_id == component_id:
            src = comp_map.get(d.source_component_id)
            if src and src.component_type == "JOB" and src.id not in seen:
                seen.add(src.id)
                jobs.append({
                    "component_id": src.id,
                    "name": src.name,
                    "technology": src.technology,
                    "evidence_class": src.evidence_class,
                })
    return jobs


def _find_database_deps(
    direct_out: list[Dependency],
    direct_in: list[Dependency],
    comp_map: dict[str, Component],
) -> list[dict]:
    """Find database/table dependencies."""
    db_types = {"TABLE", "DATABASE"}
    deps: list[dict] = []
    seen: set[str] = set()
    for d in direct_out:
        target = comp_map.get(d.target_component_id)
        if target and target.component_type in db_types and target.id not in seen:
            seen.add(target.id)
            deps.append({
                "component_id": target.id,
                "name": target.name,
                "component_type": target.component_type,
                "technology": target.technology,
                "relationship_type": d.relationship_type,
                "evidence_class": d.evidence_class,
            })
    return deps


def _find_external_interfaces(
    direct_out: list[Dependency],
    direct_in: list[Dependency],
    comp_map: dict[str, Component],
) -> list[dict]:
    """Find external system / interface dependencies."""
    ext_types = {"EXTERNAL_SYSTEM", "API", "MQ", "INTERFACE"}
    deps: list[dict] = []
    seen: set[str] = set()
    for d in direct_out:
        target = comp_map.get(d.target_component_id)
        if target and target.component_type in ext_types and target.id not in seen:
            seen.add(target.id)
            deps.append({
                "component_id": target.id,
                "name": target.name,
                "component_type": target.component_type,
                "technology": target.technology,
                "relationship_type": d.relationship_type,
                "evidence_class": d.evidence_class,
            })
    return deps


def _find_transaction_concerns(
    direct_out: list[Dependency],
    direct_in: list[Dependency],
    comp_map: dict[str, Component],
) -> list[dict]:
    """Find CICS transactions, BMS maps, IMS DL/I — potential transaction-boundary concerns."""
    concerns: list[dict] = []
    seen: set[str] = set()
    tx_rels = {REL_CICS_TRANSACTION, REL_CICS_MAP, REL_CICS_FILE, REL_IMS_DLI}
    for d in direct_out:
        if d.relationship_type in tx_rels:
            target = comp_map.get(d.target_component_id)
            if target and target.id not in seen:
                seen.add(target.id)
                concerns.append({
                    "component_id": target.id,
                    "name": target.name,
                    "component_type": target.component_type,
                    "technology": target.technology,
                    "relationship_type": d.relationship_type,
                    "evidence_class": d.evidence_class,
                    "concern": "Transaction boundary — runtime behavior must be validated",
                })
    return concerns


def _find_evidence_gaps(db: Session, application_id: str, component_id: str) -> list[dict]:
    """Find Unknown/Assumed findings linked to this component."""
    findings = db.query(Finding).filter(
        Finding.application_id == application_id,
        Finding.component_id == component_id,
        Finding.evidence_class.in_(["Unknown", "Assumed"]),
    ).all()
    gaps: list[dict] = []
    for f in findings:
        gaps.append({
            "finding_id": f.id,
            "title": f.title,
            "evidence_class": f.evidence_class,
            "detection_rule": f.detection_rule,
            "explanation": f.explanation,
            "source_filename": f.source_filename,
        })
    return gaps


def _trace_paths(
    start: str,
    adj: dict[str, list[str]],
    comp_map: dict[str, Component],
    max_paths: int = 10,
    max_depth: int = 6,
) -> list[dict]:
    """Trace paths from a component through the graph (BFS, limited)."""
    paths: list[list[str]] = []
    queue: list[tuple[str, list[str]]] = [(start, [start])]
    visited_paths: set[tuple[str, ...]] = set()

    while queue and len(paths) < max_paths:
        node, path = queue.pop(0)
        if len(path) - 1 >= max_depth:
            paths.append(path)
            continue
        neighbors = adj.get(node, [])
        if not neighbors:
            paths.append(path)
            continue
        for nb in neighbors:
            if nb in path:
                continue  # avoid cycles
            new_path = path + [nb]
            key = tuple(new_path)
            if key not in visited_paths:
                visited_paths.add(key)
                queue.append((nb, new_path))

    result: list[dict] = []
    for p in paths[:max_paths]:
        result.append({
            "path": [
                {"component_id": cid, "name": comp_map[cid].name if cid in comp_map else cid,
                 "component_type": comp_map[cid].component_type if cid in comp_map else ""}
                for cid in p
            ],
            "length": len(p) - 1,
        })
    return result


def _get_component_scores(
    db: Session, application_id: str, component: Component
) -> tuple[str, str, str]:
    """Get complexity/confidence/readiness classifications from the latest assessment."""
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id,
        AssessmentRecord.is_current == True,  # noqa: E712
    ).order_by(AssessmentRecord.computed_at.desc()).first()

    if not record:
        return "Unknown", "Unknown", "Unknown"

    try:
        data = json.loads(record.result_json)
    except (json.JSONDecodeError, TypeError):
        return "Unknown", "Unknown", "Unknown"

    # Try to find component-specific scores in fired_rules
    complexity = data.get("complexity_classification", "Unknown")
    confidence = data.get("confidence_classification", "Unknown")
    readiness = data.get("readiness_classification", "Unknown")
    return complexity, confidence, readiness


# ---- Scenario analysis ----

def _build_scenario_analysis(
    scenario_type: str,
    impact: dict,
    component: Component,
    assumptions: dict,
) -> dict:
    """Build hypothetical scenario analysis for the selected option.

    Never invents cost, time, savings or performance. All statements are
    derived from the real graph data and classified appropriately.
    """
    builder = _SCENARIO_BUILDERS.get(scenario_type, _scenario_generic)
    return builder(impact, component, assumptions)


def _common_scenario_fields(impact: dict, component: Component) -> dict:
    """Fields common to all scenarios."""
    return {
        "current_state": {
            "component_type": component.component_type,
            "technology": component.technology,
            "complexity_classification": impact["complexity_classification"],
            "confidence_classification": impact["confidence_classification"],
            "readiness_classification": impact["readiness_classification"],
            "direct_dependencies": impact["directly_impacted"],
            "upstream_count": impact["upstream_count"],
            "downstream_count": impact["downstream_count"],
            "evidence_class": impact["evidence_class"],
            "circular": impact["circular"],
            "single_point_of_dependency": impact["single_point_of_dependency"],
        },
        "disclaimer": (
            "This is a hypothetical planning scenario. Graph connectivity is not proof "
            "of runtime impact. No target platform is assumed. No cost, time, savings, "
            "or performance figures are provided."
        ),
        "evidence_classification": "Inferred",
        "evidence_classification_note": (
            "Scenario analysis is Inferred — derived from static extraction, not runtime observation."
        ),
    }


def _scenario_extract_service(impact: dict, component: Component, assumptions: dict) -> dict:
    """Scenario A: Extract to Distributed Service."""
    base = _common_scenario_fields(impact, component)

    benefits: list[str] = []
    challenges: list[str] = []
    deps_to_resolve: list[str] = []
    risk_factors: list[str] = []
    missing_evidence: list[str] = []
    prerequisites: list[str] = []
    specialist_validation: list[str] = []

    # Benefits — derived from graph facts
    if impact["indirect_downstream"] > 0:
        benefits.append(f"Potential isolation of {impact['indirect_downstream']} indirect downstream dependencies (requires runtime validation)")
    if impact["directly_impacted"] <= 3:
        benefits.append("Low direct dependency count may simplify interface extraction (Inferred)")
    if impact["circular"]:
        benefits.append("Extraction could break circular dependency if runtime confirms the cycle path")

    # Challenges — derived from graph facts
    db_deps = impact["database_dependencies"]
    if db_deps:
        challenges.append(f"{len(db_deps)} database dependency(ies) must be addressed: {', '.join(d['name'] for d in db_deps)}")
    tx_concerns = impact["possible_transaction_boundary_concerns"]
    if tx_concerns:
        challenges.append(f"{len(tx_concerns)} transaction-boundary concern(s) — CICS/IMS behavior must be replicated or bridged")
    if impact["connected_jobs"]:
        challenges.append(f"{len(impact['connected_jobs'])} connected batch job(s) — job-to-program execution model changes")
    if impact["shared_data_dependencies"]:
        challenges.append(f"{len(impact['shared_data_dependencies'])} shared data resource(s) — data access pattern must be redesigned")
    if impact["single_point_of_dependency"]:
        challenges.append("Component is a single point of dependency — extraction affects all upstream consumers")

    # Dependencies to resolve
    for d in impact["unresolved_dependencies"]:
        deps_to_resolve.append(f"Unresolved: {d['target_name']} ({d['relationship_type']})")
    for ext in impact["external_interfaces"]:
        deps_to_resolve.append(f"External interface: {ext['name']} ({ext['relationship_type']})")

    # Risk factors
    if impact["circular"]:
        risk_factors.append("Circular dependency detected — extraction order matters")
    if impact["indirect_downstream"] > 10:
        risk_factors.append(f"High blast radius: {impact['indirect_downstream']} indirect downstream components")
    if impact["evidence_class"] == "Unknown":
        risk_factors.append("Component evidence class is Unknown — source not fully available")
    if component.component_type == "PROGRAM" and component.technology == "COBOL":
        risk_factors.append("COBOL program extraction requires full semantic validation beyond static analysis")

    # Missing evidence
    for gap in impact["evidence_gaps"]:
        missing_evidence.append(f"{gap['title']} ({gap['evidence_class']})")
    if not impact["database_dependencies"] and component.component_type == "PROGRAM":
        missing_evidence.append("No database dependencies detected — confirm whether this program accesses data via indirect paths")

    # Prerequisites
    prerequisites.append("Complete runtime behavior analysis (transaction flows, batch schedules)")
    prerequisites.append("Validate all unresolved dependencies")
    if tx_concerns:
        prerequisites.append("Map CICS/IMS transaction boundaries and session semantics")
    if db_deps:
        prerequisites.append("Design data access strategy for all database dependencies")

    # Specialist validation
    specialist_validation.append("Mainframe systems programmer — verify runtime transaction boundaries")
    specialist_validation.append("Data architect — validate data access and consistency requirements")
    if impact["connected_jobs"]:
        specialist_validation.append("Batch operations specialist — validate job scheduling and execution dependencies")
    if component.technology == "COBOL":
        specialist_validation.append("COBOL analyst — validate program logic completeness")

    base.update({
        "scenario_type": "extract_service",
        "potential_benefits": benefits,
        "technical_challenges": challenges,
        "dependencies_to_resolve": deps_to_resolve,
        "risk_factors": risk_factors,
        "missing_evidence": missing_evidence,
        "prerequisites": prerequisites,
        "specialist_validation_required": specialist_validation,
    })
    return base


def _scenario_refactor_in_place(impact: dict, component: Component, assumptions: dict) -> dict:
    """Scenario B: Refactor in Place."""
    base = _common_scenario_fields(impact, component)

    benefits: list[str] = []
    challenges: list[str] = []
    deps_to_resolve: list[str] = []
    risk_factors: list[str] = []
    missing_evidence: list[str] = []
    prerequisites: list[str] = []
    specialist_validation: list[str] = []

    if impact["directly_impacted"] > 0:
        benefits.append(f"Preserves existing dependency structure — {impact['directly_impacted']} direct dependencies remain intact")
    benefits.append("No external interface contract changes required (Inferred)")
    if impact["connected_jobs"]:
        benefits.append(f"Batch job execution model unchanged for {len(impact['connected_jobs'])} connected job(s)")

    if impact["circular"]:
        challenges.append("Circular dependency must be broken as part of refactoring")
    if component.component_type == "PROGRAM" and component.technology == "COBOL":
        challenges.append("COBOL refactoring requires preserving program semantics under mainframe runtime")
    if impact["shared_data_dependencies"]:
        challenges.append(f"{len(impact['shared_data_dependencies'])} shared data resource(s) — access patterns must remain compatible")
    if impact["complexity_classification"] == "High":
        challenges.append("High complexity classification increases refactoring risk")

    for d in impact["unresolved_dependencies"]:
        deps_to_resolve.append(f"Unresolved: {d['target_name']} ({d['relationship_type']})")

    if impact["evidence_class"] == "Unknown":
        risk_factors.append("Component evidence class is Unknown — refactoring blind is high risk")
    if impact["single_point_of_dependency"]:
        risk_factors.append("Single point of dependency — refactoring errors affect all consumers")
    if impact["complexity_classification"] == "High":
        risk_factors.append("High complexity increases likelihood of introducing defects")

    for gap in impact["evidence_gaps"]:
        missing_evidence.append(f"{gap['title']} ({gap['evidence_class']})")

    prerequisites.append("Complete program logic review")
    prerequisites.append("Establish regression test baseline")
    if impact["circular"]:
        prerequisites.append("Plan circular dependency resolution")

    specialist_validation.append("COBOL developer — validate refactored logic equivalence")
    specialist_validation.append("Mainframe operations — validate runtime behavior")
    if impact["connected_jobs"]:
        specialist_validation.append("Batch operations specialist — validate job execution after refactor")

    base.update({
        "scenario_type": "refactor_in_place",
        "potential_benefits": benefits,
        "technical_challenges": challenges,
        "dependencies_to_resolve": deps_to_resolve,
        "risk_factors": risk_factors,
        "missing_evidence": missing_evidence,
        "prerequisites": prerequisites,
        "specialist_validation_required": specialist_validation,
    })
    return base


def _scenario_retain_mainframe(impact: dict, component: Component, assumptions: dict) -> dict:
    """Scenario C: Retain on Mainframe."""
    base = _common_scenario_fields(impact, component)

    benefits: list[str] = []
    challenges: list[str] = []
    deps_to_resolve: list[str] = []
    risk_factors: list[str] = []
    missing_evidence: list[str] = []
    prerequisites: list[str] = []
    specialist_validation: list[str] = []

    benefits.append("No structural change — existing dependencies and runtime behavior preserved")
    if impact["connected_jobs"]:
        benefits.append(f"All {len(impact['connected_jobs'])} batch job(s) continue to execute unchanged")
    if impact["possible_transaction_boundary_concerns"]:
        benefits.append(f"Transaction boundaries ({len(impact['possible_transaction_boundary_concerns'])}) remain under mainframe runtime")
    benefits.append("No migration risk introduced in this assessment cycle")

    if impact["complexity_classification"] == "High":
        challenges.append("High complexity remains — technical debt persists")
    if impact["circular"]:
        challenges.append("Circular dependency remains unresolved")
    if impact["evidence_class"] == "Unknown":
        challenges.append("Unknown evidence class — component is not fully understood")

    if impact["evidence_class"] == "Unknown":
        risk_factors.append("Cannot fully assess retention risk without complete source")
    if impact["single_point_of_dependency"]:
        risk_factors.append("Single point of dependency remains — no resilience improvement")

    for gap in impact["evidence_gaps"]:
        missing_evidence.append(f"{gap['title']} ({gap['evidence_class']})")

    prerequisites.append("Document retention rationale in assessment record")
    prerequisites.append("Schedule next assessment cycle to revisit")

    specialist_validation.append("Mainframe architect — validate retention decision against business drivers")
    if impact["evidence_gaps"]:
        specialist_validation.append("Assessment analyst — resolve evidence gaps before next cycle")

    base.update({
        "scenario_type": "retain_mainframe",
        "potential_benefits": benefits,
        "technical_challenges": challenges,
        "dependencies_to_resolve": deps_to_resolve,
        "risk_factors": risk_factors,
        "missing_evidence": missing_evidence,
        "prerequisites": prerequisites,
        "specialist_validation_required": specialist_validation,
    })
    return base


def _scenario_generic(impact: dict, component: Component, assumptions: dict) -> dict:
    base = _common_scenario_fields(impact, component)
    base.update({
        "scenario_type": "unknown",
        "potential_benefits": [],
        "technical_challenges": [],
        "dependencies_to_resolve": [],
        "risk_factors": [],
        "missing_evidence": [],
        "prerequisites": [],
        "specialist_validation_required": [],
    })
    return base


_SCENARIO_BUILDERS = {
    "extract_service": _scenario_extract_service,
    "refactor_in_place": _scenario_refactor_in_place,
    "retain_mainframe": _scenario_retain_mainframe,
}
