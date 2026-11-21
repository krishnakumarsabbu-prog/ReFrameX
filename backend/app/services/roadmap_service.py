"""Roadmap service — prioritized next-analysis roadmap.

Six groups:
1. Immediate investigation
2. Dependency resolution
3. Data and integration analysis
4. Security review
5. Operational validation
6. Refactoring feasibility assessment

Each action: priority, reason, related components, required evidence, expected outcome.
Planning guidance only — not a migration plan.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import (
    Application,
    Artifact,
    Component,
    Dependency,
    AssessmentRecord,
    Finding,
)
from app.assessment.scoring_engine import DOMAIN_LABELS


def _parse_json(val: str | None, default: Any) -> Any:
    if not val:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def _get_latest_assessment(db: Session, application_id: str) -> dict | None:
    record = db.query(AssessmentRecord).filter(
        AssessmentRecord.application_id == application_id
    ).order_by(AssessmentRecord.computed_at.desc()).first()
    if not record:
        return None
    try:
        return json.loads(record.result_json)
    except (json.JSONDecodeError, TypeError):
        return None


def build_roadmap(db: Session, application_id: str) -> dict:
    """Build a prioritized next-analysis roadmap for an application."""
    assessment = _get_latest_assessment(db, application_id)
    if not assessment:
        return {"application_id": application_id, "groups": {}, "total_items": 0}

    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()
    components = db.query(Component).filter(Component.application_id == application_id).all()
    dependencies = db.query(Dependency).filter(Dependency.application_id == application_id).all()
    findings = db.query(Finding).filter(Finding.application_id == application_id).all()

    groups: dict[str, list[dict]] = {
        "Immediate investigation": [],
        "Dependency resolution": [],
        "Data and integration analysis": [],
        "Security review": [],
        "Operational validation": [],
        "Refactoring feasibility assessment": [],
    }

    # 1. Immediate investigation — high severity findings, unsupported artifacts
    high_severity = [f for f in findings if f.severity == "high"]
    if high_severity:
        related = list({f.source_filename for f in high_severity if f.source_filename})[:5]
        groups["Immediate investigation"].append({
            "group": "Immediate investigation",
            "priority": "High",
            "action": f"Review {len(high_severity)} high-severity finding(s) before proceeding",
            "reason": "High-severity findings indicate significant complexity or risk that must be understood before migration planning.",
            "related_components": related,
            "required_evidence": ["Source artifacts for each high-severity finding", "Reviewer confirmation or rejection of each finding"],
            "expected_outcome": "Confirmed risk register with mitigations or accepted risks documented",
        })

    unsupported = [a for a in artifacts if a.support_level in ("UNSUPPORTED", "DETECT_ONLY")]
    if unsupported:
        groups["Immediate investigation"].append({
            "group": "Immediate investigation",
            "priority": "High",
            "action": f"Manually review {len(unsupported)} unsupported artifact(s)",
            "reason": "Unsupported artifacts could not be parsed and their contents are not reflected in the assessment.",
            "related_components": [a.original_filename for a in unsupported[:5]],
            "required_evidence": ["Artifact contents in a supported format", "Manual review notes"],
            "expected_outcome": "All artifacts either parsed or manually documented with known limitations",
        })

    # 2. Dependency resolution — unresolved dependencies, missing copybooks
    unresolved = [f for f in findings if f.finding_type == "unresolved_dependency"]
    if unresolved:
        groups["Dependency resolution"].append({
            "group": "Dependency resolution",
            "priority": "High",
            "action": f"Resolve {len(unresolved)} unresolved dependency target(s)",
            "reason": "Dependencies could not be matched to source artifacts, preventing full dependency graph analysis.",
            "related_components": [f.source_filename for f in unresolved if f.source_filename][:5],
            "required_evidence": ["Missing source artifacts referenced by dependencies"],
            "expected_outcome": "Complete dependency graph with all targets resolved",
        })

    missing_copybooks = [f for f in findings if f.finding_type == "missing_copybook"]
    if missing_copybooks:
        groups["Dependency resolution"].append({
            "group": "Dependency resolution",
            "priority": "Medium",
            "action": f"Upload {len(missing_copybooks)} missing copybook(s)",
            "reason": "Copybooks are referenced in COBOL programs but their source was not provided.",
            "related_components": [f.title.replace("Missing copybook: ", "") for f in missing_copybooks[:5]],
            "required_evidence": ["Copybook source files"],
            "expected_outcome": "Complete data structure definitions for all COBOL programs",
        })

    # 3. Data and integration analysis — missing DDL, embedded SQL, external deps
    has_embedded_sql = any(c.component_type == "TABLE" and c.technology == "SQL" for c in components)
    has_ddl = any(a.category == "SQL_DDL" for a in artifacts)
    if has_embedded_sql and not has_ddl:
        groups["Data and integration analysis"].append({
            "group": "Data and integration analysis",
            "priority": "High",
            "action": "Provide DDL scripts for all referenced databases",
            "reason": "Embedded SQL was detected but no DDL artifacts were provided. Database schema is not fully understood.",
            "related_components": [c.name for c in components if c.component_type == "TABLE"][:5],
            "required_evidence": ["DDL scripts", "Database schema documentation"],
            "expected_outcome": "Complete database schema understanding for migration planning",
        })

    external_deps = [d for d in dependencies if d.relationship_type in ("EXTERNAL_CALL", "CICS_LINK", "MQ_CALL", "HTTP_CALL")]
    if external_deps:
        groups["Data and integration analysis"].append({
            "group": "Data and integration analysis",
            "priority": "Medium",
            "action": f"Document {len(external_deps)} external integration point(s)",
            "reason": "External integration dependencies require contract documentation before migration planning.",
            "related_components": list({d.relationship_type for d in external_deps})[:5],
            "required_evidence": ["Interface contracts", "API documentation", "Protocol specifications"],
            "expected_outcome": "Complete integration inventory with documented contracts",
        })

    # 4. Security review — missing security components
    has_security = any(c.component_type == "SECURITY_RESOURCE" for c in components)
    if not has_security:
        groups["Security review"].append({
            "group": "Security review",
            "priority": "Medium",
            "action": "Provide security configuration and access control documentation",
            "reason": "No security resource components were detected. Security controls were not assessed.",
            "related_components": [],
            "required_evidence": ["Security configuration files", "Access control documentation", "RACF/ACF2 rules"],
            "expected_outcome": "Security assessment included in overall migration assessment",
        })

    # 5. Operational validation — missing JCL, missing owner, batch processing
    has_jcl = any(a.category == "JCL" for a in artifacts)
    if not has_jcl:
        groups["Operational validation"].append({
            "group": "Operational validation",
            "priority": "Medium",
            "action": "Provide JCL artifacts to enable batch orchestration assessment",
            "reason": "No JCL artifacts were found. Batch orchestration could not be assessed.",
            "related_components": [],
            "required_evidence": ["JCL job streams", "Job scheduler configuration"],
            "expected_outcome": "Complete batch orchestration assessment",
        })

    app = db.query(Application).filter(Application.id == application_id).first()
    if app and not app.owner:
        groups["Operational validation"].append({
            "group": "Operational validation",
            "priority": "Low",
            "action": "Assign an application owner for migration planning",
            "reason": "The application has no assigned owner, impacting migration planning and accountability.",
            "related_components": [],
            "required_evidence": ["Application ownership assignment"],
            "expected_outcome": "Clear ownership for migration planning and decision-making",
        })

    # Unverified assumptions
    unverified = [f for f in findings if f.finding_type == "unverified_assumption"]
    if unverified:
        groups["Operational validation"].append({
            "group": "Operational validation",
            "priority": "Low",
            "action": f"Validate {len(unverified)} unverified migration assumption(s)",
            "reason": "Recommended next steps contain assumptions that require human validation.",
            "related_components": [],
            "required_evidence": ["Reviewer validation of each assumption"],
            "expected_outcome": "All assumptions confirmed, rejected, or marked for further investigation",
        })

    # 6. Refactoring feasibility — depends on assessment scores
    complexity_class = assessment.get("complexity_classification", "Low")
    readiness_class = assessment.get("readiness_classification", "Not Ready")
    confidence_class = assessment.get("confidence_classification", "Low")

    if readiness_class == "Ready for Detailed Planning":
        groups["Refactoring feasibility assessment"].append({
            "group": "Refactoring feasibility assessment",
            "priority": "Medium",
            "action": "Conduct detailed refactoring feasibility assessment for ready components",
            "reason": "Application readiness indicates components may be ready for detailed planning.",
            "related_components": [c.name for c in components if c.evidence_class == "Evidence-based"][:5],
            "required_evidence": ["Component-level complexity analysis", "Dependency graph", "Target platform requirements"],
            "expected_outcome": "Refactoring plan with candidate patterns (as hypotheses, not final decisions)",
        })
    elif confidence_class == "Low":
        groups["Refactoring feasibility assessment"].append({
            "group": "Refactoring feasibility assessment",
            "priority": "Low",
            "action": "Improve assessment confidence before feasibility assessment",
            "reason": f"Assessment confidence is Low ({assessment.get('confidence_score', 0):.0f}/100). Feasibility assessment requires higher confidence.",
            "related_components": [],
            "required_evidence": ["Resolution of all missing information items", "Human review of findings"],
            "expected_outcome": "Assessment confidence raised to Medium or High before proceeding",
        })
    else:
        groups["Refactoring feasibility assessment"].append({
            "group": "Refactoring feasibility assessment",
            "priority": "Low",
            "action": "Schedule feasibility assessment after resolving open items",
            "reason": f"Current complexity: {complexity_class}, readiness: {readiness_class}. Feasibility assessment should follow resolution of open items.",
            "related_components": [],
            "required_evidence": ["Resolution of high-priority roadmap items"],
            "expected_outcome": "Feasibility assessment conducted with complete evidence",
        })

    # Remove empty groups
    groups = {k: v for k, v in groups.items() if v}
    total = sum(len(items) for items in groups.values())

    return {
        "application_id": application_id,
        "groups": groups,
        "total_items": total,
    }
