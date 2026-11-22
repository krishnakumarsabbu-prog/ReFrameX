"""API Router for Evidence Metrics: Static Analysis + LLM Analysis + Comparison."""

from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services.evidence_metrics_service import (
    get_full_evidence_metrics,
    get_drilldown_items,
)

router = APIRouter(prefix="/api/applications", tags=["evidence-metrics"])


@router.get("/{app_id}/evidence-metrics")
def get_evidence_metrics(
    app_id: str,
    db: Session = Depends(get_db),
):
    """Get comprehensive side-by-side evidence metrics (Static + LLM + Comparison)."""
    try:
        metrics = get_full_evidence_metrics(db, app_id)
        return metrics
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute evidence metrics: {e}")


@router.get("/{app_id}/evidence-metrics/export")
def export_evidence_metrics(
    app_id: str,
    db: Session = Depends(get_db),
):
    """Export full evidence metrics as downloadable JSON."""
    try:
        metrics = get_full_evidence_metrics(db, app_id)
        content = json.dumps(metrics, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=evidence-metrics-{app_id}.json",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export evidence metrics: {e}")


@router.get("/{app_id}/evidence-metrics/drilldown")
def get_evidence_metrics_drilldown(
    app_id: str,
    metric_type: str = Query(..., description="Metric key to drill into: severity, domain, evidence_class, lacking_line_refs, etc."),
    category: str | None = Query(None, description="Category filter (e.g., HIGH, application_business_logic, etc.)"),
    db: Session = Depends(get_db),
):
    """Retrieve the exact items behind a clicked metric."""
    try:
        items = get_drilldown_items(db, app_id, metric_type, category)
        return {"metric_type": metric_type, "category": category, "total": len(items), "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drilldown failed: {e}")
