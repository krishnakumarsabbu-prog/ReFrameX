"""Phase 7 API routes: executive reports, application comparison, assessment history, export."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services import application_service, assessment_service
from app.services.report_service import build_report
from app.services.comparison_service import compare_applications

router = APIRouter(tags=["reports"])


@router.get("/api/applications/{app_id}/report")
def get_report(app_id: str, db: Session = Depends(get_db)):
    """Generate a complete executive assessment report from stored results."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    report = build_report(db, app_id)
    if report is None:
        raise HTTPException(status_code=500, detail="Report generation failed")
    return report


@router.get("/api/applications/compare")
def compare(
    app_a: str = Query(..., description="First application ID"),
    app_b: str = Query(..., description="Second application ID"),
    db: Session = Depends(get_db),
):
    """Compare two assessed applications. Computed, not hardcoded."""
    result = compare_applications(db, app_a, app_b)
    if result is None:
        raise HTTPException(status_code=404, detail="One or both applications not found")
    return result


@router.get("/api/applications/{app_id}/assessment-history")
def get_assessment_history(app_id: str, db: Session = Depends(get_db)):
    """Get all assessment records for an application, ordered newest first."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return assessment_service.get_assessment_history(db, app_id)


@router.get("/api/applications/{app_id}/export")
def export(
    app_id: str,
    format: str = Query("json", description="Export format: json or html"),
    db: Session = Depends(get_db),
):
    """Export a full assessment report as downloadable JSON or printable HTML."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    report = build_report(db, app_id)
    if report is None:
        raise HTTPException(status_code=500, detail="Report generation failed")

    app_name = app.name.replace(" ", "_").replace("/", "-")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "html":
        html = _build_printable_html(report)
        return Response(
            content=html,
            media_type="text/html",
            headers={
                "Content-Disposition": f'attachment; filename="reframex_report_{app_name}_{timestamp}.html"'
            },
        )

    # Default: JSON
    json_str = json.dumps(report, indent=2, default=str)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="reframex_report_{app_name}_{timestamp}.json"'
        },
    )


