"""Seed script: creates synthetic fixture applications with pre-ingested artifacts.

Creates two clearly-labeled SYNTHETIC applications (not real Wells Fargo apps),
ingests their artifacts, runs analysis, discovers dependencies, and runs
assessment. This enables the Phase 7 demo: two applications assessed by the
same engine, ready for comparison and reporting.

The complex fixture is assessed TWICE to demonstrate the evidence-improvement
workflow:
  1. First assessment WITHOUT the missing TRANSCOPY.cpy (evidence gap)
  2. Add TRANSCOPY.cpy, re-analyze, re-assess (version 2)

Usage:
  cd backend && python -m app.seed
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.database import SessionLocal, init_db
from app.services import application_service, artifact_service, analysis_service
from app.services import dependency_service, assessment_service, finding_service
from app.schemas.schemas import ApplicationCreate


SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"
SIMPLE_DIR = SAMPLE_DIR / "synthetic_simple"
COMPLEX_DIR = SAMPLE_DIR / "synthetic_complex"


def _ingest_files_from_dir(db, app_id: str, directory: Path, exclude: set[str] | None = None):
    """Ingest all files from a directory into an application."""
    exclude = exclude or set()
    files = sorted(f for f in directory.iterdir() if f.is_file() and f.name not in exclude)
    for f in files:
        with open(f, "rb") as fh:
            content = fh.read()
        artifact_service.ingest_single_file(
            db, app_id, f.name, f.name, content
        )


def seed():
    """Create and assess the two synthetic fixture applications."""
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        existing = application_service.list_applications(db)
        existing_names = {a.name for a in existing}
        if "SYNTH-PAYROLL (Synthetic)" in existing_names:
            print("Already seeded. Skipping.")
            return

        # --- Simple fixture ---
        print("Creating SYNTH-PAYROLL (Synthetic)...")
        simple_app = application_service.create_application(db, ApplicationCreate(
            name="SYNTH-PAYROLL (Synthetic)",
            description="SYNTHETIC fixture — straightforward payroll calculation. Not a real Wells Fargo application.",
            business_domain="Payroll",
            owner="Demo Assessor",
            technology_stack="COBOL, JCL, Db2, VSAM",
            environment="Demo",
            assessment_status="Complete",
        ))

        _ingest_files_from_dir(db, simple_app.id, SIMPLE_DIR)
        print(f"  Ingested {len(list(SIMPLE_DIR.iterdir()))} artifacts")

        analysis_service.analyze_application(db, simple_app.id)
        dependency_service.discover_dependencies(db, simple_app.id)
        assessment_service.run_assessment(db, simple_app.id)
        finding_service.rebuild_findings(db, simple_app.id)
        print("  Analysis, dependencies, assessment, findings complete")

        # --- Complex fixture (evidence-improvement demo) ---
        print("Creating SYNTH-ACCTLEDG (Synthetic)...")
        complex_app = application_service.create_application(db, ApplicationCreate(
            name="SYNTH-ACCTLEDG (Synthetic)",
            description="SYNTHETIC fixture — account ledger with shared components, dynamic calls, CICS, SQL, and evidence gaps. Not a real Wells Fargo application.",
            business_domain="Accounting",
            owner="Demo Assessor",
            technology_stack="COBOL, CICS, JCL, Db2, BMS, RACF",
            environment="Demo",
            assessment_status="In Progress",
        ))

        # First: ingest WITHOUT TRANSCOPY.cpy (evidence gap)
        _ingest_files_from_dir(db, complex_app.id, COMPLEX_DIR, exclude={"TRANSCOPY.cpy"})
        print(f"  Ingested artifacts (excluding TRANSCOPY.cpy for evidence gap)")

        analysis_service.analyze_application(db, complex_app.id)
        dependency_service.discover_dependencies(db, complex_app.id)
        assessment_service.run_assessment(db, complex_app.id)
        finding_service.rebuild_findings(db, complex_app.id)
        print("  Assessment v1 complete (with evidence gap)")

        # Now add the missing copybook and reassess
        transcopy = COMPLEX_DIR / "TRANSCOPY.cpy"
        with open(transcopy, "rb") as fh:
            content = fh.read()
        artifact_service.ingest_single_file(db, complex_app.id, "TRANSCOPY.cpy", "TRANSCOPY.cpy", content)
        print("  Added TRANSCOPY.cpy (evidence improvement)")

        analysis_service.analyze_application(db, complex_app.id)
        dependency_service.discover_dependencies(db, complex_app.id)
        assessment_service.run_assessment(db, complex_app.id)
        finding_service.rebuild_findings(db, complex_app.id)
        print("  Assessment v2 complete (evidence gap resolved)")

        # Update status
        application_service.update_application(db, complex_app.id, __import__("app.schemas.schemas", fromlist=["ApplicationUpdate"]).ApplicationUpdate(
            assessment_status="Complete",
        ))

        print("\nSeeding complete!")
        print(f"  Simple app ID: {simple_app.id}")
        print(f"  Complex app ID: {complex_app.id}")
        print(f"  Complex app has 2 assessment versions (evidence improvement demo)")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
