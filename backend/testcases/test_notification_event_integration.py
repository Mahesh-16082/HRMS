from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.announcement_service.models import Announcement, AnnouncementCategory, AnnouncementPriority, AnnouncementStatus
from app.announcement_service import service as announcement_service
from app.announcement_service.schemas import AnnouncementCreate, AnnouncementPublish
from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.complaint_service import service as complaint_service
from app.complaint_service.models import Complaint, ComplaintPriority, ComplaintStatus
from app.complaint_service.schemas import ComplaintCreate, ComplaintUpdate
from app.core.database import SessionLocal, get_db
from app.employee_service.models import Employee, EmploymentStatus
from app.leave_service import service as leave_service
from app.leave_service.models import LeaveBalance, LeaveRequest, LeaveRequestStatus, LeaveType
from app.leave_service.schemas import LeaveRequestCreate
from app.main import app
from app.notification_service.models import Notification, NotificationType
from app.notification_service.service import list_notifications, get_unread_count, get_responsible_hr_user
from app.performance_service import service as performance_service
from app.performance_service.models import PerformanceReview, PerformanceReviewStatus
from app.performance_service.schemas import PerformanceReviewCreate, CategoryRatingInput
from app.project_service import assignment_service, role_service
from app.project_service.assignment_models import ProjectAssignment
from app.project_service.models import Project, ProjectStatus
from app.project_service.role_models import ProjectRole
from app.work_report_service import service as work_report_service
from app.work_report_service.models import WorkReport, WorkReportStatus
from app.work_report_service.schemas import WorkReportCreate, WorkReportReview, WorkReportUpdate

client = TestClient(app)


# ============================================================
# FIXTURES & TEST SETUP (ISOLATED TEST ACCOUNTS)
# ============================================================

