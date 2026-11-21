"""Refactoring Impact Simulator API routes (Phase 8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Application, Component
from app.schemas.schemas import (
    SimulateRequest,
    SimulateResponseOut,
    SimulationSummaryOut,
    SimulationDetailOut,
)
from app.services import application_service, simulation_service

router = APIRouter(tags=["simulation"])


@router.post("/api/applications/{app_id}/simulate", response_model=SimulateResponseOut)
def run_simulation(app_id: str, body: SimulateRequest, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    component = db.query(Component).filter(Component.id == body.component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    if component.application_id != app_id:
        raise HTTPException(status_code=400, detail="Component does not belong to this application")

    result = simulation_service.run_simulation(
        db, app_id, body.component_id, body.scenario_type, body.input_assumptions
    )
    if result is None:
        raise HTTPException(status_code=400, detail="Invalid scenario type or component")
    return SimulateResponseOut(**result)


@router.get("/api/applications/{app_id}/simulations", response_model=list[SimulationSummaryOut])
def list_simulations(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    sims = simulation_service.get_simulations(db, app_id)
    return [SimulationSummaryOut(**s) for s in sims]


@router.get("/api/applications/{app_id}/simulations/{simulation_id}", response_model=SimulationDetailOut)
def get_simulation(app_id: str, simulation_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    sim = simulation_service.get_simulation(db, simulation_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim["application_id"] != app_id:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return SimulationDetailOut(**sim)


@router.get("/api/applications/{app_id}/components/{component_id}/impact")
def get_component_impact_extended(app_id: str, component_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    if component.application_id != app_id:
        raise HTTPException(status_code=400, detail="Component does not belong to this application")
    impact = simulation_service.get_simulate_impact(db, app_id, component_id)
    if impact is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return impact
