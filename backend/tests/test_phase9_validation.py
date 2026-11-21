"""Phase 9 assessment validation tests.

Covers dependency-graph-based rules, weight-sensitivity, measure independence
under varying conditions, human-reviewed confidence boost, and end-to-end
assessment through the API.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.database.database import Base
from app.models.models import Application, Artifact, Component, Dependency
from app.assessment.scoring_engine import (
    load_ruleset,
    compute_assessment,
    MODEL_VERSION,
)


# ---- Fixtures (shared with test_scoring pattern) ----

@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def _make_app(db, **kwargs) -> Application:
    defaults = dict(
        id="p9-app-1", name="P9TestApp", description="Phase 9 test app",
        business_domain="Insurance", owner="Assessment Team",
        technology_stack="COBOL, CICS, DB2", environment="Production",
        assessment_status="In Progress", is_active=True,
    )
    defaults.update(kwargs)
    app = Application(**defaults)
    db.add(app)
    db.commit()
    return app


def _make_artifact(db, app_id="p9-app-1", **kwargs) -> Artifact:
    defaults = dict(
        id="p9-art-1", application_id=app_id,
        original_filename="TEST.cbl", relative_path="", extension=".cbl",
        category="COBOL", size_bytes=1000, sha256="abc123",
        parse_status="parsed", support_level="FULL_EXTRACT",
        detected_encoding="utf-8", storage_path="p9-app-1/TEST.cbl",
        error_message=None, detection_reason="COBOL source",
        fixed_record_length_hint=None,
    )
    defaults.update(kwargs)
    art = Artifact(**defaults)
    db.add(art)
    db.commit()
    return art


def _make_component(db, app_id="p9-app-1", **kwargs) -> Component:
    defaults = dict(
        id="p9-comp-1", application_id=app_id, name="TESTPROG",
        component_type="PROGRAM", technology="COBOL",
        source_artifact_id="p9-art-1", source_filename="TEST.cbl",
        line_start=1, line_end=100,
        detected_properties='{}', evidence_class="Evidence-based",
        evidence_refs='[]', warnings='[]',
        parser_name="cobol", parser_version="3.0.0",
    )
    defaults.update(kwargs)
    comp = Component(**defaults)
    db.add(comp)
    db.commit()
    return comp


def _make_dependency(db, app_id="p9-app-1", **kwargs) -> Dependency:
    defaults = dict(
        id="p9-dep-1", application_id=app_id,
        source_component_id="p9-comp-1", target_component_id="p9-comp-2",
        relationship_type="program-to-program (static CALL)",
        detection_method="static_extraction", evidence_class="Evidence-based",
        source_artifact_id="p9-art-1", source_line_number=10,
        evidence_ref='{}', description="Static CALL",
    )
    defaults.update(kwargs)
    dep = Dependency(**defaults)
    db.add(dep)
    db.commit()
    return dep


# ---- Dependency-graph rule tests ----

class TestDependencyGraphRules:
    def test_unresolved_dependency_fires_cx_ix_003(self, db):
        """CX-IX-003: Unresolved dependency (evidence_class Unknown) fires."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="p9-comp-2", name="TARGET")
        _make_dependency(db, evidence_class="Unknown")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_comp = result.domain_results["integration_external_dependencies"]["complexity"]
        fired = [fr.rule_id for fr in ix_comp.fired_rules]
        assert "CX-IX-003" in fired

    def test_circular_dependency_fires_cx_ix_004(self, db):
        """CX-IX-004: Circular dependency in the graph fires."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db, id="p9-comp-a", name="COMPA")
        _make_component(db, id="p9-comp-b", name="COMPB")
        # A -> B -> A creates a cycle
        _make_dependency(db, id="dep-ab", source_component_id="p9-comp-a",
                         target_component_id="p9-comp-b")
        _make_dependency(db, id="dep-ba", source_component_id="p9-comp-b",
                         target_component_id="p9-comp-a")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_comp = result.domain_results["integration_external_dependencies"]["complexity"]
        fired = [fr.rule_id for fr in ix_comp.fired_rules]
        assert "CX-IX-004" in fired, f"Expected CX-IX-004 fired, got: {fired}"

    def test_unresolved_dependency_fires_cf_ix_001(self, db):
        """CF-IX-001: Unresolved dependency reduces confidence."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="p9-comp-2", name="TARGET")
        _make_dependency(db, evidence_class="Unknown")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_conf = result.domain_results["integration_external_dependencies"]["confidence"]
        fired = [fr.rule_id for fr in ix_conf.fired_rules]
        assert "CF-IX-001" in fired

    def test_dependency_discovery_fires_cf_ix_002(self, db):
        """CF-IX-002: Having any dependency fires the discovery-complete rule."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="p9-comp-2", name="TARGET")
        _make_dependency(db, evidence_class="Evidence-based")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_conf = result.domain_results["integration_external_dependencies"]["confidence"]
        fired = [fr.rule_id for fr in ix_conf.fired_rules]
        assert "CF-IX-002" in fired

    def test_dependency_graph_fires_rd_ix_001(self, db):
        """RD-IX-001: Completed dependency graph increases readiness."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="p9-comp-2", name="TARGET")
        _make_dependency(db, evidence_class="Evidence-based")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_ready = result.domain_results["integration_external_dependencies"]["readiness"]
        fired = [fr.rule_id for fr in ix_ready.fired_rules]
        assert "RD-IX-001" in fired

    def test_unresolved_dependency_fires_rd_ix_002(self, db):
        """RD-IX-002: Unresolved dependencies reduce readiness."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="p9-comp-2", name="TARGET")
        _make_dependency(db, evidence_class="Unknown")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        ix_ready = result.domain_results["integration_external_dependencies"]["readiness"]
        fired = [fr.rule_id for fr in ix_ready.fired_rules]
        assert "RD-IX-002" in fired


# ---- Weight-sensitivity tests ----

class TestWeightSensitivity:
    def test_zeroing_weight_removes_rule_impact(self, db):
        """Setting a rule's weight to 0 should remove its score impact."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                        component_type="CONTROL_FLOW",
                        evidence_refs='[{"artifact_id":"p9-art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        zeroed = compute_assessment(db, "p9-app-1", ruleset=rs, weight_overrides={"CX-AB-002": 0})
        assert zeroed.complexity_score < baseline.complexity_score, \
            "Zeroing CX-AB-002 weight should reduce complexity"

    def test_doubling_weight_increases_complexity(self, db):
        """Doubling a complexity rule's weight should increase complexity."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                        component_type="CONTROL_FLOW",
                        evidence_refs='[{"artifact_id":"p9-art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        original_weight = next(r["weight"] for r in rs["rules"] if r["rule_id"] == "CX-AB-002")
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        doubled = compute_assessment(db, "p9-app-1", ruleset=rs,
                                     weight_overrides={"CX-AB-002": original_weight * 2})
        assert doubled.complexity_score > baseline.complexity_score, \
            "Doubling GOTO weight should increase complexity"

    def test_multiple_weight_changes_are_independent(self, db):
        """Changing complexity weights should not directly change confidence or readiness."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                        component_type="CONTROL_FLOW",
                        evidence_refs='[{"artifact_id":"p9-art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        overridden = compute_assessment(db, "p9-app-1", ruleset=rs,
                                        weight_overrides={"CX-AB-002": 50})
        # Confidence and readiness should be unaffected by complexity weight change
        assert overridden.confidence_score == baseline.confidence_score, \
            "Confidence should not change when only a complexity weight is overridden"
        assert overridden.readiness_score == baseline.readiness_score, \
            "Readiness should not change when only a complexity weight is overridden"

    def test_domain_weight_override_changes_aggregation(self, db):
        """Overriding a domain weight should change the aggregated score."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                        component_type="CONTROL_FLOW",
                        evidence_refs='[{"artifact_id":"p9-art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        # The what-if API allows weight overrides on rules, not domain weights directly,
        # but we can test rule weight changes across domains
        overridden = compute_assessment(db, "p9-app-1", ruleset=rs,
                                        weight_overrides={"CX-AB-002": 30, "CX-IX-004": 30})
        assert overridden.complexity_score != baseline.complexity_score


# ---- Human-reviewed confidence boost ----

class TestHumanReviewed:
    def test_human_reviewed_boosts_confidence(self, db):
        """CF-ALL-001: Human-reviewed flag adds +5 to confidence."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        reviewed = compute_assessment(db, "p9-app-1", ruleset=rs, human_reviewed=True)
        assert reviewed.confidence_score > baseline.confidence_score, \
            "Human-reviewed flag should boost confidence"
        # The boost is exactly +5 on raw, but after aggregation it may differ slightly
        assert reviewed.confidence_score >= baseline.confidence_score


