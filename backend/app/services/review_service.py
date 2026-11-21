"""Review service — reviewer actions on findings.

Machine findings are immutable. Reviewer actions are stored separately with
timestamp and reviewer name. The latest review action determines the current
reviewer-adjusted status. Confirmed findings update the 'human validation'
confidence factor on the next reassessment.

Reviewer roles (simple, local): Viewer and Reviewer. No heavy auth.
- Viewer: can add notes and context.
- Reviewer: can confirm, reject, mark for investigation, add context, add notes.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import Finding, ReviewAction


VALID_ACTIONS = {"confirm", "reject", "investigate", "add_context", "add_note"}

REVIEWER_PRIVILEGES = {
    "confirm": {"Reviewer"},
    "reject": {"Reviewer"},
    "investigate": {"Reviewer"},
    "add_context": {"Viewer", "Reviewer"},
    "add_note": {"Viewer", "Reviewer"},
}


def add_review_action(
    db: Session,
    finding_id: str,
    action: str,
    reviewer_name: str,
    reviewer_role: str,
    reason: str | None = None,
    notes: str | None = None,
    context: str | None = None,
) -> ReviewAction:
    """Add a reviewer action to a finding.

    Validates the action and role privilege. Does NOT mutate the finding itself
    (machine findings are immutable). Returns the created ReviewAction.

    Raises ValueError for invalid action or insufficient privileges.
    """
    if action not in VALID_ACTIONS:
        raise ValueError(f"Invalid action '{action}'. Must be one of: {VALID_ACTIONS}")

    allowed_roles = REVIEWER_PRIVILEGES.get(action, set())
    if reviewer_role not in allowed_roles:
        raise ValueError(
            f"Role '{reviewer_role}' cannot perform action '{action}'. "
            f"Required role: {allowed_roles}"
        )

    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise ValueError("Finding not found")

    review = ReviewAction(
        id=str(uuid.uuid4()),
        finding_id=finding_id,
        action=action,
        reviewer_name=reviewer_name,
        reviewer_role=reviewer_role,
        reason=reason,
        notes=notes,
        context=context,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_review_actions(db: Session, finding_id: str) -> list[ReviewAction]:
    """Get all review actions for a finding, ordered by time."""
    return db.query(ReviewAction).filter(
        ReviewAction.finding_id == finding_id
    ).order_by(ReviewAction.created_at.asc()).all()


def get_confirmed_findings_count(db: Session, application_id: str) -> int:
    """Count findings that have been confirmed by a reviewer.

    Used to determine the human validation confidence factor.
    """
    findings = db.query(Finding).filter(
        Finding.application_id == application_id
    ).all()
    count = 0
    for f in findings:
        actions = db.query(ReviewAction).filter(
            ReviewAction.finding_id == f.id
        ).order_by(ReviewAction.created_at.desc()).all()
        if actions and actions[0].action == "confirm":
            count += 1
    return count


def get_reviewer_status(db: Session, finding_id: str) -> dict:
    """Get the latest reviewer-adjusted status for a finding."""
    actions = db.query(ReviewAction).filter(
        ReviewAction.finding_id == finding_id
    ).order_by(ReviewAction.created_at.desc()).all()

    if not actions:
        return {"reviewer_status": None, "reviewer_notes": None, "reviewer_name": None}

    latest = actions[0]
    return {
        "reviewer_status": latest.action,
        "reviewer_notes": latest.notes,
        "reviewer_name": latest.reviewer_name,
        "reviewed_at": latest.created_at.isoformat() if latest.created_at else None,
    }
