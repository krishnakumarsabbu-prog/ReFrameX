"""Application CRUD service."""

from __future__ import annotations

import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.models import Application, Artifact
from app.schemas.schemas import ApplicationCreate, ApplicationUpdate


def list_applications(db: Session) -> list[Application]:
    apps = db.query(Application).order_by(Application.created_at.desc()).all()
    # Compute artifact counts
    for app in apps:
        app.artifact_count = db.query(func.count(Artifact.id)).filter(
            Artifact.application_id == app.id
        ).scalar() or 0
    return apps


def get_application(db: Session, app_id: str) -> Application | None:
    app = db.query(Application).filter(Application.id == app_id).first()
    if app:
        app.artifact_count = db.query(func.count(Artifact.id)).filter(
            Artifact.application_id == app.id
        ).scalar() or 0
    return app


def create_application(db: Session, data: ApplicationCreate) -> Application:
    app = Application(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        business_domain=data.business_domain,
        owner=data.owner,
        technology_stack=data.technology_stack,
        environment=data.environment,
        assessment_status=data.assessment_status,
        is_active=False,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    app.artifact_count = 0
    return app


def update_application(db: Session, app_id: str, data: ApplicationUpdate) -> Application | None:
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        return None
    updates = data.model_dump(exclude_unset=True)
    # If setting is_active=True, deactivate all others (only one active)
    if updates.get("is_active") is True:
        db.query(Application).filter(Application.is_active == True).update({"is_active": False})  # noqa: E712
    for key, val in updates.items():
        setattr(app, key, val)
    db.commit()
    db.refresh(app)
    app.artifact_count = db.query(func.count(Artifact.id)).filter(
        Artifact.application_id == app.id
    ).scalar() or 0
    return app


def delete_application(db: Session, app_id: str) -> bool:
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        return False
    # Delete files on disk
    import shutil
    from app.core.config import settings
    app_dir = settings.upload_dir / app_id
    try:
        if app_dir.exists():
            shutil.rmtree(app_dir)
    except OSError:
        pass
    db.delete(app)
    db.commit()
    return True


def get_active_application(db: Session) -> Application | None:
    return db.query(Application).filter(Application.is_active == True).first()  # noqa: E712
