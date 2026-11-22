# ReFrameX Sample Files for Upload & Validation

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
