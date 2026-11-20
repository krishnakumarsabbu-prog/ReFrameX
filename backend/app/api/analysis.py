"""Analysis API routes: analyze, components, summary, reanalyze, parser-coverage."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Component
from app.schemas.schemas import (
    ComponentOut, AnalysisSummaryOut, ParserCoverageReport,
    ParserCoverageEntry, ParserInfo, AnalyzeResponse,
)
from app.services import application_service, analysis_service

router = APIRouter(tags=["analysis"])


@router.post("/api/applications/{app_id}/analyze", response_model=AnalyzeResponse)
def analyze(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    run = analysis_service.analyze_application(db, app_id)
    return AnalyzeResponse(
        run_id=run.id,
        application_id=app_id,
        artifacts_processed=run.artifacts_processed,
        components_extracted=run.components_extracted,
        warnings_count=run.warnings_count,
        duration_ms=run.duration_ms or 0,
        status=run.status,
    )


@router.post("/api/applications/{app_id}/reanalyze", response_model=AnalyzeResponse)
def reanalyze(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    run = analysis_service.analyze_application(db, app_id)
    return AnalyzeResponse(
        run_id=run.id,
        application_id=app_id,
        artifacts_processed=run.artifacts_processed,
        components_extracted=run.components_extracted,
        warnings_count=run.warnings_count,
        duration_ms=run.duration_ms or 0,
        status=run.status,
    )


@router.get("/api/applications/{app_id}/components", response_model=list[ComponentOut])
def get_components(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    components = analysis_service.get_components(db, app_id)
    result = []
    for c in components:
        result.append(_component_to_out(c))
    return result


@router.get("/api/applications/{app_id}/analysis-summary", response_model=AnalysisSummaryOut)
def get_analysis_summary(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    summary = analysis_service.get_analysis_summary(db, app_id)
    return AnalysisSummaryOut(**summary)


@router.get("/api/applications/{app_id}/parser-coverage", response_model=ParserCoverageReport)
def get_parser_coverage(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    report = analysis_service.get_parser_coverage(db, app_id)
    return ParserCoverageReport(
        total_artifacts=report["total_artifacts"],
        by_capability=report["by_capability"],
        by_parse_status=report["by_parse_status"],
        by_category=report["by_category"],
        parsers=[ParserInfo(**p) for p in report["parsers"]],
        entries=[ParserCoverageEntry(**e) for e in report["entries"]],
        unsupported_artifacts=[ParserCoverageEntry(**e) for e in report["unsupported_artifacts"]],
    )


def _component_to_out(c: Component) -> ComponentOut:
    import json
    return ComponentOut(
        id=c.id,
        application_id=c.application_id,
        name=c.name,
        component_type=c.component_type,
        technology=c.technology,
        source_artifact_id=c.source_artifact_id,
        source_filename=c.source_filename,
        line_start=c.line_start,
        line_end=c.line_end,
        detected_properties=json.loads(c.detected_properties) if c.detected_properties else {},
        evidence_class=c.evidence_class,
        evidence_refs=json.loads(c.evidence_refs) if c.evidence_refs else [],
        warnings=json.loads(c.warnings) if c.warnings else [],
        parser_name=c.parser_name,
        parser_version=c.parser_version,
    )
