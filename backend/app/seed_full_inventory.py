"""Seed script to create full enterprise inventory for CLAIMS-MGR and LOAN-SERV,
clean up empty test applications, and generate sample_files_for_upload on disk.
"""

import sys
import zipfile
from pathlib import Path

# Add backend to path
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

# Root directory of the repository
REPO_ROOT = BACKEND_DIR.parent
SAMPLE_UPLOAD_DIR = REPO_ROOT / "sample_files_for_upload"
SAMPLE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 1. Define rich sample files
CLAIMCTL_SRC = """       IDENTIFICATION DIVISION.
       PROGRAM-ID. CLAIMCTL.
       AUTHOR. REFRAMEX-ENTERPRISE.
      *----------------------------------------------------------------*
      * CLAIMS CONTROL & ADJUDICATION MAIN ENGINE                      *
      * Features: CICS, Embedded DB2 SQL, Dynamic CALL, GOTO logic     *
      *----------------------------------------------------------------*
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SPECIAL-NAMES.
           CICS SYSTEM-ID IS CLMSYS.

       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CLAIM-FILE ASSIGN TO CLMFILE
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS CLM-KEY.

       DATA DIVISION.
       FILE SECTION.
       FD  CLAIM-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 250 CHARACTERS.
       01  CLAIM-REC-FILE.
           05  CLM-KEY             PIC 9(10).
           05  CLM-DATA            PIC X(240).

       WORKING-STORAGE SECTION.
       01  WS-EOF                  PIC X VALUE 'N'.
       01  WS-PGM-NAME             PIC X(8) VALUE 'VALIDATE'.
       01  WS-TOTAL-AMT            PIC 9(9)V99 VALUE ZERO.
       01  WS-FRAUD-ALERT          PIC X VALUE 'N'.

      * Copybook for Insurance Policy details
       COPY POLICY.

      * Copybook for Claim Record Layout
       COPY CLAIMREC.

      * DB2 SQL Communication Area
       01  SQLCA.
           05  SQLCODE             PIC S9(9) COMP.
           05  SQLERRM             PIC X(70).

       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05  CA-CLAIM-ID         PIC 9(10).
           05  CA-POLICY-NUM       PIC X(12).
           05  CA-CLAIM-AMT        PIC 9(7)V99.
           05  CA-STATUS           PIC X(2).
           05  CA-ACTION-CODE      PIC X(4).

       PROCEDURE DIVISION USING DFHCOMMAREA.
       0000-MAIN-PROCESS.
           EVALUATE CA-ACTION-CODE
               WHEN 'ADJU'
                   PERFORM 1000-ADJUDICATE
               WHEN 'INQR'
                   PERFORM 2000-INQUIRY
               WHEN OTHER
                   GO TO 9999-ERROR-EXIT
           END-EVALUATE.

           EXEC CICS RETURN
               TRANSID('CLM1')
               COMMAREA(DFHCOMMAREA)
           END-EXEC.
           GOBACK.

       1000-ADJUDICATE.
      * Dynamic Call to Fraud Validation Routine
           MOVE 'VALIDATE' TO WS-PGM-NAME
           CALL WS-PGM-NAME USING DFHCOMMAREA, WS-FRAUD-ALERT.

           IF WS-FRAUD-ALERT = 'Y'
               MOVE 'FR' TO CA-STATUS
               GO TO 9999-ERROR-EXIT
           END-IF.

      * Embedded SQL to record approved claim
           EXEC SQL
               UPDATE CLAIMS.CLAIM_TRANS
               SET CLAIM_STATUS = 'AP',
                   CLAIM_AMT = :CA-CLAIM-AMT
               WHERE CLAIM_ID = :CA-CLAIM-ID
           END-EXEC.

           IF SQLCODE NOT = 0
               GO TO 9999-ERROR-EXIT
           END-IF.

           MOVE 'AP' TO CA-STATUS.

       2000-INQUIRY.
           EXEC CICS READ
               FILE('CLMFILE')
               INTO(CLAIM-REC)
               RIDFLD(CA-CLAIM-ID)
           END-EXEC.

       9999-ERROR-EXIT.
           MOVE 'ER' TO CA-STATUS.
           DISPLAY 'CLAIM PROCESSING ERROR ENCOUNTERED'.
           STOP RUN.
"""

