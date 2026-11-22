"""Comprehensive test suite for LLM Evaluation Layer B1–B10."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.llm.redaction import redact_text, RedactionStats
from app.llm.schemas import (
    T1FindingReviewResponse,
    T2ComponentReviewResponse,
    T3RecommendationCritiqueResponse,
    validate_citations,
)
from app.llm.mock_provider import MockLLMProvider
from app.llm.registry import get_llm_provider
from app.llm.openai_compatible import OpenAICompatibleProvider
from app.database import get_db_context
from app.models.models import Application, Artifact, Component, Finding, LLMEvaluation
from app.llm.evaluator import (
    preview_evaluation_payload,
    execute_evaluation,
    review_evaluation,
)
from app.llm.metrics import compute_llm_metrics

client = TestClient(app)


def test_b1_b2_llm_config_and_mock_provider():
    """B1 & B2: Default configuration and mock provider operation."""
    provider = get_llm_provider(force_provider="mock")
    ping_res = provider.ping()
    assert ping_res["status"] == "healthy"
    assert ping_res["provider"] == "mock"

    # Disabled check for non-mock
    if not settings.llm_enabled:
        with pytest.raises(RuntimeError):
            get_llm_provider(force_provider="openai_compatible")


def test_b2_host_allowlist_enforcement():
    """B2: OpenAI-compatible provider blocks unauthorized hosts."""
    with pytest.raises(ValueError, match="not in allowed hosts list"):
        OpenAICompatibleProvider(
            base_url="https://unauthorized-domain.com/v1",
            allowed_hosts=("api.groq.com", "localhost"),
        )


def test_b3_data_minimization_and_redaction():
    """B3: Redaction of enterprise secrets, IPs, emails, accounts, and COBOL sequence numbers."""
    raw_cobol = (
        "000100 IDENTIFICATION DIVISION.\n"
        "000200 PROGRAM-ID. ACCTPROC.\n"
        "000300* Host: mainframe.prod.internal IP: 192.168.1.50\n"
        "000400* Contact developer@acmebank.corp\n"
        "000500* Account: 4532-1234-5678-9012\n"
        "000600 MOVE 'sk_live_abcdef12345678' TO API-KEY\n"
        "000700 STOP RUN.\n"
    )

    redacted, stats = redact_text(raw_cobol)

    assert "[REDACTED_IP]" in redacted
    assert "192.168.1.50" not in redacted
    assert "[REDACTED_EMAIL]" in redacted
    assert "developer@acmebank.corp" not in redacted
    assert "[REDACTED_HOST]" in redacted
    assert "mainframe.prod.internal" not in redacted
    assert "[REDACTED_ACCOUNT]" in redacted
    assert "4532-1234-5678-9012" not in redacted
    assert "[REDACTED_SECRET]" in redacted
    assert "sk_live_abcdef12345678" not in redacted

    assert stats.total_redacted >= 5
    assert stats.by_category["cobol_sequence"] == 7
    assert redacted.startswith("       IDENTIFICATION")


def test_b4_citation_validation():
    """B4: Citation validation confirms citations lie strictly within snippet range."""
    assert validate_citations([10, 12, 15], 5, 20) is True
    assert validate_citations([], 5, 20) is True
    assert validate_citations([4, 10], 5, 20) is False  # Line 4 is before start 5
    assert validate_citations([10, 25], 5, 20) is False  # Line 25 is after end 20


def test_b4_mock_provider_evaluation_tasks():
    """B4: Mock provider supports T1, T2, and T3 evaluations."""
    provider = MockLLMProvider()

    prompt = "Snippet Line Range: lines 10 to 20\nCode: MOVE A TO B"

    # T1
    t1_res = provider.evaluate("system", prompt, T1FindingReviewResponse)
    assert t1_res["concurrence"] in ("concurs", "dissents", "uncertain")
    assert 10 <= t1_res["cited_lines"][0] <= 20

    # Planted False Positive
    fp_prompt = "Snippet Line Range: lines 10 to 20\nPLANTED_FALSE_POSITIVE detected"
    t1_fp = provider.evaluate("system", fp_prompt, T1FindingReviewResponse)
    assert t1_fp["concurrence"] == "dissents"

    # T2
    t2_res = provider.evaluate("system", prompt, T2ComponentReviewResponse)
    assert "summary" in t2_res
    assert "complexity_critique" in t2_res

    # T3
    t3_res = provider.evaluate("system", prompt, T3RecommendationCritiqueResponse)
    assert "critique" in t3_res
    assert len(t3_res["alternative_options"]) > 0


def test_b5_b6_evaluation_execution_review_and_metrics():
    """B5 & B6: Execute evaluation, review actions (accept/dismiss), and compute metrics."""
    with get_db_context() as db:
        # Create test application and finding
        app = Application(
            id="test-llm-app-001",
            name="LLM Test App",
            assessment_status="In Progress",
        )
        finding = Finding(
            id="test-finding-001",
            application_id="test-llm-app-001",
            finding_type="CYCLIC_DEPENDENCY",
            title="Cycle between A and B",
            severity="high",
            evidence_class="Verified",
            explanation="Mutual dependency detected.",
            detection_rule="CX-IX-004",
            domain="jobs_batch_orchestration",
            line_start=1,
            line_end=5,
        )
        db.merge(app)
        db.merge(finding)
        db.commit()

        # Execute evaluation via mock provider
        eval_res = execute_evaluation(
            db=db,
            task_type="T1",
            target_id="test-finding-001",
            provider_override="mock",
        )

        assert eval_res["status"] == "completed"
        assert eval_res["review_status"] == "pending"
        assert eval_res["response"]["concurrence"] == "concurs"
        assert eval_res["response"]["classification_label"] == "AI-assisted (Inferred)"

        # Review action: accept suggestion
        rev_res = review_evaluation(
            db=db,
            evaluation_id=eval_res["id"],
            action="accept",
            reviewer_notes="Verified by lead architect",
        )
        assert rev_res["review_status"] == "accepted"

        # Compute metrics
        metrics = compute_llm_metrics(db, "test-llm-app-001")
        assert metrics["total_evaluations"] >= 1
        assert metrics["validity_rate"] == 1.0
        assert metrics["engine_agreement_rate"] == 1.0
        assert metrics["human_agreement_rate"] == 1.0


def test_b7_rest_api_endpoints():
    """B7: REST API routes: /status, /preview, /test, /evaluations, /metrics."""
    # 1. Status
    res = client.get("/api/llm/status")
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert "provider" in data
    assert "allowed_hosts" in data

    # 2. Test Connection
    res_test = client.post("/api/llm/test", json={"provider": "mock"})
    assert res_test.status_code == 200
    assert res_test.json()["status"] == "healthy"

    # 3. Preview Payload (Consent Preview Gate)
    res_prev = client.post("/api/llm/preview", json={
        "task_type": "T1",
        "target_id": "test-finding-001",
    })
    assert res_prev.status_code == 200
    prev_data = res_prev.json()
    assert "prompt_hash" in prev_data
    assert "user_prompt" in prev_data
    assert prev_data["redacted"] is True

    # 4. List Evaluations
    res_evals = client.get("/api/llm/evaluations/test-llm-app-001")
    assert res_evals.status_code == 200
    assert len(res_evals.json()) >= 1

    # 5. Metrics
    res_met = client.get("/api/llm/metrics/test-llm-app-001")
    assert res_met.status_code == 200
    assert res_met.json()["validity_rate"] == 1.0

    # 6. Batch Evaluation (1-click Dual Analysis)
    res_batch = client.post("/api/llm/evaluate-batch", json={
        "application_id": "test-llm-app-001",
        "task_type": "T1",
        "provider_override": "mock",
        "limit": 10,
        "force_refresh": True,
    })
    assert res_batch.status_code == 200
    b_data = res_batch.json()
    assert b_data["application_id"] == "test-llm-app-001"
    assert b_data["processed"] >= 1
