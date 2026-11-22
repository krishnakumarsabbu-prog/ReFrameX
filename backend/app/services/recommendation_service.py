"""Recommendation engine — deterministic, evidence-derived.

Exactly three primary categories:
1. Good Refactoring Candidate
2. Requires Further Analysis
3. Retain on Mainframe for Now

Rules (per project instructions):
- A low-complexity component with missing evidence or unresolved dependencies
  is NOT a good candidate — it goes to 'Requires Further Analysis'.
- Do not assume OpenShift is the only target. Candidate considerations are
  hypotheses for further evaluation, not final patterns.
- Recommendations derive from actual assessment results, not hardcoded scores.
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
)
from app.assessment.scoring_engine import (
    DOMAIN_LABELS,
    compute_component_assessment,
    load_ruleset,
)


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
    if record:
        try:
            return json.loads(record.result_json)
        except (json.JSONDecodeError, TypeError):
            pass
    # Fallback to compute dynamically if no persisted assessment record exists
    try:
        from app.assessment.scoring_engine import compute_assessment, serialize_assessment
        res = compute_assessment(db, application_id)
        if res:
            return serialize_assessment(res)
    except Exception:
        pass
    return None


def _get_component_dependency_info(
    db: Session, application_id: str, component_id: str
) -> dict:
    """Get dependency info for a component."""
    deps_out = db.query(Dependency).filter(
        Dependency.application_id == application_id,
        Dependency.source_component_id == component_id,
    ).all()
    deps_in = db.query(Dependency).filter(
        Dependency.application_id == application_id,
        Dependency.target_component_id == component_id,
    ).all()
    unresolved = sum(1 for d in deps_out if d.evidence_class == "Unknown")
    return {
        "outgoing": len(deps_out),
        "incoming": len(deps_in),
        "unresolved": unresolved,
        "total": len(deps_out) + len(deps_in),
    }


def _get_component_findings_info(
    db: Session, application_id: str, component_id: str
) -> dict:
    """Get finding info for a component."""
    from app.models.models import Finding
    findings = db.query(Finding).filter(
        Finding.application_id == application_id,
        Finding.component_id == component_id,
    ).all()
    unknown_count = sum(1 for f in findings if f.evidence_class == "Unknown")
    high_severity = sum(1 for f in findings if f.severity == "high")
    return {
        "total_findings": len(findings),
        "unknown_count": unknown_count,
        "high_severity_count": high_severity,
    }


def build_recommendations(db: Session, application_id: str) -> dict:
    """Build recommendations for all components in an application.

    Returns a dict with total, by_category, and recommendations list.
    """
    assessment = _get_latest_assessment(db, application_id)
    if not assessment:
        return {"application_id": application_id, "total": 0, "by_category": {}, "recommendations": []}

    ruleset = load_ruleset()
    components = db.query(Component).filter(
        Component.application_id == application_id
    ).order_by(Component.component_type, Component.name).all()

    # Check for missing evidence at application level
    missing_info = assessment.get("missing_information", [])
    has_missing_evidence = len(missing_info) > 0
    unresolved_deps_total = assessment.get("evidence_refs", [])  # not directly useful

    # Get all unknown findings
    from app.models.models import Finding
    unknown_findings = db.query(Finding).filter(
        Finding.application_id == application_id,
        Finding.evidence_class == "Unknown",
    ).all()
    unknown_finding_types = {f.finding_type for f in unknown_findings}

    # Application-level scores
    app_complexity = assessment.get("complexity_score", 0)
    app_complexity_class = assessment.get("complexity_classification", "Low")
    app_confidence = assessment.get("confidence_score", 0)
    app_confidence_class = assessment.get("confidence_classification", "Low")
    app_readiness = assessment.get("readiness_score", 0)
    app_readiness_class = assessment.get("readiness_classification", "Not Ready")

    recommendations: list[dict] = []

    for comp in components:
        dep_info = _get_component_dependency_info(db, application_id, comp.id)
        findings_info = _get_component_findings_info(db, application_id, comp.id)

        # Get component complexity using the unified compute_component_assessment engine
        comp_assessment = compute_component_assessment(db, comp.id, ruleset=ruleset)
        if comp_assessment:
            complexity_score = comp_assessment["complexity_score"]
            complexity_class = comp_assessment["complexity_classification"]
            comp_fired = comp_assessment.get("fired_rules", [])
        else:
            fired_rules = assessment.get("fired_rules", [])
            comp_fired = [r for r in fired_rules if any(
                ref.get("artifact_id") == comp.source_artifact_id for ref in r.get("evidence_refs", [])
            )]
            complexity_score = 0.0
            complexity_class = "Low"

        # Determine category
        has_unresolved = dep_info["unresolved"] > 0
        has_unknown_findings = findings_info["unknown_count"] > 0
        has_high_severity = findings_info["high_severity_count"] > 0
        is_unsupported_tech = comp.evidence_class == "Unknown"

        key_risks: list[str] = []
        prerequisites: list[str] = []
        supporting_evidence: list[str] = []
        deps_list: list[str] = []

        if comp_fired:
            for fr in comp_fired[:5]:
                supporting_evidence.append(f"{fr.get('rule_id', '')}: {fr.get('description', '')}")

        if dep_info["total"] > 0:
            deps_list.append(f"{dep_info['outgoing']} outgoing, {dep_info['incoming']} incoming dependencies")
        if has_unresolved:
            deps_list.append(f"{dep_info['unresolved']} unresolved target(s)")

        if has_unresolved:
            key_risks.append(f"{dep_info['unresolved']} unresolved dependency target(s)")
            prerequisites.append("Resolve all unresolved dependencies before refactoring")

        if has_unknown_findings:
            key_risks.append(f"{findings_info['unknown_count']} unknown evidence findings on this component")
            prerequisites.append("Resolve unknown evidence before classifying as a refactoring candidate")

        if has_high_severity:
            key_risks.append(f"{findings_info['high_severity_count']} high-severity finding(s)")

        if comp.evidence_class == "Unknown":
            key_risks.append("Component evidence class is Unknown — source not fully available")
            prerequisites.append("Provide complete source artifacts for this component")

        # Category determination
        # 1. Good Refactoring Candidate: low complexity, no unresolved deps, no unknown findings, no high severity
        # 2. Requires Further Analysis: has missing evidence, unresolved deps, or unknown findings
        # 3. Retain on Mainframe for Now: high complexity, high dependency count, or unsupported technology
        if complexity_class == "High" and dep_info["total"] > 5:
            category = "Retain on Mainframe for Now"
            reason = f"High complexity ({complexity_score:.0f}/100) with {dep_info['total']} dependencies makes this component a poor immediate refactoring candidate."
            if not key_risks:
                key_risks.append("High structural complexity and deep dependency coupling")
            prerequisites.insert(0, "Conduct detailed dependency and complexity analysis before planning refactoring")
            next_action = "Schedule deep-dive analysis of component structure and dependencies"
        elif has_unresolved or has_unknown_findings or is_unsupported_tech:
            category = "Requires Further Analysis"
            reason = "Component has missing evidence or unresolved dependencies that must be resolved before a refactoring decision can be made."
            next_action = "Resolve missing evidence and unresolved dependencies, then reassess"
        elif complexity_class == "Low" and not has_high_severity and dep_info["total"] <= 3:
            category = "Good Refactoring Candidate"
            reason = f"Low complexity ({complexity_score:.0f}/100), manageable dependencies ({dep_info['total']}), and no unresolved evidence make this a viable refactoring candidate."
            next_action = "Conduct feasibility assessment for refactoring this component"
        elif complexity_class == "Medium":
            category = "Requires Further Analysis"
            reason = f"Medium complexity ({complexity_score:.0f}/100) requires deeper analysis before a refactoring decision can be made."
            next_action = "Perform detailed complexity analysis and dependency mapping"
        else:
            category = "Requires Further Analysis"
            reason = "Insufficient evidence to classify as a good candidate; further analysis required."
            next_action = "Gather additional evidence and reassess"

        # Candidate considerations are hypotheses, not final patterns (A4)
        candidate_considerations: list[str] = []
        if category == "Good Refactoring Candidate":
            candidate_considerations.append(
                "Hypothesis for further evaluation: Target platform options include distributed services, refactor in place, retain, or containerized platform (such as OpenShift as ONE possible target)."
            )
            if comp.component_type == "PROGRAM" and comp.technology == "COBOL":
                candidate_considerations.append(
                    "Hypothesis for further evaluation: Consider service extraction, modular refactoring, or containerization alternatives."
                )
            if comp.component_type == "BATCH_JOB":
                candidate_considerations.append(
                    "Hypothesis for further evaluation: Consider containerized batch, cloud-native orchestration, or event-driven workflow alternatives."
                )
        elif category == "Retain on Mainframe for Now":
            candidate_considerations.append(
                "Hypothesis for further evaluation: Retain on mainframe until complexity is reduced or dependencies are decoupled, or evaluate in-place modernization."
            )
        else:
            candidate_considerations.append(
                "Hypothesis for further evaluation: Complete artifact discovery and dependency resolution before selecting a target architecture."
            )

        recommendations.append({
            "category": category,
            "component": comp.name,
            "component_id": comp.id,
            "component_type": comp.component_type,
            "classification": complexity_class,
            "reason": reason,
            "supporting_evidence": supporting_evidence,
            "dependencies": deps_list,
            "complexity_score": round(complexity_score, 1),
            "complexity_classification": complexity_class,
            "confidence_score": app_confidence,
            "confidence_classification": app_confidence_class,
            "readiness_score": app_readiness,
            "readiness_classification": app_readiness_class,
            "key_risks": key_risks,
            "prerequisites": prerequisites,
            "next_action": next_action,
            "candidate_considerations": candidate_considerations,
        })

    by_category: dict[str, int] = {}
    for rec in recommendations:
        by_category[rec["category"]] = by_category.get(rec["category"], 0) + 1

    return {
        "application_id": application_id,
        "total": len(recommendations),
        "by_category": by_category,
        "recommendations": recommendations,
    }