VALIDATE_SRC = """       IDENTIFICATION DIVISION.
       PROGRAM-ID. VALIDATE.
       AUTHOR. REFRAMEX-SAMPLE.
      *----------------------------------------------------------------*
      * CLAIMS VALIDATION SUBROUTINE - DYNAMICALLY CALLED BY CLAIMCTL   *
      *----------------------------------------------------------------*
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-MAX-LIMIT        PIC 9(7)V99 VALUE 250000.00.

       LINKAGE SECTION.
       01  LNK-COMMAREA.
           05  LNK-CLAIM-ID    PIC 9(10).
           05  LNK-POLICY-NUM  PIC X(12).
           05  LNK-CLAIM-AMT   PIC 9(7)V99.
           05  LNK-STATUS      PIC X(2).
           05  LNK-ACTION      PIC X(4).
       01  LNK-FRAUD-ALERT     PIC X.

       PROCEDURE DIVISION USING LNK-COMMAREA, LNK-FRAUD-ALERT.
       VALIDATE-MAIN.
           IF LNK-CLAIM-AMT > WS-MAX-LIMIT
               MOVE 'Y' TO LNK-FRAUD-ALERT
           ELSE
               MOVE 'N' TO LNK-FRAUD-ALERT
           END-IF.
           GOBACK.
"""

POLICY_CPY = """      *----------------------------------------------------------------*
      * POLICY.cpy - POLICY RECORD LAYOUT WITH COMP-3 AND REDEFINES    *
      *----------------------------------------------------------------*
       01  POLICY-RECORD.
           05  POL-NUMBER          PIC X(12).
           05  POL-HOLDER-NAME     PIC X(35).
           05  POL-TYPE            PIC X(4).
           05  POL-LIMIT           PIC S9(9)V99 COMP-3.
           05  POL-DEDUCTIBLE      PIC S9(5)V99 COMP-3.
           05  POL-DETAILS         PIC X(50).
           05  AUTO-DETAILS REDEFINES POL-DETAILS.
               10  AUTO-VIN        PIC X(17).
               10  AUTO-MAKE       PIC X(15).
               10  AUTO-YEAR       PIC 9(4).
               10  FILLER          PIC X(14).
"""

CLAIMREC_CPY = """      *----------------------------------------------------------------*
      * CLAIMREC.cpy - CLAIMS ADJUDICATION RECORD STRUCTURE            *
      *----------------------------------------------------------------*
       01  CLAIM-RECORD.
           05  CLAIM-ID            PIC 9(10).
           05  POLICY-ID           PIC X(12).
           05  INCIDENT-DATE       PIC 9(8).
           05  REPORT-DATE         PIC 9(8).
           05  CLAIM-AMOUNT        PIC S9(7)V99 COMP-3.
           05  APPROVED-AMOUNT     PIC S9(7)V99 COMP-3.
           05  STATUS-FLAG         PIC X(2).
"""

DAILYCLM_JCL = """//DAILYCLM JOB (ACCT,CLM),'DAILY CLAIMS BATCH',
//             CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID
//*-------------------------------------------------------------------*
//* BATCH ORCHESTRATION: CLAIMS RECONCILIATION & REPORTING            *
//*-------------------------------------------------------------------*
//STEP010  EXEC PGM=SORT
//SORTIN   DD  DSN=PROD.CLAIMS.RAW,DISP=SHR
//SORTOUT  DD  DSN=&&SORTED,DISP=(NEW,PASS),UNIT=SYSDA,
//             SPACE=(CYL,(25,10),RLSE)
//SYSOUT   DD  SYSOUT=*
//SYSIN    DD  *
  SORT FIELDS=(1,10,CH,A)
/*
//STEP020  EXEC PGM=CLAIMCTL,COND=(0,NE)
//STEPLIB  DD  DSN=PROD.CLAIMS.LOADLIB,DISP=SHR
//CLMFILE  DD  DSN=&&SORTED,DISP=(OLD,DELETE)
//REPORT   DD  DSN=PROD.CLAIMS.RECON(+1),DISP=(NEW,CATLG),
//             UNIT=SYSDA,SPACE=(CYL,(5,2))
//SYSOUT   DD  SYSOUT=*
//SYSPRINT DD  SYSOUT=*
//
"""

