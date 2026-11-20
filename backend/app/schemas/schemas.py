"""Pydantic schemas for API request/response models."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ---- Application ----

class ApplicationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    business_domain: str | None = None
    owner: str | None = None
    technology_stack: str | None = None
    environment: str | None = None
    assessment_status: str = "Not Started"


class ApplicationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    business_domain: str | None = None
    owner: str | None = None
    technology_stack: str | None = None
    environment: str | None = None
    assessment_status: str | None = None
    is_active: bool | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    business_domain: str | None
    owner: str | None
    technology_stack: str | None
    environment: str | None
    assessment_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    artifact_count: int = 0


# ---- Artifact ----

class ArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    original_filename: str
    relative_path: str
    extension: str | None
    category: str
    size_bytes: int
    upload_timestamp: datetime
    processing_status: str
    sha256: str
    parse_status: str
    support_level: str
    detected_encoding: str
    fixed_record_length_hint: int | None
    error_message: str | None
    detection_reason: str | None


class ArtifactSummary(BaseModel):
    total: int
    by_category: dict[str, int]
    by_support_level: dict[str, int]
    by_encoding: dict[str, int]
    total_size_bytes: int


class ArtifactContentOut(BaseModel):
    id: str
    original_filename: str
    relative_path: str
    category: str
    size_bytes: int
    encoding: str
    content: str | None  # None for binary/EBCDIC
    is_text: bool


class ImportFolderResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class DeleteResult(BaseModel):
    deleted: bool
    id: str


class HealthOut(BaseModel):
    status: str
    version: str
    metadata_dir_configured: bool


# ---- Component ----

class ComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    name: str
    component_type: str
    technology: str
    source_artifact_id: str
    source_filename: str
    line_start: int
    line_end: int
    detected_properties: dict[str, str]
    evidence_class: str
    evidence_refs: list[dict]
    warnings: list[str]
    parser_name: str
    parser_version: str


# ---- Analysis ----

class AnalysisSummaryOut(BaseModel):
    application_id: str
    last_run_id: str | None
    last_run_at: datetime | None
    duration_ms: int | None
    artifacts_processed: int
    components_extracted: int
    warnings_count: int
    by_type: dict[str, int]
    by_technology: dict[str, int]
    by_evidence_class: dict[str, int]
    parser_versions: dict[str, str]
    status: str


class ParserInfo(BaseModel):
    name: str
    version: str
    capability: str
    supported_categories: str


class ParserCoverageEntry(BaseModel):
    artifact_id: str
    filename: str
    category: str
    support_level: str
    parser_name: str | None
    parser_version: str | None
    capability: str | None
    parse_status: str
    components_extracted: int
    warnings: int
    error: str | None


class ParserCoverageReport(BaseModel):
    total_artifacts: int
    by_capability: dict[str, int]
    by_parse_status: dict[str, int]
    by_category: dict[str, int]
    parsers: list[ParserInfo]
    entries: list[ParserCoverageEntry]
    unsupported_artifacts: list[ParserCoverageEntry]


class AnalyzeResponse(BaseModel):
    run_id: str
    application_id: str
    artifacts_processed: int
    components_extracted: int
    warnings_count: int
    duration_ms: int
    status: str

