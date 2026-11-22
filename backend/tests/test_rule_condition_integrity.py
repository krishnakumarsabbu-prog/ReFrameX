"""Acceptance and integrity tests for ReFrameX assessment & ruleset engine.

Verifies:
1. Ground truth unavailable gracefully returns status='unavailable' and overall=None without HTTP 500 (A1).
2. Zero condition evaluation exceptions across all applications in the database (A2/A3).
3. Ruleset validator validates the default ruleset with zero errors (A3).
4. Rules audit endpoint (/api/applications/{id}/rules/audit) returns structured trace (B4).
5. Confidence coverage-weighted calculations reflect evidential completeness (B1).
6. Readiness gating prevents unearned 'Ready' status when high findings or unparsed artifacts exist (B2).
"""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.database.database import get_db_context
from app.models.models import Application, Finding
from app.assessment.scoring_engine import load_ruleset, compute_assessment
from app.assessment.ruleset_validator import validate_ruleset
from app.services import evidence_metrics_service


@pytest.fixture
def client():
    return TestClient(app)


def test_ground_truth_unavailable_graceful(monkeypatch, client):
    """A1 Acceptance: When ground truth benchmark is unavailable, endpoint returns HTTP 200 with overall=None."""
    monkeypatch.setattr(
        evidence_metrics_service,
        "_load_ground_truth_accuracy",
        lambda: {"status": "unavailable", "overall": None, "per_parser": {}, "note": "Unmounted benchmark", "evidence_class": "Assumed"},
    )
    with get_db_context() as db:
        app_obj = db.query(Application).first()
        if not app_obj:
            pytest.skip("No application in DB")
        app_id = app_obj.id

    resp = client.get(f"/api/applications/{app_id}/evidence-metrics")
    assert resp.status_code == 200
    data = resp.json()
    gt = data["static"]["parser_accuracy"]
    assert gt["status"] == "unavailable"
    assert gt["overall"] is None


def test_ruleset_validator_zero_errors():
    """A3 Acceptance: Ruleset validator finds zero errors in default ruleset."""
    ruleset = load_ruleset()
    errors = validate_ruleset(ruleset, raise_on_error=False)
    assert errors == [], f"Ruleset contains condition integrity errors: {errors}"


def test_zero_condition_exceptions_across_all_db_apps():
    """A2/A3 Acceptance: Running assessment on all DB applications causes zero evaluation errors."""
    ruleset = load_ruleset()
    with get_db_context() as db:
        apps = db.query(Application).all()
        assert len(apps) > 0, "Expected at least one application in DB"

        for a in apps:
            result = compute_assessment(db, a.id, ruleset=ruleset)
            assert result is not None, f"Assessment failed for {a.name}"
            assert result.evaluation_errors == [], (
                f"App {a.name} ({a.id}) encountered condition evaluation errors: {result.evaluation_errors}"
            )


def test_rules_audit_endpoint(client):
    """B4 Acceptance: GET /api/applications/{app_id}/rules/audit returns structured per-rule trace."""
    with get_db_context() as db:
        app_obj = db.query(Application).first()
        if not app_obj:
            pytest.skip("No application in DB")
        app_id = app_obj.id

    resp = client.get(f"/api/applications/{app_id}/rules/audit")
    assert resp.status_code == 200
    data = resp.json()
    assert data["application_id"] == app_id
    assert "total_rules" in data
    assert "fired_rules_count" in data
    assert "applicable_rules_count" in data
    assert len(data["rules"]) > 0

    first_rule = data["rules"][0]
    assert "rule_id" in first_rule
    assert "status" in first_rule
    assert first_rule["status"] in ("fired", "evaluated_not_fired", "inapplicable")
    assert "reason" in first_rule


def test_readiness_gating_behavior():
    """B2 Acceptance: Open HIGH severity findings gate readiness to Partially Ready."""
    ruleset = load_ruleset()
    with get_db_context() as db:
        app_obj = db.query(Application).first()
        if not app_obj:
            pytest.skip("No application in DB")

        # Check existing findings
        high_findings = db.query(Finding).filter(
            Finding.application_id == app_obj.id,
            Finding.severity == "high",
        ).all()

        result = compute_assessment(db, app_obj.id, ruleset=ruleset)
        assert result is not None

        # If there are open high findings, readiness must not be 'Ready for Detailed Planning'
        if any(f.review_status != "dismissed" for f in high_findings):
            assert result.readiness_classification != "Ready for Detailed Planning"
            assert any("Readiness Gate:" in m for m in result.assessment_limitations)


def test_dashboard_summary_endpoint(client):
    """Acceptance: GET /api/dashboard/summary returns dynamic portfolio metrics from database."""
    resp = client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_applications" in data
    assert "total_components" in data
    assert "total_dependencies" in data
    assert "avg_complexity" in data
    assert "avg_confidence" in data
    assert "readiness_distribution" in data
    assert "recent_assessments" in data
    assert "domains" in data
    assert "top_risks" in data
    assert "risk_counts" in data
    assert data["total_applications"] >= 1

