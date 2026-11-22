"""Executive report service — assembles structured report from stored results only.

Report sections (per Phase 7 spec):
  Executive Summary; Application Overview; Artifact Inventory; Component Inventory;
  Dependency Analysis; Eight Domain Assessments; Migration Complexity;
  Assessment Confidence; Migration Readiness; Major Risks; Evidence Gaps;
  Component Recommendations; Refactoring Considerations; Prioritized Next Steps;
  Parser Coverage and Accuracy; Automation and AI-Usage Statement;
  Limitations and Assumptions; Ruleset/Model/Parser Versions; Reviewer Changes.

All data is pulled from stored assessment records, components, dependencies,
findings, and artifacts — never recomputed or invented. Measured business-value
metrics show only measurable facts (no invented savings).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import (
    Application,
    Artifact,
    Component,
    Dependency,
    AssessmentRecord,
    Finding,
    ReviewAction,
    AnalysisRun,
    LLMEvaluation,
)
from app.core.config import settings
from app.assessment.scoring_engine import (
    DOMAIN_LABELS,
    MODEL_VERSION,
    get_ruleset_info,
    load_ruleset,
)
from app.services import assessment_service, finding_service
from app.services.recommendation_service import build_recommendations
from app.services.roadmap_service import build_roadmap
from app.services.evidence_metrics_service import get_full_evidence_metrics


def _parse_json(val: str | None, default: Any) -> Any:
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _get_latest_assessment_record(db: Session, application_id: str) -> AssessmentRecord | None:
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id,
        AssessmentRecord.is_current == True,  # noqa: E712
    ).order_by(AssessmentRecord.computed_at.desc()).first()
    if not record:
        record = db.query(AssessmentRecord).filter(
            AssessmentRecord.application_id == application_id
        ).order_by(AssessmentRecord.computed_at.desc()).first()
    return record


def build_report(db: Session, application_id: str) -> dict | None:
    """Assemble a complete executive assessment report from stored data."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return None

    record = _get_latest_assessment_record(db, application_id)
    assessment = json.loads(record.result_json) if record else {}

    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()
    components = db.query(Component).filter(Component.application_id == application_id).all()
    dependencies = db.query(Dependency).filter(Dependency.application_id == application_id).all()
    findings = db.query(Finding).filter(Finding.application_id == application_id).all()

    # Ensure findings are rebuilt if empty
    if not findings and record:
        finding_service.rebuild_findings(db, application_id)
        findings = db.query(Finding).filter(Finding.application_id == application_id).all()

    # Latest analysis run
    run = db.query(AnalysisRun).filter(
        AnalysisRun.application_id == application_id
    ).order_by(AnalysisRun.started_at.desc()).first()

    parser_versions = _parse_json(run.parser_versions, {}) if run else {}

    # Build sections
    report: dict[str, Any] = {
        "report_metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "application_id": application_id,
            "application_name": app.name,
            "assessment_record_id": record.id if record else None,
            "assessment_version": record.version if record else None,
            "report_format": "reframex-executive-report-v1",
            "generator": "ReframeX M2O Intelligence",
        },
        "executive_summary": _build_executive_summary(app, assessment, artifacts, components, dependencies, findings, record),
        "application_overview": _build_application_overview(app),
        "artifact_inventory": _build_artifact_inventory(artifacts),
        "component_inventory": _build_component_inventory(components),
        "dependency_analysis": _build_dependency_analysis(dependencies, components),
        "domain_assessments": _build_domain_assessments(assessment),
        "migration_complexity": _build_measure_section(assessment, "complexity", record),
        "assessment_confidence": _build_measure_section(assessment, "confidence", record),
        "migration_readiness": _build_measure_section(assessment, "readiness", record),
        "major_risks": _build_major_risks(findings),
        "evidence_gaps": _build_evidence_gaps(findings, artifacts),
        "component_recommendations": _build_recommendations_section(db, application_id),
        "refactoring_considerations": _build_refactoring_considerations(assessment, components, dependencies),
        "prioritized_next_steps": _build_next_steps(db, application_id, assessment),
        "parser_coverage_and_accuracy": _build_parser_coverage(artifacts, components, parser_versions),
        "automation_and_ai_statement": _build_automation_statement(),
        "limitations_and_assumptions": _build_limitations(assessment),
        "versions": _build_versions(assessment, parser_versions, record),
        "reviewer_changes": _build_reviewer_changes(findings),
        "measured_metrics": _build_measured_metrics(artifacts, components, dependencies, findings, run, record),
        "evidence_metrics": _build_evidence_metrics_section(db, application_id),
        "ai_usage_statement": _build_ai_usage_statement(db, application_id),
        "methodology": _build_methodology(),
    }

    return report


