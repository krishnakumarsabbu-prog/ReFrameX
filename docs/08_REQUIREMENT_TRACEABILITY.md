# 8. Requirement Traceability Matrix

This matrix maps every challenge requirement, FAQ item, deliverable, domain, and judging criterion to the feature, file, and test that satisfies it. It does not claim a judging score.

## Judging Criteria

| Criterion | Weight | Feature | File | Test |
|---|---|---|---|---|
| Breadth | 25 | 14 modules: Dashboard, Applications, Artifacts, Intelligence, Dependencies, Assessment, Evidence, Risks, Recommendations, Simulator, Reports, Compare, Evidence Improvement, Settings | `src/App.tsx` (routes), `src/pages/*` | `test_api.py` (all endpoints), `test_phase9_validation.py::TestAssessmentAPI` |
| Accuracy and evidence | 25 | Evidence-classified findings, line-numbered references, 99.36% benchmark parser accuracy, deterministic scoring | `backend/app/assessment/scoring_engine.py`, `backend/app/assessment/accuracy_report.py` | `test_parsers.py`, `test_scoring.py::TestScenarios`, `test_phase9_validation.py::TestDependencyGraphRules` |
| Reusability | 20 | JSON ruleset, parser registry, pluggable architecture, Reuse Guide | `backend/app/assessment/rulesets/default_ruleset_v2.json`, `backend/app/parsers/base.py` | `test_scoring.py::TestRulesetValidation`, `test_parsers.py::test_registry_*` |
| Explainability | 15 | Per-rule evidence refs, drill-down drawers, domain breakdown, missing-information registry, evidence classifications | `src/pages/AssessmentPage.tsx`, `src/pages/EvidenceExplorerPage.tsx` | `test_scoring.py::TestSerialization`, `test_phase9_validation.py::TestAssessmentAPI` |
| Extensibility | 10 | `@register_parser` decorator, `CapabilityLevel` enum, schema-validated ruleset, what-if weight simulation | `backend/app/parsers/base.py`, `backend/app/assessment/ruleset_schema.json` | `test_scoring.py::TestWhatIfSensitivity`, `test_phase9_validation.py::TestWeightSensitivity` |
| Usability | 5 | Glass UI, search, responsive design, reduce-transparency toggle, bottom tab navigation | `src/layouts/AppLayout.tsx`, `src/components/*` | Frontend build passes (`npm run build`) |

## Challenge Requirements

| Requirement | Feature | File | Test |
|---|---|---|---|
| Migration Complexity score | Complexity scoring with 34 rules, 8 domains | `scoring_engine.py::compute_assessment` | `test_scoring.py::TestScenarios` |
| Assessment Confidence score | Confidence scoring with 23 rules | `scoring_engine.py::compute_assessment` | `test_scoring.py::TestMissingArtifacts` |
| Migration Readiness score | Readiness scoring with 23 rules | `scoring_engine.py::compute_assessment` | `test_scoring.py::TestScenarios::test_high_readiness_despite_high_complexity` |
| Three measures computed independently | Separate rule sets, separate normalization, separate aggregation | `scoring_engine.py` L66, L790-810 | `test_scoring.py::TestMeasureIndependence`, `test_phase9_validation.py::TestMeasureIndependenceExtended` |
| Evidence classification (Evidence-based, Inferred, Assumed, Unknown) | Per-component evidence_class, per-finding evidence_class | `backend/app/parsers/base.py` L33, `backend/app/services/finding_service.py` | `test_parsers.py::test_cobol_extracts_dynamic_call` (Inferred) |
| Traceable evidence (artifact, line, rule) | Evidence refs with artifact_id, line_start, line_end, rule, snippet | `scoring_engine.py::RuleFiring` | `test_scoring.py::TestSerialization` |
| Dependency graph | React Flow interactive graph | `src/pages/DependenciesPage.tsx`, `backend/app/services/dependency_service.py` | `test_phase9_validation.py::TestDependencyGraphRules` |
| Missing-information reporting | Missing-info registry, Unknowns and Risks page | `backend/app/services/finding_service.py`, `src/pages/UnknownsAndRisksPage.tsx` | `test_scoring.py::TestMissingArtifacts` |
| Recommendations | Prioritized, evidence-linked recommendations | `backend/app/services/recommendation_service.py`, `src/pages/RecommendationsPage.tsx` | `test_phase9_validation.py::TestAssessmentAPI` |
| Human review | Reviewer actions, override, audit trail | `backend/app/services/review_service.py`, `src/pages/EvidenceExplorerPage.tsx` | `test_phase9_validation.py::TestHumanReviewed` |
| No random/hardcoded/AI scores | Deterministic scoring, no RNG, no AI in default mode | `scoring_engine.py` | `test_scoring.py::TestReproducibility` |
| Missing evidence != simplicity | Domains without evidence excluded, not scored as low | `scoring_engine.py` L830-831 | `test_scoring.py::TestMissingArtifacts::test_missing_evidence_not_simplicity` |
| No full COBOL semantic analysis claim | PARTIAL_EXTRACT capability, documented limitation | `docs/07_LIMITATIONS.md`, `docs/PARSER_COVERAGE.md` | N/A (documentation) |
| Preserve original artifacts | Files stored read-only, original path in DB | `backend/app/services/artifact_service.py` | `test_api.py::test_artifact_upload_and_summary` |
| Rule/model/parser versions preserved | model_version, ruleset_id, ruleset_version in results | `scoring_engine.py::AssessmentResult` | `test_scoring.py::TestVersioning` |
| Reviewer changes stored separately | review_actions table, immutable findings | `backend/app/models/models.py`, `backend/app/services/review_service.py` | `test_phase9_validation.py::TestHumanReviewed` |

