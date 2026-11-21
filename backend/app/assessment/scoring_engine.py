"""Phase 5 — Explainable Assessment & Scoring Engine.

Deterministic, configurable, evidence-driven. Computes three independent measures
(Migration Complexity, Assessment Confidence, Migration Readiness) across eight
official domains using an external JSON ruleset.

Guarantees:
- Complexity, confidence and readiness computed independently — never merged.
- Missing evidence is never counted as simplicity.
- Absence of a detected risk does not mean absence of the risk — shown as 'not evidenced'.
- Unsupported artifacts lower confidence.
- No random, hardcoded or AI-generated scores. Every point traces to a rule + evidence.
"""

from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

try:
    import jsonschema
    _HAS_JSONSCHEMA = True
except ImportError:
    _HAS_JSONSCHEMA = False

from app.models.models import Application, Artifact, Component, Dependency, AnalysisRun


# ---- Constants ----

MODEL_VERSION = "reframex-scoring-v1"
RULESET_DIR = Path(__file__).resolve().parent / "rulesets"
DEFAULT_RULESET_FILE = RULESET_DIR / "default_ruleset_v1.json"
SCHEMA_FILE = Path(__file__).resolve().parent / "ruleset_schema.json"

DOMAINS = [
    "application_business_logic",
    "data_structures",
    "database_persistence",
    "jobs_batch_orchestration",
    "online_transactions_ui",
    "integration_external_dependencies",
    "security_controls",
    "operational_nonfunctional",
]

DOMAIN_LABELS = {
    "application_business_logic": "Application & Business Logic",
    "data_structures": "Data Structures",
    "database_persistence": "Database & Persistence",
    "jobs_batch_orchestration": "Jobs, Batch & Orchestration",
    "online_transactions_ui": "Online Transactions & UI",
    "integration_external_dependencies": "Integration & External Dependencies",
    "security_controls": "Security & Controls",
    "operational_nonfunctional": "Operational & Nonfunctional",
}

MEASURES = ["complexity", "confidence", "readiness"]

CLASSIFICATION = {
    "complexity": {0: "Low", 1: "Medium", 2: "High"},
    "confidence": {0: "Low", 1: "Medium", 2: "High"},
    "readiness": {0: "Not Ready", 1: "Partially Ready", 2: "Ready for Detailed Planning"},
}


# ---- Data structures ----

@dataclass
class RuleFiring:
    """A single rule that fired with its contributing evidence."""
    rule_id: str
    domain: str
    measure: str
    description: str
    weight: float
    impact: str
    severity: str
    explanation: str
    recommendation: str | None
    upgrade_guidance: str | None
    evidence_refs: list[dict] = field(default_factory=list)
    points: float = 0.0


@dataclass
class DomainResult:
    """Per-domain per-measure result."""
    domain: str
    measure: str
    raw_score: float
    normalized_score: float
    fired_rules: list[RuleFiring] = field(default_factory=list)
    positive_factors: list[str] = field(default_factory=list)
    negative_factors: list[str] = field(default_factory=list)
    evidence_refs: list[dict] = field(default_factory=list)
    has_evidence: bool = True
    not_evidenced_notes: list[str] = field(default_factory=list)


@dataclass
class AssessmentResult:
    """Complete assessment result for an application."""
    application_id: str
    model_version: str
    ruleset_id: str
    ruleset_version: str
    computed_at: str
    complexity_score: float
    complexity_classification: str
    confidence_score: float
    confidence_classification: str
    readiness_score: float
    readiness_classification: str
    domain_scores: dict[str, dict[str, float]]
    domain_results: dict[str, dict[str, DomainResult]]
    fired_rules: list[RuleFiring]
    positive_factors: list[str]
    negative_factors: list[str]
    missing_information: list[str]
    assessment_limitations: list[str]
    recommended_next_steps: list[str]
    evidence_refs: list[dict]
    duration_ms: int


# ---- Ruleset loading & validation ----

def load_ruleset(filepath: Path | None = None) -> dict:
    """Load and validate a ruleset JSON file. Raises ValueError on malformed rules."""
    path = filepath or DEFAULT_RULESET_FILE
    if not path.exists():
        raise ValueError(f"Ruleset file not found: {path}")
    with open(path) as f:
        ruleset = json.load(f)

    # Validate with JSON schema if available
    if _HAS_JSONSCHEMA and SCHEMA_FILE.exists():
        with open(SCHEMA_FILE) as sf:
            schema = json.load(sf)
        try:
            jsonschema.validate(instance=ruleset, schema=schema)
        except jsonschema.ValidationError as e:
            raise ValueError(f"Ruleset validation failed: {e.message} (at path: {'/'.join(str(p) for p in e.absolute_path)})") from e
    else:
        _manual_validate_ruleset(ruleset)

    # Check domain weights sum to ~1.0
    weights = ruleset.get("domain_weights", {})
    total = sum(weights.get(d, 0) for d in DOMAINS)
    if abs(total - 1.0) > 0.05:
        raise ValueError(f"Domain weights must sum to ~1.0, got {total:.4f}")

    # Check for duplicate rule IDs
    rule_ids = [r["rule_id"] for r in ruleset["rules"]]
    seen = set()
    dupes = [rid for rid in rule_ids if rid in seen or seen.add(rid)]
    if dupes:
        raise ValueError(f"Duplicate rule IDs: {dupes}")

    return ruleset