DOMAIN_DESCRIPTIONS = {
    "application_business_logic": "Procedural business rules embedded in programs: paragraphs, sections, PERFORM/GOTO control flow, COMP-3 arithmetic, hardcoded literals and dates.",
    "data_structures": "Record layouts and field definitions from copybooks: REDEFINES overlays, OCCURS arrays, packed/binary field types, group hierarchy depth.",
    "database_persistence": "Data access surfaces: embedded SQL, DB2 DDL, table/index definitions, cursor usage and DB2-specific coupling.",
    "jobs_batch_orchestration": "Job control: JCL steps, procedure calls, ordering and restart semantics, scheduler coupling, dataset dependencies.",
    "online_transactions_ui": "Transaction monitors and screen maps: CICS transactions, COMMAREA contracts, BMS maps, terminal-oriented presentation logic.",
    "integration_external_dependencies": "Contract surfaces beyond the application boundary: COPY members, program CALL targets, dynamic calls, external systems and interface files.",
    "security_controls": "Access and protection concerns: RACF-style security checks, credentials in source, dataset protection and authorization flows.",
    "operational_nonfunctional": "Runtime and operations: configuration, abends/restart handling, resource utilisation, operational knob exposure.",
}


def _build_methodology() -> dict:
    """Describe how the document was produced, straight from the loaded ruleset."""
    try:
        info = get_ruleset_info(load_ruleset())
    except Exception:
        info = {}

    return {
        "pipeline": [
            {"step": "01", "title": "Ingest", "detail": "Artifacts are stored byte-for-byte with SHA-256 digests, detected encoding, category and support level. No content is transformed at this stage."},
            {"step": "02", "title": "Preprocess", "detail": "Fixed-format records are rebuilt into logical lines, sequence/indicator columns are stripped, comments and blanks removed, continuation handled."},
            {"step": "03", "title": "Parse", "detail": "Language-specific parsers emit normalized components, each carrying an evidence reference of artifact, line range, rule and snippet."},
            {"step": "04", "title": "Identify", "detail": "Components are grouped into stable identities so the same paragraph or record keeps its identity across re-analysis runs."},
            {"step": "05", "title": "Resolve dependencies", "detail": "COPY members, CALL targets, transactions and datasets are linked. Unresolved targets are recorded as Unknown rather than guessed."},
            {"step": "06", "title": "Evaluate rules", "detail": "Every rule in the declared ruleset is evaluated against every applicable component or artifact. A rule either produces evidence or it does not; nothing is sampled."},
            {"step": "07", "title": "Score", "detail": "Domain results are normalized (hyperbolic saturation for complexity, baseline plus accumulated points for confidence and readiness) and weighted into the three top-level measures."},
            {"step": "08", "title": "Publish", "detail": "Scores, findings, evidence references and versions are persisted as an immutable assessment record. Reviewers append decisions; machine output is never overwritten."},
        ],
        "evidence_classes": [
            {"name": "Evidence-based", "meaning": "Read directly from source at a specific file and line range.", "tone": "emerald"},
            {"name": "Inferred", "meaning": "Derived by analysis across evidence, with the derivation rule named.", "tone": "blue"},
            {"name": "Assumed", "meaning": "Taken as working assumption; requires confirmation before it drives a decision.", "tone": "amber"},
            {"name": "Unknown", "meaning": "Referenced but not resolvable from supplied material. Recorded, never silently dropped.", "tone": "rose"},
        ],
        "measures": {
            "complexity": {
                "label": "Migration Complexity",
                "question": "How much work is this change likely to require?",
                "formula": "100 × raw / (raw + K), K = {k}".format(k=info.get("hyperbolic_k", 20.0)),
                "detail": "Each firing of a complexity rule adds its weight to the domain raw score. The hyperbolic curve saturates, so the first few findings matter most and additional findings have diminishing effect. That prevents a single noisy file from dominating the score. Only domains that produced evidence are included, and the domain weights are renormalised over those domains.",
            },
            "confidence": {
                "label": "Assessment Confidence",
                "question": "How much of this application did we actually see?",
                "formula": "min(Σ wᵢ·cᵢ + baseline, coverage × 100)",
                "detail": "Confidence is a property of the evidence, not of the code. It accumulates positive rule points per domain, weighted by the ruleset domain weights, then is capped by the evidence coverage ratio so that an application with large blind spots cannot present high confidence.",
            },
            "readiness": {
                "label": "Migration Readiness",
                "question": "Is there enough trustworthy information to plan the migration?",
                "formula": "clamp(baseline + Σ positive − Σ negative, 0, 100)",
                "detail": "Readiness reflects whether prerequisites for detailed planning exist: required artifact categories present, parsers succeeding, dependencies resolved, and no blocking unknowns. It is deliberately independent of complexity — a simple application can be unready if evidence is missing.",
            },
        },
        "thresholds": info.get("thresholds", {}),
        "domain_weights": {DOMAIN_LABELS.get(d, d): w for d, w in (info.get("domain_weights") or {}).items()},
        "domain_descriptions": {DOMAIN_LABELS.get(d, d): desc for d, desc in DOMAIN_DESCRIPTIONS.items()},
        "rules": {
            "total": info.get("rule_counts", {}).get("total", 0),
            "by_measure": info.get("rule_counts", {}).get("by_measure", {}),
            "by_domain": info.get("rule_counts", {}).get("by_domain", {}),
        },
        "ruleset": {
            "id": info.get("ruleset_id", ""),
            "version": info.get("version", ""),
            "effective_date": info.get("effective_date", ""),
            "owner": info.get("owner", ""),
            "changelog": info.get("changelog", []),
        },
    }


