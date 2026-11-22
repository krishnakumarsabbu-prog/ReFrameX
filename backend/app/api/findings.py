"""Phase 6 API routes: findings, unknowns, recommendations, roadmap, reviews."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Artifact, Finding
from app.schemas.schemas import (
    FindingOut,
    ReviewRequest,
    ReviewActionOut,
    RecommendationSummaryOut,
    RoadmapOut,
    UnknownsOut,
    ArtifactContentOut,
)
from app.services import application_service, finding_service, review_service
from app.services.artifact_service import get_artifact_content
from app.services.recommendation_service import build_recommendations
from app.services.roadmap_service import build_roadmap
from app.assessment.analysis_assistant import get_assistant

router = APIRouter(tags=["findings"])


@router.get("/api/applications/{app_id}/findings")
def list_findings(
    app_id: str,
    db: Session = Depends(get_db),
    evidence_class: str | None = Query(None),
    domain: str | None = Query(None),
    severity: str | None = Query(None),
    finding_type: str | None = Query(None),
    search: str | None = Query(None),
):
    """List findings for an application with optional filters."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Ensure findings exist — rebuild if none
    findings = finding_service.get_findings(
        db, app_id, evidence_class=evidence_class, domain=domain,
        severity=severity, finding_type=finding_type, search=search,
    )
    if not findings:
        count = finding_service.rebuild_findings(db, app_id)
        if count > 0:
            findings = finding_service.get_findings(
                db, app_id, evidence_class=evidence_class, domain=domain,
                severity=severity, finding_type=finding_type, search=search,
            )

    return [finding_service.serialize_finding(f) for f in findings]


@router.get("/api/applications/{app_id}/unknowns")
def list_unknowns(app_id: str, db: Session = Depends(get_db)):
    """List all Unknown-class findings for an application."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    unknowns = finding_service.get_unknowns(db, app_id)
    if not unknowns:
        finding_service.rebuild_findings(db, app_id)
        unknowns = finding_service.get_unknowns(db, app_id)

    items = [finding_service.serialize_finding(f) for f in unknowns]
    by_type: dict[str, int] = {}
    for item in items:
        ft = item.get("finding_type", "unknown")
        by_type[ft] = by_type.get(ft, 0) + 1

    return {"application_id": app_id, "total": len(items), "by_type": by_type, "items": items}


@router.get("/api/applications/{app_id}/recommendations")
def list_recommendations(app_id: str, db: Session = Depends(get_db)):
    """List refactoring recommendations for an application."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return build_recommendations(db, app_id)


@router.get("/api/applications/{app_id}/roadmap")
def list_roadmap(app_id: str, db: Session = Depends(get_db)):
    """List the prioritized next-analysis roadmap for an application."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return build_roadmap(db, app_id)


@router.post("/api/findings/{finding_id}/review")
def review_finding(
    finding_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db),
):
    """Add a reviewer action to a finding. Machine findings are immutable;
    reviewer changes are stored separately."""
    finding = finding_service.get_finding(db, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    try:
        review = review_service.add_review_action(
            db,
            finding_id=finding_id,
            action=request.action,
            reviewer_name=request.reviewer_name,
            reviewer_role=request.reviewer_role,
            reason=request.reason,
            notes=request.notes,
            context=request.context,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": review.id,
        "finding_id": review.finding_id,
        "action": review.action,
        "reviewer_name": review.reviewer_name,
        "reviewer_role": review.reviewer_role,
        "reason": review.reason,
        "notes": review.notes,
        "context": review.context,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


@router.get("/api/artifacts/{artifact_id}/content")
def get_artifact_content_with_highlights(
    artifact_id: str,
    db: Session = Depends(get_db),
    finding_id: str | None = Query(None),
):
    """Get artifact content with optional highlight ranges from a finding.

    If finding_id is provided, the response includes highlight_ranges for the
    lines referenced by that finding. Never fabricates source locations; if no
    line reference exists, highlight_ranges is empty.
    """
    result = get_artifact_content(db, artifact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Artifact not found")
    artifact, data = result
    is_text = not artifact.detected_encoding.startswith("binary")
    content = None
    if is_text:
        if "cp037" in artifact.detected_encoding or "EBCDIC" in artifact.detected_encoding:
            try:
                content = data.decode("cp037", errors="replace")
            except Exception:
                content = None
        else:
            try:
                content = data.decode("utf-8")
            except UnicodeDecodeError:
                content = data.decode("latin-1", errors="replace")

    highlight_ranges: list[dict] = []
    if finding_id:
        finding = finding_service.get_finding(db, finding_id)
        if finding and finding.has_line_ref and finding.source_artifact_id == artifact_id:
            highlight_ranges.append({
                "line_start": finding.line_start,
                "line_end": finding.line_end,
                "rule": finding.detection_rule,
                "finding_id": finding.id,
                "evidence_class": finding.evidence_class,
                "explanation": finding.explanation,
            })

    return {
        "id": artifact.id,
        "original_filename": artifact.original_filename,
        "relative_path": artifact.relative_path,
        "category": artifact.category,
        "size_bytes": artifact.size_bytes,
        "encoding": artifact.detected_encoding,
        "content": content,
        "is_text": is_text,
        "highlight_ranges": highlight_ranges,
    }


@router.get("/api/assessment/ai-assistant/status")
def ai_assistant_status():
    """Return the status of the optional AI assistant. Always disabled by default."""
    assistant = get_assistant()
    return {
        "enabled": assistant.is_enabled(),
        "allowlist": assistant.get_allowlist(),
        "default": "NoOp (disabled)",
        "note": "AI assistance is an optional extension point. The default product is fully deterministic with zero outbound network calls.",
    }
