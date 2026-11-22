"""Finding service — builds, persists, and queries material conclusions.

Findings are machine-generated from assessment results, components, dependencies,
and unsupported artifacts. They are immutable once created; reviewer changes
are stored separately in ReviewAction rows. Findings are rebuilt on each
assessment run with stable deterministic IDs.

Evidence classification rules:
- Evidence-based: directly detected in an artifact with a line/record reference.
- Inferred: derived from cross-referencing multiple sources or patterns.
- Assumed: based on a reasonable default when evidence is incomplete.
- Unknown: missing evidence that cannot be classified — reduces confidence.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy.orm import Session

from app.assessment.scoring_engine import (
    load_ruleset,
    compute_assessment,
    serialize_assessment,
    DOMAIN_LABELS,
)
from app.models.models import (
    Application,
    Artifact,
    Component,
    Dependency,
    Finding,
    ReviewAction,
)


def _deterministic_finding_id(application_id: str, *parts: str) -> str:
    """Generate a stable deterministic finding ID from application + parts."""
    raw = f"{application_id}:" + ":".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def _parse_json(val: str | None, default: Any) -> Any:
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _build_rule_firings(
    application_id: str,
    assessment: dict,
) -> list[Finding]:
    """Build findings from assessment fired rules."""
    findings: list[Finding] = []
    fired_rules = assessment.get("fired_rules", [])

    # Group firings by rule_id + domain to avoid duplicates per component
    seen: set[str] = set()

    for fr in fired_rules:
        rule_id = fr.get("rule_id", "")
        domain = fr.get("domain", "")
        description = fr.get("description", "")
        evidence_refs = fr.get("evidence_refs", [])

        # Pick the first evidence ref for source attribution
        source_artifact_id = None
        source_filename = ""
        line_start = 0
        line_end = 0
        has_line_ref = False

        if evidence_refs and isinstance(evidence_refs, list):
            first = evidence_refs[0]
            if isinstance(first, dict):
                source_artifact_id = first.get("artifact_id")
                line_start = first.get("line_start", 0) or 0
                line_end = first.get("line_end", 0) or 0
                has_line_ref = line_start > 0
                snippet = first.get("snippet", "")
                if snippet:
                    source_filename = snippet.replace("Artifact: ", "") if snippet.startswith("Artifact: ") else ""

        # Determine evidence class
        evidence_class = "Evidence-based"
        if fr.get("impact") == "positive":
            evidence_class = "Evidence-based"
        if not has_line_ref and not source_artifact_id:
            evidence_class = "Inferred"

        severity = fr.get("severity", "info")
        impact = fr.get("impact", "neutral")
        if impact == "negative":
            assessment_impact = "increases_complexity" if fr.get("measure") == "complexity" else "reduces_" + fr.get("measure", "score")
        elif impact == "positive":
            assessment_impact = "reduces_complexity" if fr.get("measure") == "complexity" else "improves_" + fr.get("measure", "score")
        else:
            assessment_impact = "neutral"

        # Deduplicate by rule + domain + first artifact
        dedup_key = f"{rule_id}:{domain}:{source_artifact_id or 'app'}:{line_start}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        finding_id = _deterministic_finding_id(
            application_id, "rule", rule_id, domain, str(source_artifact_id or "app"), str(line_start)
        )

        title = description
        explanation = fr.get("explanation", "")
        confidence = abs(float(fr.get("points", 0))) / max(float(fr.get("weight", 1)), 1.0) * 100 if fr.get("weight") else 0
        recommended_action = fr.get("recommendation")

        findings.append(Finding(
            id=finding_id,
            application_id=application_id,
            title=title[:512],
            domain=domain,
            severity=severity,
            evidence_class=evidence_class,
            source_artifact_id=source_artifact_id,
            source_filename=source_filename,
            line_start=line_start,
            line_end=line_end,
            has_line_ref=has_line_ref,
            detection_rule=rule_id,
            explanation=explanation,
            confidence=round(confidence, 1),
            assessment_impact=assessment_impact,
            recommended_action=recommended_action,
            review_status="open",
            finding_type="rule_firing",
            extra_json=json.dumps({
                "measure": fr.get("measure", ""),
                "weight": fr.get("weight", 0),
                "points": fr.get("points", 0),
                "impact": impact,
                "upgrade_guidance": fr.get("upgrade_guidance"),
                "evidence_refs": evidence_refs,
            }),
        ))

    return findings


def _build_unknown_findings(
    application_id: str,
    artifacts: list[Artifact],
    components: list[Component],
    dependencies: list[Dependency],
    assessment: dict,
) -> list[Finding]:
    """Build Unknown-class findings for missing evidence and unsupported artifacts."""
    findings: list[Finding] = []

    # Unsupported / detect-only artifacts
    for art in artifacts:
        if art.support_level in ("UNSUPPORTED", "DETECT_ONLY") or art.parse_status in ("unsupported", "error"):
            fid = _deterministic_finding_id(application_id, "unsupported", art.id)
            findings.append(Finding(
                id=fid,
                application_id=application_id,
                title=f"Unsupported artifact: {art.original_filename}",
                domain="operational_nonfunctional",
                severity="medium",
                evidence_class="Unknown",
                source_artifact_id=art.id,
                source_filename=art.original_filename,
                line_start=0,
                line_end=0,
                has_line_ref=False,
                detection_rule="UNSUPPORTED_ARTIFACT",
                explanation=f"Artifact '{art.original_filename}' (category: {art.category}) has support level '{art.support_level}' and parse status '{art.parse_status}'. Contents were not fully analyzed and are not reflected in the assessment.",
                confidence=0.0,
                assessment_impact="reduces_confidence",
                recommended_action="Review artifact manually or provide in a supported format for full analysis.",
                review_status="open",
                finding_type="unsupported_artifact",
                extra_json=json.dumps({"category": art.category, "support_level": art.support_level, "parse_status": art.parse_status}),
            ))

    # Missing copybooks — components with Unknown evidence class
    for comp in components:
        if comp.evidence_class == "Unknown" and comp.component_type == "COPYBOOK":
            fid = _deterministic_finding_id(application_id, "missing_copybook", comp.name)
            findings.append(Finding(
                id=fid,
                application_id=application_id,
                title=f"Missing copybook: {comp.name}",
                domain="data_structures",
                severity="medium",
                evidence_class="Unknown",
                source_artifact_id=comp.source_artifact_id,
                source_filename=comp.source_filename,
                line_start=comp.line_start,
                line_end=comp.line_end,
                has_line_ref=comp.line_start > 0,
                detection_rule="MISSING_COPYBOOK",
                explanation=f"Copybook '{comp.name}' is referenced in '{comp.source_filename}' but its source was not provided. Data structure definitions within it cannot be assessed.",
                confidence=0.0,
                assessment_impact="reduces_confidence",
                recommended_action="Upload the missing copybook source file to enable data structure analysis.",
                review_status="open",
                finding_type="missing_copybook",
                component_id=comp.id,
            ))

    # Unresolved dependencies
    for dep in dependencies:
        if dep.evidence_class == "Unknown":
            ev = _parse_json(dep.evidence_ref, {})
            fid = _deterministic_finding_id(application_id, "unresolved_dep", dep.id)
            findings.append(Finding(
                id=fid,
                application_id=application_id,
                title=f"Unresolved dependency: {dep.relationship_type}",
                domain="integration_external_dependencies",
                severity="high",
                evidence_class="Unknown",
                source_artifact_id=dep.source_artifact_id,
                source_filename=ev.get("snippet", "") or "",
                line_start=dep.source_line_number,
                line_end=dep.source_line_number,
                has_line_ref=dep.source_line_number > 0,
                detection_rule="UNRESOLVED_DEPENDENCY",
                explanation=f"Dependency of type '{dep.relationship_type}' could not be resolved to a target component. The referenced target source was not found in the uploaded artifacts.",
                confidence=0.0,
                assessment_impact="reduces_confidence",
                recommended_action="Upload the missing source artifact that this dependency references.",
                review_status="open",
                finding_type="unresolved_dependency",
                extra_json=json.dumps({"dependency_id": dep.id, "relationship_type": dep.relationship_type}),
            ))

    # Missing JCL
    has_jcl = any(a.category == "JCL" for a in artifacts)
    if not has_jcl:
        fid = _deterministic_finding_id(application_id, "missing_jcl")
        findings.append(Finding(
            id=fid,
            application_id=application_id,
            title="No JCL artifacts provided — batch orchestration not assessed",
            domain="jobs_batch_orchestration",
            severity="medium",
            evidence_class="Unknown",
            source_artifact_id=None,
            source_filename="",
            line_start=0,
            line_end=0,
            has_line_ref=False,
            detection_rule="MISSING_JCL",
            explanation="No JCL artifacts were found. Batch orchestration could not be assessed. Absence of JCL does not mean there is no batch processing.",
            confidence=0.0,
            assessment_impact="reduces_confidence",
            recommended_action="Provide JCL artifacts to enable batch orchestration assessment.",
            review_status="open",
            finding_type="missing_artifact",
        ))

    # Embedded SQL without DDL
    has_embedded_sql = any(c.component_type == "TABLE" and c.technology == "SQL" for c in components)
    has_ddl = any(a.category in ("SQL_DDL", "SQL") for a in artifacts)
    if has_embedded_sql and not has_ddl:
        fid = _deterministic_finding_id(application_id, "missing_ddl")
        findings.append(Finding(
            id=fid,
            application_id=application_id,
            title="Embedded SQL detected but no DDL artifacts provided",
            domain="database_persistence",
            severity="medium",
            evidence_class="Unknown",
            source_artifact_id=None,
            source_filename="",
            line_start=0,
            line_end=0,
            has_line_ref=False,
            detection_rule="MISSING_DDL",
            explanation="Embedded SQL was detected in components but no DDL artifacts were provided. The database schema is not fully understood.",
            confidence=0.0,
            assessment_impact="reduces_confidence",
            recommended_action="Provide DDL scripts for all referenced databases.",
            review_status="open",
            finding_type="missing_artifact",
        ))

    # Missing security
    has_security = any(c.component_type == "SECURITY_RESOURCE" for c in components)
    if not has_security:
        fid = _deterministic_finding_id(application_id, "missing_security")
        findings.append(Finding(
            id=fid,
            application_id=application_id,
            title="No security resource components detected — security controls not assessed",
            domain="security_controls",
            severity="medium",
            evidence_class="Unknown",
            source_artifact_id=None,
            source_filename="",
            line_start=0,
            line_end=0,
            has_line_ref=False,
            detection_rule="MISSING_SECURITY",
            explanation="No security resource components were detected. Security controls were not assessed. Absence of security evidence does not mean the application has no security.",
            confidence=0.0,
            assessment_impact="reduces_confidence",
            recommended_action="Provide security configuration and access control documentation.",
            review_status="open",
            finding_type="missing_artifact",
        ))

    # Missing application owner
    app = db_query_application(application_id, None)
    # This will be handled at call site where we have db

    return findings


def _build_missing_info_findings(
    application_id: str,
    assessment: dict,
    application: Application | None,
) -> list[Finding]:
    """Build Unknown findings from assessment missing_information list."""
    findings: list[Finding] = []

    # Missing application owner
    if application and not application.owner:
        fid = _deterministic_finding_id(application_id, "missing_owner")
        findings.append(Finding(
            id=fid,
            application_id=application_id,
            title="No application owner assigned — migration planning impacted",
            domain="operational_nonfunctional",
            severity="low",
            evidence_class="Assumed",
            source_artifact_id=None,
            source_filename="",
            line_start=0,
            line_end=0,
            has_line_ref=False,
            detection_rule="MISSING_OWNER",
            explanation="The application has no assigned owner. Migration planning and accountability are impacted.",
            confidence=0.0,
            assessment_impact="reduces_readiness",
            recommended_action="Assign an application owner for migration planning.",
            review_status="open",
            finding_type="missing_info",
        ))

    # Specialist review items from missing_information
    for i, info in enumerate(assessment.get("missing_information", [])):
        # Skip ones already covered by specific finding types
        if "Unsupported artifact" in info or "Missing copybook" in info or "No JCL" in info or "Embedded SQL" in info or "No security" in info:
            continue
        fid = _deterministic_finding_id(application_id, "missing_info", str(i), info[:80])
        findings.append(Finding(
            id=fid,
            application_id=application_id,
            title=info[:512],
            domain="operational_nonfunctional",
            severity="low",
            evidence_class="Unknown",
            source_artifact_id=None,
            source_filename="",
            line_start=0,
            line_end=0,
            has_line_ref=False,
            detection_rule="MISSING_INFORMATION",
            explanation=info,
            confidence=0.0,
            assessment_impact="reduces_confidence",
            recommended_action="Resolve this information gap to improve assessment confidence.",
            review_status="open",
            finding_type="missing_info",
        ))

    # Specialist review items from assessment limitations
    for i, lim in enumerate(assessment.get("assessment_limitations", [])):
        if "Absence of" in lim:
            fid = _deterministic_finding_id(application_id, "specialist_review", str(i), lim[:80])
            findings.append(Finding(
                id=fid,
                application_id=application_id,
                title="Item flagged for specialist review",
                domain="operational_nonfunctional",
                severity="low",
                evidence_class="Assumed",
                source_artifact_id=None,
                source_filename="",
                line_start=0,
                line_end=0,
                has_line_ref=False,
                detection_rule="SPECIALIST_REVIEW",
                explanation=lim,
                confidence=0.0,
                assessment_impact="reduces_confidence",
                recommended_action="Review with a specialist to confirm or reject this assessment limitation.",
                review_status="open",
                finding_type="specialist_review",
            ))

    # Unverified migration assumptions
    for step in assessment.get("recommended_next_steps", []):
        if "review" in step.lower() or "confirm" in step.lower() or "validate" in step.lower():
            fid = _deterministic_finding_id(application_id, "unverified_assumption", step[:80])
            findings.append(Finding(
                id=fid,
                application_id=application_id,
                title="Unverified migration assumption",
                domain="operational_nonfunctional",
                severity="low",
                evidence_class="Assumed",
                source_artifact_id=None,
                source_filename="",
                line_start=0,
                line_end=0,
                has_line_ref=False,
                detection_rule="UNVERIFIED_ASSUMPTION",
                explanation=f"Recommended next step requires validation: {step}",
                confidence=0.0,
                assessment_impact="reduces_readiness",
                recommended_action=step,
                review_status="open",
                finding_type="unverified_assumption",
            ))

    return findings


def db_query_application(application_id: str, db: Session | None) -> Application | None:
    if db is None:
        return None
    return db.query(Application).filter(Application.id == application_id).first()


def rebuild_findings(db: Session, application_id: str) -> int:
    """Rebuild all findings for an application from current assessment data.

    Deletes existing findings (and cascades review actions), then rebuilds
    from the latest assessment result, components, dependencies, and artifacts.
    Returns the count of findings created.
    """
    # Get assessment
    from app.models.models import AssessmentRecord
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).order_by(AssessmentRecord.computed_at.desc()).first()

    if not record:
        # No assessment — build from raw data only
        assessment = {}
    else:
        try:
            assessment = json.loads(record.result_json)
        except (json.JSONDecodeError, TypeError):
            assessment = {}

    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()
    components = db.query(Component).filter(Component.application_id == application_id).all()
    dependencies = db.query(Dependency).filter(Dependency.application_id == application_id).all()
    application = db.query(Application).filter(Application.id == application_id).first()

    all_findings: list[Finding] = []

    # Rule firings from assessment
    all_findings.extend(_build_rule_firings(application_id, assessment))

    # Unknown-class findings
    all_findings.extend(_build_unknown_findings(application_id, artifacts, components, dependencies, assessment))

    # Missing info, specialist review, unverified assumptions
    all_findings.extend(_build_missing_info_findings(application_id, assessment, application))

    # Delete existing findings (cascades review actions)
    db.query(Finding).filter(Finding.application_id == application_id).delete()
    db.flush()

    # Insert new findings
    for f in all_findings:
        db.add(f)

    db.commit()
    return len(all_findings)


def get_findings(
    db: Session,
    application_id: str,
    evidence_class: str | None = None,
    domain: str | None = None,
    severity: str | None = None,
    finding_type: str | None = None,
    search: str | None = None,
) -> list[Finding]:
    """Query findings with optional filters."""
    q = db.query(Finding).filter(Finding.application_id == application_id)

    if evidence_class:
        q = q.filter(Finding.evidence_class == evidence_class)
    if domain:
        q = q.filter(Finding.domain == domain)
    if severity:
        q = q.filter(Finding.severity == severity)
    if finding_type:
        q = q.filter(Finding.finding_type == finding_type)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Finding.title.ilike(like)) | (Finding.explanation.ilike(like)) | (Finding.detection_rule.ilike(like))
        )

    return q.order_by(
        Finding.evidence_class,
        Finding.severity.desc(),
        Finding.created_at.desc(),
    ).all()


def get_unknowns(db: Session, application_id: str) -> list[Finding]:
    """Get all Unknown-class findings for an application."""
    return db.query(Finding).filter(
        Finding.application_id == application_id,
        Finding.evidence_class == "Unknown",
    ).order_by(Finding.severity.desc(), Finding.created_at.desc()).all()


def get_finding(db: Session, finding_id: str) -> Finding | None:
    return db.query(Finding).filter(Finding.id == finding_id).first()


def serialize_finding(finding: Finding) -> dict:
    """Serialize a Finding to a dict, including reviewer-adjusted values."""
    extra = _parse_json(finding.extra_json, {})
    review_actions = [
        {
            "id": ra.id,
            "finding_id": ra.finding_id,
            "action": ra.action,
            "reviewer_name": ra.reviewer_name,
            "reviewer_role": ra.reviewer_role,
            "reason": ra.reason,
            "notes": ra.notes,
            "context": ra.context,
            "created_at": ra.created_at.isoformat() if ra.created_at else None,
        }
        for ra in (finding.review_actions or [])
    ]

    # Determine reviewer-adjusted status from latest action
    reviewer_status = None
    reviewer_notes = None
    if review_actions:
        latest = review_actions[-1]
        reviewer_status = latest["action"]
        reviewer_notes = latest["notes"]

    return {
        "id": finding.id,
        "application_id": finding.application_id,
        "title": finding.title,
        "domain": finding.domain,
        "severity": finding.severity,
        "evidence_class": finding.evidence_class,
        "source_artifact_id": finding.source_artifact_id,
        "source_filename": finding.source_filename,
        "line_start": finding.line_start,
        "line_end": finding.line_end,
        "has_line_ref": finding.has_line_ref,
        "detection_rule": finding.detection_rule,
        "explanation": finding.explanation,
        "confidence": finding.confidence,
        "assessment_impact": finding.assessment_impact,
        "recommended_action": finding.recommended_action,
        "review_status": finding.review_status,
        "finding_type": finding.finding_type,
        "component_id": finding.component_id,
        "extra": extra,
        "created_at": finding.created_at.isoformat() if finding.created_at else None,
        "review_actions": review_actions,
        "reviewer_status": reviewer_status,
        "reviewer_notes": reviewer_notes,
    }