def _manual_validate_ruleset(ruleset: dict) -> None:
    """Fallback validation when jsonschema is not installed."""
    required_top = ["ruleset_id", "version", "effective_date", "owner", "domain_weights", "thresholds", "rules"]
    for key in required_top:
        if key not in ruleset:
            raise ValueError(f"Ruleset missing required field: {key}")
    if not ruleset["rules"]:
        raise ValueError("Ruleset must contain at least one rule")
    for d in DOMAINS:
        if d not in ruleset["domain_weights"]:
            raise ValueError(f"Domain weights missing: {d}")
    for r in ruleset["rules"]:
        for key in ["rule_id", "domain", "measure", "description", "detection_condition",
                     "weight", "impact", "severity", "evidence_requirement", "explanation"]:
            if key not in r:
                raise ValueError(f"Rule {r.get('rule_id','?')} missing required field: {key}")
        if r["domain"] not in DOMAINS:
            raise ValueError(f"Rule {r['rule_id']} has invalid domain: {r['domain']}")
        if r["measure"] not in MEASURES:
            raise ValueError(f"Rule {r['rule_id']} has invalid measure: {r['measure']}")
        if r["impact"] not in ("positive", "negative"):
            raise ValueError(f"Rule {r['rule_id']} has invalid impact: {r['impact']}")


def get_ruleset_info(ruleset: dict) -> dict:
    """Return ruleset metadata for API exposure."""
    return {
        "ruleset_id": ruleset["ruleset_id"],
        "version": ruleset["version"],
        "effective_date": ruleset["effective_date"],
        "owner": ruleset["owner"],
        "changelog": ruleset.get("changelog", []),
        "domain_weights": ruleset["domain_weights"],
        "thresholds": ruleset["thresholds"],
        "model_version": MODEL_VERSION,
        "rule_count": len(ruleset["rules"]),
    }


# ---- Evidence collection ----

@dataclass
class EvidenceBundle:
    """All evidence collected for an application, used for rule evaluation."""
    application: Application
    artifacts: list[Artifact] = field(default_factory=list)
    components: list[Component] = field(default_factory=list)
    dependencies: list[Dependency] = field(default_factory=list)
    dependency_summary: dict = field(default_factory=dict)
    graph_stats: dict = field(default_factory=dict)
    # Pre-computed indexes
    components_by_type: dict[str, list[Component]] = field(default_factory=dict)
    artifacts_by_category: dict[str, list[Artifact]] = field(default_factory=dict)
    copybook_components_unknown: list[Component] = field(default_factory=list)
    unresolved_dependencies: int = 0
    has_jcl: bool = False
    has_ddl: bool = False
    has_bms: bool = False
    has_cobol: bool = False
    has_assembler: bool = False
    has_security_components: bool = False
    has_embedded_sql: bool = False


