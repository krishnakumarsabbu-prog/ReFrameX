"""Application configuration. Reads environment variables; no secrets."""

from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass


BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/
APP_ROOT = BACKEND_DIR.parent  # project root

UPLOAD_DIR = Path(os.environ.get("REFRAMEX_UPLOAD_DIR", BACKEND_DIR / "uploads"))
DB_PATH = Path(os.environ.get("REFRAMEX_DB_PATH", BACKEND_DIR / "reframex.db"))
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Allowlisted metadata folder (read-only importer). Empty/None = disabled.
METADATA_DIR_RAW = os.environ.get("M2O_METADATA_DIR", "")
METADATA_DIR: Path | None = Path(METADATA_DIR_RAW) if METADATA_DIR_RAW else None

# React dev server origin
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

# Upload limits
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB per file
MAX_TOTAL_UPLOAD = 200 * 1024 * 1024  # 200 MB per upload request
ALLOWED_DIRECT_UPLOAD_TYPES = {
    "application/octet-stream",
    "application/zip",
    "application/x-zip-compressed",
    "text/plain",
    "application/json",
    "application/xml",
    "text/xml",
    "application/csv",
    "text/csv",
    "text/markdown",
    "application/x-yaml",
    "text/yaml",
}

# ZIP safety limits
ZIP_MAX_FILES = 500
ZIP_MAX_TOTAL_UNCOMPRESSED = 300 * 1024 * 1024  # 300 MB
ZIP_MAX_NESTING = 8
ZIP_MAX_RATIO = 100  # compressed:uncompressed

# Executable extensions rejected outright
EXECUTABLE_EXTENSIONS = {
    ".exe", ".dll", ".so", ".bat", ".cmd", ".sh", ".msi", ".jar",
    ".com", ".scr", ".ps1", ".app",
}

# Ensure dirs exist at import time (cheap, idempotent)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class Settings:
    upload_dir: Path = UPLOAD_DIR
    db_path: Path = DB_PATH
    database_url: str = DATABASE_URL
    metadata_dir: Path | None = METADATA_DIR
    cors_origins: tuple[str, ...] = tuple(CORS_ORIGINS)
    max_file_size: int = MAX_FILE_SIZE
    max_total_upload: int = MAX_TOTAL_UPLOAD
    zip_max_files: int = ZIP_MAX_FILES
    zip_max_total_uncompressed: int = ZIP_MAX_TOTAL_UNCOMPRESSED
    zip_max_nesting: int = ZIP_MAX_NESTING
    zip_max_ratio: int = ZIP_MAX_RATIO
    executable_extensions: frozenset[str] = frozenset(EXECUTABLE_EXTENSIONS)


settings = Settings()