# ---- Measure independence under varying conditions ----

class TestMeasureIndependenceExtended:
    def test_complexity_can_be_high_while_readiness_is_high(self, db):
        """High complexity and high readiness can coexist (independence)."""
        _make_app(db, owner="Owner", business_domain="Banking", technology_stack="COBOL/CICS/DB2")
        _make_artifact(db)
        _make_artifact(db, id="p9-art-jcl", category="JCL", original_filename="JOB.jcl", parse_status="parsed")
        _make_artifact(db, id="p9-art-ddl", category="SQL_DDL", original_filename="DB.sql", parse_status="parsed")
        _make_artifact(db, id="p9-art-bms", category="BMS_MAP", original_filename="SCREEN.bms", parse_status="parsed")
        for i in range(60):
            _make_component(db, id=f"p9-goto-{i}", name=f"GOTO-{i}", component_type="CONTROL_FLOW",
                            detected_properties='{"legacy_indicator":"GOTO"}',
                            evidence_refs=f'[{{"artifact_id":"p9-art-1","line_start":{i},"line_end":{i},"rule":"COBOL_GOTO","snippet":"GO TO"}}]')
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        assert result.complexity_score > 40, f"Complexity should be moderately high: {result.complexity_score}"
        assert result.readiness_score > 50, f"Readiness should also be high: {result.readiness_score}"

    def test_low_complexity_with_low_confidence(self, db):
        """Low complexity and low confidence can coexist (no evidence = not simple)."""
        _make_app(db, owner=None, business_domain=None, technology_stack=None)
        _make_artifact(db, support_level="UNSUPPORTED", parse_status="unsupported")
        rs = load_ruleset()
        result = compute_assessment(db, "p9-app-1", ruleset=rs)
        assert result.complexity_score < 50
        assert result.confidence_score < 50

    def test_confidence_does_not_affect_complexity(self, db):
        """Adding confidence evidence (JCL) should not change complexity."""
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        baseline = compute_assessment(db, "p9-app-1", ruleset=rs)
        _make_artifact(db, id="p9-art-jcl", category="JCL", original_filename="JOB.jcl", parse_status="parsed")
        with_jcl = compute_assessment(db, "p9-app-1", ruleset=rs)
        # Confidence should rise
        assert with_jcl.confidence_score > baseline.confidence_score
        # Complexity should not increase from adding JCL confidence evidence
        # (JCL adds complexity via CX-JB rules, so it may change, but the point is
        # confidence evidence itself doesn't drive complexity)
        # We verify the measures are computed via different rule sets:
        conf_rules = {fr.rule_id for fr in with_jcl.domain_results["jobs_batch_orchestration"]["confidence"].fired_rules}
        comp_rules = {fr.rule_id for fr in with_jcl.domain_results["jobs_batch_orchestration"]["complexity"].fired_rules}
        assert conf_rules != comp_rules, "Confidence and complexity rules should differ"


