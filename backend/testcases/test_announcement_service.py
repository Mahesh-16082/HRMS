from datetime import datetime, timedelta, timezone
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.announcement_service.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)
from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal, get_db
from app.main import app

client = TestClient(app)


# ============================================================
# FIXTURES & SETUP
# ============================================================

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture(scope="module")
def setup_data():
    """Ensure HR and Employee test users exist and return user IDs."""
    db = SessionLocal()
    try:
        hr_user = db.query(User).filter(User.email == "test_hr_announcements@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_hr_announcements@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        emp_user = db.query(User).filter(User.email == "test_emp_announcements@hrms.com").first()
        if not emp_user:
            emp_user = User(
                email="test_emp_announcements@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp_user)
            db.commit()
            db.refresh(emp_user)

        hr_user_id = hr_user.id
        emp_user_id = emp_user.id

        # Clean test announcements created during previous runs
        db.query(Announcement).filter(
            Announcement.created_by.in_([hr_user_id, emp_user_id])
        ).delete(synchronize_session=False)
        db.commit()

        return {
            "hr_user_id": hr_user_id,
            "emp_user_id": emp_user_id,
        }
    finally:
        db.close()


def as_user(user_id: int):
    def _override(db: Session = Depends(get_db)):
        return db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = _override


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_all():
    yield
    app.dependency_overrides.clear()


# ============================================================
# TESTS
# ============================================================

def test_01_hr_can_create_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    payload = {
        "title": "Company Annual Meeting 2026",
        "description": "All hands meeting will be held next Friday.",
        "category": AnnouncementCategory.EVENT.value,
        "priority": AnnouncementPriority.HIGH.value,
    }
    response = client.post("/api/announcements", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["category"] == AnnouncementCategory.EVENT.value
    assert data["priority"] == AnnouncementPriority.HIGH.value
    assert data["status"] == AnnouncementStatus.DRAFT.value
    assert data["published_at"] is None
    assert data["created_by"] == setup_data["hr_user_id"]


def test_02_employee_cannot_create_announcement(setup_data):
    as_user(setup_data["emp_user_id"])
    payload = {
        "title": "Employee Announcement Attempt",
        "description": "This should fail.",
        "category": AnnouncementCategory.GENERAL.value,
    }
    response = client.post("/api/announcements", json=payload)
    assert response.status_code == 403
    assert "Only HR can perform this action" in response.json()["detail"]


def test_03_created_by_comes_from_authenticated_hr_user(setup_data):
    as_user(setup_data["hr_user_id"])
    # Attempting to submit created_by should be forbidden by extra="forbid"
    payload = {
        "title": "Tampered created_by attempt",
        "description": "Should fail due to forbid extra.",
        "category": AnnouncementCategory.GENERAL.value,
        "created_by": 9999,
    }
    response = client.post("/api/announcements", json=payload)
    assert response.status_code == 422


def test_04_new_announcement_starts_as_draft(setup_data):
    as_user(setup_data["hr_user_id"])
    # Attempting to submit status should be forbidden by extra="forbid"
    payload = {
        "title": "Tampered status attempt",
        "description": "Should fail due to forbid extra.",
        "category": AnnouncementCategory.GENERAL.value,
        "status": "PUBLISHED",
    }
    response = client.post("/api/announcements", json=payload)
    assert response.status_code == 422


def test_05_hr_can_publish_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Publish Test Announcement",
        "description": "Ready to be published.",
        "category": AnnouncementCategory.POLICY.value,
    })
    announcement_id = create_res.json()["id"]

    pub_res = client.patch(f"/api/announcements/{announcement_id}/publish")
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == AnnouncementStatus.PUBLISHED.value


def test_06_publishing_sets_published_at(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Timestamp Test",
        "description": "Testing published_at timestamp.",
        "category": AnnouncementCategory.IMPORTANT.value,
    })
    announcement_id = create_res.json()["id"]
    assert create_res.json()["published_at"] is None

    pub_res = client.patch(f"/api/announcements/{announcement_id}/publish")
    assert pub_res.status_code == 200
    assert pub_res.json()["published_at"] is not None


