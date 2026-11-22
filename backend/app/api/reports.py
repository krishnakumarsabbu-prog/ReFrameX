"""Phase 7 API routes: executive reports, application comparison, assessment history, export."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services import application_service, assessment_service
from app.services.report_service import build_report
from app.services.comparison_service import compare_applications
from app.api.html_report_generator import build_modern_html_report
from app.api.pdf_report_generator import (
    PdfRenderFailed,
    PdfRendererUnavailable,
    pdf_filename,
    render_pdf,
)

router = APIRouter(tags=["reports"])


@router.get("/api/applications/{app_id}/report")
def get_report(app_id: str, db: Session = Depends(get_db)):
    """Generate a complete executive assessment report from stored results."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    report = build_report(db, app_id)
    if report is None:
        raise HTTPException(status_code=500, detail="Report generation failed")
    return report


@router.get("/api/applications/compare")
def compare(
    app_a: str = Query(..., description="First application ID"),
    app_b: str = Query(..., description="Second application ID"),
    db: Session = Depends(get_db),
):
    """Compare two assessed applications. Computed, not hardcoded."""
    result = compare_applications(db, app_a, app_b)
    if result is None:
        raise HTTPException(status_code=404, detail="One or both applications not found")
    return result


@router.get("/api/applications/{app_id}/assessment-history")
def get_assessment_history(app_id: str, db: Session = Depends(get_db)):
    """Get all assessment records for an application, ordered newest first."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return assessment_service.get_assessment_history(db, app_id)


@router.get("/api/applications/{app_id}/export")
def export(
    app_id: str,
    format: str = Query("json", description="Export format: json, html, or pdf"),
    db: Session = Depends(get_db),
):
    """Export a full assessment report as downloadable JSON, modern interactive HTML, or printable executive PDF."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    report = build_report(db, app_id)
    if report is None:
        raise HTTPException(status_code=500, detail="Report generation failed")

    app_name = app.name.replace(" ", "_").replace("/", "-")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "pdf":
        try:
            pdf_bytes = render_pdf(report)
        except PdfRendererUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PdfRenderFailed as exc:
            raise HTTPException(status_code=500, detail=f"PDF rendering failed: {exc}") from exc
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{pdf_filename(app.name, timestamp)}"'
            },
        )

    if format == "html":
        html = build_modern_html_report(report)
        return Response(
            content=html,
            media_type="text/html",
            headers={
                "Content-Disposition": f'attachment; filename="reframex_report_{app_name}_{timestamp}.html"'
            },
        )

    # Default: JSON
    json_str = json.dumps(report, indent=2, default=str)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="reframex_report_{app_name}_{timestamp}.json"'
        },
    )


def _build_printable_html(report: dict, auto_print: bool = False) -> str:
    """Build a self-contained modern HTML report (backward compatibility)."""
    return build_modern_html_report(report, auto_print=auto_print)

