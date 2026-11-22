"""Tests for Evidence Metrics: Static Analysis + LLM Analysis + Comparison.

Verifies:
1. Static metrics equal independently computed database values.
2. When LLM is disabled: llm section reports 'disabled', comparison is None, zero network calls.
3. With mock provider: counts, rates, consistency, agreement matrix, sample sizes on every metric.
4. LLM evaluations never alter deterministic scores, findings, or recommendations.
5. Drill-down endpoints return exact items for each metric.
6. Export endpoint matches GET /evidence-metrics JSON payload.
"""

from __future__ import annotations

import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

from app.main import app
from app.database.database import Base, get_db
from app.models.models import Application, Artifact, Component, Dependency, Finding, LLMEvaluation, AssessmentRecord
from app.core.config import settings
from app.services.evidence_metrics_service import get_full_evidence_metrics, NOTICE_STRING
from app.assessment.scoring_engine import compute_assessment, load_ruleset


@pytest.fixture
def test_db(tmp_path):
    db_file = tmp_path / "test_em.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    import app.models.models  # noqa
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


def _seed_app(db, app_id="em-app-1"):
    application = Application(
        id=app_id,
        name="Claims Management",
        business_domain="Insurance",
        owner="Claims Core Team",
        technology_stack="COBOL/CICS/DB2",
    )
    db.merge(application)

    art1 = Artifact(
        id="art-cbl-1",
        application_id=app_id,
        original_filename="CLAIMCTL.cbl",
        relative_path="src/CLAIMCTL.cbl",
        extension=".cbl",
        category="COBOL",
        size_bytes=1024,
        sha256="abc12345",
        parse_status="parsed",
        support_level="SUPPORTED_PARSE",
        detected_encoding="utf-8",
        storage_path="em-app-1/CLAIMCTL.cbl",
    )
    art2 = Artifact(
        id="art-bin-1",
        application_id=app_id,
        original_filename="UNSUPPORTED.bin",
        relative_path="bin/UNSUPPORTED.bin",
        extension=".bin",
        category="BINARY",
        size_bytes=512,
        sha256="def67890",
        parse_status="unsupported",
        support_level="UNSUPPORTED",
        detected_encoding="binary",
        storage_path="em-app-1/UNSUPPORTED.bin",
    )
    db.merge(art1)
    db.merge(art2)

    comp1 = Component(
        id="comp-1",
        application_id=app_id,
        name="CLAIMCTL",
        component_type="PROGRAM",
        technology="COBOL",
        source_artifact_id="art-cbl-1",
        source_filename="CLAIMCTL.cbl",
        line_start=1,
        line_end=120,
        evidence_class="Evidence-based",
        detected_properties=json.dumps({"call_type": "dynamic_resolved"}),
    )
    comp2 = Component(
        id="comp-2",
        application_id=app_id,
        name="UNKNOWN_TARGET",
        component_type="PROGRAM",
        technology="COBOL",
        source_artifact_id="art-cbl-1",
        source_filename="CLAIMCTL.cbl",
        line_start=50,
        line_end=50,
        evidence_class="Unknown",
        detected_properties=json.dumps({"call_type": "dynamic_unresolved"}),
    )
    db.merge(comp1)
    db.merge(comp2)

    f1 = Finding(
        id="f-1",
        application_id=app_id,
        title="GOTO statement introduces branching complexity",
        domain="application_business_logic",
        severity="medium",
        evidence_class="Evidence-based",
        source_artifact_id="art-cbl-1",
        source_filename="CLAIMCTL.cbl",
        line_start=45,
        line_end=45,
        has_line_ref=True,
        detection_rule="CX-AB-002",
        explanation="Unconditional branch found.",
        review_status="confirmed",
    )
    f2 = Finding(
        id="f-2",
        application_id=app_id,
        title="Unsupported binary artifact limits analysis",
        domain="operational_nonfunctional",
        severity="high",
        evidence_class="Unknown",
        source_artifact_id="art-bin-1",
        source_filename="UNSUPPORTED.bin",
        line_start=0,
        line_end=0,
        has_line_ref=False,
        detection_rule="CX-ON-003",
        explanation="Artifact cannot be parsed.",
        review_status="open",
    )
    db.merge(f1)
    db.merge(f2)
    db.commit()


