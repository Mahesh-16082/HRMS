from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db
from app.project_service import role_service
from app.project_service.role_schemas import (
    ProjectRoleCreate,
    ProjectRoleListResponse,
    ProjectRoleResponse,
    ProjectRoleUpdate,
)

router = APIRouter(
    prefix="/api/project-roles",
    tags=["Project Roles"],
)


def require_hr(current_user):
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can manage project roles",
        )


@router.post(
    "",
    response_model=ProjectRoleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project_role(
    data: ProjectRoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return role_service.create_project_role(db, data)


@router.get(
    "/active",
    response_model=ProjectRoleListResponse,
)
def get_active_project_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Available to authenticated users (both HR and Employee)
    roles = role_service.get_active_project_roles(db)
    return {
        "total": len(roles),
        "roles": roles,
    }


@router.get(
    "",
    response_model=ProjectRoleListResponse,
)
def list_project_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    roles = role_service.get_all_project_roles(db, skip=skip, limit=limit)
    return {
        "total": len(roles),
        "roles": roles,
    }


@router.get(
    "/{role_id}",
    response_model=ProjectRoleResponse,
)
def get_project_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return role_service.get_project_role_by_id(db, role_id)


@router.put(
    "/{role_id}",
    response_model=ProjectRoleResponse,
)
def update_project_role(
    role_id: int,
    data: ProjectRoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return role_service.update_project_role(db, role_id, data)


@router.patch(
    "/{role_id}/activate",
    response_model=ProjectRoleResponse,
)
def activate_project_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return role_service.activate_project_role(db, role_id)


@router.patch(
    "/{role_id}/deactivate",
    response_model=ProjectRoleResponse,
)
def deactivate_project_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return role_service.deactivate_project_role(db, role_id)


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    role_service.delete_project_role(db, role_id)
    return None