def _build_executive_summary(
    app: Application, assessment: dict, artifacts: list, components: list,
    dependencies: list, findings: list, record: AssessmentRecord | None,
) -> dict:
    complexity = assessment.get("complexity_score", 0)
    confidence = assessment.get("confidence_score", 0)
    readiness = assessment.get("readiness_score", 0)

    unknown_count = sum(1 for f in findings if f.evidence_class == "Unknown")
    high_severity = sum(1 for f in findings if f.severity == "high")

    has_assessment = record is not None

    return {
        "application_name": app.name,
        "has_assessment": has_assessment,
        "complexity_score": round(complexity, 1) if has_assessment else None,
        "complexity_classification": assessment.get("complexity_classification", "Not assessed"),
        "confidence_score": round(confidence, 1) if has_assessment else None,
        "confidence_classification": assessment.get("confidence_classification", "Not assessed"),
        "readiness_score": round(readiness, 1) if has_assessment else None,
        "readiness_classification": assessment.get("readiness_classification", "Not assessed"),
        "artifact_count": len(artifacts),
        "component_count": len(components),
        "dependency_count": len(dependencies),
        "finding_count": len(findings),
        "unknown_evidence_count": unknown_count,
        "high_severity_finding_count": high_severity,
        "assessment_version": record.version if record else None,
        "computed_at": record.computed_at.isoformat() if record and record.computed_at else None,
        "note": "This report is generated from stored assessment results. All conclusions cite their evidence class, artifact, and rule." if has_assessment else "No assessment has been run for this application. Report sections will show limited data.",
    }


def _build_application_overview(app: Application) -> dict:
    return {
        "name": app.name,
        "description": app.description,
        "business_domain": app.business_domain,
        "owner": app.owner,
        "technology_stack": app.technology_stack,
        "environment": app.environment,
        "assessment_status": app.assessment_status,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }


def _build_artifact_inventory(artifacts: list) -> dict:
    by_category: dict[str, int] = {}
    by_support: dict[str, int] = {}
    by_encoding: dict[str, int] = {}
    by_parse_status: dict[str, int] = {}
    total_size = 0

    for a in artifacts:
        by_category[a.category] = by_category.get(a.category, 0) + 1
        by_support[a.support_level] = by_support.get(a.support_level, 0) + 1
        by_encoding[a.detected_encoding] = by_encoding.get(a.detected_encoding, 0) + 1
        by_parse_status[a.parse_status] = by_parse_status.get(a.parse_status, 0) + 1
        total_size += a.size_bytes

    return {
        "total_artifacts": len(artifacts),
        "by_category": by_category,
        "by_support_level": by_support,
        "by_encoding": by_encoding,
        "by_parse_status": by_parse_status,
        "total_size_bytes": total_size,
        "artifacts": [
            {
                "id": a.id,
                "filename": a.original_filename,
                "category": a.category,
                "support_level": a.support_level,
                "parse_status": a.parse_status,
                "encoding": a.detected_encoding,
                "size_bytes": a.size_bytes,
            }
            for a in artifacts
        ],
    }


