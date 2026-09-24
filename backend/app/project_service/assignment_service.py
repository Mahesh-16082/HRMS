import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.email_service import service as email_service
from app.employee_service import repository as employee_repository
from app.employee_service.models import EmploymentStatus
from app.notification_service.models import NotificationType
from app.notification_service.service import create_notification
from app.project_service import assignment_repository
from app.project_service import repository as project_repository
from app.project_service import role_repository
from app.project_service.assignment_models import ProjectAssignment

logger = logging.getLogger(__name__)


def create_assignment(
    db: Session,
    project_id: int,
    employee_id: int,
    role_id: int | None = None,
):
    # 1. Check project exists
    project = project_repository.get_project_by_id(
        db,
        project_id,
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # 2. Check employee exists and is active
    employee = employee_repository.get_employee_by_id(
        db,
        employee_id,
    )
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign inactive employee to a project",
        )

    # 3. Check project role
    if role_id is not None:
        role = role_repository.get_role_by_id(db, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project role with ID {role_id} not found",
            )
        if not role.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project role is inactive and cannot be assigned to a new project",
            )
    else:
        # Fallback to default active role for backward compatibility in internal calls
        role = role_repository.get_role_by_code(db, "FULLSTACK_DEV")
        if not role or not role.is_active:
            active_roles = role_repository.get_active_roles(db)
            if not active_roles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active project roles available for assignment",
                )
            role = active_roles[0]

    # 4. Check duplicate assignment
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

    # 5. Create and commit assignment
    assignment = ProjectAssignment(
        project_id=project_id,
        employee_id=employee_id,
        role_id=role.id,
    )

    saved_assignment = assignment_repository.create_assignment(
        db,
        assignment,
    )

    # 6. Send assignment notification email to employee using existing SMTP service
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
                role_name=role.name,
                assigned_date=saved_assignment.assigned_at,
            )
        except Exception as exc:
            logger.error(
                f"Project assignment saved, but failed to send email to {recipient_email}: {exc}",
                exc_info=True,
            )

    # 7. Send in-app notifications to employee
    if employee.user_id:
        create_notification(
            db=db,
            recipient_user_id=employee.user_id,
            notification_type=NotificationType.PROJECT_ASSIGNED,
            title="Assigned to Project",
            message=f"You have been assigned to project '{project.project_name}'.",
            reference_type="project",
            reference_id=str(project.id),
            commit=True,
        )
        create_notification(
            db=db,
            recipient_user_id=employee.user_id,
            notification_type=NotificationType.PROJECT_ROLE_ASSIGNED,
            title="Project Role Assigned",
            message=f"You have been assigned the role '{role.name}' on project '{project.project_name}'.",
            reference_type="project_role",
            reference_id=str(role.id),
            commit=True,
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