"""Health check route."""

from fastapi import APIRouter
from app.core.config import settings
from app.schemas.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthOut)
def health():
    return HealthOut(
        status="ok",
        version="2.0.0",
        metadata_dir_configured=settings.metadata_dir is not None,
    )
