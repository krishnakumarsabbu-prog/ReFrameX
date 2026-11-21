"""Dependency discovery and graph API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Component
from app.schemas.schemas import (
    DependencyOut, GraphOut, GraphNodeOut, GraphEdgeOut,
    ComponentImpactOut, DependencySummaryOut,
)
from app.services import application_service, dependency_service

router = APIRouter(tags=["dependencies"])


@router.post("/api/applications/{app_id}/discover-dependencies")
def discover_dependencies(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    count = dependency_service.discover_dependencies(db, app_id)
    return {"dependencies_discovered": count, "application_id": app_id}


@router.get("/api/applications/{app_id}/dependencies", response_model=list[DependencyOut])
def get_dependencies(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    deps = dependency_service.get_dependencies(db, app_id)
    return [_dep_to_out(d) for d in deps]


@router.get("/api/applications/{app_id}/dependencies/summary", response_model=DependencySummaryOut)
def get_dependency_summary(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    summary = dependency_service.get_dependency_summary(db, app_id)
    return DependencySummaryOut(**summary)


@router.get("/api/applications/{app_id}/graph", response_model=GraphOut)
def get_graph(app_id: str, db: Session = Depends(get_db)):
    app = application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    graph = dependency_service.get_graph_data(db, app_id)
    return GraphOut(
        application_id=graph["application_id"],
        nodes=[GraphNodeOut(**n) for n in graph["nodes"]],
        edges=[GraphEdgeOut(**e) for e in graph["edges"]],
        truncated=graph["truncated"],
        total_nodes=graph["total_nodes"],
        total_edges=graph["total_edges"],
    )


@router.get("/api/components/{component_id}/dependencies", response_model=list[DependencyOut])
def get_component_dependencies(component_id: str, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    from app.services.dependency_service import get_component_dependencies as _get
    result = _get(db, component_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Component not found")
    deps_out = []
    for d in result["incoming"] + result["outgoing"]:
        deps_out.append(_dep_to_out(d))
    return deps_out


@router.get("/api/components/{component_id}/impact", response_model=ComponentImpactOut)
def get_component_impact(component_id: str, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    impact = dependency_service.get_component_impact(db, component_id)
    if impact is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return ComponentImpactOut(
        component_id=impact["component_id"],
        component_name=impact["component_name"],
        component_type=impact["component_type"],
        direct_dependencies=impact["direct_dependencies"],
        upstream_count=impact["upstream_count"],
        downstream_count=impact["downstream_count"],
        indirect_upstream=impact["indirect_upstream"],
        indirect_downstream=impact["indirect_downstream"],
        shared_components=impact["shared_components"],
        dependency_depth=impact["dependency_depth"],
        circular=impact["circular"],
        circular_paths=impact["circular_paths"],
        single_point_of_dependency=impact["single_point_of_dependency"],
        incoming=[DependencyOut(**d) for d in impact["incoming"]],
        outgoing=[DependencyOut(**d) for d in impact["outgoing"]],
        connected_components=impact["connected_components"],
        associated_artifacts=impact["associated_artifacts"],
        risk_indicators=impact["risk_indicators"],
    )


def _dep_to_out(d) -> DependencyOut:
    import json
    ev = json.loads(d.evidence_ref) if d.evidence_ref else {}
    return DependencyOut(
        id=d.id,
        application_id=d.application_id,
        source_component_id=d.source_component_id,
        target_component_id=d.target_component_id,
        relationship_type=d.relationship_type,
        detection_method=d.detection_method,
        evidence_class=d.evidence_class,
        source_artifact_id=d.source_artifact_id,
        source_line_number=d.source_line_number,
        evidence_ref=ev,
        description=d.description,
    )
