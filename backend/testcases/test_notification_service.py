import pytest
from datetime import datetime, timezone
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal, get_db
from app.main import app
from app.notification_service.models import Notification, NotificationType
from app.notification_service.service import create_notification

client = TestClient(app)


# ============================================================
# FIXTURES & SETUP (ISOLATED TEST USERS ONLY)
# ============================================================

@pytest.fixture(scope="module")
def setup_users():
    """
    Creates isolated test users strictly dedicated for notification tests.
    Does NOT touch, modify, or interact with real HR or employee records.
    """
    db = SessionLocal()
    try:
        user_a = db.query(User).filter(User.email == "test_user_a_notif@hrms.com").first()
        if not user_a:
            user_a = User(
                email="test_user_a_notif@hrms.com",
                full_name="Test User A",
                role="employee",
                is_active=True,
            )
            db.add(user_a)
            db.commit()
            db.refresh(user_a)

        user_b = db.query(User).filter(User.email == "test_user_b_notif@hrms.com").first()
        if not user_b:
            user_b = User(
                email="test_user_b_notif@hrms.com",
                full_name="Test User B",
                role="employee",
                is_active=True,
            )
            db.add(user_b)
            db.commit()
            db.refresh(user_b)

        hr_user = db.query(User).filter(User.email == "test_hr_notif@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_hr_notif@hrms.com",
                full_name="Test HR User",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        user_a_id = user_a.id
        user_b_id = user_b.id
        hr_user_id = hr_user.id

        # Clean notifications created during any previous test runs for these test users only
        db.query(Notification).filter(
            Notification.recipient_user_id.in_([user_a_id, user_b_id, hr_user_id])
        ).delete(synchronize_session=False)
        db.commit()

        yield {
            "user_a_id": user_a_id,
            "user_b_id": user_b_id,
            "hr_user_id": hr_user_id,
        }

        # Final cleanup for test user notifications
        db.query(Notification).filter(
            Notification.recipient_user_id.in_([user_a_id, user_b_id, hr_user_id])
        ).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def as_user(user_id: int):
    """Overrides get_current_user dependency to simulate authentication as user_id."""
    def _override(db: Session = Depends(get_db)):
        return db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = _override


@pytest.fixture(autouse=True)
def reset_overrides():
    yield
    app.dependency_overrides.clear()


# ============================================================
# TESTS
# ============================================================

def test_01_authentication_required():
    """Unauthenticated requests without token/session must return 401."""
    app.dependency_overrides.clear()
    response = client.get("/api/notifications")
    assert response.status_code == 401

    response = client.get("/api/notifications/unread-count")
    assert response.status_code == 401

    response = client.patch("/api/notifications/1/read")
    assert response.status_code == 401

    response = client.patch("/api/notifications/read-all")
    assert response.status_code == 401

    response = client.delete("/api/notifications/1")
    assert response.status_code == 401


def test_02_empty_notifications_list(setup_users):
    """When a user has no notifications, list returns total=0 and unread_count=0."""
    as_user(setup_users["user_a_id"])
    response = client.get("/api/notifications")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["unread_count"] == 0
    assert data["notifications"] == []

    count_resp = client.get("/api/notifications/unread-count")
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] == 0


def test_03_create_notification_internal(setup_users):
    """Internal service helper creates notification with reference and stores in DB."""
    db = SessionLocal()
    try:
        notif = create_notification(
            db=db,
            recipient_user_id=setup_users["user_a_id"],
            notification_type=NotificationType.LEAVE_REQUEST_APPROVED,
            title="Leave Request Approved",
            message="Your annual leave request from Oct 1 to Oct 3 has been approved.",
            reference_type="leave_request",
            reference_id="42",
            commit=True,
        )
        assert notif.id is not None
        assert notif.recipient_user_id == setup_users["user_a_id"]
        assert notif.notification_type == NotificationType.LEAVE_REQUEST_APPROVED
        assert notif.is_read is False
        assert notif.reference_type == "leave_request"
        assert notif.reference_id == "42"
        assert notif.created_at is not None
        assert notif.read_at is None
    finally:
        db.close()


def test_04_get_user_notifications_and_unread_count(setup_users):
    """User A retrieves their notifications and unread count matches database."""
    as_user(setup_users["user_a_id"])

    response = client.get("/api/notifications")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["unread_count"] == 1
    assert len(data["notifications"]) == 1

    item = data["notifications"][0]
    assert item["title"] == "Leave Request Approved"
    assert item["notification_type"] == "LEAVE_REQUEST_APPROVED"
    assert item["reference_type"] == "leave_request"
    assert item["reference_id"] == "42"
    assert item["is_read"] is False

    count_resp = client.get("/api/notifications/unread-count")
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] == 1