CLM01M_BMS = """*-------------------------------------------------------------*
* CLM01M.bms - CICS 3270 CLAIMS INQUIRY AND ENTRY SCREEN MAP  *
*-------------------------------------------------------------*
         PRINT NOGEN
CLM01M   DFHMSD TYPE=&SYSPARM,MODE=INOUT,LANG=COBOL,                   *
               DSATTS=(ATTIN,ATTOUT),STORAGE=AUTO,                    *
               TIOAPFX=YES
CLMINQ   DFHMDI SIZE=(24,80),LINE=1,COLUMN=1,CTRL=FREEKB
         DFHMDF POS=(1,26),ATTRB=(NORM,PROT),                         *
               LENGTH=28,INITIAL='INSURANCE CLAIMS INQUIRY'
         DFHMDF POS=(3,5),ATTRB=(NORM,PROT),LENGTH=10,                *
               INITIAL='CLAIM ID:'
CLMID    DFHMDF POS=(3,16),ATTRB=(NORM,UNPROT,IC),                    *
               LENGTH=10,INITIAL='__________'
         DFHMDF POS=(5,5),ATTRB=(NORM,PROT),LENGTH=10,                *
               INITIAL='AMOUNT:'
CLMAMT   DFHMDF POS=(5,16),ATTRB=(NORM,UNPROT),                       *
               LENGTH=12,INITIAL='____________'
         DFHMSD TYPE=FINAL
"""

CLAIMS_DDL = """-- Claims Database Relational Definitions (Db2 for z/OS)
CREATE TABLE CLAIMS.CLAIM_TRANS (
    CLAIM_ID     CHAR(10)       NOT NULL,
    POLICY_ID    CHAR(12)       NOT NULL,
    CLAIM_AMT    DECIMAL(10,2)  NOT NULL,
    CLAIM_DATE   DATE           NOT NULL,
    CLAIM_STATUS CHAR(2)        NOT NULL,
    PRIMARY KEY (CLAIM_ID)
);

CREATE TABLE CLAIMS.POLICY_MASTER (
    POLICY_ID    CHAR(12)       NOT NULL,
    HOLDER_NAME  VARCHAR(60)    NOT NULL,
    POLICY_LIMIT DECIMAL(12,2)  NOT NULL,
    STATUS       CHAR(1)        NOT NULL,
    PRIMARY KEY (POLICY_ID)
);

CREATE INDEX IX_CLM_POL ON CLAIMS.CLAIM_TRANS (POLICY_ID);
"""

CLAIMSEC_RACF = """* RACF Security Profiles for Claims Application
ADDGROUP CLAIMSGRP OWNER(SYSADMIN)
RDEFINE FACILITY CLAIMS.TRANS.* UACC(NONE)
PERMIT CLAIMS.TRANS.* CLASS(FACILITY) ID(CLM_OPER) ACCESS(READ)
PERMIT CLAIMS.TRANS.* CLASS(FACILITY) ID(CLM_ADJU) ACCESS(UPDATE)
RDEFINE DATASET CLAIMS.DATA.** UACC(NONE) OWNER(CLAIMSGRP)
SETROPTS REFRESH RACLIST(FACILITY)
"""

