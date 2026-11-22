"""Evaluation execution, preview payloads, and database storage (B4, B5)."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import (
    Application,
    Artifact,
    Component,
    Finding,
    LLMEvaluation,
)
from app.llm.redaction import redact_text
from app.llm.schemas import (
    T1FindingReviewResponse,
    T2ComponentReviewResponse,
    T3RecommendationCritiqueResponse,
    validate_citations,
)
from app.llm.registry import get_llm_provider
from app.services.recommendation_service import build_recommendations

PROMPT_DIR = Path(__file__).resolve().parent / "prompts"


def _read_prompt(filename: str) -> str:
    path = PROMPT_DIR / filename
    return path.read_text(encoding="utf-8")


def _prompt_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _extract_snippet(
    artifact_path: str,
    target_start: int,
    target_end: int,
    send_mode: str,
) -> tuple[str, int, int]:
    """Extract code snippet according to send_mode.

    Returns (snippet_text, snippet_start_line, snippet_end_line).
    """
    path = Path(artifact_path)
    if not path.is_file():
        return "# Source file not available on disk", target_start, target_end

    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return "# Error reading source file", target_start, target_end

    total_lines = len(lines)
    if total_lines == 0:
        return "", 1, 1

    if send_mode == "full_artifact":
        return "\n".join(f"{i+1:5d} | {lines[i]}" for i in range(total_lines)), 1, total_lines

    # Snippets mode: 5 lines context before and after
    s_start = max(1, target_start - 5)
    s_end = min(total_lines, target_end + 5)
    selected = [f"{i:5d} | {lines[i-1]}" for i in range(s_start, s_end + 1)]
    return "\n".join(selected), s_start, s_end


def preview_evaluation_payload(
    db: Session,
    task_type: str,
    target_id: str,
    send_mode: str | None = None,
    redact: bool | None = None,
) -> dict[str, Any]:
    """Generate exact preview payload without calling LLM (Consent Preview Gate - B3)."""
    send_mode = send_mode or settings.llm_send_mode
    should_redact = redact if redact is not None else settings.llm_redact

    if task_type == "T1":
        finding = db.query(Finding).filter(Finding.id == target_id).first()
        if not finding:
            raise ValueError(f"Finding '{target_id}' not found")

        component = db.query(Component).filter(Component.id == finding.component_id).first() if finding.component_id else None
        artifact = db.query(Artifact).filter(Artifact.id == finding.source_artifact_id).first() if getattr(finding, "source_artifact_id", None) else None

        filename = artifact.original_filename if artifact else (finding.source_filename or "unknown")
        storage_path = artifact.storage_path if artifact else ""

        line_start = finding.line_start or 1
        line_end = finding.line_end or line_start

        raw_snippet, s_start, s_end = _extract_snippet(storage_path, line_start, line_end, send_mode)
        redacted_snippet, stats = redact_text(raw_snippet) if should_redact else (raw_snippet, None)

        tmpl = _read_prompt("t1_finding_review.txt")
        p_hash = _prompt_hash(tmpl)

        user_prompt = tmpl.format(
            finding_type=finding.finding_type,
            evidence_class=finding.evidence_class,
            severity=finding.severity,
            explanation=finding.explanation,
            source_filename=filename,
            snippet_start_line=s_start,
            snippet_end_line=s_end,
            code_snippet=redacted_snippet,
        )

        return {
            "task_type": "T1",
            "target_id": target_id,
            "target_type": "finding",
            "application_id": finding.application_id,
            "prompt_hash": p_hash,
            "send_mode": send_mode,
            "redacted": should_redact,
            "redaction_stats": stats._asdict() if stats else None,
            "system_prompt": "You are a ReFrameX Mainframe Migration Intelligence Auditor.",
            "user_prompt": user_prompt,
            "snippet_range": [s_start, s_end],
            "estimated_tokens": len(user_prompt) // 4,
        }

    elif task_type == "T2":
        component = db.query(Component).filter(Component.id == target_id).first()
        if not component:
            raise ValueError(f"Component '{target_id}' not found")

        artifact = db.query(Artifact).filter(Artifact.id == component.source_artifact_id).first()
        filename = artifact.original_filename if artifact else (component.source_filename or "unknown")
        storage_path = artifact.storage_path if artifact else ""

        line_start = component.line_start or 1
        line_end = component.line_end or line_start

        raw_snippet, s_start, s_end = _extract_snippet(storage_path, line_start, line_end, send_mode)
        redacted_snippet, stats = redact_text(raw_snippet) if should_redact else (raw_snippet, None)

        tmpl = _read_prompt("t2_component_review.txt")
        p_hash = _prompt_hash(tmpl)

        user_prompt = tmpl.format(
            component_name=component.name,
            component_type=component.component_type,
            technology=component.technology,
            evidence_class=component.evidence_class,
            detected_properties=component.detected_properties or "{}",
            source_filename=filename,
            snippet_start_line=s_start,
            snippet_end_line=s_end,
            code_snippet=redacted_snippet,
        )

        return {
            "task_type": "T2",
            "target_id": target_id,
            "target_type": "component",
            "application_id": component.application_id,
            "prompt_hash": p_hash,
            "send_mode": send_mode,
            "redacted": should_redact,
            "redaction_stats": stats._asdict() if stats else None,
            "system_prompt": "You are a ReFrameX Component Review Auditor.",
            "user_prompt": user_prompt,
            "snippet_range": [s_start, s_end],
            "estimated_tokens": len(user_prompt) // 4,
        }

    elif task_type == "T3":
        # Target ID is component_id for recommendation critique
        component = db.query(Component).filter(Component.id == target_id).first()
        if not component:
            raise ValueError(f"Component for recommendation '{target_id}' not found")

        recs = build_recommendations(db, component.application_id)
        comp_rec = next((r for r in recs["recommendations"] if r["component_id"] == target_id), None)
        if not comp_rec:
            raise ValueError(f"No recommendation found for component '{target_id}'")

        artifact = db.query(Artifact).filter(Artifact.id == component.source_artifact_id).first()
        filename = artifact.original_filename if artifact else (component.source_filename or "unknown")
        storage_path = artifact.storage_path if artifact else ""

        line_start = component.line_start or 1
        line_end = component.line_end or line_start

        raw_snippet, s_start, s_end = _extract_snippet(storage_path, line_start, line_end, send_mode)
        redacted_snippet, stats = redact_text(raw_snippet) if should_redact else (raw_snippet, None)

        tmpl = _read_prompt("t3_recommendation_critique.txt")
        p_hash = _prompt_hash(tmpl)

        user_prompt = tmpl.format(
            component_name=component.name,
            component_type=component.component_type,
            technology=component.technology,
            category=comp_rec["category"],
            reason=comp_rec["reason"],
            candidate_considerations="; ".join(comp_rec.get("candidate_considerations", [])),
            key_risks="; ".join(comp_rec.get("key_risks", [])),
            source_filename=filename,
            snippet_start_line=s_start,
            snippet_end_line=s_end,
            code_snippet=redacted_snippet,
        )

        return {
            "task_type": "T3",
            "target_id": target_id,
            "target_type": "recommendation",
            "application_id": component.application_id,
            "prompt_hash": p_hash,
            "send_mode": send_mode,
            "redacted": should_redact,
            "redaction_stats": stats._asdict() if stats else None,
            "system_prompt": "You are a ReFrameX Migration Architecture Critique Agent.",
            "user_prompt": user_prompt,
            "snippet_range": [s_start, s_end],
            "estimated_tokens": len(user_prompt) // 4,
        }

    else:
        raise ValueError(f"Unknown task type '{task_type}'. Must be T1, T2, or T3.")


def execute_evaluation(
    db: Session,
    task_type: str,
    target_id: str,
    provider_override: str | None = None,
    send_mode: str | None = None,
    redact: bool | None = None,
) -> dict[str, Any]:
    """Execute LLM evaluation for a target and persist to database (B4, B5)."""
    preview = preview_evaluation_payload(db, task_type, target_id, send_mode, redact)

    provider = get_llm_provider(force_provider=provider_override, allow_disabled_mock=True)

    schema_cls = {
        "T1": T1FindingReviewResponse,
        "T2": T2ComponentReviewResponse,
        "T3": T3RecommendationCritiqueResponse,
    }[task_type]

    response_data = provider.evaluate(
        system_prompt=preview["system_prompt"],
        user_prompt=preview["user_prompt"],
        response_schema=schema_cls,
    )

    # Citation validation (B4)
    s_start, s_end = preview["snippet_range"]
    cited = response_data.get("cited_lines", [])
    valid_citations = validate_citations(cited, s_start, s_end)

    status = "completed" if valid_citations else "validation_failed"
    response_data["citation_validation_passed"] = valid_citations
    response_data["classification_label"] = "AI-assisted (Inferred)"

    eval_id = str(uuid.uuid4())
    record = LLMEvaluation(
        id=eval_id,
        application_id=preview["application_id"],
        task_type=task_type,
        target_id=target_id,
        target_type=preview["target_type"],
        prompt_hash=preview["prompt_hash"],
        model_id=getattr(provider, "model", "unknown"),
        provider=provider_override or settings.llm_provider,
        send_mode=preview["send_mode"],
        request_payload=json.dumps(preview),
        response_json=json.dumps(response_data),
        status=status,
        review_status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "application_id": record.application_id,
        "task_type": record.task_type,
        "target_id": record.target_id,
        "target_type": record.target_type,
        "prompt_hash": record.prompt_hash,
        "model_id": record.model_id,
        "provider": record.provider,
        "send_mode": record.send_mode,
        "response": response_data,
        "status": record.status,
        "review_status": record.review_status,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def review_evaluation(
    db: Session,
    evaluation_id: str,
    action: str,
    reviewer_notes: str | None = None,
) -> dict[str, Any]:
    """Accept or dismiss an AI suggestion (B5)."""
    record = db.query(LLMEvaluation).filter(LLMEvaluation.id == evaluation_id).first()
    if not record:
        raise ValueError(f"LLM Evaluation '{evaluation_id}' not found")

    if action not in ("accept", "dismiss"):
        raise ValueError(f"Action '{action}' invalid. Must be 'accept' or 'dismiss'.")

    record.review_status = "accepted" if action == "accept" else "dismissed"
    record.reviewer_notes = reviewer_notes
    record.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "review_status": record.review_status,
        "reviewer_notes": record.reviewer_notes,
        "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
    }
