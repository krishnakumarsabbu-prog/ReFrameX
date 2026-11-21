"""Assessment service — orchestrates scoring engine, persists results."""

from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.assessment.scoring_engine import (
    load_ruleset,
    get_ruleset_info,
    compute_assessment,
    compute_component_assessment,
    serialize_assessment,
    serialize_domain_breakdown,
)
from app.models.models import AssessmentRecord


def run_assessment(
    db: Session,
    application_id: str,
    human_reviewed: bool = False,
) -> dict:
    """Run assessment, persist result, return serialized dict."""
    ruleset = load_ruleset()
    result = compute_assessment(db, application_id, ruleset=ruleset, human_reviewed=human_reviewed)
    if result is None:
        return None

    serialized = serialize_assessment(result)

    # Persist: delete existing, insert new
    db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).delete()
    db.flush()

    record = AssessmentRecord(
        id=serialized["application_id"] + "-" + serialized["computed_at"].replace(":", "").replace("-", "").split(".")[0],
        application_id=application_id,
        model_version=result.model_version,
        ruleset_id=result.ruleset_id,
        ruleset_version=result.ruleset_version,
        complexity_score=result.complexity_score,
        complexity_classification=result.complexity_classification,
        confidence_score=result.confidence_score,
        confidence_classification=result.confidence_classification,
        readiness_score=result.readiness_score,
        readiness_classification=result.readiness_classification,
        duration_ms=result.duration_ms,
        result_json=json.dumps(serialized),
        human_reviewed=human_reviewed,
    )
    db.add(record)
    db.commit()

    return serialized


def get_assessment(db: Session, application_id: str) -> dict | None:
    """Get the latest persisted assessment for an application."""
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).order_by(AssessmentRecord.computed_at.desc()).first()

    if not record:
        return None

    try:
        return json.loads(record.result_json)
    except (json.JSONDecodeError, TypeError):
        return None


def get_domain_breakdown(db: Session, application_id: str) -> dict | None:
    """Get domain-level breakdown. Recomputes from current evidence for fresh results."""
    ruleset = load_ruleset()
    result = compute_assessment(db, application_id, ruleset=ruleset)
    if result is None:
        return None
    return serialize_domain_breakdown(result)


def get_rules() -> dict:
    """Return ruleset info and all rules for the Rule Studio."""
    ruleset = load_ruleset()
    info = get_ruleset_info(ruleset)
    rules = []
    for r in ruleset["rules"]:
        rules.append({
            "rule_id": r["rule_id"],
            "domain": r["domain"],
            "measure": r["measure"],
            "description": r["description"],
            "detection_condition": r["detection_condition"],
            "weight": r["weight"],
            "impact": r["impact"],
            "severity": r["severity"],
            "evidence_requirement": r["evidence_requirement"],
            "explanation": r["explanation"],
            "recommendation": r.get("recommendation"),
            "upgrade_guidance": r.get("upgrade_guidance"),
        })
    return {"ruleset_info": info, "rules": rules}


def run_what_if(
    db: Session,
    application_id: str,
    weight_overrides: dict[str, float],
    human_reviewed: bool = False,
) -> dict:
    """Run what-if analysis with temporary weight overrides. Does not persist."""
    ruleset = load_ruleset()

    # Compute before (with default weights)
    before_result = compute_assessment(db, application_id, ruleset=ruleset)
    if before_result is None:
        return None
    before = serialize_assessment(before_result)

    # Compute after (with overrides)
    after_result = compute_assessment(
        db, application_id, ruleset=ruleset,
        weight_overrides=weight_overrides,
        human_reviewed=human_reviewed,
    )
    after = serialize_assessment(after_result)

    return {
        "before": before,
        "after": after,
        "weight_overrides": weight_overrides,
        "human_reviewed": human_reviewed,
    }


def get_component_assessment(db: Session, component_id: str) -> dict | None:
    """Get complexity assessment for a single component."""
    return compute_component_assessment(db, component_id)
