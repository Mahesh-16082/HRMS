import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.email_service import service as email_service
from app.employee_service import repository as employee_repository
from app.project_service import repository as project_repository
from app.project_service import assignment_repository
from app.project_service.assignment_models import ProjectAssignment

logger = logging.getLogger(__name__)


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

    saved_assignment = assignment_repository.create_assignment(
        db,
        assignment,
    )

    # Send assignment notification email to employee using existing SMTP service
    recipient_email = employee.user.email if employee.user else None
    if recipient_email:
        try:
            employee_name = f"{employee.first_name} {employee.last_name}".strip()
            status_val = (
                project.status.value
                if hasattr(project.status, "value")
                else str(project.status)
            )
            email_service.send_project_assignment_email(
                recipient_email=recipient_email,
                employee_name=employee_name,
                project_name=project.project_name,
                project_code=project.project_code,
                description=project.description,
                start_date=project.start_date,
                end_date=project.end_date,
                status=status_val,
            )
        except Exception as exc:
            logger.error(
                f"Project assignment saved, but failed to send email to {recipient_email}: {exc}",
                exc_info=True,
            )

    return saved_assignment



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