def _build_printable_html(report: dict) -> str:
    """Build a self-contained printable HTML report."""
    meta = report.get("report_metadata", {})
    summary = report.get("executive_summary", {})
    app_name = meta.get("application_name", "Unknown")

    def _section(title: str, content_html: str) -> str:
        return f'<section class="report-section"><h2>{title}</h2>{content_html}</section>'

    def _kv_table(items: list[tuple[str, str]]) -> str:
        rows = "".join(f"<tr><td class='label'>{k}</td><td>{v}</td></tr>" for k, v in items if v is not None)
        return f"<table class='kv-table'>{rows}</table>"

    def _dict_table(d: dict, key_label: str = "Key", val_label: str = "Count") -> str:
        if not d:
            return "<p class='muted'>No data.</p>"
        rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in sorted(d.items()))
        return f"<table class='data-table'><thead><tr><th>{key_label}</th><th>{val_label}</th></tr></thead><tbody>{rows}</tbody></table>"

    # Executive Summary
    exec_html = _kv_table([
        ("Application", app_name),
        ("Complexity", f"{summary.get('complexity_score', 'N/A')} — {summary.get('complexity_classification', 'N/A')}"),
        ("Confidence", f"{summary.get('confidence_score', 'N/A')} — {summary.get('confidence_classification', 'N/A')}"),
        ("Readiness", f"{summary.get('readiness_score', 'N/A')} — {summary.get('readiness_classification', 'N/A')}"),
        ("Artifacts", str(summary.get("artifact_count", 0))),
        ("Components", str(summary.get("component_count", 0))),
        ("Dependencies", str(summary.get("dependency_count", 0))),
        ("Findings", str(summary.get("finding_count", 0))),
        ("Unknown Evidence Items", str(summary.get("unknown_evidence_count", 0))),
        ("High-Severity Findings", str(summary.get("high_severity_finding_count", 0))),
        ("Assessment Version", str(summary.get("assessment_version", "N/A"))),
        ("Computed At", summary.get("computed_at", "N/A")),
    ])

    # Application Overview
    overview = report.get("application_overview", {})
    overview_html = _kv_table([
        ("Name", overview.get("name")),
        ("Description", overview.get("description")),
        ("Business Domain", overview.get("business_domain")),
        ("Owner", overview.get("owner") or "Not assigned"),
        ("Technology Stack", overview.get("technology_stack")),
        ("Environment", overview.get("environment")),
        ("Assessment Status", overview.get("assessment_status")),
    ])

    # Artifact Inventory
    art_inv = report.get("artifact_inventory", {})
    art_html = _dict_table(art_inv.get("by_category", {}), "Category", "Count")
    art_html += _dict_table(art_inv.get("by_support_level", {}), "Support Level", "Count")

    # Component Inventory
    comp_inv = report.get("component_inventory", {})
    comp_html = _dict_table(comp_inv.get("by_type", {}), "Type", "Count")
    comp_html += _dict_table(comp_inv.get("by_technology", {}), "Technology", "Count")
    comp_html += _dict_table(comp_inv.get("by_evidence_class", {}), "Evidence Class", "Count")

    # Dependency Analysis
    dep_analysis = report.get("dependency_analysis", {})
    dep_html = _kv_table([
        ("Total Dependencies", str(dep_analysis.get("total_dependencies", 0))),
        ("Unresolved Targets", str(dep_analysis.get("unresolved_targets", 0))),
    ])
    dep_html += _dict_table(dep_analysis.get("by_relationship_type", {}), "Relationship Type", "Count")

    # Domain Assessments
    domains = report.get("domain_assessments", {})
    domain_rows = ""
    for domain_key, domain_data in domains.items():
        comp = domain_data.get("complexity", {})
        conf = domain_data.get("confidence", {})
        ready = domain_data.get("readiness", {})
        domain_rows += (
            f"<tr><td>{domain_data.get('label', domain_key)}</td>"
            f"<td>{comp.get('score', 'N/A')} ({comp.get('classification', 'N/A')})</td>"
            f"<td>{conf.get('score', 'N/A')} ({conf.get('classification', 'N/A')})</td>"
            f"<td>{ready.get('score', 'N/A')} ({ready.get('classification', 'N/A')})</td></tr>"
        )
    domain_html = f"<table class='data-table'><thead><tr><th>Domain</th><th>Complexity</th><th>Confidence</th><th>Readiness</th></tr></thead><tbody>{domain_rows}</tbody></table>"

    # Major Risks
    risks = report.get("major_risks", {})
    risk_items = ""
    for r in risks.get("high_severity_risks", []):
        risk_items += f"<div class='risk-item high'><span class='badge high'>HIGH</span> <strong>{r.get('title', '')}</strong><br><span class='muted'>{r.get('explanation', '')}</span></div>"
    for r in risks.get("medium_severity_risks", []):
        risk_items += f"<div class='risk-item medium'><span class='badge medium'>MEDIUM</span> <strong>{r.get('title', '')}</strong><br><span class='muted'>{r.get('explanation', '')}</span></div>"
    if not risk_items:
        risk_items = "<p class='muted'>No risks identified.</p>"
    risk_html = f"<p>High: {risks.get('high_severity_count', 0)} | Medium: {risks.get('medium_severity_count', 0)}</p>{risk_items}"

    # Evidence Gaps
    gaps = report.get("evidence_gaps", {})
    gaps_html = f"<p>Total unknown findings: {gaps.get('total_unknown_findings', 0)}</p>"
    gaps_html += _dict_table(gaps.get("by_type", {}), "Finding Type", "Count")
    if gaps.get("unsupported_artifacts"):
        gaps_html += "<h3>Unsupported Artifacts</h3><ul>"
        for ua in gaps["unsupported_artifacts"]:
            gaps_html += f"<li>{ua.get('filename')} ({ua.get('category')}, {ua.get('support_level')})</li>"
        gaps_html += "</ul>"

    # Measured Metrics
    metrics = report.get("measured_metrics", {})
    metrics_html = _kv_table([
        ("Artifacts Processed", str(metrics.get("artifacts_processed", 0))),
        ("Components Discovered", str(metrics.get("components_discovered", 0))),
        ("Dependencies Discovered", str(metrics.get("dependencies_discovered", 0))),
        ("Analysis Runtime (ms)", str(metrics.get("analysis_runtime_ms", 0))),
        ("Assessment Runtime (ms)", str(metrics.get("assessment_runtime_ms", 0))),
        ("Total Findings", str(metrics.get("total_findings", 0))),
        ("Items Needing Specialist Input", str(metrics.get("items_needing_specialist_input", 0))),
    ])
    metrics_html += _dict_table(metrics.get("findings_by_evidence_class", {}), "Evidence Class", "Count")

    # Versions
    versions = report.get("versions", {})
    versions_html = _kv_table([
        ("Model Version", versions.get("model_version")),
        ("Ruleset ID", versions.get("ruleset_id")),
        ("Ruleset Version", versions.get("ruleset_version")),
        ("Assessment Version", str(versions.get("assessment_version", "N/A"))),
        ("Computed At", versions.get("computed_at")),
    ])
    versions_html += _dict_table(versions.get("parser_versions", {}), "Parser", "Version")

    # Automation statement
    auto = report.get("automation_and_ai_statement", {})
    auto_html = "<ul>"
    for k, v in auto.items():
        auto_html += f"<li><strong>{k.replace('_', ' ').title()}:</strong> {v}</li>"
    auto_html += "</ul>"

    # Limitations
    lim = report.get("limitations_and_assumptions", {})
    lim_html = "<h3>Assessment Limitations</h3><ul>"
    for l in lim.get("assessment_limitations", []):
        lim_html += f"<li>{l}</li>"
    lim_html += "</ul><h3>Missing Information</h3><ul>"
    for m in lim.get("missing_information", []):
        lim_html += f"<li>{m}</li>"
    lim_html += "</ul><h3>General Limitations</h3><ul>"
    for g in lim.get("general_limitations", []):
        lim_html += f"<li>{g}</li>"
    lim_html += "</ul>"

    # Reviewer Changes
    rev = report.get("reviewer_changes", {})
    rev_html = f"<p>Total reviewer actions: {rev.get('total_reviewer_actions', 0)}</p>"
    if rev.get("reviewer_actions"):
        rev_html += "<table class='data-table'><thead><tr><th>Action</th><th>Finding</th><th>Reviewer</th><th>Role</th><th>Date</th></tr></thead><tbody>"
        for ra in rev["reviewer_actions"]:
            rev_html += f"<tr><td>{ra.get('action')}</td><td>{ra.get('finding_title', '')}</td><td>{ra.get('reviewer_name')}</td><td>{ra.get('reviewer_role')}</td><td>{ra.get('created_at', '')}</td></tr>"
        rev_html += "</tbody></table>"

    # Recommendations
    recs = report.get("component_recommendations", {})
    rec_html = f"<p>Total: {recs.get('total', 0)}</p>"
    rec_html += _dict_table(recs.get("by_category", {}), "Category", "Count")

    # Next Steps
    steps = report.get("prioritized_next_steps", {})
    steps_html = f"<p>Total items: {steps.get('total_items', 0)}</p>"
    for group, items in (steps.get("groups") or {}).items():
        steps_html += f"<h3>{group}</h3><ul>"
        for item in items:
            steps_html += f"<li><strong>[{item.get('priority', '')}]</strong> {item.get('action', '')}<br><span class='muted'>{item.get('reason', '')}</span></li>"
        steps_html += "</ul>"

    # Refactoring considerations
    refac = report.get("refactoring_considerations", {})
    refac_html = f"<p>Complexity: {refac.get('complexity_classification', 'N/A')} | Readiness: {refac.get('readiness_classification', 'N/A')}</p><ul>"
    for c in refac.get("considerations", []):
        refac_html += f"<li>{c}</li>"
    refac_html += "</ul>"

    # Parser coverage
    parser_cov = report.get("parser_coverage_and_accuracy", {})
    parser_html = _kv_table([
        ("Total Artifacts", str(parser_cov.get("total_artifacts", 0))),
        ("Parsed", str(parser_cov.get("parsed_artifacts", 0))),
        ("Unsupported", str(parser_cov.get("unsupported_artifacts", 0))),
        ("Components Extracted", str(parser_cov.get("components_extracted", 0))),
    ])
    parser_html += f"<p class='muted'>{parser_cov.get('note', '')}</p>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ReframeX Assessment Report — {app_name}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #1B1612; line-height: 1.6; }}
  h1 {{ font-size: 1.8rem; border-bottom: 2px solid #A9784E; padding-bottom: 8px; }}
  h2 {{ font-size: 1.3rem; margin-top: 2rem; color: #5C4A3A; border-bottom: 1px solid #E8D8C6; padding-bottom: 4px; }}
  h3 {{ font-size: 1.1rem; margin-top: 1.2rem; color: #6B5B4A; }}
  .report-header {{ background: #F5EDE3; padding: 16px 24px; border-radius: 8px; margin-bottom: 24px; }}
  .report-header p {{ margin: 4px 0; }}
  .report-section {{ margin-bottom: 1.5rem; page-break-inside: avoid; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.9rem; }}
  .kv-table td.label {{ font-weight: 600; color: #6B5B4A; width: 35%; padding: 4px 12px 4px 0; }}
  .kv-table td {{ padding: 4px 0; vertical-align: top; }}
  .data-table th {{ background: #F5EDE3; text-align: left; padding: 8px 12px; font-weight: 600; border-bottom: 2px solid #D9C1A2; }}
  .data-table td {{ padding: 6px 12px; border-bottom: 1px solid #EDE5DC; }}
  .data-table tbody tr:nth-child(even) {{ background: #FAF7F2; }}
  .muted {{ color: #8A7A6A; font-size: 0.85rem; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: white; }}
  .badge.high {{ background: #E04A3A; }}
  .badge.medium {{ background: #E0A23A; }}
  .risk-item {{ padding: 10px 0; border-bottom: 1px solid #EDE5DC; }}
  .warning {{ background: #FFF3CD; border: 1px solid #E0A23A; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }}
  .footer {{ margin-top: 3rem; padding-top: 16px; border-top: 1px solid #D9C1A2; font-size: 0.8rem; color: #8A7A6A; }}
  @media print {{ body {{ max-width: none; padding: 0; }} .report-section {{ page-break-inside: avoid; }} }}
</style>
</head>
<body>
<div class="report-header">
  <h1>ReframeX Assessment Report</h1>
  <p><strong>Application:</strong> {app_name}</p>
  <p><strong>Generated:</strong> {meta.get("generated_at", "")}</p>
  <p><strong>Report Format:</strong> {meta.get("report_format", "")}</p>
</div>

{_section("Executive Summary", exec_html)}
{_section("Application Overview", overview_html)}
{_section("Artifact Inventory", art_html)}
{_section("Component Inventory", comp_html)}
{_section("Dependency Analysis", dep_html)}
{_section("Eight Domain Assessments", domain_html)}
{_section("Migration Complexity", _kv_table([("Score", str(report.get("migration_complexity", {}).get("score", "N/A"))), ("Classification", report.get("migration_complexity", {}).get("classification", "N/A"))]))}
{_section("Assessment Confidence", _kv_table([("Score", str(report.get("assessment_confidence", {}).get("score", "N/A"))), ("Classification", report.get("assessment_confidence", {}).get("classification", "N/A"))]))}
{_section("Migration Readiness", _kv_table([("Score", str(report.get("migration_readiness", {}).get("score", "N/A"))), ("Classification", report.get("migration_readiness", {}).get("classification", "N/A"))]))}
{_section("Major Risks", risk_html)}
{_section("Evidence Gaps and Unsupported Artifacts", gaps_html)}
{_section("Component Recommendations", rec_html)}
{_section("Refactoring Considerations", refac_html)}
{_section("Prioritized Next Steps", steps_html)}
{_section("Parser Coverage and Accuracy", parser_html)}
{_section("Automation and AI-Usage Statement", auto_html)}
{_section("Limitations and Assumptions", lim_html)}
{_section("Ruleset, Model and Parser Versions", versions_html)}
{_section("Reviewer Changes", rev_html)}
{_section("Measured Business-Value Metrics", metrics_html)}

<div class="footer">
  <p>This report was generated by ReframeX M2O Intelligence from stored assessment results. All conclusions cite their evidence class, artifact, and rule. No estimated cost, hours saved, or percentage savings are reported. This is static extraction, not full COBOL semantic analysis.</p>
</div>
</body>
</html>"""
    return html