def collect_evidence(db: Session, application_id: str) -> EvidenceBundle | None:
    """Collect all evidence from the database for an application."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return None

    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()
    components = db.query(Component).filter(Component.application_id == application_id).all()
    dependencies = db.query(Dependency).filter(Dependency.application_id == application_id).all()

    # Build indexes
    by_type: dict[str, list[Component]] = {}
    for c in components:
        by_type.setdefault(c.component_type, []).append(c)

    by_category: dict[str, list[Artifact]] = {}
    for a in artifacts:
        by_category.setdefault(a.category, []).append(a)

    # Compute dependency stats
    unresolved = sum(1 for d in dependencies if d.evidence_class == "Unknown")
    by_rel: dict[str, int] = {}
    for d in dependencies:
        by_rel[d.relationship_type] = by_rel.get(d.relationship_type, 0) + 1

    # Graph stats
    from collections import defaultdict
    adj: dict[str, list[str]] = defaultdict(list)
    reverse_adj: dict[str, list[str]] = defaultdict(list)
    for d in dependencies:
        adj[d.source_component_id].append(d.target_component_id)
        reverse_adj[d.target_component_id].append(d.source_component_id)

    circular_count = _count_circular_nodes(adj)
    single_points = _count_single_points(adj, reverse_adj)

    # Detect what we have
    categories_set = {a.category for a in artifacts}
    has_jcl = bool(by_category.get("JCL"))
    has_ddl = bool(by_category.get("SQL_DDL"))
    has_bms = bool(by_category.get("BMS_MAP"))
    has_cobol = bool(by_category.get("COBOL"))
    has_assembler = bool(by_category.get("ASSEMBLER"))
    has_embedded_sql = any(c.component_type == "TABLE" and c.technology == "SQL" for c in components)
    has_security = any(c.component_type == "SECURITY_RESOURCE" for c in components)

    # Missing copybooks
    unknown_copybooks = [c for c in components if c.component_type == "COPYBOOK" and c.evidence_class == "Unknown"]

    return EvidenceBundle(
        application=app,
        artifacts=artifacts,
        components=components,
        dependencies=dependencies,
        dependency_summary={
            "total_dependencies": len(dependencies),
            "by_relationship_type": by_rel,
            "unresolved_targets": unresolved,
        },
        graph_stats={
            "total_nodes": len(set(c.id for c in components)),
            "total_edges": len(dependencies),
            "circular_count": circular_count,
            "single_points": single_points,
        },
        components_by_type=by_type,
        artifacts_by_category=by_category,
        copybook_components_unknown=unknown_copybooks,
        unresolved_dependencies=unresolved,
        has_jcl=has_jcl,
        has_ddl=has_ddl,
        has_bms=has_bms,
        has_cobol=has_cobol,
        has_assembler=has_assembler,
        has_security_components=has_security,
        has_embedded_sql=has_embedded_sql,
    )


def _count_circular_nodes(adj: dict[str, list[str]]) -> int:
    """Count nodes participating in circular dependencies."""
    count = 0
    for node in adj:
        if _has_cycle_from(node, node, adj, set(), 10):
            count += 1
    return count


def _has_cycle_from(start: str, current: str, adj: dict[str, list[str]], visited: set, max_depth: int) -> bool:
    if max_depth <= 0:
        return False
    for neighbor in adj.get(current, []):
        if neighbor == start:
            return True
        if neighbor not in visited:
            visited.add(neighbor)
            if _has_cycle_from(start, neighbor, adj, visited, max_depth - 1):
                return True
            visited.discard(neighbor)
    return False


def _count_single_points(adj: dict[str, list[str]], reverse_adj: dict[str, list[str]]) -> int:
    """Approximate single-point-of-dependency count."""
    count = 0
    for node in adj:
        downstream = _bfs_set(node, adj)
        upstream = _bfs_set(node, reverse_adj)
        if not downstream or not upstream:
            continue
        is_sp = True
        for up_node in upstream:
            for neighbor in adj.get(up_node, []):
                if neighbor == node:
                    continue
                if neighbor in downstream:
                    is_sp = False
                    break
            if not is_sp:
                break
        if is_sp:
            count += 1
    return count


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


# ---- Rule evaluation ----

def _parse_json_safe(val: str | None, default: Any) -> Any:
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _component_evidence_refs(component: Component) -> list[dict]:
    refs = _parse_json_safe(component.evidence_refs, [])
    if not isinstance(refs, list):
        return []
    return refs


def _component_props(component: Component) -> dict[str, str]:
    return _parse_json_safe(component.detected_properties, {})


def _artifact_props(artifact: Artifact) -> dict[str, str]:
    """Extract artifact-level properties for condition evaluation."""
    return {
        "category": artifact.category,
        "support_level": artifact.support_level,
        "parse_status": artifact.parse_status,
        "extension": artifact.extension or "",
        "original_filename": artifact.original_filename,
    }


def _evaluate_condition(condition: str, context: dict) -> bool:
    """Evaluate a detection condition string against a context dict.

    Conditions are simple expressions using 'and', 'or', '==', '!=',
    'in', 'contains', 'present', 'not present', '>=', '<=', '>', '<'.
    """
    try:
        cond = condition

        # Handle 'X not present' and 'not X present'
        cond = re.sub(r"(\w+(?:\.\w+)*)\s+not\s+present", r'(not _present("\1", ctx))', cond)
        cond = re.sub(r"not\s+(\w+(?:\.\w+)*)\s+present", r'(not _present("\1", ctx))', cond)
        # Handle 'X present' (after 'not' variants are handled)
        cond = re.sub(r"(\w+(?:\.\w+)*)\s+present", r'_present("\1", ctx)', cond)

        # Handle 'X contains Y'
        cond = re.sub(
            r"(\w+(?:\.\w+)*)\s+contains\s+(\"[^\"]*\"|'[^']*')",
            r'_contains("\1", \2, ctx)',
            cond,
        )

        # Protect quoted strings before replacing identifiers
        placeholders: dict[str, str] = {}
        def _protect_string(m):
            key = f"__STR{len(placeholders)}__"
            placeholders[key] = m.group(0)
            return key

        cond = re.sub(r"'[^']*'|\"[^\"]*\"", _protect_string, cond)

        # Replace identifiers (including dotted refs) with _lookup calls
        def _replace_ref(m):
            ref = m.group(0)
            if ref in ("and", "or", "not", "in", "True", "False", "None", "ctx"):
                return ref
            if ref.startswith("__STR"):
                return ref
            if ref.startswith("_"):
                return ref
            return f'_lookup("{ref}", ctx)'

        cond = re.sub(r"\b[a-z_][a-z0-9_.]*\b", _replace_ref, cond)

        # Restore quoted strings
        for key, val in placeholders.items():
            cond = cond.replace(key, val)

        local_vars = {
            "_lookup": _eval_lookup,
            "_present": _eval_present,
            "_contains": _eval_contains,
            "ctx": context,
        }
        result = eval(cond, {"__builtins__": {}}, local_vars)  # noqa: S307
        return bool(result)
    except Exception:
        return False


def _eval_lookup(ref: str, ctx: dict) -> Any:
    """Look up a dotted reference in the context."""
    # First try direct key (handles keys like "component.evidence_class")
    if ref in ctx:
        return ctx[ref]
    # Then try nested traversal
    parts = ref.split(".")
    val = ctx
    for part in parts:
        if isinstance(val, dict):
            val = val.get(part, None)
        else:
            val = getattr(val, part, None)
        if val is None:
            return None
    return val


def _eval_present(ref: str, ctx: dict) -> bool:
    # First try direct key lookup (handles keys like "application.owner")
    if ref in ctx:
        val = ctx[ref]
    else:
        val = _eval_lookup(ref, ctx)
    if val is None:
        return False
    if isinstance(val, str) and val.strip() == "":
        return False
    if isinstance(val, (list, dict)) and len(val) == 0:
        return False
    return True


def _eval_contains(ref: str, search: str, ctx: dict) -> bool:
    val = _eval_lookup(ref, ctx)
    if val is None:
        return False
    search_str = str(search).strip("'\"")
    return search_str.lower() in str(val).lower()


def _build_component_context(component: Component, artifact: Artifact | None) -> dict:
    """Build evaluation context for a single component."""
    props = _component_props(component)
    ctx = {
        "component_type": component.component_type,
        "component_type": component.component_type,
        "technology": component.technology,
        "name": component.name,
        "evidence_class": component.evidence_class,
        "component.evidence_class": component.evidence_class,
        "source_filename": component.source_filename,
        "detected_properties": props,
        "line_start": component.line_start,
        "line_end": component.line_end,
    }
    # Flatten detected_properties for direct access
    for k, v in props.items():
        ctx[f"detected_properties.{k}"] = v

    if artifact:
        ctx["artifact_category"] = artifact.category
        ctx["artifact.category"] = artifact.category
        ctx["artifact"] = {
            "category": artifact.category,
            "support_level": artifact.support_level,
            "parse_status": artifact.parse_status,
        }
        ctx["artifact.support_level"] = artifact.support_level
        ctx["artifact.parse_status"] = artifact.parse_status

    return ctx


def _build_artifact_context(artifact: Artifact) -> dict:
    """Build evaluation context for an artifact-level rule."""
    return {
        "artifact_category": artifact.category,
        "artifact.category": artifact.category,
        "artifact": {
            "category": artifact.category,
            "support_level": artifact.support_level,
            "parse_status": artifact.parse_status,
            "original_filename": artifact.original_filename,
        },
        "artifact.support_level": artifact.support_level,
        "artifact.parse_status": artifact.parse_status,
    }


def _build_application_context(evidence: EvidenceBundle) -> dict:
    """Build application-level context for rules that check application-wide conditions."""
    app = evidence.application
    return {
        "application": {
            "owner": app.owner,
            "business_domain": app.business_domain,
            "technology_stack": app.technology_stack,
            "name": app.name,
            "description": app.description,
        },
        "application.owner": app.owner,
        "application.business_domain": app.business_domain,
        "application.technology_stack": app.technology_stack,
        "dependency_graph": {
            "total_edges": evidence.graph_stats.get("total_edges", 0),
            "circular_count": evidence.graph_stats.get("circular_count", 0),
            "single_points": evidence.graph_stats.get("single_points", 0),
        },
        "dependency_graph.circular_count": evidence.graph_stats.get("circular_count", 0),
        "dependency_graph.single_points": evidence.graph_stats.get("single_points", 0),
        "dependency_graph.total_edges": evidence.graph_stats.get("total_edges", 0),
        "dependency_summary": {
            "unresolved_targets": evidence.unresolved_dependencies,
            "total_dependencies": evidence.dependency_summary.get("total_dependencies", 0),
        },
        "dependency_summary.unresolved_targets": evidence.unresolved_dependencies,
    }


# ---- Scoring computation ----

def evaluate_rules(
    ruleset: dict,
    evidence: EvidenceBundle,
    weight_overrides: dict[str, float] | None = None,
) -> dict[str, dict[str, DomainResult]]:
    """Evaluate all rules against the evidence bundle.

    Returns a nested dict: domain_results[domain][measure] = DomainResult
    """
    overrides = weight_overrides or {}
    rules = ruleset["rules"]

    # Build artifact lookup map
    artifact_map = {a.id: a for a in evidence.artifacts}

    # Initialize domain results for all 8 domains x 3 measures
    domain_results: dict[str, dict[str, DomainResult]] = {}
    for domain in DOMAINS:
        domain_results[domain] = {}
        for measure in MEASURES:
            domain_results[domain][measure] = DomainResult(
                domain=domain,
                measure=measure,
                raw_score=0.0,
                normalized_score=0.0,
            )

    # Track which domains have evidence per measure
    domain_has_evidence: dict[str, set[str]] = {d: set() for d in DOMAINS}

    # Application-level context (computed once)
    app_ctx = _build_application_context(evidence)

    for rule in rules:
        domain = rule["domain"]
        measure = rule["measure"]
        rule_id = rule["rule_id"]
        weight = overrides.get(rule_id, rule["weight"])

        firings: list[RuleFiring] = []
        dr = domain_results[domain][measure]

        # Determine evaluation scope based on condition
        condition = rule["detection_condition"]

        # Component-level rules
        if "component_type" in condition or "detected_properties" in condition or "component.evidence_class" in condition:
            for comp in evidence.components:
                artifact = artifact_map.get(comp.source_artifact_id)
                ctx = _build_component_context(comp, artifact)
                ctx.update(app_ctx)
                if _evaluate_condition(condition, ctx):
                    firing = RuleFiring(
                        rule_id=rule_id,
                        domain=domain,
                        measure=measure,
                        description=rule["description"],
                        weight=weight,
                        impact=rule["impact"],
                        severity=rule["severity"],
                        explanation=rule["explanation"],
                        recommendation=rule.get("recommendation"),
                        upgrade_guidance=rule.get("upgrade_guidance"),
                        evidence_refs=_component_evidence_refs(comp),
                        points=weight,
                    )
                    firings.append(firing)
                    domain_has_evidence[domain].add(measure)

        # Artifact-level rules (check if condition references artifact_ or artifact.)
        elif "artifact_category" in condition or "artifact." in condition or "artifact " in condition:
            for artifact in evidence.artifacts:
                ctx = _build_artifact_context(artifact)
                ctx.update(app_ctx)
                if _evaluate_condition(condition, ctx):
                    firing = RuleFiring(
                        rule_id=rule_id,
                        domain=domain,
                        measure=measure,
                        description=rule["description"],
                        weight=weight,
                        impact=rule["impact"],
                        severity=rule["severity"],
                        explanation=rule["explanation"],
                        recommendation=rule.get("recommendation"),
                        upgrade_guidance=rule.get("upgrade_guidance"),
                        evidence_refs=[{
                            "artifact_id": artifact.id,
                            "line_start": 0,
                            "line_end": 0,
                            "rule": rule_id,
                            "snippet": f"Artifact: {artifact.original_filename} ({artifact.category})",
                        }],
                        points=weight,
                    )
                    firings.append(firing)
                    domain_has_evidence[domain].add(measure)

        # Dependency-level rules
        elif "dependency" in condition:
            for dep in evidence.dependencies:
                ctx = {
                    "dependency.evidence_class": dep.evidence_class,
                    "dependency.relationship_type": dep.relationship_type,
                }
                ctx.update(app_ctx)
                if _evaluate_condition(condition, ctx):
                    ev = _parse_json_safe(dep.evidence_ref, {})
                    firing = RuleFiring(
                        rule_id=rule_id,
                        domain=domain,
                        measure=measure,
                        description=rule["description"],
                        weight=weight,
                        impact=rule["impact"],
                        severity=rule["severity"],
                        explanation=rule["explanation"],
                        recommendation=rule.get("recommendation"),
                        upgrade_guidance=rule.get("upgrade_guidance"),
                        evidence_refs=[ev] if ev else [],
                        points=weight,
                    )
                    firings.append(firing)
                    domain_has_evidence[domain].add(measure)

        # Application-level / graph-level / absence rules
        else:
            ctx = dict(app_ctx)
            ctx["has_jcl"] = evidence.has_jcl
            ctx["has_ddl"] = evidence.has_ddl
            ctx["has_bms"] = evidence.has_bms
            ctx["has_cobol"] = evidence.has_cobol
            ctx["has_embedded_sql"] = evidence.has_embedded_sql
            ctx["has_security_components"] = evidence.has_security_components
            ctx["no_unknown_copybooks"] = len(evidence.copybook_components_unknown) == 0
            ctx["embedded_SQL_detected_but_no_DDL"] = evidence.has_embedded_sql and not evidence.has_ddl

            if _evaluate_condition(condition, ctx):
                firing = RuleFiring(
                    rule_id=rule_id,
                    domain=domain,
                    measure=measure,
                    description=rule["description"],
                    weight=weight,
                    impact=rule["impact"],
                    severity=rule["severity"],
                    explanation=rule["explanation"],
                    recommendation=rule.get("recommendation"),
                    upgrade_guidance=rule.get("upgrade_guidance"),
                    evidence_refs=[],
                    points=weight,
                )
                firings.append(firing)
                domain_has_evidence[domain].add(measure)

        # Accumulate firings into domain result
        for firing in firings:
            dr.fired_rules.append(firing)
            if firing.impact == "negative":
                dr.raw_score += firing.points
                dr.negative_factors.append(f"{firing.rule_id}: {firing.description}")
            else:
                # Positive impact: for complexity, positive reduces; for confidence/readiness, positive adds
                if measure == "complexity":
                    dr.raw_score -= firing.points
                else:
                    dr.raw_score += firing.points
                dr.positive_factors.append(f"{firing.rule_id}: {firing.description}")

            # Collect evidence refs
            for ref in firing.evidence_refs:
                dr.evidence_refs.append(ref)

    # Mark domains with no evidence
    for domain in DOMAINS:
        for measure in MEASURES:
            dr = domain_results[domain][measure]
            dr.has_evidence = measure in domain_has_evidence.get(domain, set())

    return domain_results


def normalize_domain_scores(
    domain_results: dict[str, dict[str, DomainResult]],
    ruleset: dict,
) -> None:
    """Normalize raw domain scores to 0-100 and classify."""
    thresholds = ruleset["thresholds"]

    for domain in DOMAINS:
        for measure in MEASURES:
            dr = domain_results[domain][measure]

            if not dr.has_evidence:
                dr.normalized_score = 0.0
                dr.not_evidenced_notes.append("Not assessed: no evidence for this domain and measure")
                continue

            raw = dr.raw_score

            if measure == "complexity":
                # Complexity: higher raw = more complex. Normalize using a soft cap.
                # Use a sigmoid-like normalization: score = 100 * (raw / (raw + K))
                # where K is a scaling constant. K=20 gives reasonable distribution.
                K = 20.0
                if raw <= 0:
                    # No negative factors — low complexity, but only if evidence exists
                    normalized = max(0.0, 10.0 + raw)  # Small positive baseline from positive factors
                else:
                    normalized = 100.0 * (raw / (raw + K))
                dr.normalized_score = max(0.0, min(100.0, normalized))

            elif measure == "confidence":
                # Confidence: starts at 50, positive factors add, negative subtract, clamp 0-100
                normalized = 50.0 + raw
                dr.normalized_score = max(0.0, min(100.0, normalized))

            elif measure == "readiness":
                # Readiness: starts at 50, positive factors add, negative subtract, clamp 0-100
                normalized = 50.0 + raw
                dr.normalized_score = max(0.0, min(100.0, normalized))


def aggregate_scores(
    domain_results: dict[str, dict[str, DomainResult]],
    ruleset: dict,
) -> dict[str, float]:
    """Aggregate domain scores into overall scores using domain weights.

    Only domains with evidence contribute. Weights are renormalized over
    domains that have evidence.
    """
    domain_weights = ruleset["domain_weights"]
    scores: dict[str, float] = {}

    for measure in MEASURES:
        weighted_sum = 0.0
        weight_total = 0.0
        for domain in DOMAINS:
            dr = domain_results[domain][measure]
            if not dr.has_evidence:
                continue
            w = domain_weights[domain]
            weighted_sum += dr.normalized_score * w
            weight_total += w

        if weight_total > 0:
            scores[measure] = max(0.0, min(100.0, weighted_sum / weight_total))
        else:
            scores[measure] = 0.0

    return scores


def classify_score(score: float, measure: str, thresholds: dict) -> str:
    """Classify a score into a category based on thresholds."""
    thresh = thresholds[measure]
    low = thresh["low"]
    medium = thresh["medium"]

    # For complexity and confidence: low score = low, medium = medium, high = high
    # For readiness: low score = Not Ready, medium = Partially, high = Ready
    if score < low:
        return CLASSIFICATION[measure][0]
    elif score < medium:
        return CLASSIFICATION[measure][1]
    else:
        return CLASSIFICATION[measure][2]


def compute_assessment(
    db: Session,
    application_id: str,
    ruleset: dict | None = None,
    weight_overrides: dict[str, float] | None = None,
    human_reviewed: bool = False,
) -> AssessmentResult | None:
    """Full assessment computation for an application.

    Returns None if application not found.
    """
    start = time.perf_counter()

    if ruleset is None:
        ruleset = load_ruleset()

    evidence = collect_evidence(db, application_id)
    if evidence is None:
        return None

    # Evaluate rules
    domain_results = evaluate_rules(ruleset, evidence, weight_overrides)

    # If human reviewed, fire the human-reviewed positive confidence rule
    if human_reviewed:
        dr = domain_results["application_business_logic"]["confidence"]
        firing = RuleFiring(
            rule_id="CF-ALL-001",
            domain="application_business_logic",
            measure="confidence",
            description="Human-validated findings increase confidence",
            weight=5,
            impact="positive",
            severity="info",
            explanation="Human review of machine-generated findings increases the reliability of assessment conclusions.",
            recommendation=None,
            upgrade_guidance=None,
            evidence_refs=[],
            points=5,
        )
        dr.fired_rules.append(firing)
        dr.raw_score += 5
        dr.positive_factors.append("CF-ALL-001: Human-validated findings increase confidence")
        dr.has_evidence = True

    # Normalize
    normalize_domain_scores(domain_results, ruleset)

    # Aggregate
    scores = aggregate_scores(domain_results, ruleset)

    # Classify
    thresholds = ruleset["thresholds"]
    complexity_class = classify_score(scores["complexity"], "complexity", thresholds)
    confidence_class = classify_score(scores["confidence"], "confidence", thresholds)
    readiness_class = classify_score(scores["readiness"], "readiness", thresholds)

    # Build domain score dict
    domain_scores: dict[str, dict[str, float]] = {}
    for domain in DOMAINS:
        domain_scores[domain] = {}
        for measure in MEASURES:
            dr = domain_results[domain][measure]
            domain_scores[domain][measure] = round(dr.normalized_score, 1) if dr.has_evidence else None

    # Collect all fired rules
    all_fired: list[RuleFiring] = []
    all_positive: list[str] = []
    all_negative: list[str] = []
    all_evidence: list[dict] = []
    missing_info: list[str] = []
    limitations: list[str] = []

    for domain in DOMAINS:
        for measure in MEASURES:
            dr = domain_results[domain][measure]
            for fr in dr.fired_rules:
                all_fired.append(fr)
            all_positive.extend(dr.positive_factors)
            all_negative.extend(dr.negative_factors)
            all_evidence.extend(dr.evidence_refs)
            if not dr.has_evidence:
                missing_info.append(f"{DOMAIN_LABELS[domain]} / {measure}: Not assessed — no evidence found")
                if measure == "complexity":
                    limitations.append(f"Absence of detected complexity in {DOMAIN_LABELS[domain]} does not mean absence of risk — it means no evidence was available")

    # Unsupported artifacts → limitations
    unsupported = [a for a in evidence.artifacts if a.support_level == "UNSUPPORTED" or a.parse_status in ("unsupported", "error")]
    for ua in unsupported:
        missing_info.append(f"Unsupported artifact: {ua.original_filename} ({ua.category}) — contents not analyzed")
        limitations.append(f"Artifact {ua.original_filename} could not be fully parsed — its contents are not reflected in the assessment")

    # Missing copybooks
    for mc in evidence.copybook_components_unknown:
        missing_info.append(f"Missing copybook: {mc.name} — referenced in code but source not available")

    # Missing JCL
    if not evidence.has_jcl:
        missing_info.append("No JCL artifacts found — batch orchestration not assessed")
        limitations.append("Absence of JCL does not mean there is no batch processing — it means no JCL was provided for analysis")

    # Missing DDL with embedded SQL
    if evidence.has_embedded_sql and not evidence.has_ddl:
        missing_info.append("Embedded SQL detected but no DDL artifacts provided — database schema not fully understood")

    # Missing security
    if not evidence.has_security_components:
        missing_info.append("No security resource components detected — security controls not assessed")
        limitations.append("Absence of security evidence does not mean the application has no security — it means none was provided for analysis")

    # Recommended next steps
    next_steps: list[str] = []
    if evidence.copybook_components_unknown:
        next_steps.append("Upload all missing copybook files referenced in COBOL programs")
    if not evidence.has_jcl:
        next_steps.append("Provide JCL artifacts to enable batch orchestration assessment")
    if evidence.has_embedded_sql and not evidence.has_ddl:
        next_steps.append("Provide DDL scripts for all referenced databases")
    if unsupported:
        next_steps.append("Review unsupported artifacts manually or provide alternative formats")
    if evidence.unresolved_dependencies > 0:
        next_steps.append(f"Resolve {evidence.unresolved_dependencies} unresolved dependency target(s) by uploading missing source")
    if not evidence.has_security_components:
        next_steps.append("Provide security configuration and access control documentation")
    if not evidence.application.owner:
        next_steps.append("Assign an application owner for migration planning")
    if not next_steps:
        next_steps.append("Conduct human review of machine-generated findings before proceeding to detailed migration planning")
        next_steps.append("Review the assessment with stakeholders and confirm readiness for detailed planning")

    elapsed = int((time.perf_counter() - start) * 1000)

    return AssessmentResult(
        application_id=application_id,
        model_version=MODEL_VERSION,
        ruleset_id=ruleset["ruleset_id"],
        ruleset_version=ruleset["version"],
        computed_at=datetime.now(timezone.utc).isoformat(),
        complexity_score=round(scores["complexity"], 1),
        complexity_classification=complexity_class,
        confidence_score=round(scores["confidence"], 1),
        confidence_classification=confidence_class,
        readiness_score=round(scores["readiness"], 1),
        readiness_classification=readiness_class,
        domain_scores=domain_scores,
        domain_results=domain_results,
        fired_rules=all_fired,
        positive_factors=all_positive,
        negative_factors=all_negative,
        missing_information=missing_info,
        assessment_limitations=limitations,
        recommended_next_steps=next_steps,
        evidence_refs=all_evidence,
        duration_ms=elapsed,
    )


def compute_component_assessment(
    db: Session,
    component_id: str,
    ruleset: dict | None = None,
) -> dict | None:
    """Compute complexity assessment for a single component."""
    if ruleset is None:
        ruleset = load_ruleset()

    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        return None

    artifact = db.query(Artifact).filter(Artifact.id == component.source_artifact_id).first()
    props = _component_props(component)
    ev_refs = _component_evidence_refs(component)

    # Evaluate complexity rules against this single component
    complexity_rules = [r for r in ruleset["rules"] if r["measure"] == "complexity"]
    fired: list[dict] = []
    raw_score = 0.0

    ctx = _build_component_context(component, artifact)

    for rule in complexity_rules:
        condition = rule["detection_condition"]
        # Only evaluate component-level conditions
        if "component_type" not in condition and "detected_properties" not in condition:
            continue
        if _evaluate_condition(condition, ctx):
            fired.append({
                "rule_id": rule["rule_id"],
                "domain": rule["domain"],
                "description": rule["description"],
                "weight": rule["weight"],
                "impact": rule["impact"],
                "severity": rule["severity"],
                "explanation": rule["explanation"],
                "recommendation": rule.get("recommendation"),
                "upgrade_guidance": rule.get("upgrade_guidance"),
                "evidence_refs": ev_refs,
            })
            if rule["impact"] == "negative":
                raw_score += rule["weight"]
            else:
                raw_score -= rule["weight"]

    K = 20.0
    if raw_score <= 0:
        normalized = max(0.0, 10.0 + raw_score)
    else:
        normalized = 100.0 * (raw_score / (raw_score + K))
    normalized = max(0.0, min(100.0, normalized))

    thresholds = ruleset["thresholds"]
    classification = classify_score(normalized, "complexity", thresholds)

    return {
        "component_id": component_id,
        "component_name": component.name,
        "component_type": component.component_type,
        "technology": component.technology,
        "complexity_score": round(normalized, 1),
        "complexity_classification": classification,
        "raw_score": round(raw_score, 1),
        "fired_rules": fired,
        "evidence_refs": ev_refs,
        "model_version": MODEL_VERSION,
        "ruleset_version": ruleset["version"],
    }


def serialize_assessment(result: AssessmentResult) -> dict:
    """Serialize an AssessmentResult to a JSON-safe dict for API responses."""
    domain_scores_out: dict[str, dict] = {}
    for domain in DOMAINS:
        domain_scores_out[domain] = {}
        for measure in MEASURES:
            dr = result.domain_results[domain][measure]
            domain_scores_out[domain][measure] = {
                "score": round(dr.normalized_score, 1) if dr.has_evidence else None,
                "classification": classify_score(dr.normalized_score, measure, _get_thresholds(result)) if dr.has_evidence else "Not assessed",
                "has_evidence": dr.has_evidence,
                "fired_rule_count": len(dr.fired_rules),
                "positive_factors": dr.positive_factors,
                "negative_factors": dr.negative_factors,
                "not_evidenced_notes": dr.not_evidenced_notes,
            }

    fired_rules_out = []
    for fr in result.fired_rules:
        fired_rules_out.append({
            "rule_id": fr.rule_id,
            "domain": fr.domain,
            "measure": fr.measure,
            "description": fr.description,
            "weight": fr.weight,
            "impact": fr.impact,
            "severity": fr.severity,
            "explanation": fr.explanation,
            "recommendation": fr.recommendation,
            "upgrade_guidance": fr.upgrade_guidance,
            "evidence_refs": fr.evidence_refs,
            "points": fr.points,
        })

    return {
        "application_id": result.application_id,
        "model_version": result.model_version,
        "ruleset_id": result.ruleset_id,
        "ruleset_version": result.ruleset_version,
        "computed_at": result.computed_at,
        "complexity_score": result.complexity_score,
        "complexity_classification": result.complexity_classification,
        "confidence_score": result.confidence_score,
        "confidence_classification": result.confidence_classification,
        "readiness_score": result.readiness_score,
        "readiness_classification": result.readiness_classification,
        "domain_scores": domain_scores_out,
        "fired_rules": fired_rules_out,
        "positive_factors": result.positive_factors,
        "negative_factors": result.negative_factors,
        "missing_information": result.missing_information,
        "assessment_limitations": result.assessment_limitations,
        "recommended_next_steps": result.recommended_next_steps,
        "evidence_refs": result.evidence_refs,
        "duration_ms": result.duration_ms,
    }


def _get_thresholds(result: AssessmentResult) -> dict:
    """Get thresholds from the ruleset used for this result. We re-load since
    thresholds aren't stored in AssessmentResult directly."""
    ruleset = load_ruleset()
    return ruleset["thresholds"]


