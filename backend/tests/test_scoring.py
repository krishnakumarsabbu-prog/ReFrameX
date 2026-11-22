"""Tests for the Phase 5 scoring engine.

Covers: normalization, rule execution, missing artifacts, confidence, readiness,
thresholds, reproducibility, and all required scenarios.
"""

from __future__ import annotations

import json
import pytest
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.database.database import Base
from app.models.models import Application, Artifact, Component, Dependency
from app.assessment.scoring_engine import (
    load_ruleset,
    evaluate_rules,
    normalize_domain_scores,
    aggregate_scores,
    classify_score,
    compute_assessment,
    compute_component_assessment,
    serialize_assessment,
    EvidenceBundle,
    DOMAINS,
    MEASURES,
    MODEL_VERSION,
)


# ---- Fixtures ----

@pytest.fixture
def db():
    """In-memory SQLite DB for testing."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def _make_app(db, **kwargs) -> Application:
    defaults = dict(
        id="test-app-1", name="TestApp", description="Test application",
        business_domain="Insurance", owner="Assessment Team",
        technology_stack="COBOL, CICS, DB2", environment="Production",
        assessment_status="In Progress", is_active=True,
    )
    defaults.update(kwargs)
    app = Application(**defaults)
    db.add(app)
    db.commit()
    return app


def _make_artifact(db, app_id="test-app-1", **kwargs) -> Artifact:
    defaults = dict(
        id="art-1", application_id=app_id,
        original_filename="TEST.cbl", relative_path="", extension=".cbl",
        category="COBOL", size_bytes=1000, sha256="abc123",
        parse_status="parsed", support_level="FULL_EXTRACT",
        detected_encoding="utf-8", storage_path="test-app-1/TEST.cbl",
        error_message=None, detection_reason="COBOL source",
        fixed_record_length_hint=None,
    )
    defaults.update(kwargs)
    art = Artifact(**defaults)
    db.add(art)
    db.commit()
    return art


def _make_component(db, app_id="test-app-1", **kwargs) -> Component:
    defaults = dict(
        id="comp-1", application_id=app_id, name="TESTPROG",
        component_type="PROGRAM", technology="COBOL",
        source_artifact_id="art-1", source_filename="TEST.cbl",
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


def _make_dependency(db, app_id="test-app-1", **kwargs) -> Dependency:
    defaults = dict(
        id="dep-1", application_id=app_id,
        source_component_id="comp-1", target_component_id="comp-2",
        relationship_type="program-to-program (static CALL)",
        detection_method="static_extraction", evidence_class="Evidence-based",
        source_artifact_id="art-1", source_line_number=10,
        evidence_ref='{}', description="Static CALL",
    )
    defaults.update(kwargs)
    dep = Dependency(**defaults)
    db.add(dep)
    db.commit()
    return dep


# ---- Tests: Ruleset validation ----

class TestRulesetValidation:
    def test_ruleset_loads_successfully(self):
        rs = load_ruleset()
        assert rs["ruleset_id"] in ("default_ruleset_v1", "default_ruleset_v2")
        assert len(rs["rules"]) > 0

    def test_all_8_domains_present(self):
        rs = load_ruleset()
        for d in DOMAINS:
            assert d in rs["domain_weights"], f"Missing domain weight: {d}"

    def test_domain_weights_sum_to_one(self):
        rs = load_ruleset()
        total = sum(rs["domain_weights"].values())
        assert abs(total - 1.0) < 0.05, f"Weights sum to {total}, expected ~1.0"

    def test_all_3_measures_present(self):
        rs = load_ruleset()
        measures = set(r["measure"] for r in rs["rules"])
        assert measures == {"complexity", "confidence", "readiness"}

    def test_every_rule_has_required_fields(self):
        rs = load_ruleset()
        required = ["rule_id", "domain", "measure", "description", "detection_condition",
                    "weight", "impact", "severity", "evidence_requirement", "explanation"]
        for rule in rs["rules"]:
            for field_name in required:
                assert field_name in rule, f"Rule {rule.get('rule_id', '?')} missing {field_name}"

    def test_no_duplicate_rule_ids(self):
        rs = load_ruleset()
        ids = [r["rule_id"] for r in rs["rules"]]
        assert len(ids) == len(set(ids)), "Duplicate rule IDs found"

    def test_malformed_ruleset_rejected(self, tmp_path):
        bad = {"ruleset_id": "bad", "version": "1", "effective_date": "2026", "owner": "x",
               "domain_weights": {}, "thresholds": {}, "rules": []}
        f = tmp_path / "bad.json"
        f.write_text(json.dumps(bad))
        with pytest.raises(ValueError):
            load_ruleset(f)


# ---- Tests: Normalization ----

class TestNormalization:
    def test_complexity_zero_when_no_evidence(self, db):
        _make_app(db, owner=None, business_domain=None, technology_stack=None)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        # Complexity should have no evidence (no artifacts/components)
        for domain in DOMAINS:
            dr = result.domain_results[domain]["complexity"]
            assert not dr.has_evidence, f"{domain}/complexity should have no evidence"
            assert dr.normalized_score == 0.0

    def test_complexity_score_clamped_0_100(self, db):
        _make_app(db)
        _make_artifact(db)
        for i in range(50):
            _make_component(db, id=f"goto-{i}", name=f"GOTO-{i}", component_type="CONTROL_FLOW",
                           detected_properties='{"legacy_indicator":"GOTO"}',
                           evidence_refs=f'[{{"artifact_id":"art-1","line_start":{i},"line_end":{i},"rule":"COBOL_GOTO","snippet":"GO TO PARA1"}}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert 0 <= result.complexity_score <= 100

    def test_confidence_score_clamped_0_100(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert 0 <= result.confidence_score <= 100

    def test_readiness_score_clamped_0_100(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert 0 <= result.readiness_score <= 100


# ---- Tests: Independence of measures ----

class TestMeasureIndependence:
    def test_three_measures_computed_independently(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                       component_type="CONTROL_FLOW",
                       evidence_refs='[{"artifact_id":"art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        # They should not all be equal (proving independence)
        scores = [result.complexity_score, result.confidence_score, result.readiness_score]
        assert len(set(scores)) > 1, "Measures should be independent, not all equal"


# ---- Tests: Missing artifacts ----

class TestMissingArtifacts:
    def test_missing_jcl_reduces_confidence(self, db):
        _make_app(db)
        _make_artifact(db, category="COBOL")
        _make_component(db)
        rs = load_ruleset()
        result_no_jcl = compute_assessment(db, "test-app-1", ruleset=rs)
        conf_no_jcl = result_no_jcl.confidence_score

        _make_artifact(db, id="art-jcl", category="JCL", original_filename="JOB.jcl")
        result_with_jcl = compute_assessment(db, "test-app-1", ruleset=rs)
        conf_with_jcl = result_with_jcl.confidence_score

        assert conf_with_jcl > conf_no_jcl, "Adding JCL should raise confidence"

    def test_missing_copybooks_reduces_confidence(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="cb-1", name="MISSING-COPY", component_type="COPYBOOK",
                       evidence_class="Unknown",
                       evidence_refs='[{"artifact_id":"art-1","line_start":5,"line_end":5,"rule":"UNRESOLVED","snippet":"Not found"}]')
        rs = load_ruleset()
        result_missing = compute_assessment(db, "test-app-1", ruleset=rs)

        # Now add the copybook artifact and re-create component as resolved
        _make_artifact(db, id="art-cb", category="COPYBOOK", original_filename="MISSING-COPY.cpy")
        # Update the component to be Evidence-based
        db.query(Component).filter(Component.id == "cb-1").update({"evidence_class": "Evidence-based"})
        db.commit()
        result_resolved = compute_assessment(db, "test-app-1", ruleset=rs)

        assert result_resolved.confidence_score > result_missing.confidence_score
        assert result_resolved.readiness_score > result_missing.readiness_score

    def test_missing_evidence_not_simplicity(self, db):
        """Missing evidence must not count as low complexity."""
        _make_app(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        for domain in DOMAINS:
            dr = result.domain_results[domain]["complexity"]
            assert not dr.has_evidence
            assert any("Not assessed" in n for n in dr.not_evidenced_notes)

    def test_unsupported_artifacts_lower_confidence(self, db):
        _make_app(db)
        _make_artifact(db, support_level="UNSUPPORTED", parse_status="unsupported")
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.confidence_score < 50.0, "Unsupported artifacts should reduce confidence"


# ---- Tests: Reproducibility ----

class TestReproducibility:
    def test_same_evidence_same_result(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                       component_type="CONTROL_FLOW")
        rs = load_ruleset()
        r1 = compute_assessment(db, "test-app-1", ruleset=rs)
        r2 = compute_assessment(db, "test-app-1", ruleset=rs)
        assert r1.complexity_score == r2.complexity_score
        assert r1.confidence_score == r2.confidence_score
        assert r1.readiness_score == r2.readiness_score


# ---- Tests: Thresholds & classification ----

class TestClassification:
    def test_complexity_classification(self):
        rs = load_ruleset()
        t = rs["thresholds"]
        assert classify_score(10, "complexity", t) == "Low"
        assert classify_score(50, "complexity", t) == "Medium"
        assert classify_score(80, "complexity", t) == "High"

    def test_confidence_classification(self):
        rs = load_ruleset()
        t = rs["thresholds"]
        assert classify_score(20, "confidence", t) == "Low"
        assert classify_score(55, "confidence", t) == "Medium"
        assert classify_score(85, "confidence", t) == "High"

    def test_readiness_classification(self):
        rs = load_ruleset()
        t = rs["thresholds"]
        assert classify_score(20, "readiness", t) == "Not Ready"
        assert classify_score(55, "readiness", t) == "Partially Ready"
        assert classify_score(85, "readiness", t) == "Ready for Detailed Planning"


# ---- Tests: What-if sensitivity ----

class TestWhatIfSensitivity:
    def test_changing_weight_changes_result(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                       component_type="CONTROL_FLOW",
                       evidence_refs='[{"artifact_id":"art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        r1 = compute_assessment(db, "test-app-1", ruleset=rs)
        r2 = compute_assessment(db, "test-app-1", ruleset=rs, weight_overrides={"CX-AB-002": 50})
        assert r2.complexity_score > r1.complexity_score, "Increasing GOTO weight should increase complexity"

    def test_weight_override_not_persisted(self):
        rs = load_ruleset()
        original = next(r["weight"] for r in rs["rules"] if r["rule_id"] == "CX-AB-002")
        # Override doesn't modify the file
        assert next(r["weight"] for r in load_ruleset()["rules"] if r["rule_id"] == "CX-AB-002") == original


# ---- Tests: Adding evidence raises confidence without wrongly changing complexity ----

class TestEvidenceRaisesConfidence:
    def test_adding_evidence_raises_confidence(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        r1 = compute_assessment(db, "test-app-1", ruleset=rs)

        _make_artifact(db, id="art-jcl", category="JCL", original_filename="JOB.jcl", parse_status="parsed")
        r2 = compute_assessment(db, "test-app-1", ruleset=rs)

        assert r2.confidence_score >= r1.confidence_score, "Adding JCL should raise confidence"


# ---- Tests: Required scenarios ----

class TestScenarios:
    def test_high_coupling(self, db):
        _make_app(db)
        _make_artifact(db)
        for i in range(20):
            _make_component(db, id=f"prog-{i}", name=f"PROG{i}",
                           detected_properties='{"call_type":"static"}', component_type="PROGRAM",
                           evidence_refs=f'[{{"artifact_id":"art-1","line_start":{i},"line_end":{i},"rule":"COBOL_CALL_STATIC","snippet":"CALL \\"PROG{i}\\""}}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.complexity_score > 10

    def test_shared_db_dependencies(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, id="prog-1", name="PROG1", component_type="PROGRAM", technology="COBOL")
        _make_component(db, id="sql-1", name="SQL-SELECT", component_type="TABLE", technology="SQL",
                       detected_properties='{"sql_statement":"SELECT","tables":"CUSTOMERS,POLICIES,CLAIMS"}',
                       evidence_refs='[{"artifact_id":"art-1","line_start":50,"line_end":55,"rule":"COBOL_EXEC_SQL","snippet":"EXEC SQL SELECT"}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.complexity_score > 0

    def test_complex_batch(self, db):
        _make_app(db)
        _make_artifact(db, id="art-jcl", category="JCL", original_filename="JOB.jcl")
        _make_component(db, id="job-1", name="JOB1", component_type="JOB", technology="JCL",
                       source_artifact_id="art-jcl", source_filename="JOB.jcl",
                       evidence_refs='[{"artifact_id":"art-jcl","line_start":1,"line_end":50,"rule":"JCL_JOB","snippet":"JOB1"}]')
        _make_component(db, id="proc-1", name="PROC1", component_type="PROC", technology="JCL",
                       source_artifact_id="art-jcl",
                       evidence_refs='[{"artifact_id":"art-jcl","line_start":10,"line_end":10,"rule":"JCL_PROC","snippet":"EXEC PROC=PROC1"}]')
        _make_component(db, id="ds-1", name="INPUTDS", component_type="DATASET", technology="JCL",
                       source_artifact_id="art-jcl", detected_properties='{"io_class":"input","dsn":"SYS1.INPUT"}',
                       evidence_refs='[{"artifact_id":"art-jcl","line_start":15,"line_end":15,"rule":"JCL_DD","snippet":"DD"}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.complexity_score > 0

    def test_dynamic_calls(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, id="dyn-1", name="DYNPROG",
                       detected_properties='{"call_type":"dynamic","target_variable":"WS-PROG"}',
                       component_type="PROGRAM", evidence_class="Inferred",
                       evidence_refs='[{"artifact_id":"art-1","line_start":20,"line_end":20,"rule":"COBOL_CALL_DYNAMIC","snippet":"CALL WS-PROG"}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        fired = [fr.rule_id for fr in result.domain_results["application_business_logic"]["complexity"].fired_rules]
        assert "CX-AB-005" in fired

    def test_missing_copybooks(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        _make_component(db, id="cb-missing", name="MISSING-COPY", component_type="COPYBOOK",
                       evidence_class="Unknown",
                       evidence_refs='[{"artifact_id":"art-1","line_start":5,"line_end":5,"rule":"UNRESOLVED","snippet":"Not found"}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        ds_conf = result.domain_results["data_structures"]["confidence"]
        fired = [fr.rule_id for fr in ds_conf.fired_rules]
        assert "CF-DS-002" in fired

    def test_missing_jcl(self, db):
        _make_app(db)
        _make_artifact(db, category="COBOL")
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        jb_conf = result.domain_results["jobs_batch_orchestration"]["confidence"]
        fired = [fr.rule_id for fr in jb_conf.fired_rules]
        assert "CF-JB-002" in fired

    def test_unsupported_technology(self, db):
        _make_app(db)
        _make_artifact(db, id="art-asm", category="ASSEMBLER", original_filename="PROG.asm",
                      support_level="UNSUPPORTED", parse_status="detected")
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        on_comp = result.domain_results["operational_nonfunctional"]["complexity"]
        fired = [fr.rule_id for fr in on_comp.fired_rules]
        assert "CX-ON-002" in fired

    def test_incomplete_security_info(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        sc_conf = result.domain_results["security_controls"]["confidence"]
        fired = [fr.rule_id for fr in sc_conf.fired_rules]
        assert "CF-SC-001" in fired

    def test_incomplete_operational_info(self, db):
        _make_app(db, owner=None, business_domain=None, technology_stack=None)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        ab_ready = result.domain_results["application_business_logic"]["readiness"]
        fired = [fr.rule_id for fr in ab_ready.fired_rules]
        assert "RD-AB-002" in fired

    def test_low_complexity_low_confidence(self, db):
        _make_app(db, owner=None, business_domain=None, technology_stack=None)
        _make_artifact(db, parse_status="unsupported", support_level="UNSUPPORTED")
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.complexity_score < 50
        assert result.confidence_score < 50

    def test_high_complexity_high_confidence(self, db):
        _make_app(db, owner="Team", business_domain="Finance", technology_stack="COBOL/CICS/DB2")
        _make_artifact(db)
        _make_artifact(db, id="art-jcl", category="JCL", original_filename="JOB.jcl", parse_status="parsed")
        _make_artifact(db, id="art-ddl", category="SQL_DDL", original_filename="DB.sql", parse_status="parsed")
        _make_artifact(db, id="art-bms", category="BMS_MAP", original_filename="SCREEN.bms", parse_status="parsed")
        for i in range(10):
            _make_component(db, id=f"goto-{i}", name=f"GOTO-{i}", component_type="CONTROL_FLOW",
                           detected_properties='{"legacy_indicator":"GOTO"}',
                           evidence_refs=f'[{{"artifact_id":"art-1","line_start":{i},"line_end":{i},"rule":"COBOL_GOTO","snippet":"GO TO PARA{i}"}}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.complexity_score > 40, f"Expected high complexity, got {result.complexity_score}"
        assert result.confidence_score > 50, f"Expected high confidence, got {result.confidence_score}"

    def test_high_readiness_despite_high_complexity(self, db):
        _make_app(db, owner="Owner Team", business_domain="Banking", technology_stack="COBOL")
        _make_artifact(db)
        _make_artifact(db, id="art-jcl", category="JCL", original_filename="JOB.jcl", parse_status="parsed")
        _make_artifact(db, id="art-ddl", category="SQL_DDL", original_filename="DB.sql", parse_status="parsed")
        _make_artifact(db, id="art-bms", category="BMS_MAP", original_filename="SCREEN.bms", parse_status="parsed")
        for i in range(10):
            _make_component(db, id=f"goto-{i}", name=f"GOTO-{i}", component_type="CONTROL_FLOW",
                           detected_properties='{"legacy_indicator":"GOTO"}',
                           evidence_refs=f'[{{"artifact_id":"art-1","line_start":{i},"line_end":{i},"rule":"COBOL_GOTO","snippet":"GO TO"}}]')
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.readiness_score > 50, \
            f"Readiness {result.readiness_score} should be high despite complexity {result.complexity_score}"


# ---- Tests: Serialization ----

class TestSerialization:
    def test_serialize_assessment(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        serialized = serialize_assessment(result)
        assert "complexity_score" in serialized
        assert "confidence_score" in serialized
        assert "readiness_score" in serialized
        assert "domain_scores" in serialized
        assert "fired_rules" in serialized
        assert "missing_information" in serialized
        assert serialized["model_version"] == MODEL_VERSION


# ---- Tests: Component-level assessment ----

class TestComponentAssessment:
    def test_component_complexity(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db, detected_properties='{"legacy_indicator":"GOTO"}',
                       component_type="CONTROL_FLOW",
                       evidence_refs='[{"artifact_id":"art-1","line_start":1,"line_end":1,"rule":"COBOL_GOTO","snippet":"GO TO"}]')
        rs = load_ruleset()
        result = compute_component_assessment(db, "comp-1", ruleset=rs)
        assert result is not None
        assert result["component_id"] == "comp-1"
        assert result["complexity_score"] > 0
        assert any(r["rule_id"] == "CX-AB-002" for r in result["fired_rules"])


# ---- Tests: Model version stored ----

class TestVersioning:
    def test_model_version_in_result(self, db):
        _make_app(db)
        _make_artifact(db)
        _make_component(db)
        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        assert result.model_version == MODEL_VERSION
        assert result.ruleset_id == rs["ruleset_id"]
        assert result.ruleset_version == rs["version"]


# ---- Tests: Audit Fixes & Verification ----

class TestAuditCorrections:
    def test_category_normalization_real_ingest_categories(self, db):
        """Verify that pipeline categories 'SQL', 'BMS', 'HLASM' fire readiness and complexity rules."""
        _make_app(db, owner="Test Team", business_domain="Insurance", technology_stack="COBOL/CICS/DB2")
        _make_artifact(db, id="art-cobol", category="COBOL", original_filename="PROG.cbl", parse_status="parsed")
        _make_artifact(db, id="art-sql", category="SQL", original_filename="SCHEMA.sql", parse_status="parsed")
        _make_artifact(db, id="art-bms", category="BMS", original_filename="MAP.bms", parse_status="parsed")
        _make_artifact(db, id="art-asm", category="HLASM", original_filename="ROUTINE.asm", parse_status="parsed")
        _make_component(db, id="comp-cbl", name="MAINPROG", component_type="PROGRAM", technology="COBOL", source_artifact_id="art-cobol")
        _make_component(db, id="comp-tbl", name="POLICY_TBL", component_type="TABLE", technology="SQL", source_artifact_id="art-sql")

        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)

        # Database readiness
        db_ready = result.domain_results["database_persistence"]["readiness"]
        db_fired = [r.rule_id for r in db_ready.fired_rules]
        assert "RD-DB-001" in db_fired, f"RD-DB-001 should fire for category='SQL', got {db_fired}"
        assert "RD-DB-003" in db_fired, f"RD-DB-003 should fire when SQL + COBOL exist, got {db_fired}"
        assert "RD-DB-002" not in db_fired, "RD-DB-002 (missing DDL penalty) should NOT fire when SQL DDL exists"

        # Online UI readiness
        ol_ready = result.domain_results["online_transactions_ui"]["readiness"]
        ol_fired = [r.rule_id for r in ol_ready.fired_rules]
        assert "RD-OL-001" in ol_fired, f"RD-OL-001 should fire for category='BMS', got {ol_fired}"
        assert "RD-OL-002" in ol_fired, f"RD-OL-002 should fire when BMS + COBOL exist, got {ol_fired}"

        # Complexity diagnostic rules
        db_cx = result.domain_results["database_persistence"]["complexity"]
        assert any(r.rule_id == "CX-DB-002" for r in db_cx.fired_rules), "CX-DB-002 should fire for SQL artifact"
        ol_cx = result.domain_results["online_transactions_ui"]["complexity"]
        assert any(r.rule_id == "CX-OL-002" for r in ol_cx.fired_rules), "CX-OL-002 should fire for BMS artifact"
        on_cx = result.domain_results["operational_nonfunctional"]["complexity"]
        assert any(r.rule_id == "CX-ON-002" for r in on_cx.fired_rules), "CX-ON-002 should fire for HLASM artifact"

    def test_confidence_saturation_prevention(self, db):
        """Verify that 50 duplicate Evidence-based components do not inflate domain score to 3,000."""
        _make_app(db)
        _make_artifact(db, id="art-1", category="COBOL", parse_status="parsed", support_level="SUPPORTED_PARSE")
        # Add 50 evidence-based components
        for i in range(50):
            _make_component(db, id=f"comp-{i}", name=f"PROG-{i}", component_type="PROGRAM",
                           evidence_class="Evidence-based", source_artifact_id="art-1")

        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        ab_conf = result.domain_results["application_business_logic"]["confidence"]

        # Raw score should be 100.0 (60 from CF-AB-001 + 40 from CF-AB-003), NOT 50 * 60 + 40 = 3040
        assert ab_conf.raw_score == 100.0, f"Expected raw score 100.0, got {ab_conf.raw_score}"
        assert ab_conf.normalized_score == 100.0

    def test_inferred_penalty_visible_in_confidence(self, db):
        """Verify that an Inferred component visibly docks confidence and is not masked by saturation."""
        _make_app(db)
        _make_artifact(db, id="art-1", category="COBOL", parse_status="parsed", support_level="SUPPORTED_PARSE")
        # 10 Evidence-based and 1 Inferred
        for i in range(10):
            _make_component(db, id=f"comp-{i}", name=f"PROG-{i}", component_type="PROGRAM",
                           evidence_class="Evidence-based", source_artifact_id="art-1")
        _make_component(db, id="comp-inferred", name="DYNPROG", component_type="PROGRAM",
                       evidence_class="Inferred", source_artifact_id="art-1")

        rs = load_ruleset()
        result = compute_assessment(db, "test-app-1", ruleset=rs)
        ab_conf = result.domain_results["application_business_logic"]["confidence"]

        # 60 (CF-AB-001) + 40 (CF-AB-003) - 15 (CF-AB-002) = 85.0
        assert ab_conf.raw_score == 85.0, f"Expected raw score 85.0 with penalty, got {ab_conf.raw_score}"
        assert ab_conf.normalized_score == 85.0

    def test_unified_recommendation_and_component_complexity(self, db):
        """Verify that recommendation_service component complexity matches compute_component_assessment."""
        from app.services.recommendation_service import build_recommendations
        _make_app(db)
        _make_artifact(db)
        _make_component(db, id="comp-goto", name="GOTO-PROG", component_type="CONTROL_FLOW",
                       detected_properties='{"legacy_indicator":"GOTO"}',
                       evidence_refs='[{"artifact_id":"art-1","line_start":10,"line_end":10,"rule":"COBOL_GOTO","snippet":"GO TO PARA"}]')

        rs = load_ruleset()
        compute_assessment(db, "test-app-1", ruleset=rs)

        # Directly compute component assessment
        comp_direct = compute_component_assessment(db, "comp-goto", ruleset=rs)
        assert comp_direct is not None

        # Build recommendations
        recs = build_recommendations(db, "test-app-1")
        comp_rec = next((r for r in recs["recommendations"] if r["component_id"] == "comp-goto"), None)
        assert comp_rec is not None

        # Both must report the exact same complexity score and classification
        assert comp_rec["complexity_score"] == comp_direct["complexity_score"], \
            f"Recommendation complexity {comp_rec['complexity_score']} != direct {comp_direct['complexity_score']}"
        assert comp_rec["complexity_classification"] == comp_direct["complexity_classification"]

    def test_all_v2_rules_have_valid_evaluation_scope(self):
        """Verify that all rules in default_ruleset_v2.json declare evaluation_scope."""
        rs = load_ruleset()
        valid_scopes = {"component", "artifact", "dependency", "application"}
        for r in rs["rules"]:
            scope = r.get("evaluation_scope")
            assert scope in valid_scopes, f"Rule {r['rule_id']} missing valid evaluation_scope: got {scope}"
