"""SQLAlchemy engine and session factory."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()


def init_db() -> None:
    """Create all tables. Called at startup."""
    import app.models.models  # noqa: F401 — register models with Base
    Base.metadata.create_all(bind=engine)
    _auto_migrate()


def _auto_migrate() -> None:
    """Add new columns to existing tables for backward compatibility.

    SQLite does not automatically add columns when the model changes.
    We use ALTER TABLE for additive columns only — never destructive.
    """
    import sqlalchemy as sa
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "assessment_records" in insp.get_table_names():
        existing_cols = {c["name"] for c in insp.get_columns("assessment_records")}
        with engine.connect() as conn:
            if "version" not in existing_cols:
                conn.execute(text("ALTER TABLE assessment_records ADD COLUMN version INTEGER DEFAULT 1"))
            if "is_current" not in existing_cols:
                conn.execute(text("ALTER TABLE assessment_records ADD COLUMN is_current BOOLEAN DEFAULT 1"))
            conn.commit()


def get_db():
    """FastAPI dependency: yield a session, close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
