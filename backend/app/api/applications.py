"""Application CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationOut, DeleteResult,
)
from app.services import application_service

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db)):
    return application_service.list_applications(db)


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(data: ApplicationCreate, db: Session = Depends(get_db)):
    try:
        return application_service.create_application(db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.put("/{app_id}", response_model=ApplicationOut)
def update_application(app_id: str, data: ApplicationUpdate, db: Session = Depends(get_db)):
    app = application_service.update_application(db, app_id, data)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.delete("/{app_id}", response_model=DeleteResult)
def delete_application(app_id: str, db: Session = Depends(get_db)):
    deleted = application_service.delete_application(db, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Application not found")
    return DeleteResult(deleted=True, id=app_id)
