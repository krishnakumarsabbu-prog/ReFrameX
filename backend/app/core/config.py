"""Application configuration. Reads environment variables; no secrets."""

from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass


BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
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

# LLM Evaluation Layer Configuration (B1)
LLM_ENABLED = os.environ.get("LLM_ENABLED", "false").lower() in ("true", "1", "yes")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai_compatible")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
LLM_ALLOWED_HOSTS = tuple(h.strip() for h in os.environ.get("LLM_ALLOWED_HOSTS", "api.groq.com,localhost,127.0.0.1").split(",") if h.strip())
LLM_SEND_MODE = os.environ.get("LLM_SEND_MODE", "snippets")  # snippets | structure_only | full_artifact
LLM_REDACT = os.environ.get("LLM_REDACT", "true").lower() in ("true", "1", "yes")
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30.0"))
LLM_MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "2"))
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
    llm_enabled: bool = LLM_ENABLED
    llm_provider: str = LLM_PROVIDER
    llm_base_url: str = LLM_BASE_URL
    llm_api_key: str = LLM_API_KEY
    llm_model: str = LLM_MODEL
    llm_allowed_hosts: tuple[str, ...] = LLM_ALLOWED_HOSTS
    llm_send_mode: str = LLM_SEND_MODE
    llm_redact: bool = LLM_REDACT
    llm_timeout_seconds: float = LLM_TIMEOUT_SECONDS
    llm_max_retries: int = LLM_MAX_RETRIES


settings = Settings()