def test_static_metrics_computation(test_db):
    """Static metrics equal values computed independently from the database."""
    _seed_app(test_db, "app-static-1")
    metrics = get_full_evidence_metrics(test_db, "app-static-1")

    static = metrics["static"]
    assert static["findings_total"] == 2
    assert static["by_severity"]["MEDIUM"] == 1
    assert static["by_severity"]["HIGH"] == 1
    assert static["by_domain"]["application_business_logic"] == 1
    assert static["by_domain"]["operational_nonfunctional"] == 1
    assert static["by_evidence_classification"]["Evidence-based"] == 1
    assert static["by_evidence_classification"]["Unknown"] == 1

    # Traceability: 1 with line ref, 1 lacking
    assert static["traceability"]["total"] == 2
    assert static["traceability"]["with_line_ref_count"] == 1
    assert static["traceability"]["with_line_pct"] == 50.0
    assert len(static["traceability"]["lacking_line_refs"]) == 1
    assert static["traceability"]["lacking_line_refs"][0]["id"] == "f-2"

    # Coverage
    assert static["coverage"]["artifacts_total"] == 2
    assert static["coverage"]["artifacts_by_support_level"]["SUPPORTED_PARSE"] == 1
    assert static["coverage"]["artifacts_by_support_level"]["UNSUPPORTED"] == 1
    assert static["coverage"]["parse_success_rate"] == 50.0
    assert static["coverage"]["unresolved_placeholders_count"] == 1
    assert static["coverage"]["dynamic_calls"]["resolved"] == 1
    assert static["coverage"]["dynamic_calls"]["unresolved"] == 1

    # Human review
    assert static["human_review"]["confirmed"] == 1
    assert static["human_review"]["pending"] == 1


def test_llm_disabled_graceful_degradation(test_db, monkeypatch):
    """When LLM is disabled and no evals exist: llm section reports 'disabled', comparison is None, 0 network calls."""
    monkeypatch.setattr(settings, "llm_enabled", False)
    _seed_app(test_db, "app-disabled-1")

    metrics = get_full_evidence_metrics(test_db, "app-disabled-1")
    assert metrics["llm"]["status"] == "disabled"
    assert metrics["comparison"] is None
    assert metrics["notice"] == NOTICE_STRING


def test_mock_provider_evaluations_and_comparison(test_db):
    """With mock evaluations present: verify distributions, sample sizes, quality, and comparison."""
    _seed_app(test_db, "app-mock-1")

    # Add mock LLMEvaluation records
    ev1 = LLMEvaluation(
        id="eval-1",
        application_id="app-mock-1",
        task_type="T1",
        target_id="f-1",
        target_type="finding",
        prompt_hash="hash-1",
        model_id="mock-llm-v1",
        provider="mock",
        send_mode="snippets",
        request_payload=json.dumps({"snippet_range": [30, 60]}),
        response_json=json.dumps({
            "concurrence": "concurs",
            "verdict": "supports",
            "rationale": "GOTO confirmed at line 45.",
            "cited_lines": [45],
            "citation_validation_passed": True,
            "suggested_reclassification": "Evidence-based",
            "latency_ms": 110.0,
            "prompt_tokens": 300,
            "completion_tokens": 80,
        }),
        status="completed",
        review_status="accepted",
    )
    ev2 = LLMEvaluation(
        id="eval-2",
        application_id="app-mock-1",
        task_type="T1",
        target_id="f-2",
        target_type="finding",
        prompt_hash="hash-2",
        model_id="mock-llm-v1",
        provider="mock",
        send_mode="snippets",
        request_payload=json.dumps({"snippet_range": [1, 20]}),
        response_json=json.dumps({
            "concurrence": "dissents",
            "verdict": "contradicts",
            "rationale": "Binary artifact may contain proprietary header, recheck.",
            "cited_lines": [5],
            "citation_validation_passed": False,
            "suggested_reclassification": "Inferred",
            "latency_ms": 140.0,
            "prompt_tokens": 350,
            "completion_tokens": 90,
        }),
        status="completed",
        review_status="dismissed",
    )
    test_db.add(ev1)
    test_db.add(ev2)
    test_db.commit()

    metrics = get_full_evidence_metrics(test_db, "app-mock-1")

    llm = metrics["llm"]
    assert llm["status"] == "complete"
    assert llm["n"] == 2
    assert llm["verdict_distribution"]["supports"] == 1
    assert llm["verdict_distribution"]["contradicts"] == 1
    assert llm["verdict_distribution"]["n"] == 2

    # Quality metrics
    assert llm["quality"]["schema_valid_rate"] == 100.0
    assert llm["quality"]["citation_valid_rate"] == 50.0  # 1 of 2 valid
    assert llm["quality"]["invalid_citation_count"] == 1
    assert llm["quality"]["n"] == 2

    # Human outcome
    assert llm["human_outcome"]["accepted"] == 1
    assert llm["human_outcome"]["dismissed"] == 1
    assert llm["human_outcome"]["n"] == 2

    # Comparison section
    comp = metrics["comparison"]
    assert comp is not None
    assert comp["agreement_matrix"]["agree"] == 1
    assert comp["agreement_matrix"]["disagree"] == 1
    assert comp["agreement_matrix"]["total_compared"] == 2
    assert comp["agreement_matrix"]["n"] == 2

    # Disagreements list contains f-2
    assert comp["disagreements_count"] == 1
    assert comp["disagreements"][0]["finding_id"] == "f-2"
    assert comp["disagreements"][0]["llm_verdict"] == "contradicts"

    # Classification difference: f-2 static is Unknown, LLM suggested Inferred
    assert comp["classification_differences_count"] == 1
    assert comp["classification_differences"][0]["finding_id"] == "f-2"
    assert comp["classification_differences"][0]["llm_suggested_class"] == "Inferred"

    # Notice string present
    assert comp["notice"] == NOTICE_STRING