def test_05_newest_first_ordering(setup_users):
    """Multiple notifications are returned strictly in newest-first (created_at DESC) order."""
    db = SessionLocal()
    try:
        create_notification(
            db=db,
            recipient_user_id=setup_users["user_a_id"],
            notification_type=NotificationType.PROJECT_ASSIGNED,
            title="Project Assigned: HRMS 2.0",
            message="You have been assigned to project HRMS 2.0.",
            reference_type="project",
            reference_id="101",
            commit=True,
        )
        create_notification(
            db=db,
            recipient_user_id=setup_users["user_a_id"],
            notification_type=NotificationType.PERFORMANCE_REVIEW_COMPLETED,
            title="Performance Review Completed",
            message="Your Q3 performance review has been completed.",
            reference_type="performance_review",
            reference_id="202",
            commit=True,
        )
    finally:
        db.close()

    as_user(setup_users["user_a_id"])
    response = client.get("/api/notifications")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3

    # Newest created notification should be first
    assert data["notifications"][0]["title"] == "Performance Review Completed"
    assert data["notifications"][1]["title"] == "Project Assigned: HRMS 2.0"
    assert data["notifications"][2]["title"] == "Leave Request Approved"


def test_06_pagination(setup_users):
    """Pagination parameters skip and limit correctly slice results."""
    as_user(setup_users["user_a_id"])

    response = client.get("/api/notifications?skip=0&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["notifications"]) == 2
    assert data["skip"] == 0
    assert data["limit"] == 2

    response2 = client.get("/api/notifications?skip=2&limit=2")
    assert response2.status_code == 200
    data2 = response2.json()
    assert len(data2["notifications"]) == 1
    assert data2["notifications"][0]["title"] == "Leave Request Approved"


def test_07_pagination_validation(setup_users):
    """Negative skip or limit outside 1-100 returns 422."""
    as_user(setup_users["user_a_id"])

    res1 = client.get("/api/notifications?skip=-1")
    assert res1.status_code == 422

    res2 = client.get("/api/notifications?limit=0")
    assert res2.status_code == 422

    res3 = client.get("/api/notifications?limit=101")
    assert res3.status_code == 422


def test_08_mark_one_as_read(setup_users):
    """Marking a single notification as read sets is_read=True and read_at timestamp."""
    as_user(setup_users["user_a_id"])
    list_resp = client.get("/api/notifications")
    target_id = list_resp.json()["notifications"][0]["id"]

    patch_resp = client.patch(f"/api/notifications/{target_id}/read")
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["id"] == target_id
    assert data["is_read"] is True
    assert data["read_at"] is not None

    # Unread count should now be 2
    count_resp = client.get("/api/notifications/unread-count")
    assert count_resp.json()["unread_count"] == 2


def test_09_mark_one_as_read_idempotent(setup_users):
    """Marking an already-read notification as read is safely idempotent."""
    as_user(setup_users["user_a_id"])
    list_resp = client.get("/api/notifications")
    target_id = list_resp.json()["notifications"][0]["id"]

    # Call it again
    patch_resp = client.patch(f"/api/notifications/{target_id}/read")
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_read"] is True


def test_10_mark_all_as_read(setup_users):
    """Mark all notifications as read updates all unread notifications for that user."""
    as_user(setup_users["user_a_id"])
    res = client.patch("/api/notifications/read-all")
    assert res.status_code == 200
    assert res.json()["updated_count"] == 2

    # Verify unread count is now 0
    count_resp = client.get("/api/notifications/unread-count")
    assert count_resp.json()["unread_count"] == 0

    # Repeating mark-all should update 0
    res_repeat = client.patch("/api/notifications/read-all")
    assert res_repeat.status_code == 200
    assert res_repeat.json()["updated_count"] == 0


def test_11_user_isolation(setup_users):
    """User B cannot see User A's notifications in list or unread count."""
    as_user(setup_users["user_b_id"])

    response = client.get("/api/notifications")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["notifications"] == []

    count_resp = client.get("/api/notifications/unread-count")
    assert count_resp.json()["unread_count"] == 0


def test_12_idor_prevention_mark_read(setup_users):
    """User B cannot mark User A's notification as read; returns 404."""
    # Find User A's notification ID
    as_user(setup_users["user_a_id"])
    a_notif_id = client.get("/api/notifications").json()["notifications"][0]["id"]

    # User B attempts to mark User A's notification as read
    as_user(setup_users["user_b_id"])
    res = client.patch(f"/api/notifications/{a_notif_id}/read")
    assert res.status_code == 404
    assert res.json()["detail"] == "Notification not found"


def test_13_idor_prevention_delete(setup_users):
    """User B cannot delete User A's notification; returns 404."""
    as_user(setup_users["user_a_id"])
    a_notif_id = client.get("/api/notifications").json()["notifications"][0]["id"]

    as_user(setup_users["user_b_id"])
    res = client.delete(f"/api/notifications/{a_notif_id}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Notification not found"


def test_14_delete_own_notification(setup_users):
    """User A can delete their own notification."""
    as_user(setup_users["user_a_id"])
    list_before = client.get("/api/notifications").json()
    target_id = list_before["notifications"][0]["id"]
    total_before = list_before["total"]

    del_res = client.delete(f"/api/notifications/{target_id}")
    assert del_res.status_code == 204

    list_after = client.get("/api/notifications").json()
    assert list_after["total"] == total_before - 1
    ids = [n["id"] for n in list_after["notifications"]]
    assert target_id not in ids


def test_15_filtering_by_is_read_and_type(setup_users):
    """Filtering notifications by is_read and notification_type works accurately."""
    db = SessionLocal()
    try:
        create_notification(
            db=db,
            recipient_user_id=setup_users["user_b_id"],
            notification_type=NotificationType.ANNOUNCEMENT_PUBLISHED,
            title="Company Holiday",
            message="Office will be closed on Friday.",
            commit=True,
        )
        create_notification(
            db=db,
            recipient_user_id=setup_users["user_b_id"],
            notification_type=NotificationType.WORK_REPORT_APPROVED,
            title="Work Report Approved",
            message="Your weekly report was approved.",
            commit=True,
        )
    finally:
        db.close()

    as_user(setup_users["user_b_id"])

    # Mark one as read
    b_list = client.get("/api/notifications").json()
    first_id = b_list["notifications"][0]["id"]
    client.patch(f"/api/notifications/{first_id}/read")

    # Filter is_read=true
    res_read = client.get("/api/notifications?is_read=true")
    assert res_read.status_code == 200
    assert len(res_read.json()["notifications"]) == 1
    assert res_read.json()["notifications"][0]["is_read"] is True

    # Filter is_read=false
    res_unread = client.get("/api/notifications?is_read=false")
    assert res_unread.status_code == 200
    assert len(res_unread.json()["notifications"]) == 1
    assert res_unread.json()["notifications"][0]["is_read"] is False

    # Filter by notification_type
    res_type = client.get(f"/api/notifications?notification_type={NotificationType.ANNOUNCEMENT_PUBLISHED.value}")
    assert res_type.status_code == 200
    assert len(res_type.json()["notifications"]) == 1
    assert res_type.json()["notifications"][0]["notification_type"] == "ANNOUNCEMENT_PUBLISHED"


def test_16_directional_notification_creation(setup_users):
    """
    Verifies directional notification dispatch:
    - Employee action targets responsible HR user.
    - HR action targets employee user.
    - Does NOT broadcast to all users.
    """
    db = SessionLocal()
    try:
        # 1. Employee submits leave -> targeted to HR user
        hr_notif = create_notification(
            db=db,
            recipient_user_id=setup_users["hr_user_id"],
            notification_type=NotificationType.LEAVE_REQUEST_SUBMITTED,
            title="New Leave Request Submitted",
            message="Test User B has submitted a leave request.",
            reference_type="leave_request",
            reference_id="99",
            commit=True,
        )
        assert hr_notif.recipient_user_id == setup_users["hr_user_id"]
        hr_notif_id = hr_notif.id

        # 2. HR resolves complaint -> targeted to Employee user
        emp_notif = create_notification(
            db=db,
            recipient_user_id=setup_users["user_b_id"],
            notification_type=NotificationType.COMPLAINT_RESOLVED,
            title="Complaint Resolved",
            message="Your complaint #55 has been marked as resolved.",
            reference_type="complaint",
            reference_id="55",
            commit=True,
        )
        assert emp_notif.recipient_user_id == setup_users["user_b_id"]
        emp_notif_id = emp_notif.id
    finally:
        db.close()

    # HR only sees HR notification
    as_user(setup_users["hr_user_id"])
    hr_list = client.get("/api/notifications").json()
    assert any(n["id"] == hr_notif_id for n in hr_list["notifications"])
    assert not any(n["id"] == emp_notif_id for n in hr_list["notifications"])

    # Employee B only sees Employee notification
    as_user(setup_users["user_b_id"])
    emp_list = client.get("/api/notifications").json()
    assert any(n["id"] == emp_notif_id for n in emp_list["notifications"])
    assert not any(n["id"] == hr_notif_id for n in emp_list["notifications"])


def test_17_invalid_notification_type_validation(setup_users):
    """Invalid notification type query parameter is rejected with 422."""
    as_user(setup_users["user_a_id"])
    res = client.get("/api/notifications?notification_type=NON_EXISTENT_TYPE")
    assert res.status_code == 422
