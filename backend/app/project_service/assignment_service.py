from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.employee_service import repository as employee_repository
from app.project_service import repository as project_repository
from app.project_service import assignment_repository
from app.project_service.assignment_models import ProjectAssignment


def create_assignment(
    db: Session,
    project_id: int,
    employee_id: int,
):
    # Check project
    project = project_repository.get_project_by_id(
        db,
        project_id,
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check employee
    employee = employee_repository.get_employee_by_id(
        db,
        employee_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    # Check duplicate assignment
    existing_assignment = assignment_repository.get_assignment(
        db,
        project_id,
        employee_id,
    )

    if existing_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee is already assigned to this project",
        )

    assignment = ProjectAssignment(
        project_id=project_id,
        employee_id=employee_id,
    )

    return assignment_repository.create_assignment(
        db,
        assignment,
    )


def get_project_assignments(
    db: Session,
    project_id: int,
):
    project = project_repository.get_project_by_id(
        db,
        project_id,
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return assignment_repository.get_project_assignments(
        db,
        project_id,
    )


def get_my_assignments(
    db: Session,
    user_id: int,
):
    employee = employee_repository.get_employee_by_user_id(
        db,
        user_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return assignment_repository.get_employee_assignments(
        db,
        employee.id,
    )


def delete_assignment(
    db: Session,
    assignment_id: int,
):
    assignment = assignment_repository.get_assignment_by_id(
        db,
        assignment_id,
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project assignment not found",
        )

    assignment_repository.delete_assignment(
        db,
        assignment,
    )

    return {
        "message": "Employee removed from project successfully"
    }