def _build_component_inventory(components: list) -> dict:
    by_type: dict[str, int] = {}
    by_technology: dict[str, int] = {}
    by_evidence: dict[str, int] = {}

    for c in components:
        by_type[c.component_type] = by_type.get(c.component_type, 0) + 1
        by_technology[c.technology] = by_technology.get(c.technology, 0) + 1
        by_evidence[c.evidence_class] = by_evidence.get(c.evidence_class, 0) + 1

    return {
        "total_components": len(components),
        "by_type": by_type,
        "by_technology": by_technology,
        "by_evidence_class": by_evidence,
        "components": [
            {
                "name": c.name,
                "type": c.component_type,
                "technology": c.technology,
                "evidence_class": c.evidence_class,
                "source_filename": c.source_filename,
                "line_start": c.line_start,
                "line_end": c.line_end,
                "parser": c.parser_name,
                "parser_version": c.parser_version,
            }
            for c in components
        ],
    }


def _build_dependency_analysis(dependencies: list, components: list) -> dict:
    by_rel_type: dict[str, int] = {}
    by_evidence: dict[str, int] = {}
    unresolved = 0

    comp_names = {c.id: c.name for c in components}

    for d in dependencies:
        by_rel_type[d.relationship_type] = by_rel_type.get(d.relationship_type, 0) + 1
        by_evidence[d.evidence_class] = by_evidence.get(d.evidence_class, 0) + 1
        if d.evidence_class == "Unknown":
            unresolved += 1

    return {
        "total_dependencies": len(dependencies),
        "by_relationship_type": by_rel_type,
        "by_evidence_class": by_evidence,
        "unresolved_targets": unresolved,
        "dependencies": [
            {
                "source": comp_names.get(d.source_component_id, d.source_component_id),
                "target": comp_names.get(d.target_component_id, d.target_component_id),
                "relationship_type": d.relationship_type,
                "evidence_class": d.evidence_class,
                "source_line": d.source_line_number,
            }
            for d in dependencies
        ],
    }


def _build_domain_assessments(assessment: dict) -> dict:
    domain_scores = assessment.get("domain_scores", {})
    out: dict[str, dict] = {}

    for domain, label in DOMAIN_LABELS.items():
        scores = domain_scores.get(domain, {})
        out[domain] = {
            "label": label,
            "complexity": scores.get("complexity", {}),
            "confidence": scores.get("confidence", {}),
            "readiness": scores.get("readiness", {}),
        }

    return out


def _build_measure_section(assessment: dict, measure: str, record: AssessmentRecord | None) -> dict:
    score = assessment.get(f"{measure}_score", 0)
    classification = assessment.get(f"{measure}_classification", "Not assessed")

    fired_rules = [r for r in assessment.get("fired_rules", []) if r.get("measure") == measure]
    positive = assessment.get("positive_factors", []) if measure == "complexity" else []
    negative = assessment.get("negative_factors", []) if measure == "complexity" else []

    if measure == "confidence":
        positive = [r["description"] for r in fired_rules if r.get("impact") == "positive"]
        negative = [r["description"] for r in fired_rules if r.get("impact") == "negative"]
    elif measure == "readiness":
        positive = [r["description"] for r in fired_rules if r.get("impact") == "positive"]
        negative = [r["description"] for r in fired_rules if r.get("impact") == "negative"]

    return {
        "score": round(score, 1) if record else None,
        "classification": classification,
        "fired_rules_count": len(fired_rules),
        "positive_factors": positive,
        "negative_factors": negative,
        "fired_rules": [
            {
                "rule_id": r.get("rule_id"),
                "description": r.get("description"),
                "impact": r.get("impact"),
                "severity": r.get("severity"),
                "weight": r.get("weight"),
                "points": r.get("points"),
                "evidence_refs": r.get("evidence_refs", []),
            }
            for r in fired_rules
        ],
    }


def _build_major_risks(findings: list) -> dict:
    high = [f for f in findings if f.severity == "high"]
    medium = [f for f in findings if f.severity == "medium"]

    def _risk_item(f: Finding) -> dict:
        return {
            "title": f.title,
            "domain": f.domain,
            "evidence_class": f.evidence_class,
            "detection_rule": f.detection_rule,
            "explanation": f.explanation,
            "recommended_action": f.recommended_action,
            "source_filename": f.source_filename,
            "line_start": f.line_start if f.has_line_ref else None,
        }

    return {
        "high_severity_count": len(high),
        "medium_severity_count": len(medium),
        "high_severity_risks": [_risk_item(f) for f in high],
        "medium_severity_risks": [_risk_item(f) for f in medium[:20]],
    }