def test_07_employee_can_view_published_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Visible To Employee",
        "description": "Employees should be able to see this.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    # Employee views details
    as_user(setup_data["emp_user_id"])
    res = client.get(f"/api/announcements/{announcement_id}")
    assert res.status_code == 200
    assert res.json()["title"] == "Visible To Employee"

    # Employee views in /me list
    list_res = client.get("/api/announcements/me")
    assert list_res.status_code == 200
    ids = [item["id"] for item in list_res.json()["announcements"]]
    assert announcement_id in ids


def test_08_employee_cannot_view_draft_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Secret Draft",
        "description": "HR only draft.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]

    as_user(setup_data["emp_user_id"])
    # Employee cannot view details of draft (404)
    res = client.get(f"/api/announcements/{announcement_id}")
    assert res.status_code == 404

    # Draft not present in employee's /me list
    list_res = client.get("/api/announcements/me")
    ids = [item["id"] for item in list_res.json()["announcements"]]
    assert announcement_id not in ids


def test_09_employee_cannot_view_archived_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Archived Notice",
        "description": "Old notice to archive.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")
    client.patch(f"/api/announcements/{announcement_id}/archive")

    as_user(setup_data["emp_user_id"])
    res = client.get(f"/api/announcements/{announcement_id}")
    assert res.status_code == 404

    list_res = client.get("/api/announcements/me")
    ids = [item["id"] for item in list_res.json()["announcements"]]
    assert announcement_id not in ids


