"""Artifact ingestion and inventory routes."""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.database.database import get_db
from app.models.models import Artifact
from app.schemas.schemas import (
    ArtifactOut, ArtifactSummary, ArtifactContentOut,
    ImportFolderResult, DeleteResult,
)
from app.services import application_service, artifact_service
from app.services.security import SecurityError

router = APIRouter(tags=["artifacts"])


async def _read_upload(f: UploadFile) -> bytes:
    data = await f.read()
    return data


@router.get("/api/applications/{app_id}/artifacts", response_model=list[ArtifactOut])
def list_artifacts(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return db.query(Artifact).filter(Artifact.application_id == app_id).order_by(
        Artifact.upload_timestamp.desc()
    ).all()


@router.post("/api/applications/{app_id}/artifacts", response_model=list[ArtifactOut])
async def upload_artifacts(
    app_id: str,
    db: Session = Depends(get_db),
    files: list[UploadFile] = File(...),
):
    """Upload multiple files. Folder uploads use webkitRelativePath in the filename."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    file_data: list[tuple[str, str, bytes]] = []
    all_results: list = []
    for f in files:
        data = await _read_upload(f)
        fname = f.filename or "unnamed"
        rel = ""
        if "/" in fname or "\\" in fname:
            rel = fname
            fname = Path(fname).name

        if fname.lower().endswith(".zip") and data[:2] == b"PK":
            try:
                zip_results = artifact_service.ingest_zip(db, app_id, data)
                all_results.extend(zip_results)
            except SecurityError as e:
                raise HTTPException(status_code=422, detail=e.reason)
        else:
            file_data.append((fname, rel, data))

    if file_data:
        try:
            results = artifact_service.ingest_uploaded_files(db, app_id, file_data)
            all_results.extend(results)
        except SecurityError as e:
            raise HTTPException(status_code=422, detail=e.reason)

    return all_results


@router.post(
    "/api/applications/{app_id}/artifacts/import-folder",
    response_model=ImportFolderResult,
)
def import_folder(app_id: str, db: Session = Depends(get_db)):
    """Import from the allowlisted M2O_METADATA_DIR. Read-only."""
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if not settings.metadata_dir:
        raise HTTPException(
            status_code=400,
            detail="M2O_METADATA_DIR is not configured. Set the environment variable to the metadata folder path.",
        )
    folder = settings.metadata_dir.resolve()
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Metadata directory does not exist or is not a directory: {folder}",
        )
    imported, skipped, errors = artifact_service.ingest_folder(db, app_id, folder)
    return ImportFolderResult(imported=imported, skipped=skipped, errors=errors)


@router.get("/api/applications/{app_id}/artifacts/summary", response_model=ArtifactSummary)
def artifact_summary(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    artifacts = db.query(Artifact).filter(Artifact.application_id == app_id).all()
    by_category: dict[str, int] = {}
    by_support: dict[str, int] = {}
    by_encoding: dict[str, int] = {}
    total_size = 0
    for a in artifacts:
        by_category[a.category] = by_category.get(a.category, 0) + 1
        by_support[a.support_level] = by_support.get(a.support_level, 0) + 1
        by_encoding[a.detected_encoding] = by_encoding.get(a.detected_encoding, 0) + 1
        total_size += a.size_bytes

    return ArtifactSummary(
        total=len(artifacts),
        by_category=by_category,
        by_support_level=by_support,
        by_encoding=by_encoding,
        total_size_bytes=total_size,
    )


@router.get("/api/artifacts/{artifact_id}", response_model=ArtifactOut)
def get_artifact(artifact_id: str, db: Session = Depends(get_db)):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.delete("/api/artifacts/{artifact_id}", response_model=DeleteResult)
def delete_artifact(artifact_id: str, db: Session = Depends(get_db)):
    deleted = artifact_service.delete_artifact(db, artifact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return DeleteResult(deleted=True, id=artifact_id)
