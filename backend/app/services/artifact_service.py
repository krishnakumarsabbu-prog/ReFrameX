"""Artifact ingestion service: file storage, hashing, classification, inventory."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Artifact, Application
from app.parsers.classifier import classify
from app.services.security import (
    SecurityError,
    reject_executable,
    safe_relative_path,
    validate_zip,
)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _app_dir(application_id: str) -> Path:
    d = settings.upload_dir / application_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _store_file(application_id: str, relative_path: str, data: bytes) -> tuple[str, str]:
    """Store a file under the application's upload dir. Returns (storage_path, sha256)."""
    app_dir = _app_dir(application_id)
    if relative_path:
        rel_safe = safe_relative_path(relative_path)
        target = app_dir / rel_safe
        target.parent.mkdir(parents=True, exist_ok=True)
    else:
        # Flat: use a unique name to avoid collisions
        target = app_dir / f"{uuid.uuid4().hex[:12]}_{Path(relative_path or 'unnamed').name}"

    rel_from_app = target.relative_to(app_dir)
    # Store with a flat namespaced name to avoid filesystem path issues on the storage side
    # but keep the original relative_path in the DB for display.
    storage_name = f"{uuid.uuid4().hex[:16]}"
    storage_target = app_dir / storage_name
    storage_target.write_bytes(data)
    # Make read-only
    try:
        storage_target.chmod(0o444)
    except OSError:
        pass

    return str(storage_target.relative_to(settings.upload_dir)), _sha256(data)


def _create_artifact_record(
    db: Session,
    application_id: str,
    original_filename: str,
    relative_path: str,
    data: bytes,
    storage_path: str,
    sha256: str,
) -> Artifact:
    classification = classify(original_filename, data)

    artifact = Artifact(
        id=str(uuid.uuid4()),
        application_id=application_id,
        original_filename=original_filename,
        relative_path=relative_path,
        extension=Path(original_filename).suffix.lower() or None,
        category=classification.category,
        size_bytes=len(data),
        sha256=sha256,
        support_level=classification.support_level,
        detected_encoding=classification.encoding,
        fixed_record_length_hint=classification.fixed_record_length_hint,
        parse_status="pending",
        processing_status="stored",
        error_message=None,
        storage_path=storage_path,
        detection_reason=classification.reason,
    )
    db.add(artifact)
    return artifact


def ingest_single_file(
    db: Session,
    application_id: str,
    original_filename: str,
    relative_path: str,
    data: bytes,
) -> Artifact:
    """Ingest a single file: validate, store, classify, record."""
    if len(data) > settings.max_file_size:
        raise SecurityError(
            f"file size {len(data)} exceeds limit {settings.max_file_size}", original_filename
        )
    reject_executable(original_filename, data)

    storage_path, sha = _store_file(application_id, relative_path, data)
    artifact = _create_artifact_record(
        db, application_id, original_filename, relative_path, data, storage_path, sha
    )
    db.commit()
    db.refresh(artifact)
    return artifact


def ingest_uploaded_files(
    db: Session,
    application_id: str,
    files: list[tuple[str, str, bytes]],
) -> list[Artifact]:
    """Ingest multiple files. Each tuple is (original_filename, relative_path, data).

    Raises SecurityError on first violation; prior writes in this batch are still committed
    individually (each file is committed as it goes, so partial success is visible).
    """
    # Validate total size
    total = sum(len(d) for _, _, d in files)
    if total > settings.max_total_upload:
        raise SecurityError(
            f"total upload size {total} exceeds limit {settings.max_total_upload}"
        )

    results: list[Artifact] = []
    errors: list[str] = []
    for original_filename, relative_path, data in files:
        try:
            artifact = ingest_single_file(db, application_id, original_filename, relative_path, data)
            results.append(artifact)
        except SecurityError as e:
            errors.append(f"{original_filename}: {e.reason}")
            # Record the error as a rejected artifact? No — just collect and continue.
    if errors and not results:
        # All failed — raise to inform caller
        raise SecurityError("; ".join(errors))
    return results


def ingest_zip(
    db: Session,
    application_id: str,
    zip_data: bytes,
) -> list[Artifact]:
    """Extract and ingest files from a ZIP archive."""
    import zipfile
    import io

    if len(zip_data) > settings.max_file_size * 5:
        raise SecurityError("ZIP file too large")

    # Write to temp, validate, then extract
    tmp_path = _app_dir(application_id) / f"_tmp_{uuid.uuid4().hex}.zip"
    tmp_path.write_bytes(zip_data)
    try:
        validate_zip(tmp_path)
        results: list[Artifact] = []
        with zipfile.ZipFile(tmp_path, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                rel = safe_relative_path(info.filename)
                data = zf.read(info)
                try:
                    artifact = ingest_single_file(db, application_id, Path(info.filename).name, rel, data)
                    results.append(artifact)
                except SecurityError:
                    pass  # skip rejected files within zip
        return results
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def ingest_folder(
    db: Session,
    application_id: str,
    folder: Path,
) -> tuple[int, int, list[str]]:
    """Walk a folder (read-only) and ingest all files. Returns (imported, skipped, errors)."""
    imported = 0
    skipped = 0
    errors: list[str] = []

    if not folder.exists():
        return 0, 0, [f"folder does not exist: {folder}"]
    if not folder.is_dir():
        return 0, 0, [f"path is not a directory: {folder}"]

    for root, _dirs, filenames in os_walk(folder):
        for fname in filenames:
            fpath = Path(root) / fname
            try:
                if fpath.is_symlink():
                    skipped += 1
                    errors.append(f"skipped symlink: {fpath}")
                    continue
                data = fpath.read_bytes()
                if len(data) > settings.max_file_size:
                    skipped += 1
                    errors.append(f"skipped (too large): {fpath.name}")
                    continue
                reject_executable(fname, data)
                rel = str(fpath.relative_to(folder))
                rel = safe_relative_path(rel)
                storage_path, sha = _store_file(application_id, rel, data)
                _create_artifact_record(
                    db, application_id, fname, rel, data, storage_path, sha
                )
                imported += 1
            except SecurityError as e:
                skipped += 1
                errors.append(f"{fname}: {e.reason}")
            except Exception as e:
                skipped += 1
                errors.append(f"{fname}: {type(e).__name__}: {e}")
    db.commit()
    return imported, skipped, errors


def os_walk(folder: Path):
    """Wrapper so tests can monkeypatch."""
    import os
    yield from os.walk(folder)


def get_artifact_content(db: Session, artifact_id: str) -> tuple[Artifact, bytes] | None:
    """Load artifact and its raw bytes. Returns None if not found."""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        return None
    path = settings.upload_dir / artifact.storage_path
    if not path.exists():
        return None
    return artifact, path.read_bytes()


def delete_artifact(db: Session, artifact_id: str) -> bool:
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        return False
    # Remove file
    path = settings.upload_dir / artifact.storage_path
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(artifact)
    db.commit()
    return True
