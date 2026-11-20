"""Detect-only parsers: HLASM, IMS, Scheduler, Security, Metadata/Config.

These parsers detect artifacts and flag them for specialist review.
They do NOT perform full extraction.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, ParseWarning, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine


@register_parser
class HlasmParser(BaseParser):
    """HLASM assembler — DETECT_ONLY. Identifies CSECT/START, macro usage."""
    name: ClassVar[str] = "hlasm"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["HLASM"]

    def _language(self) -> str:
        return "asm"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="detected",
        )

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()
            # CSECT
            m_csect = re.search(r"([A-Z0-9][A-Z0-9_]*)\s+CSECT", text, re.IGNORECASE)
            if m_csect:
                result.components.append(NormalizedComponent(
                    name=m_csect.group(1),
                    component_type="MODULE",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"asm_type": "CSECT"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="HLASM_CSECT",
                        snippet=text[:200],
                    )],
                ))
            # START
            m_start = re.search(r"([A-Z0-9][A-Z0-9_]*)\s+START", text, re.IGNORECASE)
            if m_start:
                result.components.append(NormalizedComponent(
                    name=m_start.group(1),
                    component_type="MODULE",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"asm_type": "START"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="HLASM_START",
                        snippet=text[:200],
                    )],
                ))
            # Macro usage (common macros)
            for macro in ("CALL", "LINK", "ATTCH", "WTO", "WTOR", "ABEND", "GETMAIN", "FREEMAIN"):
                if re.search(r"\b" + macro + r"\b", text, re.IGNORECASE):
                    result.components.append(NormalizedComponent(
                        name=f"MACRO-{macro}",
                        component_type="MODULE",
                        technology="HLASM",
                        source_artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        detected_properties={"macro": macro},
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line.line_no,
                            line_end=line.line_no,
                            rule="HLASM_MACRO",
                            snippet=text[:200],
                        )],
                    ))
                    break

        if result.components:
            result.warnings.append(ParseWarning(
                line=0, code="HLASM_SPECIALIST",
                message="HLASM assembler detected — requires specialist review",
            ))
        return result


@register_parser
class ImsParser(BaseParser):
    """IMS PSB/DBD — DETECT_ONLY."""
    name: ClassVar[str] = "ims"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["IMS"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="detected",
        )

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()
            # DBD NAME=
            m_dbd = re.search(r"DBD\s+NAME\s*=\s*([A-Z0-9]+)", text, re.IGNORECASE)
            if m_dbd:
                result.components.append(NormalizedComponent(
                    name=m_dbd.group(1),
                    component_type="EXTERNAL_SYSTEM",
                    technology="IMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"ims_type": "DBD"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="IMS_DBD",
                        snippet=text[:200],
                    )],
                ))
            # PSB
            m_psb = re.search(r"PSB\s+NAME\s*=\s*([A-Z0-9]+)", text, re.IGNORECASE)
            if m_psb:
                result.components.append(NormalizedComponent(
                    name=m_psb.group(1),
                    component_type="EXTERNAL_SYSTEM",
                    technology="IMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"ims_type": "PSB"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="IMS_PSB",
                        snippet=text[:200],
                    )],
                ))
            # SEGMENT
            m_seg = re.search(r"SEGMENT\s+NAME\s*=\s*([A-Z0-9]+)", text, re.IGNORECASE)
            if m_seg:
                result.components.append(NormalizedComponent(
                    name=m_seg.group(1),
                    component_type="EXTERNAL_SYSTEM",
                    technology="IMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"ims_type": "SEGMENT"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="IMS_SEGMENT",
                        snippet=text[:200],
                    )],
                ))

        if result.components:
            result.warnings.append(ParseWarning(
                line=0, code="IMS_SPECIALIST",
                message="IMS DBD/PSB detected — requires specialist review",
            ))
        return result


@register_parser
class SchedulerParser(BaseParser):
    """Scheduler (Control-M-style) — DETECT_ONLY."""
    name: ClassVar[str] = "scheduler"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["Scheduler"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="detected",
        )

        full_text = " ".join(l.text.strip() for l in lines if not l.is_comment and not l.is_blank)

        # XML-based: <job> tags
        for m in re.finditer(r"<job\s+[^>]*name\s*=\s*['\"]([^'\"]+)['\"]", full_text, re.IGNORECASE):
            result.components.append(NormalizedComponent(
                name=m.group(1),
                component_type="SCHEDULE",
                technology="Scheduler",
                source_artifact_id=artifact_id,
                line_start=1,
                line_end=lines[-1].line_no if lines else 1,
                detected_properties={"schedule_type": "job"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=1,
                    line_end=lines[-1].line_no if lines else 1,
                    rule="SCHED_JOB",
                    snippet=m.group(0)[:200],
                )],
            ))

        # JSON-based: "jobName" or "name" in job context
        for m in re.finditer(r'"jobName"\s*:\s*"([^"]+)"', full_text):
            result.components.append(NormalizedComponent(
                name=m.group(1),
                component_type="SCHEDULE",
                technology="Scheduler",
                source_artifact_id=artifact_id,
                line_start=1,
                line_end=lines[-1].line_no if lines else 1,
                detected_properties={"schedule_type": "job"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=1,
                    line_end=lines[-1].line_no if lines else 1,
                    rule="SCHED_JOB_JSON",
                    snippet=m.group(0)[:200],
                )],
            ))

        # Predecessor/dependency
        for m in re.finditer(r"(?:predecessor|depends_on|DEPENDENT_ON)\s*[=:]\s*['\"]?([^'\"\s,>]+)", full_text, re.IGNORECASE):
            result.components.append(NormalizedComponent(
                name=m.group(1),
                component_type="SCHEDULE",
                technology="Scheduler",
                source_artifact_id=artifact_id,
                line_start=1,
                line_end=lines[-1].line_no if lines else 1,
                detected_properties={"dependency": m.group(1)},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=1,
                    line_end=lines[-1].line_no if lines else 1,
                    rule="SCHED_DEPENDENCY",
                    snippet=m.group(0)[:200],
                )],
            ))

        return result


@register_parser
class SecurityParser(BaseParser):
    """Security (RACF-style) — DETECT_ONLY."""
    name: ClassVar[str] = "security"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["Security"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="detected",
        )

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()
            # RACF user/profile definitions
            m_user = re.search(r"(?:ADDUSER|ALTERUSER|ADD\s+USER)\s+([A-Z0-9]+)", text, re.IGNORECASE)
            if m_user:
                result.components.append(NormalizedComponent(
                    name=m_user.group(1),
                    component_type="SECURITY_RESOURCE",
                    technology="RACF",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"security_type": "user"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="RACF_USER",
                        snippet=text[:200],
                    )],
                ))
            # Profile definitions
            m_prof = re.search(r"(?:RDEFINE|ADD|ALTER)\s+(DATASET|GENERAL|RESOURCE)\s+([A-Z0-9.**]+)", text, re.IGNORECASE)
            if m_prof:
                result.components.append(NormalizedComponent(
                    name=m_prof.group(2),
                    component_type="SECURITY_RESOURCE",
                    technology="RACF",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"security_type": "profile", "resource_class": m_prof.group(1).upper()},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="RACF_PROFILE",
                        snippet=text[:200],
                    )],
                ))
            # Permit/access
            m_perm = re.search(r"PERMIT\s+(\S+)\s+.*ID\s*\(([^)]+)\)", text, re.IGNORECASE)
            if m_perm:
                result.components.append(NormalizedComponent(
                    name=m_perm.group(1),
                    component_type="SECURITY_RESOURCE",
                    technology="RACF",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"security_type": "permit", "ids": m_perm.group(2)},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="RACF_PERMIT",
                        snippet=text[:200],
                    )],
                ))

        return result


@register_parser
class MetadataParser(BaseParser):
    """Metadata/config — DETECT_ONLY. Extracts key-value info from JSON/YAML/CSV/properties."""
    name: ClassVar[str] = "metadata"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["Config"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="detected",
        )

        full_text = "\n".join(l.text for l in lines if not l.is_comment and not l.is_blank)

        # JSON key-value: "owner": "...", "apiEndpoint": "...", etc.
        interesting_keys = {
            "owner": "owner", "application": "application", "system": "system",
            "apiEndpoint": "API", "endpoint": "API", "url": "API",
            "mqQueue": "MQ", "queue": "MQ", "queueManager": "MQ",
            "database": "DATABASE", "db": "DATABASE", "dataSource": "DATABASE",
            "version": "EXTERNAL_SYSTEM", "externalSystem": "EXTERNAL_SYSTEM",
            "availability": "EXTERNAL_SYSTEM", "recovery": "EXTERNAL_SYSTEM",
            "throughput": "EXTERNAL_SYSTEM", "dr": "EXTERNAL_SYSTEM",
            "dataClassification": "UNKNOWN",
        }
        for key, comp_type in interesting_keys.items():
            pattern = rf'"({key})"\s*:\s*"([^"]*)"'
            for m in re.finditer(pattern, full_text, re.IGNORECASE):
                result.components.append(NormalizedComponent(
                    name=f"{m.group(1)}={m.group(2)}",
                    component_type=comp_type,
                    technology="Config",
                    source_artifact_id=artifact_id,
                    line_start=1,
                    line_end=lines[-1].line_no if lines else 1,
                    detected_properties={"key": m.group(1), "value": m.group(2)},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=1,
                        line_end=lines[-1].line_no if lines else 1,
                        rule="METADATA_KV",
                        snippet=m.group(0)[:200],
                    )],
                ))

        # YAML key: value
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()
            m_yaml = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)$", text)
            if m_yaml:
                key = m_yaml.group(1).lower()
                value = m_yaml.group(2).strip().strip("'\"")
                if key in interesting_keys and value:
                    result.components.append(NormalizedComponent(
                        name=f"{key}={value}",
                        component_type=interesting_keys[key],
                        technology="Config",
                        source_artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        detected_properties={"key": key, "value": value},
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line.line_no,
                            line_end=line.line_no,
                            rule="METADATA_YAML_KV",
                            snippet=text[:200],
                        )],
                    ))

        return result


@register_parser
class UnsupportedParser(BaseParser):
    """Unsupported/opaque artifacts — records and flags, never skips silently."""
    name: ClassVar[str] = "unsupported"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = ["Data", "UNKNOWN"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="unsupported",
        )
        result.components.append(NormalizedComponent(
            name=filename,
            component_type="UNKNOWN",
            technology="Unsupported",
            source_artifact_id=artifact_id,
            line_start=0,
            line_end=0,
            detected_properties={"category": category},
            evidence_class="Unknown",
            evidence_refs=[EvidenceRef(
                artifact_id=artifact_id,
                line_start=0,
                line_end=0,
                rule="UNSUPPORTED_ARTIFACT",
                snippet=f"Artifact {filename} could not be parsed — category: {category}",
            )],
            warnings=["Unsupported artifact type — recorded for confidence reduction"],
        ))
        result.warnings.append(ParseWarning(
            line=0, code="UNSUPPORTED",
            message=f"Artifact {filename} is unsupported ({category}) — flagged for confidence reduction",
        ))
        return result
