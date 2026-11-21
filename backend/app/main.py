"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.database import init_db
from app.api import applications, artifacts, health, analysis, dependencies, assessment, findings, reports


app = FastAPI(
    title="ReframeX M2O Intelligence",
    version="2.0.0",
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
    init_db()


app.include_router(health.router)
app.include_router(applications.router)
app.include_router(artifacts.router)
app.include_router(analysis.router)
app.include_router(dependencies.router)
app.include_router(assessment.router)
app.include_router(findings.router)
app.include_router(reports.router)