@pytest.fixture(scope="module")
def setup_test_env():
    """
    Sets up isolated test HR and Employee accounts dedicated for event integration tests.
    Does NOT touch, modify, or interact with real HR or employee records.
    """
    db = SessionLocal()
    try:
        # 1. HR User
        hr_user = db.query(User).filter(User.email == "test_evt_hr@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_evt_hr@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        # 2. Employee User & Profile
        emp_user = db.query(User).filter(User.email == "test_evt_emp@hrms.com").first()
        if not emp_user:
            emp_user = User(
                email="test_evt_emp@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp_user)
            db.commit()
            db.refresh(emp_user)

        emp_profile = db.query(Employee).filter(Employee.user_id == emp_user.id).first()
        if not emp_profile:
            emp_profile = Employee(
                user_id=emp_user.id,
                employee_code="EMP_EVT_01",
                first_name="EvtEmpFirst",
                last_name="EvtEmpLast",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp_profile)
            db.commit()
            db.refresh(emp_profile)

        # 3. Secondary Employee User & Profile (for isolation & broadcast tests)
        other_user = db.query(User).filter(User.email == "test_evt_other@hrms.com").first()
        if not other_user:
            other_user = User(
                email="test_evt_other@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(other_user)
            db.commit()
            db.refresh(other_user)

        other_profile = db.query(Employee).filter(Employee.user_id == other_user.id).first()
        if not other_profile:
            other_profile = Employee(
                user_id=other_user.id,
                employee_code="EMP_EVT_02",
                first_name="OtherEmpFirst",
                last_name="OtherEmpLast",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(other_profile)
            db.commit()
            db.refresh(other_profile)

        # 4. Leave Type & Balances for emp_profile
        leave_type = db.query(LeaveType).filter(LeaveType.code == "EVT_CASUAL").first()
        if not leave_type:
            leave_type = LeaveType(
                name="Event Casual Leave",
                code="EVT_CASUAL",
                description="Test leave type for event integration",
                annual_quota=15,
                is_active=True,
            )
            db.add(leave_type)
            db.commit()
            db.refresh(leave_type)
        else:
            leave_type.is_active = True
            db.commit()
            db.refresh(leave_type)

        leave_service.ensure_employee_yearly_balances(db, emp_profile.id, 2026)

        # 5. Project & Role
        project = db.query(Project).filter(Project.project_code == "PRJ_EVT_01").first()
        if not project:
            project = Project(
                project_name="Event Integration Project",
                project_code="PRJ_EVT_01",
                description="Project for event tests",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                status=ProjectStatus.ACTIVE,
                created_by=hr_user.id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        role = db.query(ProjectRole).filter(ProjectRole.code == "EVT_DEV").first()
        if not role:
            role = ProjectRole(
                name="Event Developer",
                code="EVT_DEV",
                description="Event dev role",
                is_active=True,
            )
            db.add(role)
            db.commit()
            db.refresh(role)

        test_user_ids = [hr_user.id, emp_user.id, other_user.id]
        test_emp_ids = [emp_profile.id, other_profile.id]

        # Clean test records from previous runs
        db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(Complaint).filter(Complaint.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(WorkReport).filter(WorkReport.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(PerformanceReview).filter(PerformanceReview.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(ProjectAssignment).filter(ProjectAssignment.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(Announcement).filter(Announcement.created_by == hr_user.id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.recipient_user_id.in_(test_user_ids)).delete(synchronize_session=False)
        
        # Reset balance
        bal = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == emp_profile.id,
            LeaveBalance.leave_type_id == leave_type.id,
            LeaveBalance.year == 2026,
        ).first()
        if bal:
            bal.used = 0.0
            bal.available = bal.allocated
        db.commit()

        yield {
            "hr_user_id": hr_user.id,
            "emp_user_id": emp_user.id,
            "emp_id": emp_profile.id,
            "other_user_id": other_user.id,
            "other_emp_id": other_profile.id,
            "leave_type_id": leave_type.id,
            "project_id": project.id,
            "role_id": role.id,
        }

        # Cleanup
        db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(Complaint).filter(Complaint.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(WorkReport).filter(WorkReport.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(PerformanceReview).filter(PerformanceReview.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(ProjectAssignment).filter(ProjectAssignment.employee_id.in_(test_emp_ids)).delete(synchronize_session=False)
        db.query(Announcement).filter(Announcement.created_by == hr_user.id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.recipient_user_id.in_(test_user_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# 1. LEAVE SERVICE EVENT INTEGRATION TESTS
# ============================================================

def reset_leave_state(db_session: Session, emp_id: int, leave_type_id: int):
    db_session.query(LeaveRequest).filter(LeaveRequest.employee_id == emp_id).delete(synchronize_session=False)
    lt = db_session.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
    if lt and not lt.is_active:
        lt.is_active = True
    leave_service.ensure_employee_yearly_balances(db_session, emp_id, 2026)
    bal = db_session.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type_id == leave_type_id,
        LeaveBalance.year == 2026,
    ).first()
    if bal:
        bal.used = 0.0
        bal.available = bal.allocated
    db_session.commit()


def test_01_leave_request_submitted_notifies_hr(setup_test_env, db_session):
    """
    Employee applies for leave -> HR receives LEAVE_REQUEST_SUBMITTED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    emp_id = setup_test_env["emp_id"]
    leave_type_id = setup_test_env["leave_type_id"]

    reset_leave_state(db_session, emp_id, leave_type_id)

    responsible_hr = get_responsible_hr_user(db_session)
    assert responsible_hr is not None

    req_data = LeaveRequestCreate(
        leave_type_id=leave_type_id,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        reason="Attending family function",
    )
    leave_req = leave_service.apply_leave_request(db_session, emp_user_id, req_data)

    # Verify notification created for HR
    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == responsible_hr.id,
            Notification.notification_type == NotificationType.LEAVE_REQUEST_SUBMITTED,
            Notification.reference_type == "leave",
            Notification.reference_id == str(leave_req.id),
        )
        .first()
    )
    assert notif is not None
    assert "submitted a leave request" in notif.message
    assert notif.is_read is False

    # Cleanup test notification
    db_session.delete(notif)
    db_session.commit()


def test_02_leave_request_approved_notifies_employee(setup_test_env, db_session):
    """
    HR approves leave request -> Employee receives LEAVE_REQUEST_APPROVED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    emp_id = setup_test_env["emp_id"]
    hr_user_id = setup_test_env["hr_user_id"]
    leave_type_id = setup_test_env["leave_type_id"]

    reset_leave_state(db_session, emp_id, leave_type_id)

    req_data = LeaveRequestCreate(
        leave_type_id=leave_type_id,
        start_date=date(2026, 6, 5),
        end_date=date(2026, 6, 6),
        reason="Approved leave test",
    )
    leave_req = leave_service.apply_leave_request(db_session, emp_user_id, req_data)

    # Approve
    leave_service.approve_leave_request(db_session, hr_user_id, leave_req.id)

    # Verify notification created for Employee
    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.LEAVE_REQUEST_APPROVED,
            Notification.reference_type == "leave",
            Notification.reference_id == str(leave_req.id),
        )
        .first()
    )
    assert notif is not None
    assert "approved" in notif.message.lower()


def test_03_leave_request_rejected_notifies_employee(setup_test_env, db_session):
    """
    HR rejects leave request -> Employee receives LEAVE_REQUEST_REJECTED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    emp_id = setup_test_env["emp_id"]
    hr_user_id = setup_test_env["hr_user_id"]
    leave_type_id = setup_test_env["leave_type_id"]

    reset_leave_state(db_session, emp_id, leave_type_id)

    req_data = LeaveRequestCreate(
        leave_type_id=leave_type_id,
        start_date=date(2026, 6, 10),
        end_date=date(2026, 6, 11),
        reason="Rejected leave test",
    )
    leave_req = leave_service.apply_leave_request(db_session, emp_user_id, req_data)

    # Reject
    leave_service.reject_leave_request(db_session, hr_user_id, leave_req.id, "Staff shortage")

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.LEAVE_REQUEST_REJECTED,
            Notification.reference_type == "leave",
            Notification.reference_id == str(leave_req.id),
        )
        .first()
    )
    assert notif is not None
    assert "Staff shortage" in notif.message


def test_04_leave_request_revoked_notifies_employee(setup_test_env, db_session):
    """
    HR revokes previously approved leave request -> Employee receives LEAVE_REQUEST_REVOKED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    emp_id = setup_test_env["emp_id"]
    hr_user_id = setup_test_env["hr_user_id"]
    leave_type_id = setup_test_env["leave_type_id"]

    reset_leave_state(db_session, emp_id, leave_type_id)

    req_data = LeaveRequestCreate(
        leave_type_id=leave_type_id,
        start_date=date(2026, 6, 15),
        end_date=date(2026, 6, 16),
        reason="Revoke leave test",
    )
    leave_req = leave_service.apply_leave_request(db_session, emp_user_id, req_data)
    leave_service.approve_leave_request(db_session, hr_user_id, leave_req.id)

    # Revoke
    leave_service.revoke_leave_request(db_session, hr_user_id, leave_req.id)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.LEAVE_REQUEST_REVOKED,
            Notification.reference_type == "leave",
            Notification.reference_id == str(leave_req.id),
        )
        .first()
    )
    assert notif is not None
    assert "revoked" in notif.message.lower()


# ============================================================
# 2. COMPLAINT SERVICE EVENT INTEGRATION TESTS
# ============================================================

def test_05_complaint_submitted_notifies_hr(setup_test_env, db_session):
    """
    Employee submits complaint -> HR receives COMPLAINT_SUBMITTED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    responsible_hr = get_responsible_hr_user(db_session)
    assert responsible_hr is not None

    data = ComplaintCreate(
        subject="AC not working in cabin 4",
        description="Room temperature is too high",
        category="Facility",
        priority=ComplaintPriority.MEDIUM,
    )
    complaint = complaint_service.create_complaint(db_session, emp_user_id, data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == responsible_hr.id,
            Notification.notification_type == NotificationType.COMPLAINT_SUBMITTED,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .first()
    )
    assert notif is not None
    assert "AC not working in cabin 4" in notif.message

    # Cleanup test notification
    db_session.delete(notif)
    db_session.commit()


def test_06_complaint_updated_by_employee_notifies_hr(setup_test_env, db_session):
    """
    Employee updates OPEN complaint -> HR receives COMPLAINT_UPDATED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    responsible_hr = get_responsible_hr_user(db_session)
    assert responsible_hr is not None

    data = ComplaintCreate(
        subject="Mouse not working",
        description="Scroll wheel broken",
        category="Hardware",
        priority=ComplaintPriority.LOW,
    )
    complaint = complaint_service.create_complaint(db_session, emp_user_id, data)

    update_data = ComplaintUpdate(
        description="Scroll wheel and left button both broken",
    )
    complaint_service.update_my_complaint(db_session, emp_user_id, complaint.id, update_data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == responsible_hr.id,
            Notification.notification_type == NotificationType.COMPLAINT_UPDATED,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .first()
    )
    assert notif is not None
    assert "updated complaint" in notif.message

    # Cleanup test notifications
    db_session.query(Notification).filter(
        Notification.reference_type == "complaint",
        Notification.reference_id == str(complaint.id),
    ).delete()
    db_session.commit()


def test_07_complaint_updated_by_hr_notifies_employee(setup_test_env, db_session):
    """
    HR updates complaint status to IN_PROGRESS -> Employee receives COMPLAINT_UPDATED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]

    data = ComplaintCreate(
        subject="Keyboard keys sticking",
        description="Keys space and enter stick",
        category="Hardware",
        priority=ComplaintPriority.MEDIUM,
    )
    complaint = complaint_service.create_complaint(db_session, emp_user_id, data)

    complaint_service.update_complaint_status(
        db_session,
        complaint.id,
        new_status=ComplaintStatus.IN_PROGRESS,
        hr_remarks="IT technician assigned",
    )

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.COMPLAINT_UPDATED,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .first()
    )
    assert notif is not None
    assert "IN_PROGRESS" in notif.message or "updated" in notif.message


def test_08_complaint_resolved_notifies_employee(setup_test_env, db_session):
    """
    HR resolves complaint -> Employee receives COMPLAINT_RESOLVED notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]

    data = ComplaintCreate(
        subject="Monitor flicker",
        description="Screen flickers periodically",
        category="Hardware",
        priority=ComplaintPriority.HIGH,
    )
    complaint = complaint_service.create_complaint(db_session, emp_user_id, data)

    complaint_service.update_complaint_status(
        db_session,
        complaint.id,
        new_status=ComplaintStatus.RESOLVED,
        hr_remarks="Replaced HDMI cable",
    )

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.COMPLAINT_RESOLVED,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .first()
    )
    assert notif is not None
    assert "resolved" in notif.message.lower()


def test_09_complaint_duplicate_update_no_extra_notification(setup_test_env, db_session):
    """
    Duplicate update with identical status and remarks should NOT trigger a new notification.
    """
    emp_user_id = setup_test_env["emp_user_id"]

    data = ComplaintCreate(
        subject="Duplicate check complaint",
        description="Testing idempotency",
        category="General",
        priority=ComplaintPriority.LOW,
    )
    complaint = complaint_service.create_complaint(db_session, emp_user_id, data)

    complaint_service.update_complaint_status(
        db_session,
        complaint.id,
        new_status=ComplaintStatus.IN_PROGRESS,
        hr_remarks="Investigating",
    )

    initial_count = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .count()
    )

    # Calling update with same status and same remarks
    complaint_service.update_complaint_status(
        db_session,
        complaint.id,
        new_status=ComplaintStatus.IN_PROGRESS,
        hr_remarks="Investigating",
    )

    after_count = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.reference_type == "complaint",
            Notification.reference_id == str(complaint.id),
        )
        .count()
    )

    assert after_count == initial_count


# ============================================================
# 3. PROJECT SERVICE EVENT INTEGRATION TESTS
# ============================================================

def test_10_project_assigned_and_role_assigned_notifies_employee(setup_test_env, db_session):
    """
    HR assigns employee to project with a role -> Employee receives PROJECT_ASSIGNED & PROJECT_ROLE_ASSIGNED notifications.
    """
    emp_user_id = setup_test_env["emp_user_id"]
    emp_id = setup_test_env["emp_id"]
    project_id = setup_test_env["project_id"]
    role_id = setup_test_env["role_id"]

    # Ensure assignment doesn't already exist from a previous run
    existing = assignment_service.assignment_repository.get_assignment(db_session, project_id, emp_id)
    if existing:
        assignment_service.assignment_repository.delete_assignment(db_session, existing)

    # Create assignment
    assignment_service.create_assignment(db_session, project_id, emp_id, role_id)

    # Verify PROJECT_ASSIGNED
    prj_notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.PROJECT_ASSIGNED,
            Notification.reference_type == "project",
            Notification.reference_id == str(project_id),
        )
        .first()
    )
    assert prj_notif is not None
    assert "Event Integration Project" in prj_notif.message

    # Verify PROJECT_ROLE_ASSIGNED
    role_notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.PROJECT_ROLE_ASSIGNED,
            Notification.reference_type == "project_role",
            Notification.reference_id == str(role_id),
        )
        .first()
    )
    assert role_notif is not None
    assert "Event Developer" in role_notif.message