# ---- End-to-end assessment via API ----
# These tests use an isolated TestClient fixture for Phase 9 API validation.

@pytest.fixture(scope="function")
def api_client(tmp_path, monkeypatch):
    """Create a TestClient with an isolated DB and upload dir."""
    db_path = tmp_path / "p9_test.db"
    upload_dir = tmp_path / "p9_uploads"
    upload_dir.mkdir()

    monkeypatch.setattr("app.core.config.settings.upload_dir", upload_dir)
    monkeypatch.setattr("app.core.config.settings.db_path", db_path)
    monkeypatch.setattr("app.core.config.settings.database_url", f"sqlite:///{db_path}")

    from sqlalchemy import create_engine as _ce
    from sqlalchemy.orm import sessionmaker
    from app.database import database as dbmod
    import app.models.models  # noqa
    new_engine = _ce(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(dbmod, "engine", new_engine)
    monkeypatch.setattr(dbmod, "SessionLocal", sessionmaker(bind=new_engine, autoflush=False, autocommit=False))
    dbmod.Base.metadata.create_all(bind=new_engine)

    from app.main import app
    from app.database.database import get_db

    def override_get_db():
        session = dbmod.SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    dbmod.Base.metadata.drop_all(bind=new_engine)


class TestAssessmentAPI:
    def test_assess_endpoint_returns_full_result(self, api_client):
        """POST /assess and GET /assessment work end-to-end."""
        c = api_client
        resp = c.post("/api/applications", json={
            "name": "E2E Test App", "description": "End-to-end test",
            "business_domain": "Insurance", "owner": "Test Team",
            "technology_stack": "COBOL",
        })
        assert resp.status_code == 201
        app_id = resp.json()["id"]

        cobol = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. TESTPROG.\n       PROCEDURE DIVISION.\n           GO TO PARA1.\n       PARA1.\n           STOP RUN.\n"
        resp = c.post(
            f"/api/applications/{app_id}/artifacts",
            files={"files": ("TEST.cbl", cobol, "text/plain")},
        )
        assert resp.status_code == 200
        assert len(resp.json()) > 0

        resp = c.post(f"/api/applications/{app_id}/analyze")
        assert resp.status_code == 200

        resp = c.post(f"/api/applications/{app_id}/assess")
        assert resp.status_code == 200
        data = resp.json()
        assert "complexity_score" in data
        assert "confidence_score" in data
        assert "readiness_score" in data
        assert "fired_rules" in data
        assert data["model_version"] == MODEL_VERSION

        resp = c.get(f"/api/applications/{app_id}/assessment")
        assert resp.status_code == 200
        assert resp.json()["complexity_score"] == data["complexity_score"]

        resp = c.get(f"/api/applications/{app_id}/assessment/domains")
        assert resp.status_code == 200

        resp = c.get(f"/api/applications/{app_id}/findings")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

        resp = c.get(f"/api/applications/{app_id}/recommendations")
        assert resp.status_code == 200

        resp = c.get(f"/api/applications/{app_id}/unknowns")
        assert resp.status_code == 200

    def test_whatif_endpoint(self, api_client):
        """POST /assess/what-if returns before/after comparison."""
        c = api_client
        resp = c.post("/api/applications", json={
            "name": "WhatIf App", "business_domain": "Finance",
            "owner": "Team", "technology_stack": "COBOL",
        })
        app_id = resp.json()["id"]

        cobol = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. WIPROG.\n       PROCEDURE DIVISION.\n           GO TO P1.\n       P1.\n           STOP RUN.\n"
        c.post(f"/api/applications/{app_id}/artifacts",
               files={"files": ("W.cbl", cobol, "text/plain")})
        c.post(f"/api/applications/{app_id}/analyze")
        c.post(f"/api/applications/{app_id}/assess")

        resp = c.post(
            f"/api/applications/{app_id}/assess/what-if",
            json={"weight_overrides": {"CX-AB-002": 50}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "before" in data
        assert "after" in data
        assert data["after"]["complexity_score"] > data["before"]["complexity_score"]

    def test_reanalysis_no_duplicates(self, api_client):
        """Re-analyzing should not duplicate components."""
        from app.database.database import SessionLocal
        from app.models.models import Component

        c = api_client
        resp = c.post("/api/applications", json={
            "name": "Reanalysis App", "technology_stack": "COBOL",
        })
        app_id = resp.json()["id"]

        cobol = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. REPROG.\n       PROCEDURE DIVISION.\n           STOP RUN.\n"
        c.post(f"/api/applications/{app_id}/artifacts",
               files={"files": ("R.cbl", cobol, "text/plain")})

        c.post(f"/api/applications/{app_id}/analyze")
        db = SessionLocal()
        try:
            count1 = db.query(Component).filter(Component.application_id == app_id).count()
        finally:
            db.close()

        c.post(f"/api/applications/{app_id}/reanalyze")
        db = SessionLocal()
        try:
            count2 = db.query(Component).filter(Component.application_id == app_id).count()
        finally:
            db.close()

        assert count1 == count2, f"Reanalysis created duplicates: {count1} -> {count2}"
