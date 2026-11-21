"""Application comparison service — compares two assessed applications.

Compares: component counts, artifact coverage, technology distribution,
dependency counts, domain complexity, overall complexity, confidence,
readiness, risk distribution, missing evidence, next steps.

If model or ruleset versions differ, a prominent warning is produced
instead of silently comparing incompatible results.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import (
    Application,
    Artifact,
    Component,
    Dependency,
    AssessmentRecord,
    Finding,
)
from app.assessment.scoring_engine import DOMAIN_LABELS


def _parse_json(val: str | None, default: Any) -> Any:
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _get_current_assessment(db: Session, application_id: str) -> AssessmentRecord | None:
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id,
        AssessmentRecord.is_current == True,  # noqa: E712
    ).order_by(AssessmentRecord.computed_at.desc()).first()
    if not record:
        record = db.query(AssessmentRecord).filter(
            AssessmentRecord.application_id == application_id
        ).order_by(AssessmentRecord.computed_at.desc()).first()
    return record


def _build_app_summary(db: Session, app: Application) -> dict:
    """Build a comparison summary for one application."""
    artifacts = db.query(Artifact).filter(Artifact.application_id == app.id).all()
    components = db.query(Component).filter(Component.application_id == app.id).all()
    dependencies = db.query(Dependency).filter(Dependency.application_id == app.id).all()
    findings = db.query(Finding).filter(Finding.application_id == app.id).all()
    record = _get_current_assessment(db, app.id)

    assessment = json.loads(record.result_json) if record else {}

    # Component counts by type
    comp_by_type: dict[str, int] = {}
    comp_by_tech: dict[str, int] = {}
    for c in components:
        comp_by_type[c.component_type] = comp_by_type.get(c.component_type, 0) + 1
        comp_by_tech[c.technology] = comp_by_tech.get(c.technology, 0) + 1

    # Artifact coverage
    artifact_by_category: dict[str, int] = {}
    for a in artifacts:
        artifact_by_category[a.category] = artifact_by_category.get(a.category, 0) + 1

    # Dependency counts
    dep_by_type: dict[str, int] = {}
    dep_unresolved = 0
    for d in dependencies:
        dep_by_type[d.relationship_type] = dep_by_type.get(d.relationship_type, 0) + 1
        if d.evidence_class == "Unknown":
            dep_unresolved += 1

    # Risk distribution
    risk_by_severity: dict[str, int] = {}
    risk_by_evidence: dict[str, int] = {}
    for f in findings:
        risk_by_severity[f.severity] = risk_by_severity.get(f.severity, 0) + 1
        risk_by_evidence[f.evidence_class] = risk_by_evidence.get(f.evidence_class, 0) + 1

    # Missing evidence
    unknown_findings = [f for f in findings if f.evidence_class == "Unknown"]
    missing_by_type: dict[str, int] = {}
    for f in unknown_findings:
        missing_by_type[f.finding_type] = missing_by_type.get(f.finding_type, 0) + 1

    # Domain complexity
    domain_complexity: dict[str, Any] = {}
    domain_scores = assessment.get("domain_scores", {})
    for domain in DOMAIN_LABELS:
        scores = domain_scores.get(domain, {})
        domain_complexity[domain] = {
            "label": DOMAIN_LABELS[domain],
            "complexity_score": scores.get("complexity", {}).get("score") if isinstance(scores.get("complexity"), dict) else None,
            "confidence_score": scores.get("confidence", {}).get("score") if isinstance(scores.get("confidence"), dict) else None,
            "readiness_score": scores.get("readiness", {}).get("score") if isinstance(scores.get("readiness"), dict) else None,
            "has_evidence": scores.get("complexity", {}).get("has_evidence", False) if isinstance(scores.get("complexity"), dict) else False,
        }

    return {
        "application_id": app.id,
        "application_name": app.name,
        "description": app.description,
        "business_domain": app.business_domain,
        "has_assessment": record is not None,
        "model_version": assessment.get("model_version", ""),
        "ruleset_id": assessment.get("ruleset_id", ""),
        "ruleset_version": assessment.get("ruleset_version", ""),
        "complexity_score": assessment.get("complexity_score"),
        "complexity_classification": assessment.get("complexity_classification", "Not assessed"),
        "confidence_score": assessment.get("confidence_score"),
        "confidence_classification": assessment.get("confidence_classification", "Not assessed"),
        "readiness_score": assessment.get("readiness_score"),
        "readiness_classification": assessment.get("readiness_classification", "Not assessed"),
        "artifact_count": len(artifacts),
        "artifact_by_category": artifact_by_category,
        "component_count": len(components),
        "component_by_type": comp_by_type,
        "component_by_technology": comp_by_tech,
        "dependency_count": len(dependencies),
        "dependency_by_type": dep_by_type,
        "dependency_unresolved": dep_unresolved,
        "finding_count": len(findings),
        "risk_by_severity": risk_by_severity,
        "risk_by_evidence_class": risk_by_evidence,
        "missing_evidence_count": len(unknown_findings),
        "missing_evidence_by_type": missing_by_type,
        "domain_complexity": domain_complexity,
        "recommended_next_steps": assessment.get("recommended_next_steps", []),
        "computed_at": record.computed_at.isoformat() if record and record.computed_at else None,
    }


def compare_applications(db: Session, app_id_a: str, app_id_b: str) -> dict | None:
    """Compare two applications. Returns None if either application is not found."""
    app_a = db.query(Application).filter(Application.id == app_id_a).first()
    app_b = db.query(Application).filter(Application.id == app_id_b).first()

    if not app_a or not app_b:
        return None

    summary_a = _build_app_summary(db, app_a)
    summary_b = _build_app_summary(db, app_b)

    # Version compatibility check
    version_warning = None
    if summary_a["has_assessment"] and summary_b["has_assessment"]:
        if summary_a["model_version"] != summary_b["model_version"]:
            version_warning = {
                "type": "model_version_mismatch",
                "message": f"Model versions differ: '{summary_a['application_name']}' uses {summary_a['model_version']}, '{summary_b['application_name']}' uses {summary_b['model_version']}. Comparison may not be valid.",
                "app_a_model_version": summary_a["model_version"],
                "app_b_model_version": summary_b["model_version"],
            }
        elif summary_a["ruleset_id"] != summary_b["ruleset_id"] or summary_a["ruleset_version"] != summary_b["ruleset_version"]:
            version_warning = {
                "type": "ruleset_version_mismatch",
                "message": f"Ruleset versions differ: '{summary_a['application_name']}' uses {summary_a['ruleset_id']} v{summary_a['ruleset_version']}, '{summary_b['application_name']}' uses {summary_b['ruleset_id']} v{summary_b['ruleset_version']}. Domain weights and rules may differ.",
                "app_a_ruleset": f"{summary_a['ruleset_id']} v{summary_a['ruleset_version']}",
                "app_b_ruleset": f"{summary_b['ruleset_id']} v{summary_b['ruleset_version']}",
            }
    elif summary_a["has_assessment"] != summary_b["has_assessment"]:
        missing_app = summary_b["application_name"] if summary_a["has_assessment"] else summary_a["application_name"]
        version_warning = {
            "type": "missing_assessment",
            "message": f"Application '{missing_app}' has no assessment. Comparison will be incomplete.",
        }

    # Build comparison deltas
    deltas = _build_deltas(summary_a, summary_b)

    return {
        "application_a": summary_a,
        "application_b": summary_b,
        "version_warning": version_warning,
        "deltas": deltas,
        "comparison_note": "Scores are relative within each application and computed independently. Cross-application score differences reflect different evidence, not a shared scale.",
    }


def _build_deltas(a: dict, b: dict) -> dict:
    """Compute deltas between two application summaries."""
    def _safe_delta(a_val, b_val):
        if a_val is None and b_val is None:
            return None
        if a_val is None or b_val is None:
            return None
        return round(b_val - a_val, 1)

    # Domain complexity deltas
    domain_deltas: dict[str, dict] = {}
    for domain in DOMAIN_LABELS:
        da = a["domain_complexity"].get(domain, {})
        db = b["domain_complexity"].get(domain, {})
        domain_deltas[domain] = {
            "label": DOMAIN_LABELS[domain],
            "complexity_delta": _safe_delta(da.get("complexity_score"), db.get("complexity_score")),
            "confidence_delta": _safe_delta(da.get("confidence_score"), db.get("confidence_score")),
            "readiness_delta": _safe_delta(da.get("readiness_score"), db.get("readiness_score")),
        }

    return {
        "artifact_count_delta": b["artifact_count"] - a["artifact_count"],
        "component_count_delta": b["component_count"] - a["component_count"],
        "dependency_count_delta": b["dependency_count"] - a["dependency_count"],
        "finding_count_delta": b["finding_count"] - a["finding_count"],
        "missing_evidence_delta": b["missing_evidence_count"] - a["missing_evidence_count"],
        "complexity_score_delta": _safe_delta(a["complexity_score"], b["complexity_score"]),
        "confidence_score_delta": _safe_delta(a["confidence_score"], b["confidence_score"]),
        "readiness_score_delta": _safe_delta(a["readiness_score"], b["readiness_score"]),
        "domain_deltas": domain_deltas,
    }
