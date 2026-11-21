"""Assessment API routes: assess, get assessment, domain breakdown, rules, what-if, component assessment."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Component
from app.schemas.schemas import (
    AssessmentOut, DomainBreakdownOut, RulesOut, WhatIfRequest,
    WhatIfResponse, ComponentAssessmentOut, RuleFiringOut, DomainScoreOut,
)
from app.services import application_service, assessment_service

router = APIRouter(tags=["assessment"])


@router.post("/api/applications/{app_id}/assess")
def assess(app_id: str, db: Session = Depends(get_db)):
    """Run assessment for an application. Persists the result."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    result = assessment_service.run_assessment(db, app_id)
    if result is None:
        raise HTTPException(status_code=500, detail="Assessment computation failed")
    return result


@router.get("/api/applications/{app_id}/assessment")
def get_assessment(app_id: str, db: Session = Depends(get_db)):
    """Get the latest persisted assessment for an application."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    result = assessment_service.get_assessment(db, app_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No assessment found. Run assessment first.")
    return result


@router.get("/api/applications/{app_id}/assessment/domains")
def get_domain_breakdown(app_id: str, db: Session = Depends(get_db)):
    """Get domain-level breakdown with fired rules and evidence."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    result = assessment_service.get_domain_breakdown(db, app_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return result


@router.get("/api/assessment/rules")
def get_rules():
    """Return ruleset metadata and all rules for the Rule Studio."""
    return assessment_service.get_rules()


@router.post("/api/applications/{app_id}/assess/what-if")
def what_if(app_id: str, request: WhatIfRequest, db: Session = Depends(get_db)):
    """Run what-if analysis with temporary weight overrides. Not persisted."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    result = assessment_service.run_what_if(
        db, app_id, request.weight_overrides, request.human_reviewed
    )
    if result is None:
        raise HTTPException(status_code=500, detail="What-if computation failed")
    return result


@router.get("/api/components/{component_id}/assessment")
def get_component_assessment(component_id: str, db: Session = Depends(get_db)):
    """Get complexity assessment for a single component."""
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    result = assessment_service.get_component_assessment(db, component_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return result
