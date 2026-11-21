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
    """Run assessment, persist result as a new versioned record, return serialized dict.

    Previous assessment records are marked is_current=False (not deleted) so the
    full history is preserved for before/after comparison.
    """
    ruleset = load_ruleset()
    result = compute_assessment(db, application_id, ruleset=ruleset, human_reviewed=human_reviewed)
    if result is None:
        return None

    serialized = serialize_assessment(result)

    # Mark all prior records as non-current
    db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id,
        AssessmentRecord.is_current == True,  # noqa: E712
    ).update({"is_current": False})

    # Determine next version number
    max_version = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).count()
    next_version = max_version + 1

    import uuid as _uuid
    record = AssessmentRecord(
        id=str(_uuid.uuid4()),
        application_id=application_id,
        version=next_version,
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
        is_current=True,
    )
    db.add(record)
    db.commit()

    return serialized


def get_assessment(db: Session, application_id: str) -> dict | None:
    """Get the latest persisted assessment for an application."""
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id,
        AssessmentRecord.is_current == True,  # noqa: E712
    ).order_by(AssessmentRecord.computed_at.desc()).first()

    if not record:
        # Fallback for legacy records without is_current
        record = db.query(AssessmentRecord).filter(
            AssessmentRecord.application_id == application_id
        ).order_by(AssessmentRecord.computed_at.desc()).first()

    if not record:
        return None

    try:
        return json.loads(record.result_json)
    except (json.JSONDecodeError, TypeError):
        return None


def get_assessment_history(db: Session, application_id: str) -> list[dict]:
    """Get all assessment records for an application, ordered newest first."""
    records = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).order_by(AssessmentRecord.computed_at.desc()).all()

    history = []
    for r in records:
        try:
            result = json.loads(r.result_json)
        except (json.JSONDecodeError, TypeError):
            result = {}
        history.append({
            "id": r.id,
            "version": r.version,
            "application_id": r.application_id,
            "model_version": r.model_version,
            "ruleset_id": r.ruleset_id,
            "ruleset_version": r.ruleset_version,
            "complexity_score": r.complexity_score,
            "complexity_classification": r.complexity_classification,
            "confidence_score": r.confidence_score,
            "confidence_classification": r.confidence_classification,
            "readiness_score": r.readiness_score,
            "readiness_classification": r.readiness_classification,
            "computed_at": r.computed_at.isoformat() if r.computed_at else None,
            "duration_ms": r.duration_ms,
            "human_reviewed": r.human_reviewed,
            "is_current": r.is_current,
            "result": result,
        })
    return history


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
