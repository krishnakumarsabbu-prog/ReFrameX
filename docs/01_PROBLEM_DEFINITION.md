# 1. Problem Definition

## Applications Evaluated

ReframeX was validated against two synthetic mainframe application portfolios representing common migration scenarios:

### Application 1: CLAIMS-MGR (Claims Management)
- **Artifacts available**: COBOL program (CLAIMCTL.cbl), copybook (POLICY.cpy), JCL job stream (CLAIMJOB.jcl), BMS map (CLAIMMAP.bms), DB2 DDL (LOAN_DDL.sql)
- **Technology stack**: COBOL, CICS, DB2, VSAM
- **Components extracted**: 16 from COBOL, 1 from copybook, 13 from JCL, 6 from BMS, 3 from SQL

### Application 2: PAYROLL-EXEC (Payroll Batch)
- **Artifacts available**: COBOL program (PAYCALC.cbl), copybook (EMPLOYEE.cpy), JCL (PAYJOB.jcl), DB2 DDL (PAYROLL_DDL.sql), IDCAMS VSAM definitions (PAYROLL.idcams)
- **Technology stack**: COBOL, DB2, VSAM, batch processing

### Application 3: ACCT-LEDGER (General Ledger, complex synthetic)
- **Artifacts available**: COBOL programs (ACCTLEDG.cbl, VALIDATE.cbl), copybooks (ACCTCOPY.cpy, TRANSCOPY.cpy), JCL (ACCTJOB.jcl), BMS map (ACCTMAP.bms), DB2 DDL (ACCT_DDL.sql), RACF security (ACCTSEC.racf)
- **Technology stack**: COBOL, CICS, DB2, VSAM, RACF security

## Available Artifacts

| Artifact Type | Extensions | Parser | Capability |
|---|---|---|---|
| COBOL programs | .cbl, .cob, .cobol | cobol v3.0.0 | PARTIAL_EXTRACT |
| Copybooks | .cpy, .copy | copybook v3.0.0 | FULL_EXTRACT |
| JCL | .jcl, .proc, .cntl | jcl v3.0.0 | FULL_EXTRACT |
| SQL/DDL | .sql, .ddl, .db2 | sql v3.0.0 | FULL_EXTRACT |
| BMS maps | .bms, .map | bms v3.0.0 | FULL_EXTRACT |
| VSAM/IDCAMS | .idcams, .vsam | vsam v3.0.0 | FULL_EXTRACT |
| HLASM | .asm, .mac | hlasm v3.0.0 | DETECT_ONLY |
| IMS | .psb, .dbd | ims v3.0.0 | DETECT_ONLY |
| Security (RACF) | .racf, .rcf | security v3.0.0 | DETECT_ONLY |
| Scheduler | .ctm, .sch | scheduler v3.0.0 | DETECT_ONLY |
| Config/metadata | .json, .csv, .xml, .yaml | metadata v3.0.0 | DETECT_ONLY |
| Data files | .dat, .bin, .ebc | (none) | UNSUPPORTED |

## Limitations

1. **Static extraction only**: ReframeX performs regex/rule-based static extraction. It does NOT perform full COBOL semantic compilation, data flow tracing, or variable dependency tracking.
2. **No runtime analysis**: No execution traces, performance data, or runtime behavior is analyzed.
3. **Single-application scope**: Cross-application dependency analysis is limited to explicit references found in artifacts.
4. **EBCDIC decoding**: EBCDIC files are detected and flagged but not fully decoded for content extraction.
5. **DETECT_ONLY parsers**: HLASM, IMS, scheduler, and security artifacts are detected and counted but not structurally parsed.

## Planning Decisions Supported

ReframeX outputs support the following migration planning decisions:

- **Migration Complexity score** (0-100): How difficult the migration is likely to be, based on evidence from 8 domains.
- **Assessment Confidence score** (0-100): How much you can trust the complexity assessment, based on artifact coverage and evidence quality.
- **Migration Readiness score** (0-100): Whether the application is ready for migration planning, based on documentation completeness and dependency clarity.
- **Domain breakdown**: Per-domain scores for all 8 domains, allowing targeted investigation.
- **Dependency graph**: Visual graph of inter-component relationships for blast-radius analysis.
- **Recommendations**: Prioritized, evidence-linked refactoring actions.
- **Missing information registry**: What artifacts are missing and how their absence affects confidence.
- **Risk register**: Severity-classified risks with evidence traceability.

These three measures are computed independently — a high complexity score does not imply low readiness, and low confidence does not imply simplicity.
