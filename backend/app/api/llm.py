"""REST API routes for the LLM Evaluation Layer (B7)."""

from __future__ import annotations

import json
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.llm.evaluator import (
    preview_evaluation_payload,
    execute_evaluation,
    review_evaluation,
)
from app.llm.metrics import compute_llm_metrics
from app.llm.registry import get_llm_provider
from app.models.models import LLMEvaluation

router = APIRouter(prefix="/api/llm", tags=["LLM Evaluation Layer"])


class LLMStatusOut(BaseModel):
    enabled: bool
    provider: str
    base_url: str
    model: str
    allowed_hosts: list[str]
    send_mode: str
    redact: bool
    timeout_seconds: float


class LLMTestRequest(BaseModel):
    provider: str | None = None


class PreviewRequest(BaseModel):
    task_type: Literal["T1", "T2", "T3"]
    target_id: str
    send_mode: str | None = None
    redact: bool | None = None


class EvaluateRequest(BaseModel):
    task_type: Literal["T1", "T2", "T3"]
    target_id: str
    provider_override: str | None = None
    send_mode: str | None = None
    redact: bool | None = None


class ReviewRequest(BaseModel):
    action: Literal["accept", "dismiss"]
    reviewer_notes: str | None = None


class BatchEvaluateRequest(BaseModel):
    application_id: str
    task_type: Literal["T1", "T2", "T3"] = "T1"
    provider_override: str | None = None
    limit: int = 50
    force_refresh: bool = False


@router.get("/status", response_model=LLMStatusOut)
def get_llm_status():
    """Get current LLM Evaluation Layer configuration and status."""
    return {
        "enabled": settings.llm_enabled,
        "provider": settings.llm_provider,
        "base_url": settings.llm_base_url,
        "model": settings.llm_model,
        "allowed_hosts": list(settings.llm_allowed_hosts),
        "send_mode": settings.llm_send_mode,
        "redact": settings.llm_redact,
        "timeout_seconds": settings.llm_timeout_seconds,
    }


@router.post("/test")
def test_llm_connection(req: LLMTestRequest = LLMTestRequest()):
    """Test LLM provider connectivity and measure latency."""
    try:
        provider = get_llm_provider(force_provider=req.provider, allow_disabled_mock=True)
        res = provider.ping()
        return res
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }


@router.post("/preview")
def preview_payload(req: PreviewRequest, db: Session = Depends(get_db)):
    """Consent Preview Gate: preview exact redacted prompt without calling LLM."""
    try:
        preview = preview_evaluation_payload(
            db=db,
            task_type=req.task_type,
            target_id=req.target_id,
            send_mode=req.send_mode,
            redact=req.redact,
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {e}")


@router.post("/evaluate")
def run_evaluation(req: EvaluateRequest, db: Session = Depends(get_db)):
    """Execute LLM evaluation for a finding, component, or recommendation."""
    try:
        result = execute_evaluation(
            db=db,
            task_type=req.task_type,
            target_id=req.target_id,
            provider_override=req.provider_override,
            send_mode=req.send_mode,
            redact=req.redact,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")


@router.post("/evaluate-batch")
def run_batch_evaluation(req: BatchEvaluateRequest, db: Session = Depends(get_db)):
    """Execute LLM evaluation for findings or components of an application in batch.
    
    Guarantees that a Hackathon Evaluator can run dual analysis across all findings
    with 1 click instead of clicking every finding manually.
    """
    from app.models.models import Finding, Component, LLMEvaluation

    provider_to_use = req.provider_override
    if not provider_to_use and not settings.llm_enabled:
        provider_to_use = "mock"

    if req.task_type == "T1":
        findings_query = db.query(Finding).filter(Finding.application_id == req.application_id)
        if not req.force_refresh:
            existing_evals = db.query(LLMEvaluation.target_id).filter(
                LLMEvaluation.application_id == req.application_id,
                LLMEvaluation.task_type == "T1",
            ).all()
            evaluated_ids = {e[0] for e in existing_evals}
            findings = [f for f in findings_query.all() if f.id not in evaluated_ids]
        else:
            findings = findings_query.all()
        target_ids = [f.id for f in findings[:req.limit]]

    elif req.task_type == "T2":
        components = db.query(Component).filter(Component.application_id == req.application_id).all()
        target_ids = [c.id for c in components[:req.limit]]
    else:
        components = db.query(Component).filter(Component.application_id == req.application_id).all()
        target_ids = [c.id for c in components[:req.limit]]

    results = []
    errors = []
    for tid in target_ids:
        try:
            res = execute_evaluation(
                db=db,
                task_type=req.task_type,
                target_id=tid,
                provider_override=provider_to_use,
            )
            results.append(res)
        except Exception as e:
            errors.append(f"{tid}: {str(e)}")
            continue

    return {
        "application_id": req.application_id,
        "task_type": req.task_type,
        "processed": len(results),
        "errors_count": len(errors),
        "evaluations": results,
    }


@router.get("/evaluations/{application_id}")
def list_evaluations(
    application_id: str,
    target_id: str | None = Query(None),
    task_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """List stored LLM evaluations for an application."""
    query = db.query(LLMEvaluation).filter(LLMEvaluation.application_id == application_id)
    if target_id:
        query = query.filter(LLMEvaluation.target_id == target_id)
    if task_type:
        query = query.filter(LLMEvaluation.task_type == task_type)

    records = query.order_by(LLMEvaluation.created_at.desc()).all()
    out = []
    for r in records:
        try:
            resp = json.loads(r.response_json)
        except Exception:
            resp = {}
        out.append({
            "id": r.id,
            "application_id": r.application_id,
            "task_type": r.task_type,
            "target_id": r.target_id,
            "target_type": r.target_type,
            "prompt_hash": r.prompt_hash,
            "model_id": r.model_id,
            "provider": r.provider,
            "send_mode": r.send_mode,
            "status": r.status,
            "review_status": r.review_status,
            "reviewer_notes": r.reviewer_notes,
            "response": resp,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        })
    return out


@router.post("/review/{evaluation_id}")
def submit_review(
    evaluation_id: str,
    req: ReviewRequest,
    db: Session = Depends(get_db),
):
    """Accept or dismiss an AI suggestion."""
    try:
        return review_evaluation(
            db=db,
            evaluation_id=evaluation_id,
            action=req.action,
            reviewer_notes=req.reviewer_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/metrics/{application_id}")
def get_metrics(application_id: str, db: Session = Depends(get_db)):
    """Get evaluation harness accuracy, agreement, and validity metrics."""
    return compute_llm_metrics(db, application_id)
