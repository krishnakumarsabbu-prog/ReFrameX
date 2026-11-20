"""Tests for classifier, security, and ingestion flows."""

import sys
import os
import tempfile
import zipfile
import io
from pathlib import Path

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="function")
def client(tmp_path, monkeypatch):
    """Create a test client with isolated DB and upload dir."""
    db_path = tmp_path / "test.db"
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()

    monkeypatch.setattr("app.core.config.settings.upload_dir", upload_dir)
    monkeypatch.setattr("app.core.config.settings.db_path", db_path)
    monkeypatch.setattr("app.core.config.settings.database_url", f"sqlite:///{db_path}")

    # Re-create engine and tables with new path
    from sqlalchemy import create_engine as _ce
    from app.database import database as dbmod
    import app.models.models  # noqa
    new_engine = _ce(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(dbmod, "engine", new_engine)
    monkeypatch.setattr(dbmod, "SessionLocal", __import__("sqlalchemy").orm.sessionmaker(bind=new_engine, autoflush=False, autocommit=False))
    dbmod.Base.metadata.create_all(bind=new_engine)

    # Also patch get_db to use the new SessionLocal
    from app.main import app
    from app.database.database import get_db

    def override_get_db():
        db = dbmod.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    from app.main import app
    with TestClient(app) as c:
        yield c

    dbmod.Base.metadata.drop_all(bind=new_engine)


# ---- Classifier tests ----

def test_classify_cobol():
    from app.parsers.classifier import classify
    data = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. TEST.\n"
    c = classify("test.cbl", data)
    assert c.category == "COBOL"
    assert c.support_level == "SUPPORTED_PARSE"
    assert c.encoding == "ASCII"


def test_classify_jcl_by_extension():
    from app.parsers.classifier import classify
    data = b"//JOB JOB CLASS=A\n"
    c = classify("job.jcl", data)
    assert c.category == "JCL"


def test_classify_content_sniff_no_extension():
    from app.parsers.classifier import classify
    data = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. SNIFF.\n"
    c = classify("README", data)  # no extension, should sniff COBOL
    assert c.category == "COBOL"
    assert "content signature" in c.reason


def test_classify_unknown_binary():
    from app.parsers.classifier import classify
    data = b"\x00\x01\x02\x03\xff\xfe"
    c = classify("mystery.dat", data)
    assert c.category == "Data"
    assert c.encoding == "binary"


def test_classify_ebcdic_flag():
    from app.parsers.classifier import classify
    # EBCDIC-encoded "IDENTIFICATION DIVISION" in cp037
    text = "IDENTIFICATION DIVISION"
    data = text.encode("cp037")
    c = classify("prog.cbl", data)
    assert "EBCDIC" in c.encoding


# ---- Security tests ----

def test_reject_executable_extension():
    from app.services.security import reject_executable, SecurityError
    with pytest.raises(SecurityError):
        reject_executable("malware.exe", b"MZ\x90\x00")


def test_reject_executable_magic_bytes():
    from app.services.security import reject_executable, SecurityError
    with pytest.raises(SecurityError):
        reject_executable("mystery.bin", b"\x4d\x5a\x90\x00\x03\x00")


def test_safe_relative_path_traversal():
    from app.services.security import safe_relative_path, SecurityError
    with pytest.raises(SecurityError):
        safe_relative_path("../../../etc/passwd")
    with pytest.raises(SecurityError):
        safe_relative_path("/etc/passwd")


def test_safe_relative_path_normal():
    from app.services.security import safe_relative_path
    assert safe_relative_path("src/prog.cbl") == "src/prog.cbl"
    assert safe_relative_path("./prog.cbl") == "prog.cbl"


def test_zip_bomb_ratio():
    from app.services.security import validate_zip, SecurityError
    import tempfile
    # Create a zip with a highly compressible entry
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("big.txt", b"A" * 200_000)
    # Ratio is 200000 / small_compressed — should be > 100
    with pytest.raises(SecurityError):
        validate_zip(tmp_path)
    tmp_path.unlink(missing_ok=True)


def test_zip_traversal_entry():
    from app.services.security import validate_zip, SecurityError
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    with zipfile.ZipFile(tmp_path, "w") as zf:
        zf.writestr("../../../etc/evil.txt", b"bad")
    with pytest.raises(SecurityError):
        validate_zip(tmp_path)
    tmp_path.unlink(missing_ok=True)


# ---- API integration tests ----

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_application_crud(client):
    # Create
    r = client.post("/api/applications", json={"name": "CLAIMS-MGR", "owner": "Team A"})
    assert r.status_code == 201
    app_id = r.json()["id"]
    assert r.json()["name"] == "CLAIMS-MGR"

    # List
    r = client.get("/api/applications")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Get
    r = client.get(f"/api/applications/{app_id}")
    assert r.status_code == 200
    assert r.json()["id"] == app_id

    # Update
    r = client.put(f"/api/applications/{app_id}", json={"description": "Claims management system"})
    assert r.status_code == 200
    assert r.json()["description"] == "Claims management system"

    # Set active
    r = client.put(f"/api/applications/{app_id}", json={"is_active": True})
    assert r.status_code == 200
    assert r.json()["is_active"] is True

    # Delete
    r = client.delete(f"/api/applications/{app_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # Confirm gone
    r = client.get(f"/api/applications/{app_id}")
    assert r.status_code == 404


def test_artifact_upload_and_summary(client):
    # Create app
    r = client.post("/api/applications", json={"name": "TEST-APP"})
    app_id = r.json()["id"]

    # Upload a COBOL file
    cobol = b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. TESTPGM.\n"
    r = client.post(
        f"/api/applications/{app_id}/artifacts",
        files={"files": ("test.cbl", cobol, "application/octet-stream")},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
    art = r.json()[0]
    assert art["category"] == "COBOL"
    assert art["support_level"] == "SUPPORTED_PARSE"
    artifact_id = art["id"]

    # Summary
    r = client.get(f"/api/applications/{app_id}/artifacts/summary")
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["by_category"]["COBOL"] == 1

    # Get content
    r = client.get(f"/api/artifacts/{artifact_id}/content")
    assert r.status_code == 200
    assert r.json()["is_text"] is True
    assert "IDENTIFICATION" in r.json()["content"]

    # Delete
    r = client.delete(f"/api/artifacts/{artifact_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True


def test_executable_rejected(client):
    r = client.post("/api/applications", json={"name": "SEC-TEST"})
    app_id = r.json()["id"]

    r = client.post(
        f"/api/applications/{app_id}/artifacts",
        files={"files": ("evil.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")},
    )
    # Should reject — either 422 or empty result
    assert r.status_code in (422, 200)
    if r.status_code == 200:
        assert len(r.json()) == 0


def test_zip_upload(client):
    r = client.post("/api/applications", json={"name": "ZIP-TEST"})
    app_id = r.json()["id"]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("src/prog.cbl", b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. Z.\n")
        zf.writestr("README.txt", b"sample\n")
    zip_bytes = buf.getvalue()

    # Upload as a .zip file — the endpoint treats .zip as regular files,
    # so we need to handle zip extraction. Let's test the zip path directly.
    from app.services.artifact_service import ingest_zip
    from app.database.database import SessionLocal
    db = SessionLocal()
    try:
        results = ingest_zip(db, app_id, zip_bytes)
        assert len(results) == 2
        categories = {r.category for r in results}
        assert "COBOL" in categories
    finally:
        db.close()


def test_folder_import(client, tmp_path, monkeypatch):
    r = client.post("/api/applications", json={"name": "FOLDER-TEST"})
    app_id = r.json()["id"]

    # Create a fake metadata folder
    meta = tmp_path / "metadata"
    meta.mkdir()
    (meta / "prog.cbl").write_bytes(b"       IDENTIFICATION DIVISION.\n       PROGRAM-ID. F.\n")
    (meta / "sub").mkdir()
    (meta / "sub" / "job.jcl").write_bytes(b"//JOB JOB CLASS=A\n")

    monkeypatch.setattr("app.core.config.settings.metadata_dir", meta)

    r = client.post(f"/api/applications/{app_id}/artifacts/import-folder")
    assert r.status_code == 200
    assert r.json()["imported"] == 2
    assert r.json()["skipped"] == 0