def serialize_domain_breakdown(result: AssessmentResult) -> dict:
    """Serialize domain-level breakdown for the domains API endpoint."""
    out: dict[str, dict] = {}
    for domain in DOMAINS:
        out[domain] = {
            "label": DOMAIN_LABELS[domain],
            "scores": {},
        }
        for measure in MEASURES:
            dr = result.domain_results[domain][measure]
            out[domain]["scores"][measure] = {
                "score": round(dr.normalized_score, 1) if dr.has_evidence else None,
                "classification": classify_score(
                    dr.normalized_score, measure, _get_thresholds(result)
                ) if dr.has_evidence else "Not assessed",
                "has_evidence": dr.has_evidence,
                "fired_rules": [
                    {
                        "rule_id": fr.rule_id,
                        "description": fr.description,
                        "weight": fr.weight,
                        "impact": fr.impact,
                        "severity": fr.severity,
                        "explanation": fr.explanation,
                        "recommendation": fr.recommendation,
                        "upgrade_guidance": fr.upgrade_guidance,
                        "evidence_refs": fr.evidence_refs,
                    }
                    for fr in dr.fired_rules
                ],
                "positive_factors": dr.positive_factors,
                "negative_factors": dr.negative_factors,
                "evidence_refs": dr.evidence_refs,
                "not_evidenced_notes": dr.not_evidenced_notes,
            }
    return out