def test_10_expired_announcement_is_hidden_from_employee_list(setup_data, db_session: Session):
    as_user(setup_data["hr_user_id"])
    future_time = datetime.now(timezone.utc) + timedelta(hours=2)
    create_res = client.post("/api/announcements", json={
        "title": "Expiring Notice",
        "description": "This will expire.",
        "category": AnnouncementCategory.EVENT.value,
        "expires_at": future_time.isoformat(),
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    # Manually expire in DB
    record = db_session.query(Announcement).filter(Announcement.id == announcement_id).first()
    record.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()

    as_user(setup_data["emp_user_id"])
    list_res = client.get("/api/announcements/me")
    ids = [item["id"] for item in list_res.json()["announcements"]]
    assert announcement_id not in ids


def test_11_expired_announcement_is_hidden_from_employee_details(setup_data, db_session: Session):
    as_user(setup_data["hr_user_id"])
    future_time = datetime.now(timezone.utc) + timedelta(hours=2)
    create_res = client.post("/api/announcements", json={
        "title": "Expired Notice Details",
        "description": "Should return 404 for employee.",
        "category": AnnouncementCategory.EVENT.value,
        "expires_at": future_time.isoformat(),
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    # Expire in DB
    record = db_session.query(Announcement).filter(Announcement.id == announcement_id).first()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    as_user(setup_data["emp_user_id"])
    res = client.get(f"/api/announcements/{announcement_id}")
    assert res.status_code == 404


def test_12_hr_can_view_expired_announcement(setup_data, db_session: Session):
    as_user(setup_data["hr_user_id"])
    future_time = datetime.now(timezone.utc) + timedelta(hours=2)
    create_res = client.post("/api/announcements", json={
        "title": "HR Expired Access",
        "description": "HR can view even when expired.",
        "category": AnnouncementCategory.EVENT.value,
        "expires_at": future_time.isoformat(),
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    # Expire in DB
    record = db_session.query(Announcement).filter(Announcement.id == announcement_id).first()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    db_session.commit()

    # HR can access details
    res = client.get(f"/api/announcements/{announcement_id}")
    assert res.status_code == 200
    assert res.json()["id"] == announcement_id

    # HR can see it in management list
    hr_list = client.get("/api/announcements")
    assert hr_list.status_code == 200
    ids = [item["id"] for item in hr_list.json()["announcements"]]
    assert announcement_id in ids


def test_13_hr_can_update_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Original Title",
        "description": "Original Description",
        "category": AnnouncementCategory.GENERAL.value,
        "priority": AnnouncementPriority.LOW.value,
    })
    announcement_id = create_res.json()["id"]

    update_res = client.put(f"/api/announcements/{announcement_id}", json={
        "title": "Updated Title",
        "description": "Updated Description",
        "priority": AnnouncementPriority.URGENT.value,
    })
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "Updated Description"
    assert data["priority"] == AnnouncementPriority.URGENT.value
    assert data["category"] == AnnouncementCategory.GENERAL.value


def test_14_employee_cannot_update_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Protected Announcement",
        "description": "Protected.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]

    as_user(setup_data["emp_user_id"])
    res = client.put(f"/api/announcements/{announcement_id}", json={
        "title": "Hacked Title",
    })
    assert res.status_code == 403


def test_15_hr_can_archive_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Archive Me",
        "description": "To be archived.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    arch_res = client.patch(f"/api/announcements/{announcement_id}/archive")
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == AnnouncementStatus.ARCHIVED.value


def test_16_employee_cannot_archive_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Archive Protected",
        "description": "Employee cannot archive this.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]
    client.patch(f"/api/announcements/{announcement_id}/publish")

    as_user(setup_data["emp_user_id"])
    res = client.patch(f"/api/announcements/{announcement_id}/archive")
    assert res.status_code == 403


def test_17_invalid_status_transitions_are_rejected(setup_data):
    as_user(setup_data["hr_user_id"])

    # 1. Archiving a DRAFT announcement directly is invalid
    draft_res = client.post("/api/announcements", json={
        "title": "Direct Archive Attempt",
        "description": "Cannot archive draft.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    draft_id = draft_res.json()["id"]
    arch_draft_res = client.patch(f"/api/announcements/{draft_id}/archive")
    assert arch_draft_res.status_code == 400
    assert "Only PUBLISHED announcements can be archived" in arch_draft_res.json()["detail"]

    # 2. Publishing an already PUBLISHED announcement is invalid
    client.patch(f"/api/announcements/{draft_id}/publish")
    re_pub_res = client.patch(f"/api/announcements/{draft_id}/publish")
    assert re_pub_res.status_code == 400
    assert "Only DRAFT announcements can be published" in re_pub_res.json()["detail"]

    # 3. Publishing an ARCHIVED announcement directly is invalid
    client.patch(f"/api/announcements/{draft_id}/archive")
    pub_arch_res = client.patch(f"/api/announcements/{draft_id}/publish")
    assert pub_arch_res.status_code == 400
    assert "Only DRAFT announcements can be published" in pub_arch_res.json()["detail"]

    # 4. Archiving an already ARCHIVED announcement is invalid
    re_arch_res = client.patch(f"/api/announcements/{draft_id}/archive")
    assert re_arch_res.status_code == 400
    assert "Only PUBLISHED announcements can be archived" in re_arch_res.json()["detail"]

    # 5. Updating an ARCHIVED announcement is invalid
    up_arch_res = client.put(f"/api/announcements/{draft_id}", json={
        "title": "New Title",
    })
    assert up_arch_res.status_code == 400
    assert "Archived announcements cannot be updated" in up_arch_res.json()["detail"]


def test_18_search_works(setup_data):
    as_user(setup_data["hr_user_id"])
    unique_word = f"Kaleidoscope_{datetime.now().timestamp()}"
    client.post("/api/announcements", json={
        "title": f"Notice with {unique_word}",
        "description": "Regular text body.",
        "category": AnnouncementCategory.GENERAL.value,
    })

    # HR search
    res = client.get(f"/api/announcements?search={unique_word}")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert unique_word in data["announcements"][0]["title"]


def test_19_category_filter_works(setup_data):
    as_user(setup_data["hr_user_id"])
    client.post("/api/announcements", json={
        "title": "Holiday Gala",
        "description": "Holiday announcement.",
        "category": AnnouncementCategory.HOLIDAY.value,
    })

    res = client.get(f"/api/announcements?category={AnnouncementCategory.HOLIDAY.value}")
    assert res.status_code == 200
    for item in res.json()["announcements"]:
        assert item["category"] == AnnouncementCategory.HOLIDAY.value


def test_20_priority_filter_works(setup_data):
    as_user(setup_data["hr_user_id"])
    client.post("/api/announcements", json={
        "title": "Urgent Server Maintenance",
        "description": "Tonight at 11 PM.",
        "category": AnnouncementCategory.IMPORTANT.value,
        "priority": AnnouncementPriority.URGENT.value,
    })

    res = client.get(f"/api/announcements?priority={AnnouncementPriority.URGENT.value}")
    assert res.status_code == 200
    for item in res.json()["announcements"]:
        assert item["priority"] == AnnouncementPriority.URGENT.value


def test_21_pagination_works(setup_data):
    as_user(setup_data["hr_user_id"])
    initial_res = client.get("/api/announcements?limit=1&skip=0")
    assert initial_res.status_code == 200
    total = initial_res.json()["total"]
    assert total >= 1

    page1 = client.get("/api/announcements?limit=2&skip=0").json()["announcements"]
    assert len(page1) <= 2
    if total >= 2:
        page2 = client.get("/api/announcements?limit=1&skip=1").json()["announcements"]
        assert len(page2) == 1
        assert page2[0]["id"] == page1[1]["id"]


def test_22_hr_can_delete_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Delete Target",
        "description": "To be deleted.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]

    del_res = client.delete(f"/api/announcements/{announcement_id}")
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Announcement deleted successfully"

    # Verify 404 after deletion
    get_res = client.get(f"/api/announcements/{announcement_id}")
    assert get_res.status_code == 404


def test_23_employee_cannot_delete_announcement(setup_data):
    as_user(setup_data["hr_user_id"])
    create_res = client.post("/api/announcements", json={
        "title": "Delete Forbidden Target",
        "description": "Employee cannot delete this.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = create_res.json()["id"]

    as_user(setup_data["emp_user_id"])
    del_res = client.delete(f"/api/announcements/{announcement_id}")
    assert del_res.status_code == 403


def test_24_expired_date_validation_works(setup_data):
    as_user(setup_data["hr_user_id"])
    past_time = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    # Past expiration date on creation rejected
    create_res = client.post("/api/announcements", json={
        "title": "Past Expiry Test",
        "description": "Should fail.",
        "category": AnnouncementCategory.GENERAL.value,
        "expires_at": past_time,
    })
    assert create_res.status_code == 400
    assert "Expiration date must be in the future" in create_res.json()["detail"]

    # Past expiration date on update rejected
    good_res = client.post("/api/announcements", json={
        "title": "Valid Expiry Initially",
        "description": "Will attempt invalid update.",
        "category": AnnouncementCategory.GENERAL.value,
    })
    announcement_id = good_res.json()["id"]

    update_res = client.put(f"/api/announcements/{announcement_id}", json={
        "expires_at": past_time,
    })
    assert update_res.status_code == 400
    assert "Expiration date must be in the future" in update_res.json()["detail"]


def test_25_already_expired_announcement_cannot_be_published(setup_data, db_session: Session):
    as_user(setup_data["hr_user_id"])
    future_time = datetime.now(timezone.utc) + timedelta(hours=1)

    create_res = client.post("/api/announcements", json={
        "title": "Soon To Expire Draft",
        "description": "Will be expired before publish.",
        "category": AnnouncementCategory.GENERAL.value,
        "expires_at": future_time.isoformat(),
    })
    announcement_id = create_res.json()["id"]

    # Modify expires_at in DB directly to simulate expiration before publish
    record = db_session.query(Announcement).filter(Announcement.id == announcement_id).first()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    # Attempt to publish without supplying new expiry
    pub_res = client.patch(f"/api/announcements/{announcement_id}/publish")
    assert pub_res.status_code == 400
    assert "expiration date in the past" in pub_res.json()["detail"]
