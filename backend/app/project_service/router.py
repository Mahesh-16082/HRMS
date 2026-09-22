from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db
from app.employee_service import repository as employee_repository
from app.project_service import assignment_repository
from app.project_service import service
from app.project_service.models import ProjectStatus
from app.project_service.schemas import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectStatusUpdate,
    ProjectUpdate,
)


router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"],
)


def require_hr(current_user):
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can perform this action",
        )


# =========================
# HR ENDPOINTS
# =========================

@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return service.create_project(
        db=db,
        user_id=current_user.id,
        project_name=data.project_name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
    )


@router.get(
    "",
    response_model=ProjectListResponse,
)
def get_projects(
    project_status: ProjectStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    projects = service.get_projects(
        db=db,
        project_status=project_status,
    )

    return {
        "total": len(projects),
        "projects": projects,
    }


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == "hr":
        return service.get_project(
            db=db,
            project_id=project_id,
        )

    # For employee users, verify assignment
    employee = employee_repository.get_employee_by_user_id(
        db,
        current_user.id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    assignment = assignment_repository.get_assignment(
        db,
        project_id,
        employee.id,
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this project",
        )

    return service.get_project(
        db=db,
        project_id=project_id,
    )



@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return service.update_project(
        db=db,
        project_id=project_id,
        project_name=data.project_name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
    )


@router.patch(
    "/{project_id}/status",
    response_model=ProjectResponse,
)
def update_project_status(
    project_id: int,
    data: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return service.update_project_status(
        db=db,
        project_id=project_id,
        project_status=data.status,
    )


@router.delete(
    "/{project_id}",
)
def archive_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return service.archive_project(
        db=db,
        project_id=project_id,
    )


@router.get(
    "/dashboard/count",
)
def get_project_count(
    project_status: ProjectStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    count = service.get_project_count(
        db=db,
        project_status=project_status,
    )

    return {
        "count": count,
    }