# ============================================================
# 4. ANNOUNCEMENT SERVICE EVENT INTEGRATION TESTS
# ============================================================

def test_11_announcement_published_notifies_active_employees(setup_test_env, db_session):
    """
    HR publishes announcement -> All active employees receive ANNOUNCEMENT_PUBLISHED notification.
    """
    hr_user_id = setup_test_env["hr_user_id"]
    emp_user_id = setup_test_env["emp_user_id"]
    other_user_id = setup_test_env["other_user_id"]

    data = AnnouncementCreate(
        title="Annual Company Picnic 2026",
        description="Join us for games and food!",
        category=AnnouncementCategory.EVENT,
        priority=AnnouncementPriority.MEDIUM,
    )
    ann = announcement_service.create_announcement(db_session, hr_user_id, data)

    # Publish
    announcement_service.publish_announcement(db_session, ann.id)

    # Verify both test employees received the notification
    emp_notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.ANNOUNCEMENT_PUBLISHED,
            Notification.reference_type == "announcement",
            Notification.reference_id == str(ann.id),
        )
        .first()
    )
    assert emp_notif is not None
    assert "Annual Company Picnic 2026" in emp_notif.title

    other_notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == other_user_id,
            Notification.notification_type == NotificationType.ANNOUNCEMENT_PUBLISHED,
            Notification.reference_type == "announcement",
            Notification.reference_id == str(ann.id),
        )
        .first()
    )
    assert other_notif is not None

    # Cleanup test notifications for this announcement
    db_session.query(Notification).filter(
        Notification.reference_type == "announcement",
        Notification.reference_id == str(ann.id),
    ).delete()
    db_session.commit()


