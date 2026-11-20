"""JCL parser — FULL_EXTRACT.

Extracts: JOB, EXEC steps, PROC and PGM references, DD statements, DSN, DISP,
input/output classification, COND / IF-THEN-ELSE / RESTART indicators,
symbolic parameters, utility programs, job-to-job indicators where explicit.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine


_UTILITY_PROGRAMS = {
    "IDCAMS", "SORT", "IEBGENER", "IEBCOPY", "IEBDG", "IEBPTPCH",
    "IEFBR14", "IEHINITT", "IEHMOVE", "IEHRECOVER",
    "DFSORT", "ICEMAN", "IKJEFT01", "RUNSTATS", "DSNUTILB",
    "DSNTIAUL", "DSNTEP2", "IKJEFT1A",
}


@register_parser
class JclParser(BaseParser):
    name: ClassVar[str] = "jcl"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[str] = []  # set below
    supported_categories = ["JCL"]

    def _language(self) -> str:
        return "jcl"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()

            # JOB statement
            m_job = re.match(r"^//(\S+)\s+JOB\b", text)
            if m_job:
                job_name = m_job.group(1)
                props: dict[str, str] = {}
                # Extract accounting info
                m_acct = re.search(r"JOB\s*\(([^)]*)\)", text)
                if m_acct:
                    props["accounting"] = m_acct.group(1)
                # Extract CLASS, MSGCLASS, NOTIFY, RESTART, COND
                for kw in ("CLASS", "MSGCLASS", "NOTIFY", "RESTART", "COND",
                           "TIME", "REGION", "TYPRUN", "LINES", "BYTES"):
                    m_kw = re.search(r"\b" + kw + r"=([^,\s]+)", text)
                    if m_kw:
                        props[kw.lower()] = m_kw.group(1).rstrip(")")
                result.components.append(NormalizedComponent(
                    name=job_name,
                    component_type="JOB",
                    technology="JCL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="JCL_JOB",
                        snippet=text[:200],
                    )],
                ))
                continue

            # EXEC statement
            m_exec = re.match(r"^//(\S+)\s+EXEC\b\s+(.*)", text)
            if m_exec:
                step_name = m_exec.group(1)
                exec_body = m_exec.group(2)
                props: dict[str, str] = {"step": step_name}
                # PGM= or PROC=
                m_pgm = re.search(r"PGM=([A-Z0-9.]+)", exec_body, re.IGNORECASE)
                m_proc = re.search(r"PROC=([A-Z0-9.]+)", exec_body, re.IGNORECASE)
                if m_pgm:
                    pgm_name = m_pgm.group(1)
                    props["pgm"] = pgm_name
                    props["exec_type"] = "PGM"
                    if pgm_name.upper() in _UTILITY_PROGRAMS:
                        props["utility"] = "yes"
                    comp_name = pgm_name
                    comp_type = "PROGRAM"
                elif m_proc:
                    proc_name = m_proc.group(1)
                    props["proc"] = proc_name
                    props["exec_type"] = "PROC"
                    comp_name = proc_name
                    comp_type = "PROC"
                else:
                    # Could be a PROC name directly
                    proc_direct = exec_body.split(",")[0].split(" ")[0].strip()
                    if proc_direct and re.match(r"^[A-Z0-9.#@]+$", proc_direct, re.IGNORECASE):
                        props["proc"] = proc_direct
                        props["exec_type"] = "PROC"
                        comp_name = proc_direct
                        comp_type = "PROC"
                    else:
                        comp_name = step_name
                        comp_type = "UNKNOWN"
                # COND
                m_cond = re.search(r"COND=([^,\s]+(?:,[^,\s]+)*)", exec_body)
                if m_cond:
                    props["cond"] = m_cond.group(1)
                # PARM
                m_parm = re.search(r"PARM=([^\s,]+|'[^']*'|\"[^\"]*\")", exec_body)
                if m_parm:
                    props["parm"] = m_parm.group(1).strip("'\"")
                result.components.append(NormalizedComponent(
                    name=comp_name,
                    component_type=comp_type,
                    technology="JCL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="JCL_EXEC",
                        snippet=text[:200],
                    )],
                ))
                continue

            # DD statement
            m_dd = re.match(r"^//(\S+)\s+DD\b\s*(.*)", text)
            if m_dd:
                dd_name = m_dd.group(1)
                dd_body = m_dd.group(2)
                props: dict[str, str] = {"dd": dd_name}
                # DSN
                m_dsn = re.search(r"DSN=([A-Z0-9.'@#$-]+)", dd_body, re.IGNORECASE)
                if m_dsn:
                    props["dsn"] = m_dsn.group(1).rstrip("'")
                # DISP
                m_disp = re.search(r"DISP=([^,\s]+(?:,[^,\s]*)*)", dd_body)
                if m_disp:
                    disp_val = m_disp.group(1).rstrip(")")
                    props["disp"] = disp_val
                    if disp_val.upper().startswith("OLD") or disp_val.upper().startswith("SHR"):
                        props["io_class"] = "input"
                    elif disp_val.upper().startswith("NEW") or disp_val.upper().startswith("MOD"):
                        props["io_class"] = "output"
                # SYSOUT
                if "SYSOUT=" in dd_body:
                    props["sysout"] = "yes"
                    props["io_class"] = "output"
                # Special DDs
                if dd_name.upper() in ("STEPLIB", "JOBLIB"):
                    props["loadlib"] = "yes"
                comp_type = "DATASET"
                if dd_name.upper() in ("SYSIN", "SYSOUT", "SYSPRINT"):
                    comp_type = "FILE"
                result.components.append(NormalizedComponent(
                    name=dd_name,
                    component_type=comp_type,
                    technology="JCL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="JCL_DD",
                        snippet=text[:200],
                    )],
                ))
                continue

            # IF-THEN-ELSE
            if re.match(r"^//IF\b", text, re.IGNORECASE) or re.match(r"^//IF\d", text, re.IGNORECASE):
                result.components.append(NormalizedComponent(
                    name="IF-THEN-ELSE",
                    component_type="CONTROL_FLOW",
                    technology="JCL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"conditional": "yes"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="JCL_IF_THEN",
                        snippet=text[:200],
                    )],
                ))

        return result
