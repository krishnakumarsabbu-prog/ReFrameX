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


# ---- Dependency ----

class DependencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    application_id: str
    source_component_id: str
    target_component_id: str
    relationship_type: str
    detection_method: str
    evidence_class: str
    source_artifact_id: str
    source_line_number: int
    evidence_ref: dict
    description: str | None


class GraphNodeOut(BaseModel):
    id: str
    name: str
    component_type: str
    technology: str
    evidence_class: str
    source_filename: str
    source_artifact_id: str
    line_start: int
    line_end: int


class GraphEdgeOut(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    evidence_class: str
    detection_method: str
    source_line_number: int
    description: str | None


class GraphOut(BaseModel):
    application_id: str
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]
    truncated: bool
    total_nodes: int
    total_edges: int


class ComponentImpactOut(BaseModel):
    component_id: str
    component_name: str
    component_type: str
    direct_dependencies: int
    upstream_count: int
    downstream_count: int
    indirect_upstream: int
    indirect_downstream: int
    shared_components: int
    dependency_depth: int
    circular: bool
    circular_paths: list[list[str]]
    single_point_of_dependency: bool
    incoming: list[DependencyOut]
    outgoing: list[DependencyOut]
    connected_components: list[dict]
    associated_artifacts: list[str]
    risk_indicators: list[str]


class DependencySummaryOut(BaseModel):
    application_id: str
    total_dependencies: int
    by_relationship_type: dict[str, int]
    by_evidence_class: dict[str, int]
    unresolved_targets: int
    circular_dependencies: int
    single_points: int


# ---- Assessment (Phase 5) ----

class RuleFiringOut(BaseModel):
    rule_id: str
    domain: str
    measure: str
    description: str
    weight: float
    impact: str
    severity: str
    explanation: str
    recommendation: str | None
    upgrade_guidance: str | None
    evidence_refs: list[dict]
    points: float


class DomainScoreOut(BaseModel):
    score: float | None
    classification: str
    has_evidence: bool
    fired_rule_count: int
    positive_factors: list[str]
    negative_factors: list[str]
    not_evidenced_notes: list[str]


class AssessmentOut(BaseModel):
    application_id: str
    model_version: str
    ruleset_id: str
    ruleset_version: str
    computed_at: str
    complexity_score: float
    complexity_classification: str
    confidence_score: float
    confidence_classification: str
    readiness_score: float
    readiness_classification: str
    domain_scores: dict[str, dict[str, DomainScoreOut]]
    fired_rules: list[RuleFiringOut]
    positive_factors: list[str]
    negative_factors: list[str]
    missing_information: list[str]
    assessment_limitations: list[str]
    recommended_next_steps: list[str]
    evidence_refs: list[dict]
    duration_ms: int


class DomainBreakdownOut(BaseModel):
    label: str
    scores: dict[str, dict]


class RuleInfoOut(BaseModel):
    rule_id: str
    domain: str
    measure: str
    description: str
    detection_condition: str
    weight: float
    impact: str
    severity: str
    evidence_requirement: str
    explanation: str
    recommendation: str | None
    upgrade_guidance: str | None


class RulesetInfoOut(BaseModel):
    ruleset_id: str
    version: str
    effective_date: str
    owner: str
    changelog: list[dict]
    domain_weights: dict[str, float]
    thresholds: dict[str, dict[str, int]]
    model_version: str
    rule_count: int


class RulesOut(BaseModel):
    ruleset_info: RulesetInfoOut
    rules: list[RuleInfoOut]


class WhatIfRequest(BaseModel):
    weight_overrides: dict[str, float] = Field(default_factory=dict)
    human_reviewed: bool = False


class WhatIfResponse(BaseModel):
    before: dict
    after: dict
    weight_overrides: dict[str, float]
    human_reviewed: bool


class ComponentAssessmentOut(BaseModel):
    component_id: str
    component_name: str
    component_type: str
    technology: str
    complexity_score: float
    complexity_classification: str
    raw_score: float
    fired_rules: list[dict]
    evidence_refs: list[dict]
    model_version: str
    ruleset_version: str