# ============================================================
# 5. PERFORMANCE SERVICE EVENT INTEGRATION TESTS
# ============================================================

def test_12_performance_review_completed_notifies_employee(setup_test_env, db_session):
    """
    HR completes performance review -> Employee receives PERFORMANCE_REVIEW_COMPLETED notification.
    """
    hr_user = db_session.query(User).filter(User.id == setup_test_env["hr_user_id"]).first()
    emp_id = setup_test_env["emp_id"]
    emp_user_id = setup_test_env["emp_user_id"]

    review_data = PerformanceReviewCreate(
        employee_id=emp_id,
        review_period="Q2-2026",
        title="Q2 Evaluation",
        review_date=date(2026, 6, 30),
        status=PerformanceReviewStatus.COMPLETED,
        comments="Outstanding work on notifications",
        ratings=[
            CategoryRatingInput(category="Quality of Work", rating=5),
            CategoryRatingInput(category="Communication", rating=4),
        ],
    )
    review = performance_service.create_review(db_session, hr_user, review_data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.PERFORMANCE_REVIEW_COMPLETED,
            Notification.reference_type == "performance_review",
            Notification.reference_id == str(review.id),
        )
        .first()
    )
    assert notif is not None
    assert "Q2-2026" in notif.message


# ============================================================
# 6. WORK REPORT SERVICE EVENT INTEGRATION TESTS
# ============================================================

