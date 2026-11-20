# ReframeX — Data Profile: M2O Hackathon Metadata

## Status of the metadata folder in this environment

The environment variable `M2O_METADATA_DIR` is **not set** in this build
environment, and no `M2O Hackathon Metadata` folder was found on disk. The
importer has therefore been built against the extension map and content
signatures specified in the Phase 2 requirements, and validated against the
synthetic sample artifacts shipped in `backend/sample_data/`.

When the real metadata folder is available, point ReframeX at it:

```bash
export M2O_METADATA_DIR=/path/to/M2O\ Hackathon\ Metadata
```

Then call `POST /api/applications/{id}/artifacts/import-folder` from the
Artifact Explorer. The importer walks the allowlisted path read-only and
records every file it finds — nothing is ignored.

## Expected structure (based on the hackathon brief)

Mainframe metadata folders of this kind typically contain a mix of source
artifacts, control cards, and documentation organized by application or
library. The importer makes no assumptions about directory names; it
classifies each file by extension and, when the extension is absent or
unexpected, by content signature.

### File categories expected

| Category | Extensions | Notes |
|---|---|---|
| COBOL | `.cbl .cob .cobol` | Programs; parsed in a later phase |
| Copybook | `.cpy .copy` | Shared data definitions |
| JCL / PROC | `.jcl .proc .prc .cntl` | Job control and catalogued procs |
| SQL / DDL / Db2 | `.sql .ddl .db2` | DDL, DML, stored procs |
| BMS / 3270 maps | `.bms .map` | CICS screen maps |
| HLASM | `.asm .mac` | Assembler source and macros |
| VSAM / IDCAMS | `.idcams .vsam .def` | Cluster definitions |
| IMS | `.psb .dbd .ims` | IMS DB/DC definitions |
| Schedulers | `.ctm .sch` + scheduler XML/JSON | Control-M, etc. |
| Security / RACF | `.racf .rcf` + recognizable security metadata | RACF exports |
| Config / metadata / docs | `.json .csv .txt .xml .properties .conf .ini .yaml .yml .md` | Recorded, some parsed lightly |
| Data files | `.dat .bin .ebc` | Recorded only, not parsed |

### Content signatures used for extension-less / unexpected files

| Signature (case-insensitive substring in first 8 KB) | Category |
|---|---|
| `IDENTIFICATION DIVISION` | COBOL |
| `//JOB` or `//` at line start followed by `JOB`/`EXEC`/`DD` | JCL |
| `DFHMSD` / `DFHMDI` | BMS |
| `DEFINE CLUSTER` / `IDCAMS` | VSAM / IDCAMS |
| `CSECT` / `DC` / `USING` (HLASM markers) | HLASM |
| `CREATE TABLE` / `SELECT` / `INSERT INTO` | SQL / DDL |
| `DBD` / `PSB` / `SEGMENT` `NAME=` | IMS |

When no signature matches, the file is classified `UNSUPPORTED` with the
reason `unrecognized content` and still recorded in inventory — never ignored.

## Encodings

The importer detects three encoding classes:

- **UTF-8 / ASCII** — decodes cleanly as UTF-8 with no NUL bytes.
- **likely EBCDIC cp037** — fails UTF-8 decode, no NUL bytes, and the EBCDIC
  round-trip produces a high ratio of printable characters. Flagged for
  specialist review; not parsed.
- **binary** — contains NUL bytes or fails both decoders. Recorded only.

## What to do when the folder is available

1. Set `M2O_METADATA_DIR` to the absolute path of the metadata folder.
2. Start the backend (`uvicorn app.main:app`).
3. Create an application (or select an existing one).
4. In the Artifact Explorer, click **Import metadata folder** — this calls
   `POST /api/applications/{id}/artifacts/import-folder`.
5. Review the resulting inventory: counts by category and support level,
   EBCDIC/binary flags, and any `UNSUPPORTED` items that need specialist
   review.

## Missing-information handling

Files that cannot be classified are recorded with `support_level =
UNSUPPORTED` and a recorded reason. They are never silently dropped. This is
consistent with project rule 3: *missing evidence is never evidence of
simplicity*.
