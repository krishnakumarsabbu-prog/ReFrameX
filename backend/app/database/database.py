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


def get_db():
    """FastAPI dependency: yield a session, close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