def test_13_work_report_submitted_notifies_hr(setup_test_env, db_session):
    """
    Employee submits work report -> HR receives WORK_REPORT_SUBMITTED notification.
    """
    emp_user = db_session.query(User).filter(User.id == setup_test_env["emp_user_id"]).first()
    responsible_hr = get_responsible_hr_user(db_session)
    assert responsible_hr is not None
    project_id = setup_test_env["project_id"]

    # Delete any existing report for today
    today = date.today()
    existing = work_report_service.repository.get_report_by_employee_and_date(db_session, setup_test_env["emp_id"], today)
    if existing:
        work_report_service.repository.delete_work_report(db_session, existing)

    data = WorkReportCreate(
        work_date=today,
        project_id=project_id,
        title="Backend Notification Integration",
        tasks_completed="Connected 6 services with notification service",
        hours_worked=8.0,
        submit=True,
    )
    report = work_report_service.create_work_report(db_session, emp_user, data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == responsible_hr.id,
            Notification.notification_type == NotificationType.WORK_REPORT_SUBMITTED,
            Notification.reference_type == "work_report",
            Notification.reference_id == str(report.id),
        )
        .first()
    )
    assert notif is not None
    assert "submitted a work report" in notif.message


def test_14_work_report_approved_notifies_employee(setup_test_env, db_session):
    """
    HR approves work report -> Employee receives WORK_REPORT_APPROVED notification.
    """
    hr_user = db_session.query(User).filter(User.id == setup_test_env["hr_user_id"]).first()
    emp_user_id = setup_test_env["emp_user_id"]
    today = date.today()

    report = work_report_service.repository.get_report_by_employee_and_date(db_session, setup_test_env["emp_id"], today)
    assert report is not None

    review_data = WorkReportReview(
        status=WorkReportStatus.APPROVED,
        review_feedback="Great progress!",
    )
    work_report_service.review_work_report_hr(db_session, hr_user, report.id, review_data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.WORK_REPORT_APPROVED,
            Notification.reference_type == "work_report",
            Notification.reference_id == str(report.id),
        )
        .first()
    )
    assert notif is not None
    assert "approved" in notif.message.lower()