RUNBOOK_TXT = """MIGRATION INTELLIGENCE RUNBOOK - CLAIMS-MGR
=====================================================
Application ID: CLAIMS-MGR
Business Domain: Insurance Policy & Claims Adjudication
Target Platform: Red Hat OpenShift Container Platform

1. Operational SLAs:
   - Online CICS Service Hours: 06:00 - 22:00 EST. Response SLA < 350ms.
   - Batch Window: Daily nightly execution starting 23:00 EST.
   - Max Batch Duration: 2 hours 15 minutes.

2. Disaster Recovery:
   - Recovery Point Objective (RPO): < 15 minutes.
   - Recovery Time Objective (RTO): 2 hours.

3. OpenShift Migration Recommendation:
   - CICS BMS 3270 Screens: Refactor to React SPA on OpenShift Routes.
   - Batch Stream (DAILYCLM): Containerize into OpenShift CronJobs / Tekton Pipelines.
   - Db2 Database: Migrate to PostgreSQL on Red Hat OpenShift Data Foundation (ODF).
"""

# LOAN-SERV files
LOANPROC_SRC = """       IDENTIFICATION DIVISION.
       PROGRAM-ID. LOANPROC.
       AUTHOR. REFRAMEX-SAMPLE.
      *----------------------------------------------------------------*
      * COMMERCIAL LOAN RECONCILIATION & INTEREST ACCRUAL ENGINE       *
      *----------------------------------------------------------------*
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-TOTAL-INTEREST    PIC 9(9)V99 VALUE ZERO.
       COPY LOANREC.

       PROCEDURE DIVISION.
       MAIN-LOAN.
           MOVE 125000.00 TO LOAN-BALANCE
           COMPUTE WS-TOTAL-INTEREST = LOAN-BALANCE * (LOAN-RATE / 100)
           DISPLAY 'TOTAL INTEREST: ' WS-TOTAL-INTEREST
           STOP RUN.
"""

LOANREC_CPY = """       01  LOAN-RECORD.
           05  LOAN-ACCOUNT-NUM  PIC 9(12).
           05  BORROWER-NAME     PIC X(30).
           05  LOAN-BALANCE      PIC S9(11)V99 COMP-3.
           05  LOAN-RATE         PIC 9(2)V99.
"""

LOANJOB_JCL = """//LOANJOB  JOB (ACCT,LN),'LOAN INTEREST ACCRUAL',
//             CLASS=B,MSGCLASS=A
//STEP1   EXEC PGM=LOANPROC
//SYSOUT  DD  SYSOUT=*
//
"""

LOAN_DDL = """CREATE TABLE LOANS.ACCOUNT_MASTER (
    LOAN_NUM    CHAR(12) NOT NULL,
    BORROWER    VARCHAR(50),
    BALANCE     DECIMAL(12,2),
    INTEREST    DECIMAL(4,2),
    PRIMARY KEY (LOAN_NUM)
);
"""


