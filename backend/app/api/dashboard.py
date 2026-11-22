"""Portfolio Dashboard API router.

Provides live aggregated metrics, risk registers, readiness distributions,
and domain scores across all mainframe applications in the database.
"""

from __future__ import annotations

import json
from fastapi import APIRouter, Depends
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Application, Artifact, Component, Dependency, AssessmentRecord, Finding

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DOMAIN_METADATA: dict[str, dict[str, str]] = {
    "application_business_logic": {"label": "Application & Business Logic", "shortLabel": "Business Logic"},
    "data_structures": {"label": "Data Structures", "shortLabel": "Data Structures"},
    "database_persistence": {"label": "Database & Persistence", "shortLabel": "Database"},
    "jobs_batch_orchestration": {"label": "Jobs, Batch & Orchestration", "shortLabel": "Batch & Jobs"},
    "online_transactions_ui": {"label": "Online Transactions & UI", "shortLabel": "Online & UI"},
    "integration_external_dependencies": {"label": "Integration & External Deps", "shortLabel": "Integration"},
    "security_controls": {"label": "Security & Controls", "shortLabel": "Security"},
    "operational_nonfunctional": {"label": "Operational & Nonfunctional", "shortLabel": "Operational"},
}


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Fetch live portfolio dashboard metrics aggregated from the database."""
    apps = db.query(Application).all()
    app_map = {a.id: a for a in apps}
    total_apps = len(apps)
    total_comps = db.query(Component).count()
    total_deps = db.query(Dependency).count()
    total_artifacts = db.query(Artifact).count()
    high_findings = db.query(Finding).filter(Finding.severity == "high").count()

    # Portfolios (business domains)
    portfolios = {a.business_domain for a in apps if a.business_domain}
    portfolios_count = max(len(portfolios), 1)

    # Latest assessment per application
    assessments: dict[str, AssessmentRecord] = {}
    for a in apps:
        rec = db.query(AssessmentRecord).filter(
            AssessmentRecord.application_id == a.id,
            AssessmentRecord.is_current == True,
        ).order_by(AssessmentRecord.computed_at.desc()).first()
        if not rec:
            rec = db.query(AssessmentRecord).filter(
                AssessmentRecord.application_id == a.id
            ).order_by(AssessmentRecord.computed_at.desc()).first()
        if rec:
            assessments[a.id] = rec

    cx_scores = [r.complexity_score for r in assessments.values() if r.complexity_score is not None]
    conf_scores = [r.confidence_score for r in assessments.values() if r.confidence_score is not None]
    avg_cx = round(sum(cx_scores) / len(cx_scores), 1) if cx_scores else 0.0
    avg_conf = round(sum(conf_scores) / len(conf_scores), 1) if conf_scores else 0.0

    # Readiness distribution
    readiness_counts = {"Not Ready": 0, "Partially Ready": 0, "Ready for Planning": 0}
    for r in assessments.values():
        cls_name = r.readiness_classification or "Not Ready"
        if "Not Ready" in cls_name:
            readiness_counts["Not Ready"] += 1
        elif "Partially" in cls_name:
            readiness_counts["Partially Ready"] += 1
        else:
            readiness_counts["Ready for Planning"] += 1

    # Recent assessments table
    recent_assessments = []
    for a in apps:
        rec = assessments.get(a.id)
        recent_assessments.append({
            "id": a.id,
            "application": a.name,
            "date": rec.computed_at.strftime("%Y-%m-%d") if rec and rec.computed_at else a.created_at.strftime("%Y-%m-%d"),
            "complexity": round(rec.complexity_score, 1) if rec and rec.complexity_score is not None else 0,
            "confidence": round(rec.confidence_score, 1) if rec and rec.confidence_score is not None else 0,
            "readiness": rec.readiness_classification if rec and rec.readiness_classification else "Not Assessed",
            "status": a.assessment_status or "Complete",
        })

    # Domain aggregation
    domain_data: dict[str, dict[str, list[float]]] = {k: {"readiness": [], "complexity": []} for k in DOMAIN_METADATA}
    for rec in assessments.values():
        if rec and rec.result_json:
            res = json.loads(rec.result_json) if isinstance(rec.result_json, str) else rec.result_json
            d_scores = res.get("domain_scores", {})
            for d_key, s_obj in d_scores.items():
                if d_key in domain_data and isinstance(s_obj, dict):
                    ready_val = s_obj.get("readiness", {}).get("score")
                    cx_val = s_obj.get("complexity", {}).get("score")
                    if ready_val is not None:
                        domain_data[d_key]["readiness"].append(ready_val)
                    if cx_val is not None:
                        domain_data[d_key]["complexity"].append(cx_val)

    # Domain component counts
    domain_comp_counts: dict[str, int] = {k: 0 for k in DOMAIN_METADATA}
    all_components = db.query(Component).all()
    for c in all_components:
        tech = (c.technology or "").upper()
        ctype = (c.component_type or "").upper()
        if tech == "COBOL" or ctype in ("PROGRAM", "PARAGRAPH", "MODULE"):
            domain_comp_counts["application_business_logic"] += 1
        elif tech in ("COPYBOOK",) or ctype in ("COPYBOOK", "DATA_ITEM"):
            domain_comp_counts["data_structures"] += 1
        elif tech in ("SQL", "DB2") or "TABLE" in ctype or "INDEX" in ctype:
            domain_comp_counts["database_persistence"] += 1
        elif tech == "JCL" or ctype in ("JOB", "STEP", "PROC"):
            domain_comp_counts["jobs_batch_orchestration"] += 1
        elif tech == "BMS" or "MAP" in ctype or "CICS" in ctype:
            domain_comp_counts["online_transactions_ui"] += 1
        elif "CALL" in ctype or "LINK" in ctype:
            domain_comp_counts["integration_external_dependencies"] += 1
        elif tech in ("RACF", "SECURITY"):
            domain_comp_counts["security_controls"] += 1
        else:
            domain_comp_counts["operational_nonfunctional"] += 1

    domains_list = []
    for d_key, meta in DOMAIN_METADATA.items():
        r_list = domain_data[d_key]["readiness"]
        c_list = domain_data[d_key]["complexity"]
        avg_r = round(sum(r_list) / len(r_list), 1) if r_list else 0.0
        avg_c = round(sum(c_list) / len(c_list), 1) if c_list else 0.0
        domains_list.append({
            "id": d_key,
            "label": meta["label"],
            "shortLabel": meta["shortLabel"],
            "readiness": avg_r,
            "complexity": avg_c,
            "components": domain_comp_counts.get(d_key, 0),
        })

    # Component breakdown by application (for Trend / Distribution chart)
    component_trend = []
    for a in apps[:8]:
        cnt = db.query(Component).filter(Component.application_id == a.id).count()
        component_trend.append({
            "label": a.name[:10],
            "value": cnt,
        })

    # Real top risks from Finding table
    comp_map = {c.id: c.name for c in all_components}
    severity_order = case(
        (Finding.severity == "high", 1),
        (Finding.severity == "medium", 2),
        (Finding.severity == "low", 3),
        else_=4,
    )
    db_findings = db.query(Finding).order_by(
        severity_order,
        Finding.created_at.desc(),
    ).limit(8).all()

    top_risks_list = []
    for f in db_findings:
        parent_app = app_map.get(f.application_id)
        app_name = parent_app.name if parent_app else "Unknown App"
        comp_name = comp_map.get(f.component_id) or f.source_filename or f.title[:28]
        domain_label = DOMAIN_METADATA.get(f.domain, {}).get("shortLabel", f.domain.replace("_", " ").title())
        top_risks_list.append({
            "id": f.id,
            "component": comp_name,
            "application": app_name,
            "severity": f.severity or "medium",
            "category": domain_label,
            "evidence": f.evidence_class or "Evidence-based",
        })

    # Risk counts for risks tab
    high_count = db.query(Finding).filter(Finding.severity == "high").count()
    medium_count = db.query(Finding).filter(Finding.severity == "medium").count()
    low_count = db.query(Finding).filter(Finding.severity == "low").count()
    unknown_evidence_count = db.query(Finding).filter(Finding.evidence_class.in_(["Assumed", "Unknown"])).count()
    risk_counts = {
        "high": high_count,
        "medium": medium_count,
        "low": low_count,
        "unknown_evidence": unknown_evidence_count,
    }

    # Recommended actions from current assessments
    recommended_actions_list = []
    seen_actions = set()
    for rec in assessments.values():
        parent_app = app_map.get(rec.application_id)
        app_name = parent_app.name if parent_app else "Application"
        if rec.result_json:
            res = json.loads(rec.result_json) if isinstance(rec.result_json, str) else rec.result_json
            next_steps = res.get("recommended_next_steps", [])
            for step in next_steps:
                if step and step not in seen_actions:
                    seen_actions.add(step)
                    priority = "High" if ("gate" in step.lower() or "missing" in step.lower() or "cics" in step.lower()) else "Medium"
                    recommended_actions_list.append({
                        "id": f"act-{len(recommended_actions_list)+1}",
                        "action": step,
                        "priority": priority,
                        "application": app_name,
                        "effort": "1-2 sprints" if priority == "High" else "2-3 sprints",
                    })
                    if len(recommended_actions_list) >= 6:
                        break
        if len(recommended_actions_list) >= 6:
            break

    return {
        "total_applications": total_apps,
        "total_components": total_comps,
        "total_dependencies": total_deps,
        "total_artifacts": total_artifacts,
        "high_risk_findings_count": high_findings,
        "avg_complexity": avg_cx,
        "avg_confidence": avg_conf,
        "portfolios_count": portfolios_count,
        "readiness_distribution": [
            {"label": "Not Ready", "value": readiness_counts["Not Ready"], "color": "#DC2626"},
            {"label": "Partially Ready", "value": readiness_counts["Partially Ready"], "color": "#D97706"},
            {"label": "Ready for Planning", "value": readiness_counts["Ready for Planning"], "color": "#059669"},
        ],
        "recent_assessments": recent_assessments,
        "component_trend": component_trend,
        "domains": domains_list,
        "top_risks": top_risks_list,
        "risk_counts": risk_counts,
        "recommended_actions": recommended_actions_list,
    }