def _build_evidence_gaps(findings: list, artifacts: list) -> dict:
    unknown = [f for f in findings if f.evidence_class == "Unknown"]
    unsupported = [a for a in artifacts if a.support_level in ("UNSUPPORTED", "DETECT_ONLY")]

    by_type: dict[str, int] = {}
    for f in unknown:
        by_type[f.finding_type] = by_type.get(f.finding_type, 0) + 1

    return {
        "total_unknown_findings": len(unknown),
        "by_type": by_type,
        "unsupported_artifacts": [
            {"filename": a.original_filename, "category": a.category, "support_level": a.support_level}
            for a in unsupported
        ],
        "unknown_findings": [
            {
                "title": f.title,
                "finding_type": f.finding_type,
                "explanation": f.explanation,
                "recommended_action": f.recommended_action,
            }
            for f in unknown
        ],
    }


def _build_recommendations_section(db: Session, application_id: str) -> dict:
    recs = build_recommendations(db, application_id)
    return {
        "total": recs.get("total", 0),
        "by_category": recs.get("by_category", {}),
        "recommendations": recs.get("recommendations", []),
    }


def _build_refactoring_considerations(assessment: dict, components: list, dependencies: list) -> dict:
    complexity_class = assessment.get("complexity_classification", "Not assessed")
    readiness_class = assessment.get("readiness_classification", "Not assessed")

    considerations: list[str] = []
    if complexity_class == "High":
        considerations.append("High overall complexity suggests phased refactoring approach rather than big-bang.")
    if readiness_class == "Not Ready":
        considerations.append("Application is not ready for detailed migration planning — resolve evidence gaps first.")
    if readiness_class == "Partially Ready":
        considerations.append("Application is partially ready — some components may be candidates while others need further analysis.")

    unresolved = sum(1 for d in dependencies if d.evidence_class == "Unknown")
    if unresolved > 0:
        considerations.append(f"{unresolved} unresolved dependency target(s) must be resolved before refactoring decisions.")

    unknown_components = sum(1 for c in components if c.evidence_class == "Unknown")
    if unknown_components > 0:
        considerations.append(f"{unknown_components} component(s) have Unknown evidence class — source not fully available.")

    considerations.append("Target platform patterns are hypotheses for further evaluation. Do not assume OpenShift or any specific runtime is the only target.")

    return {
        "complexity_classification": complexity_class,
        "readiness_classification": readiness_class,
        "considerations": considerations,
    }


def _build_next_steps(db: Session, application_id: str, assessment: dict) -> dict:
    roadmap = build_roadmap(db, application_id)
    return {
        "total_items": roadmap.get("total_items", 0),
        "groups": roadmap.get("groups", {}),
        "assessment_recommended_steps": assessment.get("recommended_next_steps", []),
    }


def _build_parser_coverage(artifacts: list, components: list, parser_versions: dict) -> dict:
    by_category: dict[str, int] = {}
    for a in artifacts:
        by_category[a.category] = by_category.get(a.category, 0) + 1

    parsed = sum(1 for a in artifacts if a.parse_status == "parsed")
    unsupported = sum(1 for a in artifacts if a.support_level in ("UNSUPPORTED", "DETECT_ONLY"))

    return {
        "total_artifacts": len(artifacts),
        "parsed_artifacts": parsed,
        "unsupported_artifacts": unsupported,
        "by_category": by_category,
        "parser_versions": parser_versions,
        "components_extracted": len(components),
        "note": "Parser coverage reflects static extraction only. This is not full COBOL semantic analysis.",
    }


def _build_automation_statement() -> dict:
    return {
        "automation_level": "Rules-based static extraction and deterministic scoring",
        "ai_assistance": "Optional extension point, disabled by default. Zero outbound network calls in default configuration.",
        "scoring_method": "Deterministic, evidence-driven. Complexity, confidence, and readiness computed independently from weighted domain rules.",
        "finding_generation": "Machine-generated from assessment results, components, dependencies, and artifact analysis. All findings classified Evidence-based, Inferred, Assumed, or Unknown.",
        "human_review": "Reviewer actions stored separately from machine findings. Machine findings are immutable; reviewer changes are appended.",
        "no_outbound_calls": "The tool makes no outbound network calls by default. No source code or artifacts are sent to external services.",
    }


