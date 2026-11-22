"""Idempotent seed script for ReFrameX demo applications.

Seeds or pre-warms:
  - CLAIMS-MGR (Insurance Claims Processing Monolith)
  - LOAN-SERV (Commercial Loan Servicing Engine)
  - SYNTH-PAYROLL (Straightforward Batch Payroll)
  - SYNTH-ACCTLEDG (Account Ledger with CICS/DB2/BMS)

Usage:
  py backend/scripts/seed_demo.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database.database import SessionLocal, init_db
from app.models.models import Application
from app.schemas.schemas import ApplicationCreate, ApplicationUpdate
from app.services import (
    application_service,
    artifact_service,
    analysis_service,
    dependency_service,
    assessment_service,
    finding_service,
)
from app.seed_full_inventory import (
    CLAIMCTL_SRC,
    VALIDATE_SRC,
    POLICY_CPY,
    CLAIMREC_CPY,
    DAILYCLM_JCL,
    CLAIMS_DDL,
    CLM01M_BMS,
    CLAIMSEC_RACF,
    RUNBOOK_TXT,
    LOANPROC_SRC,
    LOANREC_CPY,
    LOANJOB_JCL,
    LOAN_DDL,
)

SAMPLE_DIR = BACKEND_DIR / "sample_data"
SIMPLE_DIR = SAMPLE_DIR / "synthetic_simple"
COMPLEX_DIR = SAMPLE_DIR / "synthetic_complex"


def _ingest_dir(db, app_id: str, directory: Path):
    if not directory.exists():
        return
    for f in sorted(directory.iterdir()):
        if f.is_file():
            with open(f, "rb") as fh:
                content = fh.read()
            artifact_service.ingest_single_file(db, app_id, f.name, f.name, content)


def seed_demo() -> None:
    print("Initializing ReFrameX Database...")
    init_db()
    db = SessionLocal()

    try:
        # 1. CLAIMS-MGR
        claims_app = db.query(Application).filter(Application.name == "CLAIMS-MGR").first()
        if not claims_app:
            print("Creating application: CLAIMS-MGR...")
            claims_app = application_service.create_application(
                db,
                ApplicationCreate(
                    name="CLAIMS-MGR",
                    description="Insurance Claims Processing & Adjudication System. Core mission-critical monolith assessed for OpenShift modernization.",
                    business_domain="Insurance & Claims",
                    owner="Enterprise Claims Architecture",
                    technology_stack="COBOL, CICS, Db2, JCL, BMS, RACF",
                    environment="Production",
                    assessment_status="Complete",
                ),
            )
            claims_files = {
                "CLAIMCTL.cbl": CLAIMCTL_SRC,
                "VALIDATE.cbl": VALIDATE_SRC,
                "POLICY.cpy": POLICY_CPY,
                "CLAIMREC.cpy": CLAIMREC_CPY,
                "DAILYCLM.jcl": DAILYCLM_JCL,
                "CLAIMS_DDL.sql": CLAIMS_DDL,
                "CLM01M.bms": CLM01M_BMS,
                "CLAIMSEC.racf": CLAIMSEC_RACF,
                "RUNBOOK.txt": RUNBOOK_TXT,
            }
            for fn, content in claims_files.items():
                artifact_service.ingest_single_file(db, claims_app.id, fn, fn, content.encode("utf-8"))

        # 2. LOAN-SERV
        loan_app = db.query(Application).filter(Application.name == "LOAN-SERV").first()
        if not loan_app:
            print("Creating application: LOAN-SERV...")
            loan_app = application_service.create_application(
                db,
                ApplicationCreate(
                    name="LOAN-SERV",
                    description="Commercial Loan Servicing & Interest Accrual Engine.",
                    business_domain="Banking & Lending",
                    owner="Lending Technology Group",
                    technology_stack="COBOL, JCL, Db2, VSAM",
                    environment="Production",
                    assessment_status="Complete",
                ),
            )
            loan_files = {
                "LOANPROC.cbl": LOANPROC_SRC,
                "LOANREC.cpy": LOANREC_CPY,
                "LOANJOB.jcl": LOANJOB_JCL,
                "LOAN_DDL.sql": LOAN_DDL,
            }
            for fn, content in loan_files.items():
                artifact_service.ingest_single_file(db, loan_app.id, fn, fn, content.encode("utf-8"))

        # 3. SYNTH-PAYROLL
        payroll_app = db.query(Application).filter(Application.name.like("SYNTH-PAYROLL%")).first()
        if not payroll_app and SIMPLE_DIR.exists():
            print("Creating application: SYNTH-PAYROLL...")
            payroll_app = application_service.create_application(
                db,
                ApplicationCreate(
                    name="SYNTH-PAYROLL",
                    description="Straightforward payroll batch processing system.",
                    business_domain="Payroll",
                    owner="Demo Assessor",
                    technology_stack="COBOL, JCL, Db2, VSAM",
                    environment="Demo",
                    assessment_status="Complete",
                ),
            )
            _ingest_dir(db, payroll_app.id, SIMPLE_DIR)

        # 4. SYNTH-ACCTLEDG
        acct_app = db.query(Application).filter(Application.name.like("SYNTH-ACCTLEDG%")).first()
        if not acct_app and COMPLEX_DIR.exists():
            print("Creating application: SYNTH-ACCTLEDG...")
            acct_app = application_service.create_application(
                db,
                ApplicationCreate(
                    name="SYNTH-ACCTLEDG",
                    description="Account ledger with shared copybooks, dynamic calls, CICS, SQL.",
                    business_domain="Accounting",
                    owner="Demo Assessor",
                    technology_stack="COBOL, CICS, JCL, Db2, BMS, RACF",
                    environment="Demo",
                    assessment_status="In Progress",
                ),
            )
            _ingest_dir(db, acct_app.id, COMPLEX_DIR)

        # Re-assess and pre-warm all apps
        all_apps = application_service.list_applications(db)
        print(f"\nPre-warming analysis and assessment for {len(all_apps)} applications...")

        summary_rows = []
        for app in all_apps:
            analysis_service.analyze_application(db, app.id)
            dependency_service.discover_dependencies(db, app.id)
            assess_record = assessment_service.run_assessment(db, app.id)
            finding_service.rebuild_findings(db, app.id)

            cx = assess_record.get("complexity_score") if isinstance(assess_record, dict) else getattr(assess_record, "complexity_score", 0.0)
            conf = assess_record.get("confidence_score") if isinstance(assess_record, dict) else getattr(assess_record, "confidence_score", 0.0)
            ready = assess_record.get("readiness_score") if isinstance(assess_record, dict) else getattr(assess_record, "readiness_score", 0.0)
            status = assess_record.get("readiness_classification") if isinstance(assess_record, dict) else getattr(assess_record, "readiness_classification", "N/A")

            summary_rows.append((
                app.name[:22],
                f"{cx:.1f}",
                f"{conf:.1f}",
                f"{ready:.1f}",
                str(status),
            ))

        # Make CLAIMS-MGR active by default
        if claims_app:
            application_service.update_application(db, claims_app.id, ApplicationUpdate(is_active=True))

        print("\n" + "=" * 80)
        print(f"{'Application':<22} | {'Complexity':<10} | {'Confidence':<10} | {'Readiness':<10} | {'Status'}")
        print("-" * 80)
        for name, cx, conf, ready, status in summary_rows:
            print(f"{name:<22} | {cx:<10} | {conf:<10} | {ready:<10} | {status}")
        print("=" * 80)
        print("Demo seed completed successfully.\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
