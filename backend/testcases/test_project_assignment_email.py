from datetime import date
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.authentication_service.models import User
from app.core.database import SessionLocal
from app.employee_service.models import Employee, EmploymentStatus
from app.employee_service import repository as employee_repository
from app.email_service import service as email_service
from app.notification_service.models import Notification, NotificationType
from app.notification_service.service import create_notification
from app.project_service import assignment_repository, assignment_service
from app.project_service import repository as project_repository
from app.project_service import role_repository
from app.project_service.models import Project, ProjectStatus
from app.project_service.role_models import ProjectRole


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module")
def setup_assignment_env(db_session: Session):
    # 1. HR User (Actor)
    hr_user = db_session.query(User).filter(User.email == "test_assign_hr@hrms.com").first()
    if not hr_user:
        hr_user = User(
            email="test_assign_hr@hrms.com",
            full_name="HR Administrator",
            role="hr",
            is_active=True,
            is_verified=True,
        )
        db_session.add(hr_user)
        db_session.commit()
        db_session.refresh(hr_user)

    # 2. Employee User & Profile (Recipient)
    emp_user = db_session.query(User).filter(User.email == "arjun_test_recipient@hrms.com").first()
    if not emp_user:
        emp_user = User(
            email="arjun_test_recipient@hrms.com",
            full_name="Arjun Seereddy",
            role="employee",
            is_active=True,
            is_verified=True,
        )
        db_session.add(emp_user)
        db_session.commit()
        db_session.refresh(emp_user)

    employee = db_session.query(Employee).filter(Employee.user_id == emp_user.id).first()
    if not employee:
        employee = Employee(
            user_id=emp_user.id,
            employee_code="EMP_TEST_ARJUN",
            first_name="Arjun",
            last_name="Seereddy",
            phone="+91 9999988888",
            employment_status=EmploymentStatus.ACTIVE,
        )
        db_session.add(employee)
        db_session.commit()
        db_session.refresh(employee)

    # 3. Project
    project = db_session.query(Project).filter(Project.project_code == "PRJ-ASSIGN-TEST").first()
    if not project:
        project = Project(
            project_name="HRMS Portal Alpha",
            project_code="PRJ-ASSIGN-TEST",
            description="Alpha project for testing assignment routing",
            start_date=date(2026, 1, 1),
            status=ProjectStatus.ACTIVE,
            created_by=hr_user.id,
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

    # 4. Project Role
    role = db_session.query(ProjectRole).filter(ProjectRole.code == "LEAD_DEV_TEST").first()
    if not role:
        role = ProjectRole(
            name="Lead Full Stack Developer",
            code="LEAD_DEV_TEST",
            description="Technical lead role",
            is_active=True,
        )
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

    return {
        "hr_user": hr_user,
        "emp_user": emp_user,
        "employee": employee,
        "project": project,
        "role": role,
    }


def test_01_project_assignment_email_and_notification_routing(setup_assignment_env, db_session: Session):
    """
    When HR assigns an employee to a project:
    - Employee receives exactly ONE email (recipient_email == employee.email, NEVER HR).
    - Employee receives exactly ONE PROJECT_ASSIGNED notification.
    - HR receives ZERO emails and ZERO notifications.
    - Title is 'New Project Assignment' and message contains project and role dynamically.
    """
    hr_user = setup_assignment_env["hr_user"]
    emp_user = setup_assignment_env["emp_user"]
    employee = setup_assignment_env["employee"]
    project = setup_assignment_env["project"]
    role = setup_assignment_env["role"]

    # Clean existing assignment & notifications
    existing = assignment_repository.get_assignment(db_session, project.id, employee.id)
    if existing:
        assignment_repository.delete_assignment(db_session, existing)

    db_session.query(Notification).filter(
        Notification.reference_type == "project",
        Notification.reference_id == str(project.id),
    ).delete()
    db_session.commit()

    with patch.object(email_service, "send_project_assignment_email") as mock_send_email:
        assignment = assignment_service.create_assignment(
            db=db_session,
            project_id=project.id,
            employee_id=employee.id,
            role_id=role.id,
            current_user=hr_user,
        )

        assert assignment is not None
        assert assignment.project_id == project.id
        assert assignment.employee_id == employee.id

        # 1. Verify email was sent to employee ONLY (exactly once)
        assert mock_send_email.call_count == 1
        call_kwargs = mock_send_email.call_args.kwargs
        assert call_kwargs["recipient_email"] == emp_user.email
        assert call_kwargs["recipient_email"] != hr_user.email
        assert call_kwargs["employee_name"] == "Arjun Seereddy"
        assert call_kwargs["project_name"] == "HRMS Portal Alpha"
        assert call_kwargs["role_name"] == "Lead Full Stack Developer"

        # 2. Verify in-app notification: Employee received exactly ONE notification
        emp_notifs = (
            db_session.query(Notification)
            .filter(
                Notification.recipient_user_id == emp_user.id,
                Notification.reference_type == "project",
                Notification.reference_id == str(project.id),
            )
            .all()
        )
        assert len(emp_notifs) == 1
        notif = emp_notifs[0]
        assert notif.notification_type == NotificationType.PROJECT_ASSIGNED
        assert notif.title == "New Project Assignment"
        assert notif.message == 'You have been assigned to "HRMS Portal Alpha" as Lead Full Stack Developer.'

        # 3. Verify HR received ZERO notifications
        hr_notifs = (
            db_session.query(Notification)
            .filter(
                Notification.recipient_user_id == hr_user.id,
                Notification.reference_type == "project",
                Notification.reference_id == str(project.id),
            )
            .all()
        )
        assert len(hr_notifs) == 0


def test_02_duplicate_assignment_fails_and_sends_no_email_or_notification(setup_assignment_env, db_session: Session):
    """
    Attempting to reassign the same employee fails with 400 and sends ZERO emails or notifications.
    """
    hr_user = setup_assignment_env["hr_user"]
    employee = setup_assignment_env["employee"]
    project = setup_assignment_env["project"]
    role = setup_assignment_env["role"]

    with patch.object(email_service, "send_project_assignment_email") as mock_send_email:
        with pytest.raises(HTTPException) as exc_info:
            assignment_service.create_assignment(
                db=db_session,
                project_id=project.id,
                employee_id=employee.id,
                role_id=role.id,
                current_user=hr_user,
            )
        assert exc_info.value.status_code == 400
        assert "already assigned" in exc_info.value.detail
        assert not mock_send_email.called


def test_03_assignment_persists_even_if_email_fails(setup_assignment_env, db_session: Session):
    """
    If the SMTP server or network fails during email sending, the assignment is still persisted.
    """
    hr_user = setup_assignment_env["hr_user"]
    emp_user = setup_assignment_env["emp_user"]
    employee = setup_assignment_env["employee"]
    role = setup_assignment_env["role"]

    # Create a secondary test project
    p2 = db_session.query(Project).filter(Project.project_code == "PRJ-ASSIGN-P2").first()
    if not p2:
        p2 = Project(
            project_name="Second Test Project",
            project_code="PRJ-ASSIGN-P2",
            description="Testing email error resilience",
            start_date=date(2026, 2, 1),
            status=ProjectStatus.PLANNED,
            created_by=hr_user.id,
        )
        db_session.add(p2)
        db_session.commit()
        db_session.refresh(p2)

    existing = assignment_repository.get_assignment(db_session, p2.id, employee.id)
    if existing:
        assignment_repository.delete_assignment(db_session, existing)

    with patch.object(email_service, "send_project_assignment_email", side_effect=Exception("SMTP Connection Error")):
        assignment = assignment_service.create_assignment(
            db=db_session,
            project_id=p2.id,
            employee_id=employee.id,
            role_id=role.id,
            current_user=hr_user,
        )
        assert assignment is not None
        # Verify assignment persisted in DB
        persisted = assignment_repository.get_assignment(db_session, p2.id, employee.id)
        assert persisted is not None

        # Verify notification still reached employee
        notif = (
            db_session.query(Notification)
            .filter(
                Notification.recipient_user_id == emp_user.id,
                Notification.reference_type == "project",
                Notification.reference_id == str(p2.id),
            )
            .first()
        )
        assert notif is not None
        assert notif.title == "New Project Assignment"


def test_04_hr_excluded_from_receiving_project_notifications_guard(setup_assignment_env, db_session: Session):
    """
    Direct safeguard: create_notification raises 400 if trying to send PROJECT_ASSIGNED to an HR user.
    """
    hr_user = setup_assignment_env["hr_user"]

    with pytest.raises(HTTPException) as exc_info:
        create_notification(
            db=db_session,
            recipient_user_id=hr_user.id,
            notification_type=NotificationType.PROJECT_ASSIGNED,
            title="Invalid HR Project Notification",
            message="HR should never receive this",
        )
    assert exc_info.value.status_code == 400
    assert "cannot be sent to HR users" in exc_info.value.detail