def _build_limitations(assessment: dict) -> dict:
    return {
        "assessment_limitations": assessment.get("assessment_limitations", []),
        "missing_information": assessment.get("missing_information", []),
        "general_limitations": [
            "This is static extraction, not full COBOL semantic analysis.",
            "Absence of detected risk does not mean absence of the risk.",
            "Missing evidence is never evidence of simplicity.",
            "Scores are relative within an application, not comparable across different applications without context.",
            "Migration patterns are hypotheses, not final decisions. Do not assume OpenShift is the only target.",
        ],
    }


def _build_versions(assessment: dict, parser_versions: dict, record: AssessmentRecord | None) -> dict:
    return {
        "model_version": assessment.get("model_version", MODEL_VERSION),
        "ruleset_id": assessment.get("ruleset_id", ""),
        "ruleset_version": assessment.get("ruleset_version", ""),
        "parser_versions": parser_versions,
        "assessment_record_id": record.id if record else None,
        "assessment_version": record.version if record else None,
        "computed_at": record.computed_at.isoformat() if record and record.computed_at else None,
    }


def _build_reviewer_changes(findings: list) -> dict:
    changes: list[dict] = []
    for f in findings:
        for ra in (f.review_actions or []):
            changes.append({
                "finding_id": f.id,
                "finding_title": f.title,
                "action": ra.action,
                "reviewer_name": ra.reviewer_name,
                "reviewer_role": ra.reviewer_role,
                "reason": ra.reason,
                "notes": ra.notes,
                "context": ra.context,
                "created_at": ra.created_at.isoformat() if ra.created_at else None,
            })

    return {
        "total_reviewer_actions": len(changes),
        "reviewer_actions": sorted(changes, key=lambda c: c.get("created_at", ""), reverse=True),
    }


def _build_measured_metrics(
    artifacts: list, components: list, dependencies: list,
    findings: list, run: AnalysisRun | None, record: AssessmentRecord | None,
) -> dict:
    """Show only measurable facts — no invented savings, hours, or percentages."""
    by_evidence: dict[str, int] = {}
    for f in findings:
        by_evidence[f.evidence_class] = by_evidence.get(f.evidence_class, 0) + 1

    specialist_count = sum(1 for f in findings if f.finding_type in ("specialist_review", "unverified_assumption"))

    return {
        "artifacts_processed": run.artifacts_processed if run else 0,
        "components_discovered": len(components),
        "dependencies_discovered": len(dependencies),
        "analysis_runtime_ms": run.duration_ms if run else 0,
        "assessment_runtime_ms": record.duration_ms if record else 0,
        "total_findings": len(findings),
        "findings_by_evidence_class": by_evidence,
        "items_needing_specialist_input": specialist_count,
        "note": "Metrics show only measurable facts. No estimated cost, hours saved, or percentage savings are reported.",
    }


def _build_evidence_metrics_section(db: Session, application_id: str) -> dict:
    """Build Evidence Metrics section for report: Static results always; LLM if run; comparison if both exist."""
    em = get_full_evidence_metrics(db, application_id)
    return {
        "metadata": em.get("metadata"),
        "static": em.get("static"),
        "llm": em.get("llm") if em.get("llm", {}).get("status") not in ("disabled", "not_run") else None,
        "comparison": em.get("comparison"),
        "notice": em.get("notice"),
    }


def _build_ai_usage_statement(db: Session, application_id: str) -> dict:
    """Build AI-usage statement (used yes/no, host, model, items reviewed, items accepted by humans)."""
    evals = db.query(LLMEvaluation).filter(LLMEvaluation.application_id == application_id).all()
    used = len(evals) > 0
    models = sorted(list({e.model_id for e in evals}))
    accepted = sum(1 for e in evals if e.review_status == "accepted")
    host = settings.llm_allowed_hosts[0] if settings.llm_allowed_hosts else "api.groq.com"

    return {
        "used": used,
        "host": host if used else "N/A",
        "model": models[0] if models else (settings.llm_model if settings.llm_enabled else "N/A"),
        "items_reviewed": len(evals),
        "items_accepted_by_humans": accepted,
        "statement": "AI evaluation was actively utilized as an advisory second opinion with human review." if used else "Zero external AI calls were made; this assessment is 100% deterministic rules-based.",
    }
