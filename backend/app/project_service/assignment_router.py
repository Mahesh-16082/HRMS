from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db
from app.project_service import assignment_service
from app.project_service.assignment_schemas import (
    ProjectAssignmentCreate,
    ProjectAssignmentListResponse,
    ProjectAssignmentResponse,
)


router = APIRouter(
    prefix="/api/project-assignments",
    tags=["Project Assignments"],
)


def require_hr(current_user):
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can manage project assignments",
        )


# =========================
# HR ENDPOINTS
# =========================

@router.post(
    "",
    response_model=ProjectAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_employee(
    data: ProjectAssignmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return assignment_service.create_assignment(
        db=db,
        project_id=data.project_id,
        employee_id=data.employee_id,
    )


@router.get(
    "/project/{project_id}",
    response_model=ProjectAssignmentListResponse,
)
def get_project_assignments(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    assignments = assignment_service.get_project_assignments(
        db=db,
        project_id=project_id,
    )

    return {
        "total": len(assignments),
        "assignments": assignments,
    }


@router.delete(
    "/{assignment_id}",
)
def remove_employee_from_project(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)

    return assignment_service.delete_assignment(
        db=db,
        assignment_id=assignment_id,
    )


# =========================
# EMPLOYEE ENDPOINT
# =========================

@router.get(
    "/me",
    response_model=ProjectAssignmentListResponse,
)
@router.get(
    "/me",
    response_model=ProjectAssignmentListResponse,
)
def get_my_project_assignments(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    assignments = assignment_service.get_my_assignments(
        db=db,
        user_id=current_user.id,
    )

    return {
        "total": len(assignments),
        "assignments": assignments,
    }