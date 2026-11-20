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