## Assessment Domains

| Domain | Weight | Rules | Test |
|---|---|---|---|
| application_business_logic | 0.18 | CX-AB-001 through CX-AB-009, CF-AB-001-003, RD-AB-001-002 | `test_scoring.py::TestScenarios::test_high_coupling`, `test_dynamic_calls` |
| data_structures | 0.12 | CX-DS-001-003, CF-DS-001-002, RD-DS-001-002 | `test_scoring.py::TestScenarios::test_missing_copybooks` |
| database_persistence | 0.15 | CX-DB-001-004, CF-DB-001-002, RD-DB-001-002 | `test_scoring.py::TestScenarios::test_shared_db_dependencies` |
| jobs_batch_orchestration | 0.12 | CX-JB-001-004, CF-JB-001-002, RD-JB-001 | `test_scoring.py::TestScenarios::test_complex_batch`, `test_missing_jcl` |
| online_transactions_ui | 0.15 | CX-OL-001-005, CF-OL-001, RD-OL-001 | (via BMS artifact tests) |
| integration_external_dependencies | 0.12 | CX-IX-001-005, CF-IX-001-002, RD-IX-001-002 | `test_phase9_validation.py::TestDependencyGraphRules` |
| security_controls | 0.08 | CX-SC-001, CF-SC-001, RD-SC-001 | `test_scoring.py::TestScenarios::test_incomplete_security_info` |
| operational_nonfunctional | 0.08 | CX-ON-001-003, CF-ON-001-002, RD-ON-001-003 | `test_scoring.py::TestScenarios::test_unsupported_technology` |

## Required Assessment Scenarios

| Scenario | Test | File |
|---|---|---|
| High program coupling | `test_high_coupling` | `test_scoring.py` |
| Shared DB dependencies | `test_shared_db_dependencies` | `test_scoring.py` |
| Complex batch | `test_complex_batch` | `test_scoring.py` |
| Dynamic calls | `test_dynamic_calls` | `test_scoring.py` |
| Missing copybooks | `test_missing_copybooks` | `test_scoring.py` |
| Missing JCL | `test_missing_jcl` | `test_scoring.py` |
| Unsupported technology | `test_unsupported_technology` | `test_scoring.py` |
| Incomplete security info | `test_incomplete_security_info` | `test_scoring.py` |
| Incomplete operational info | `test_incomplete_operational_info` | `test_scoring.py` |
| Low complexity + low confidence | `test_low_complexity_low_confidence` | `test_scoring.py` |
| High complexity + high confidence | `test_high_complexity_high_confidence` | `test_scoring.py` |
| High readiness despite high complexity | `test_high_readiness_despite_high_complexity` | `test_scoring.py` |
| Circular dependency | `test_circular_dependency_fires_cx_ix_004` | `test_phase9_validation.py` |
| Unresolved dependency | `test_unresolved_dependency_fires_cx_ix_003` | `test_phase9_validation.py` |
| Single point of dependency | (via CX-IX-005 rule) | `test_phase9_validation.py` |
| Weight sensitivity | `test_zeroing_weight_removes_rule_impact`, `test_doubling_weight_increases_complexity` | `test_phase9_validation.py` |
| Measure independence under weight changes | `test_multiple_weight_changes_are_independent` | `test_phase9_validation.py` |
| Human-reviewed confidence boost | `test_human_reviewed_boosts_confidence` | `test_phase9_validation.py` |
| End-to-end API | `test_assess_endpoint_returns_full_result` | `test_phase9_validation.py` |
| Reanalysis no duplicates | `test_reanalysis_no_duplicates` | `test_phase9_validation.py` |

## Deliverables

| Deliverable | Document |
|---|---|
| 1. Problem Definition | `docs/01_PROBLEM_DEFINITION.md` |
| 2. Proposed Solution | `docs/02_PROPOSED_SOLUTION.md` |
| 3. Expected Business Value | `docs/03_EXPECTED_BUSINESS_VALUE.md` |
| 4. Demonstration script | `docs/04_DEMONSTRATION_SCRIPT.md` |
| 5. Implementation Considerations | `docs/05_IMPLEMENTATION_CONSIDERATIONS.md` |
| 6. Reuse Guide | `docs/06_REUSE_GUIDE.md` |
| 7. Limitations list | `docs/07_LIMITATIONS.md` |
| 8. Traceability matrix | `docs/08_REQUIREMENT_TRACEABILITY.md` |
| 9. Presentation kit | `docs/09_PRESENTATION_KIT.md` |
| Parser accuracy table | `docs/PARSER_COVERAGE.md` |
| Scoring methodology | `docs/SCORING_METHODOLOGY.md` |
| Automation model | `docs/AUTOMATION_MODEL.md` |
| Data profile | `docs/DATA_PROFILE.md` |