def test_15_work_report_rejected_notifies_employee(setup_test_env, db_session):
    """
    HR rejects work report -> Employee receives WORK_REPORT_REJECTED notification.
    """
    emp_user = db_session.query(User).filter(User.id == setup_test_env["emp_user_id"]).first()
    hr_user = db_session.query(User).filter(User.id == setup_test_env["hr_user_id"]).first()
    emp_user_id = setup_test_env["emp_user_id"]
    today = date.today()

    report = work_report_service.repository.get_report_by_employee_and_date(db_session, setup_test_env["emp_id"], today)

    # Update report back to DRAFT or REJECTED to submit again
    report.status = WorkReportStatus.DRAFT
    db_session.commit()

    # Re-submit
    work_report_service.submit_my_work_report(db_session, emp_user, report.id)

    # Reject
    review_data = WorkReportReview(
        status=WorkReportStatus.REJECTED,
        review_feedback="Please provide more details on tasks",
    )
    work_report_service.review_work_report_hr(db_session, hr_user, report.id, review_data)

    notif = (
        db_session.query(Notification)
        .filter(
            Notification.recipient_user_id == emp_user_id,
            Notification.notification_type == NotificationType.WORK_REPORT_REJECTED,
            Notification.reference_type == "work_report",
            Notification.reference_id == str(report.id),
        )
        .first()
    )
    assert notif is not None
    assert "Please provide more details on tasks" in notif.message


# ============================================================
# 7. ISOLATION & UNREAD COUNT VERIFICATION
# ============================================================

def test_16_notification_isolation_and_unread_count(setup_test_env, db_session):
    """
    Verify that an employee only sees their own notifications,
    HR sees their notifications, and unread counts match accurately.
    """
    emp_user = db_session.query(User).filter(User.id == setup_test_env["emp_user_id"]).first()
    hr_user = db_session.query(User).filter(User.id == setup_test_env["hr_user_id"]).first()

    emp_notifications_res = list_notifications(db_session, emp_user)
    hr_notifications_res = list_notifications(db_session, hr_user)

    for n in emp_notifications_res.notifications:
        db_n = db_session.query(Notification).filter(Notification.id == n.id).first()
        assert db_n.recipient_user_id == emp_user.id

    for n in hr_notifications_res.notifications:
        db_n = db_session.query(Notification).filter(Notification.id == n.id).first()
        assert db_n.recipient_user_id == hr_user.id

    emp_unread = get_unread_count(db_session, emp_user)
    assert emp_unread.unread_count == emp_notifications_res.unread_count