def seed_full_inventory():
    print("==================================================")
    print("ReFrameX: Initializing Full Enterprise Inventory")
    print("==================================================")
    init_db()
    db = SessionLocal()

    try:
        # 1. Clean up empty dummy "Test" app if present
        test_apps = db.query(Application).filter(Application.name == "Test").all()
        for t in test_apps:
            print(f"Cleaning up empty legacy application: {t.name} ({t.id})")
            db.delete(t)
        db.commit()

        # 2. Write sample files to disk for user testing
        print(f"\nWriting sample files to disk in: {SAMPLE_UPLOAD_DIR}")
        files_to_write = {
            "CLAIMCTL.cbl": CLAIMCTL_SRC,
            "VALIDATE.cbl": VALIDATE_SRC,
            "POLICY.cpy": POLICY_CPY,
            "CLAIMREC.cpy": CLAIMREC_CPY,
            "DAILYCLM.jcl": DAILYCLM_JCL,
            "CLM01M.bms": CLM01M_BMS,
            "CLAIMS_DDL.sql": CLAIMS_DDL,
            "CLAIMSEC.racf": CLAIMSEC_RACF,
            "CLAIM_RUNBOOK.txt": RUNBOOK_TXT,
        }

        for filename, content in files_to_write.items():
            filepath = SAMPLE_UPLOAD_DIR / filename
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  [Created file] {filename}")

        # Create ZIP package for one-click upload
        zip_path = SAMPLE_UPLOAD_DIR / "sample_inventory_pack.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            for filename in files_to_write.keys():
                zf.write(SAMPLE_UPLOAD_DIR / filename, arcname=filename)
        print(f"  [Created ZIP] {zip_path.name}")

        # Write How-To-Test guide
        readme_content = """# ReFrameX Sample Files for Upload & Validation

This folder contains verified sample mainframe artifacts for testing the ReFrameX platform:

## Included Artifacts:
1. `CLAIMCTL.cbl`: High-complexity COBOL program with CICS, Embedded DB2 SQL, Dynamic CALL, and GOTO statements.
2. `VALIDATE.cbl`: Dynamically-called COBOL subprogram.
3. `POLICY.cpy`: Shared copybook containing COMP-3 packed decimals and REDEFINES structures.
4. `CLAIMREC.cpy`: Shared claim record layout.
5. `DAILYCLM.jcl`: Daily batch orchestration job stream with SORT step and GDG generation datasets.
6. `CLM01M.bms`: CICS BMS 3270 terminal green-screen mapset.
7. `CLAIMS_DDL.sql`: Relational Db2 table schema with indexes.
8. `CLAIMSEC.racf`: RACF access control rules protecting dataset resources.
9. `CLAIM_RUNBOOK.txt`: Operational runbook defining SLAs, batch windows, and recovery procedures.
10. `sample_inventory_pack.zip`: All the above bundled in a single ZIP for 1-click upload!

## How to Test in the ReFrameX Portal:
1. Open the portal: http://localhost:5173
2. Go to **Applications** -> click **+ New application** (e.g. `MY-TEST-APP`).
3. Go to **Artifact Explorer** -> click **Upload files** or **drag and drop** the files (or `sample_inventory_pack.zip`).
4. Watch the system ingest and classify the artifacts.
5. Navigate to **Complexity Assessment** -> click **Run Assessment**.
6. Inspect the scores, the drill-down drawer, and the interactive dependency graph!
"""
        with open(SAMPLE_UPLOAD_DIR / "README_HOW_TO_TEST.md", "w", encoding="utf-8") as f:
            f.write(readme_content)

        # 3. Seed CLAIMS-MGR application in database
        claims_app = db.query(Application).filter(Application.name == "CLAIMS-MGR").first()
        if not claims_app:
            print("\nSeeding application: CLAIMS-MGR...")
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
            # Ingest all files
            for filename, content in files_to_write.items():
                artifact_service.ingest_single_file(
                    db, claims_app.id, filename, filename, content.encode("utf-8")
                )
            print(f"  Ingested {len(files_to_write)} artifacts into CLAIMS-MGR")

            # Run full assessment pipeline
            analysis_service.analyze_application(db, claims_app.id)
            dependency_service.discover_dependencies(db, claims_app.id)
            assessment_service.run_assessment(db, claims_app.id)
            finding_service.rebuild_findings(db, claims_app.id)
            print("  Analyzed, dependencies mapped, assessed, and findings generated for CLAIMS-MGR")
        else:
            print("\nCLAIMS-MGR already exists. Ensuring it is active.")

        # Set CLAIMS-MGR as active
        application_service.update_application(
            db, claims_app.id, ApplicationUpdate(is_active=True)
        )

        # 4. Seed LOAN-SERV application in database (for Comparison)
        loan_app = db.query(Application).filter(Application.name == "LOAN-SERV").first()
        if not loan_app:
            print("\nSeeding application: LOAN-SERV...")
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
            for filename, content in loan_files.items():
                artifact_service.ingest_single_file(
                    db, loan_app.id, filename, filename, content.encode("utf-8")
                )
            analysis_service.analyze_application(db, loan_app.id)
            dependency_service.discover_dependencies(db, loan_app.id)
            assessment_service.run_assessment(db, loan_app.id)
            finding_service.rebuild_findings(db, loan_app.id)
            print("  Analyzed and assessed LOAN-SERV")

        print("\n==================================================")
        print("Inventory Setup Successfully Completed!")
        print(f"Active App: CLAIMS-MGR (ID: {claims_app.id})")
        print(f"Sample Files Directory: {SAMPLE_UPLOAD_DIR}")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    seed_full_inventory()