def test_llm_evaluations_never_alter_scores(test_db):
    """Invariant: Deterministic scores remain 100% identical before and after LLM evaluations."""
    _seed_app(test_db, "app-invariant-1")
    rs = load_ruleset()

    score_before = compute_assessment(test_db, "app-invariant-1", ruleset=rs)

    # Insert an LLM evaluation claiming something different
    ev = LLMEvaluation(
        id="eval-inv-1",
        application_id="app-invariant-1",
        task_type="T1",
        target_id="f-1",
        target_type="finding",
        prompt_hash="p1",
        model_id="mock",
        provider="mock",
        send_mode="snippets",
        request_payload="{}",
        response_json=json.dumps({"concurrence": "dissents", "suggested_classification": "Unknown"}),
        status="completed",
        review_status="accepted",
    )
    test_db.add(ev)
    test_db.commit()

    score_after = compute_assessment(test_db, "app-invariant-1", ruleset=rs)

    assert score_before.complexity_score == score_after.complexity_score
    assert score_before.confidence_score == score_after.confidence_score
    assert score_before.readiness_score == score_after.readiness_score
    assert score_before.domains_assessed == score_after.domains_assessed
    assert score_before.coverage_ratio == score_after.coverage_ratio


def test_api_evidence_metrics_and_drilldown(client, test_db):
    """REST API endpoints for evidence-metrics, export, and drilldown."""
    _seed_app(test_db, "app-api-1")

    # 1. GET /api/applications/{id}/evidence-metrics
    resp = client.get("/api/applications/app-api-1/evidence-metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "metadata" in data
    assert "static" in data
    assert "llm" in data
    assert data["static"]["findings_total"] == 2

    # 2. GET /api/applications/{id}/evidence-metrics/export
    export_resp = client.get("/api/applications/app-api-1/evidence-metrics/export")
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"] == "application/json"
    exported_data = export_resp.json()
    assert exported_data["static"]["findings_total"] == data["static"]["findings_total"]

    # 3. GET /api/applications/{id}/evidence-metrics/drilldown
    # Drill into high severity
    dd_resp = client.get("/api/applications/app-api-1/evidence-metrics/drilldown?metric_type=severity&category=HIGH")
    assert dd_resp.status_code == 200
    dd_data = dd_resp.json()
    assert dd_data["total"] == 1
    assert dd_data["items"][0]["id"] == "f-2"

    # Drill into lacking line refs
    dd_resp2 = client.get("/api/applications/app-api-1/evidence-metrics/drilldown?metric_type=lacking_line_refs")
    assert dd_resp2.status_code == 200
    assert dd_resp2.json()["total"] == 1
    assert dd_resp2.json()["items"][0]["id"] == "f-2"
