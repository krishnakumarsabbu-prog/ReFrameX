# Synthetic Fixture Applications

These are **SYNTHETIC fixtures** — not real Wells Fargo applications. They are
internally consistent and mirror the structure of real mainframe artifacts per
`docs/DATA_PROFILE.md`.

## Simple Fixture (`synthetic_simple/`)

A straightforward payroll calculation application:
- `PAYCALC.cbl` — COBOL program, sequential file I/O, arithmetic
- `EMPLOYEE.cpy` — copybook with employee record layout
- `PAYJOB.jcl` — JCL batch job executing PAYCALC
- `PAYROLL_DDL.sql` — Db2 DDL for employee pay tables
- `PAYROLL.idcams` — VSAM cluster definition

## Complex Fixture (`synthetic_complex/`)

An account ledger application with shared components, dynamic calls, and
evidence gaps:
- `ACCTLEDG.cbl` — COBOL program, CICS transactions, embedded SQL, dynamic CALL
- `ACCTCOPY.cpy` — shared copybook with account record layout
- `VALIDATE.cbl` — validation subprogram called dynamically by ACCTLEDG
- `ACCTJOB.jcl` — JCL batch with proc, DB2 bind step
- `ACCT_DDL.sql` — Db2 DDL for account and transaction tables
- `ACCTMAP.bms` — BMS 3270 map for account inquiry screen
- `ACCTSEC.racf` — RACF security resource definitions

### Evidence gap (intentional)

`ACCTLEDG.cbl` contains `COPY TRANSCOPY` but `TRANSCOPY.cpy` is **not provided**
in the fixture. This demonstrates the evidence-improvement workflow:
1. Assess with the missing copybook → confidence reduced, missing-copybook finding generated
2. Add `TRANSCOPY.cpy` → reassess → confidence improves, new data structure discovered

## Evidence-Improvement Demo

To demonstrate the evidence-improvement workflow:
1. Create an application from `synthetic_complex/` **without** the missing copybook
2. Ingest artifacts, analyze, discover dependencies, assess
3. Record the assessment (version 1)
4. Add the missing `TRANSCOPY.cpy` artifact
5. Re-analyze, re-discover, re-assess
6. Compare assessment versions (before/after) using assessment history

This shows: previous evidence coverage, newly discovered components/relationships,
updated confidence, updated findings, and that complexity changes only where
the new evidence truly reveals new complexity.
