"""FastAPI application entry point."""

from __future__ import annotations

import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import inspect

from app.core.config import settings, APP_ROOT, BACKEND_DIR
from app.database.database import init_db, engine
from app.assessment.scoring_engine import load_ruleset
from app.assessment.ruleset_validator import validate_ruleset
from app.api import (
    applications,
    artifacts,
    health,
    analysis,
    dependencies,
    assessment,
    findings,
    reports,
    simulation,
    llm,
    evidence_metrics,
    chat,
    dashboard,
)

logger = logging.getLogger("reframex.startup")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(
    title="ReframeX M2O Intelligence",
    version="2.1.0",
    description="Mainframe migration assessment accelerator — artifact ingestion and inventory.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # 1. Database Initialization & Verification
    logger.info("Running database startup checks...")
    try:
        init_db()
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        if not table_names:
            logger.warning("Database startup check: No tables found in database! Ensure migrations or init_db executed.")
        else:
            logger.info("Database initialized successfully at %s. Detected %d tables.", settings.db_path, len(table_names))
    except Exception as exc:
        logger.error("Database connection / initialization error: %s", exc)

    # 2. Strict Ruleset Validation Check
    logger.info("Validating default ruleset (default_ruleset_v2)...")
    try:
        ruleset_dict = load_ruleset()
        validation_errors = validate_ruleset(ruleset_dict)
        if validation_errors:
            error_details = "\n  - " + "\n  - ".join(validation_errors[:10])
            raise RuntimeError(
                f"Startup configuration error: 'default_ruleset_v2' failed validation with {len(validation_errors)} error(s):{error_details}"
            )
        logger.info(
            "Ruleset 'default_ruleset_v2' (v%s) passed startup validation (%d rules).",
            ruleset_dict.get("version"),
            len(ruleset_dict.get("rules", [])),
        )
    except Exception as exc:
        logger.critical("FATAL: Startup configuration check failed: %s", exc)
        raise


app.include_router(health.router)
app.include_router(applications.router)
app.include_router(artifacts.router)
app.include_router(analysis.router)
app.include_router(dependencies.router)
app.include_router(assessment.router)
app.include_router(findings.router)
app.include_router(reports.router)
app.include_router(simulation.router)
app.include_router(llm.router)
app.include_router(evidence_metrics.router)
app.include_router(chat.router)
app.include_router(dashboard.router)

# Mount frontend static distribution if available (e.g., in Docker container or production build)
DIST_DIR = APP_ROOT / "dist"
if not DIST_DIR.exists():
    DIST_DIR = BACKEND_DIR / "static"

if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    logger.info("Mounting frontend distribution from %s", DIST_DIR)
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        # Don't intercept API routes or documentation
        if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc", "health"):
            return None
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")

