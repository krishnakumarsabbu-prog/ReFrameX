"""Analysis engine — orchestrates parsers across all artifacts for an application.

Idempotent: reanalysis deletes prior components and creates new ones with
stable, deterministic IDs (no duplicates). Stores parser versions, timestamps,
duration and warnings.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.models import Artifact, Component, AnalysisRun
from app.parsers import get_parser_for_category, list_parsers


def _serialize_refs(refs) -> list[dict]:
    return [
        {
            "artifact_id": r.artifact_id,
            "line_start": r.line_start,
            "line_end": r.line_end,
            "rule": r.rule,
            "snippet": r.snippet,
        }
        for r in refs
    ]


def analyze_application(db: Session, application_id: str) -> AnalysisRun:
    """Run analysis on all artifacts for an application.

    Idempotent: existing components for this application are deleted first,
    then re-extracted with deterministic IDs. Returns the AnalysisRun record.
    """
    start_time = time.perf_counter()
    started_at = datetime.now(timezone.utc)

    run = AnalysisRun(
        id=str(uuid.uuid4()),
        application_id=application_id,
        started_at=started_at,
        status="running",
    )
    db.add(run)
    db.flush()

    # Delete existing components for this application
    db.query(Component).filter(Component.application_id == application_id).delete()
    db.flush()

    # Get all artifacts
    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()

    parser_versions: dict[str, str] = {}
    total_components = 0
    total_warnings = 0
    artifacts_processed = 0

    for artifact in artifacts:
        # Get parser for this artifact's category
        parser = get_parser_for_category(artifact.category)
        if parser is None:
            # No parser for this category — record as unsupported
            parser_versions["unsupported"] = "n/a"
            continue

        # Load file content
        file_path = settings.upload_dir / artifact.storage_path
        content = b""
        if file_path.exists():
            content = file_path.read_bytes()

        # Parse
        parse_result = parser.parse(artifact.id, artifact.original_filename, content, artifact.category)

        # Record parser version
        parser_versions[parser.name] = parser.version

        artifacts_processed += 1

        # Store components
        for comp in parse_result.components:
            comp_id = comp.deterministic_id(application_id)
            db_comp = Component(
                id=comp_id,
                application_id=application_id,
                name=comp.name,
                component_type=comp.component_type,
                technology=comp.technology,
                source_artifact_id=artifact.id,
                source_filename=artifact.original_filename,
                line_start=comp.line_start,
                line_end=comp.line_end,
                detected_properties=json.dumps(comp.detected_properties),
                evidence_class=comp.evidence_class,
                evidence_refs=json.dumps(_serialize_refs(comp.evidence_refs)),
                warnings=json.dumps(comp.warnings),
                parser_name=parse_result.parser_name,
                parser_version=parse_result.parser_version,
            )
            db.add(db_comp)
            total_components += 1

        total_warnings += len(parse_result.warnings)

        # Update artifact parse status
        artifact.parse_status = parse_result.parse_status

    # Build summary
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    completed_at = datetime.now(timezone.utc)

    # Compute summary by type, technology, evidence class
    components = db.query(Component).filter(Component.application_id == application_id).all()
    by_type: dict[str, int] = {}
    by_tech: dict[str, int] = {}
    by_evidence: dict[str, int] = {}
    for c in components:
        by_type[c.component_type] = by_type.get(c.component_type, 0) + 1
        by_tech[c.technology] = by_tech.get(c.technology, 0) + 1
        by_evidence[c.evidence_class] = by_evidence.get(c.evidence_class, 0) + 1

    summary = {
        "by_type": by_type,
        "by_technology": by_tech,
        "by_evidence_class": by_evidence,
        "artifacts_processed": artifacts_processed,
        "total_artifacts": len(artifacts),
        "parsers_used": parser_versions,
    }

    run.completed_at = completed_at
    run.duration_ms = elapsed_ms
    run.artifacts_processed = artifacts_processed
    run.components_extracted = total_components
    run.warnings_count = total_warnings
    run.parser_versions = json.dumps(parser_versions)
    run.status = "completed"
    run.summary = json.dumps(summary)

    db.commit()
    db.refresh(run)
    return run


def get_components(db: Session, application_id: str) -> list[Component]:
    """Get all components for an application, ordered by type then name."""
    return db.query(Component).filter(
        Component.application_id == application_id
    ).order_by(Component.component_type, Component.name).all()


def get_analysis_summary(db: Session, application_id: str) -> dict:
    """Get analysis summary for an application."""
    # Get latest run
    run = db.query(AnalysisRun).filter(
        AnalysisRun.application_id == application_id
    ).order_by(AnalysisRun.started_at.desc()).first()

    components = db.query(Component).filter(
        Component.application_id == application_id
    ).all()

    by_type: dict[str, int] = {}
    by_tech: dict[str, int] = {}
    by_evidence: dict[str, int] = {}
    for c in components:
        by_type[c.component_type] = by_type.get(c.component_type, 0) + 1
        by_tech[c.technology] = by_tech.get(c.technology, 0) + 1
        by_evidence[c.evidence_class] = by_evidence.get(c.evidence_class, 0) + 1

    parser_versions: dict[str, str] = {}
    if run:
        try:
            parser_versions = json.loads(run.parser_versions)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "application_id": application_id,
        "last_run_id": run.id if run else None,
        "last_run_at": run.completed_at if run else None,
        "duration_ms": run.duration_ms if run else None,
        "artifacts_processed": run.artifacts_processed if run else 0,
        "components_extracted": len(components),
        "warnings_count": run.warnings_count if run else 0,
        "by_type": by_type,
        "by_technology": by_tech,
        "by_evidence_class": by_evidence,
        "parser_versions": parser_versions,
        "status": run.status if run else "not_run",
    }


def get_parser_coverage(db: Session, application_id: str) -> dict:
    """Generate parser coverage report for an application."""
    artifacts = db.query(Artifact).filter(Artifact.application_id == application_id).all()
    components = db.query(Component).filter(Component.application_id == application_id).all()

    # Group components by artifact
    comp_by_artifact: dict[str, list[Component]] = {}
    for c in components:
        comp_by_artifact.setdefault(c.source_artifact_id, []).append(c)

    entries: list[dict] = []
    unsupported: list[dict] = []
    by_capability: dict[str, int] = {}
    by_parse_status: dict[str, int] = {}
    by_category: dict[str, int] = {}

    for art in artifacts:
        by_category[art.category] = by_category.get(art.category, 0) + 1
        parser = get_parser_for_category(art.category)
        comp_count = len(comp_by_artifact.get(art.id, []))
        warnings_count = sum(
            len(json.loads(c.warnings) if c.warnings else "[]")
            for c in comp_by_artifact.get(art.id, [])
        )

        entry = {
            "artifact_id": art.id,
            "filename": art.original_filename,
            "category": art.category,
            "support_level": art.support_level,
            "parser_name": parser.name if parser else None,
            "parser_version": parser.version if parser else None,
            "capability": parser.capability.value if parser else None,
            "parse_status": art.parse_status,
            "components_extracted": comp_count,
            "warnings": warnings_count,
            "error": None,
        }
        entries.append(entry)

        if parser:
            by_capability[parser.capability.value] = by_capability.get(parser.capability.value, 0) + 1
        else:
            by_capability["UNSUPPORTED"] = by_capability.get("UNSUPPORTED", 0) + 1
            unsupported.append(entry)

        by_parse_status[art.parse_status] = by_parse_status.get(art.parse_status, 0) + 1

    parsers_info = list_parsers()

    return {
        "total_artifacts": len(artifacts),
        "by_capability": by_capability,
        "by_parse_status": by_parse_status,
        "by_category": by_category,
        "parsers": parsers_info,
        "entries": entries,
        "unsupported_artifacts": unsupported,
    }
