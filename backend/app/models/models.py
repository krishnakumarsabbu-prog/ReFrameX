"""SQLAlchemy ORM models for applications and artifacts."""

from __future__ import annotations

from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import relationship

from app.database.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Application(Base):
    __tablename__ = "applications"

    id = sa.Column(sa.String(36), primary_key=True)
    name = sa.Column(sa.String(255), nullable=False, unique=True)
    description = sa.Column(sa.Text, nullable=True)
    business_domain = sa.Column(sa.String(255), nullable=True)
    owner = sa.Column(sa.String(255), nullable=True)
    technology_stack = sa.Column(sa.String(255), nullable=True)
    environment = sa.Column(sa.String(100), nullable=True)
    assessment_status = sa.Column(sa.String(50), nullable=False, default="Not Started")
    is_active = sa.Column(sa.Boolean, nullable=False, default=False)
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    artifacts = relationship("Artifact", back_populates="application", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id = sa.Column(sa.String(36), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = sa.Column(sa.String(512), nullable=False)
    relative_path = sa.Column(sa.String(1024), nullable=False, default="")
    extension = sa.Column(sa.String(20), nullable=True)
    category = sa.Column(sa.String(50), nullable=False, default="UNKNOWN")
    size_bytes = sa.Column(sa.Integer, nullable=False, default=0)
    upload_timestamp = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)
    processing_status = sa.Column(sa.String(50), nullable=False, default="stored")
    sha256 = sa.Column(sa.String(64), nullable=False)
    parse_status = sa.Column(sa.String(50), nullable=False, default="pending")
    support_level = sa.Column(sa.String(50), nullable=False, default="UNSUPPORTED")
    detected_encoding = sa.Column(sa.String(50), nullable=False, default="unknown")
    fixed_record_length_hint = sa.Column(sa.Integer, nullable=True)
    error_message = sa.Column(sa.Text, nullable=True)
    storage_path = sa.Column(sa.String(1024), nullable=False)
    detection_reason = sa.Column(sa.Text, nullable=True)

    application = relationship("Application", back_populates="artifacts")


class Component(Base):
    """A normalized component extracted from an artifact by a parser."""
    __tablename__ = "components"

    id = sa.Column(sa.String(16), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    name = sa.Column(sa.String(512), nullable=False)
    component_type = sa.Column(sa.String(50), nullable=False)
    technology = sa.Column(sa.String(100), nullable=False, default="")
    source_artifact_id = sa.Column(sa.String(36), sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False, index=True)
    source_filename = sa.Column(sa.String(512), nullable=False, default="")
    line_start = sa.Column(sa.Integer, nullable=False, default=0)
    line_end = sa.Column(sa.Integer, nullable=False, default=0)
    detected_properties = sa.Column(sa.Text, nullable=False, default="{}")
    evidence_class = sa.Column(sa.String(50), nullable=False, default="Evidence-based")
    evidence_refs = sa.Column(sa.Text, nullable=False, default="[]")
    warnings = sa.Column(sa.Text, nullable=False, default="[]")
    parser_name = sa.Column(sa.String(100), nullable=False, default="")
    parser_version = sa.Column(sa.String(50), nullable=False, default="")
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)

    application = relationship("Application")
    source_artifact = relationship("Artifact", backref="components")


class Dependency(Base):
    """A discovered relationship between two components within an application."""
    __tablename__ = "dependencies"

    id = sa.Column(sa.String(16), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    source_component_id = sa.Column(sa.String(16), sa.ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True)
    target_component_id = sa.Column(sa.String(16), sa.ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = sa.Column(sa.String(100), nullable=False)
    detection_method = sa.Column(sa.String(100), nullable=False, default="static_extraction")
    evidence_class = sa.Column(sa.String(50), nullable=False, default="Evidence-based")
    source_artifact_id = sa.Column(sa.String(36), sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False, index=True)
    source_line_number = sa.Column(sa.Integer, nullable=False, default=0)
    evidence_ref = sa.Column(sa.Text, nullable=False, default="{}")
    description = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)

    source_component = relationship("Component", foreign_keys=[source_component_id])
    target_component = relationship("Component", foreign_keys=[target_component_id])
    source_artifact = relationship("Artifact")


class AnalysisRun(Base):
    """A single analysis run for an application."""
    __tablename__ = "analysis_runs"

    id = sa.Column(sa.String(36), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)
    completed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    duration_ms = sa.Column(sa.Integer, nullable=True)
    artifacts_processed = sa.Column(sa.Integer, nullable=False, default=0)
    components_extracted = sa.Column(sa.Integer, nullable=False, default=0)
    warnings_count = sa.Column(sa.Integer, nullable=False, default=0)
    parser_versions = sa.Column(sa.Text, nullable=False, default="{}")
    status = sa.Column(sa.String(50), nullable=False, default="running")
    summary = sa.Column(sa.Text, nullable=True)

    application = relationship("Application")


class AssessmentRecord(Base):
    """A persisted assessment result for an application.

    Stores the full serialized assessment JSON so it can be retrieved without
    recomputation. Assessment history is preserved — each new assessment is a
    new row with an incrementing version number, enabling before/after
    comparison for the evidence-improvement workflow.
    """
    __tablename__ = "assessment_records"

    id = sa.Column(sa.String(36), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    version = sa.Column(sa.Integer, nullable=False, default=1)
    model_version = sa.Column(sa.String(50), nullable=False)
    ruleset_id = sa.Column(sa.String(100), nullable=False)
    ruleset_version = sa.Column(sa.String(50), nullable=False)
    complexity_score = sa.Column(sa.Float, nullable=False, default=0.0)
    complexity_classification = sa.Column(sa.String(50), nullable=False, default="Low")
    confidence_score = sa.Column(sa.Float, nullable=False, default=0.0)
    confidence_classification = sa.Column(sa.String(50), nullable=False, default="Low")
    readiness_score = sa.Column(sa.Float, nullable=False, default=0.0)
    readiness_classification = sa.Column(sa.String(50), nullable=False, default="Not Ready")
    computed_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)
    duration_ms = sa.Column(sa.Integer, nullable=False, default=0)
    result_json = sa.Column(sa.Text, nullable=False, default="{}")
    human_reviewed = sa.Column(sa.Boolean, nullable=False, default=False)
    is_current = sa.Column(sa.Boolean, nullable=False, default=True, index=True)

    application = relationship("Application")


class Finding(Base):
    """A material conclusion derived from assessment evidence.

    Findings are machine-generated and immutable. Reviewer changes are stored
    separately in ReviewAction rows. Findings are rebuilt on each assessment run;
    their deterministic IDs stay stable across reassessment for the same evidence.
    """
    __tablename__ = "findings"

    id = sa.Column(sa.String(80), primary_key=True)
    application_id = sa.Column(sa.String(36), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    title = sa.Column(sa.String(512), nullable=False)
    domain = sa.Column(sa.String(100), nullable=False, default="")
    severity = sa.Column(sa.String(50), nullable=False, default="info")
    evidence_class = sa.Column(sa.String(50), nullable=False, default="Evidence-based")
    source_artifact_id = sa.Column(sa.String(36), sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=True)
    source_filename = sa.Column(sa.String(512), nullable=False, default="")
    line_start = sa.Column(sa.Integer, nullable=False, default=0)
    line_end = sa.Column(sa.Integer, nullable=False, default=0)
    has_line_ref = sa.Column(sa.Boolean, nullable=False, default=False)
    detection_rule = sa.Column(sa.String(100), nullable=False, default="")
    explanation = sa.Column(sa.Text, nullable=False, default="")
    confidence = sa.Column(sa.Float, nullable=False, default=0.0)
    assessment_impact = sa.Column(sa.String(50), nullable=False, default="neutral")
    recommended_action = sa.Column(sa.Text, nullable=True)
    review_status = sa.Column(sa.String(50), nullable=False, default="open")
    finding_type = sa.Column(sa.String(50), nullable=False, default="rule_firing")
    component_id = sa.Column(sa.String(16), nullable=True)
    extra_json = sa.Column(sa.Text, nullable=False, default="{}")
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)

    application = relationship("Application")
    source_artifact = relationship("Artifact", foreign_keys=[source_artifact_id])
    review_actions = relationship("ReviewAction", back_populates="finding", cascade="all, delete-orphan", order_by="ReviewAction.created_at")


class ReviewAction(Base):
    """A reviewer action on a finding. Stored separately from machine findings.

    Machine findings are immutable; reviewer changes are appended here with
    timestamp and reviewer name. The latest review action determines the
    current reviewer-adjusted status.
    """
    __tablename__ = "review_actions"

    id = sa.Column(sa.String(36), primary_key=True)
    finding_id = sa.Column(sa.String(80), sa.ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True)
    action = sa.Column(sa.String(50), nullable=False)
    reviewer_name = sa.Column(sa.String(255), nullable=False, default="anonymous")
    reviewer_role = sa.Column(sa.String(50), nullable=False, default="Viewer")
    reason = sa.Column(sa.Text, nullable=True)
    notes = sa.Column(sa.Text, nullable=True)
    context = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False, default=_utcnow)

    finding = relationship("Finding", back_populates="review_actions")
