import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal
from app.main import app
from app.policy_service.models import Policy
from app.notification_service.models import Notification

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_users():
    """Ensure HR and Employee test users exist."""
    db = SessionLocal()
    try:
        hr_user = db.query(User).filter(User.email == "test_hr_policy@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_hr_policy@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        emp_user = db.query(User).filter(User.email == "test_emp_policy@hrms.com").first()
        if not emp_user:
            emp_user = User(
                email="test_emp_policy@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp_user)
            db.commit()
            db.refresh(emp_user)

        return {"hr": hr_user, "emp": emp_user}
    finally:
        db.close()


def test_unauthenticated_access_rejected():
    """Unauthenticated requests must be rejected with 401."""
    app.dependency_overrides.clear()
    res = client.get("/api/policies")
    assert res.status_code == 401


def test_hr_can_list_all_policies(setup_users):
    """HR can list all policies and receives exactly 20 policies."""
    hr = setup_users["hr"]
    app.dependency_overrides[get_current_user] = lambda: hr

    res = client.get("/api/policies")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "policies" in data
    assert data["total"] == 20
    assert len(data["policies"]) == 20


def test_employee_can_list_all_policies(setup_users):
    """Employee can list all policies and receives identical policies."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    res = client.get("/api/policies")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 20
    assert len(data["policies"]) == 20


def test_category_filters(setup_users):
    """Category filter correctly partitions the 20 policies across the 6 categories."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    expected_categories = {
        "OFFICE RULES": 3,
        "LEAVE POLICIES": 3,
        "ATTENDANCE": 3,
        "WORKPLACE CONDUCT": 4,
        "TECHNOLOGY & SECURITY": 4,
        "EMPLOYEE GUIDELINES": 3,
    }

    for category, expected_count in expected_categories.items():
        res = client.get("/api/policies", params={"category": category})
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == expected_count
        assert len(data["policies"]) == expected_count
        for policy in data["policies"]:
            assert policy["category"] == category


def test_search_by_title(setup_users):
    """Search by title returns matching policies."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    res = client.get("/api/policies?search=Etiquette")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any("Etiquette" in p["title"] for p in data["policies"])


def test_search_by_content(setup_users):
    """Search by content returns matching policies."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    res = client.get("/api/policies?search=confidential")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1


def test_pagination(setup_users):
    """Pagination parameters skip and limit work as expected."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    res = client.get("/api/policies?skip=0&limit=5")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 20
    assert len(data["policies"]) == 5
    assert data["skip"] == 0
    assert data["limit"] == 5

    res2 = client.get("/api/policies?skip=5&limit=5")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["policies"]) == 5
    # IDs should not overlap
    ids1 = [p["id"] for p in data["policies"]]
    ids2 = [p["id"] for p in data2["policies"]]
    assert set(ids1).isdisjoint(set(ids2))


def test_get_policy_by_id(setup_users):
    """Get single policy details by ID."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    list_res = client.get("/api/policies?limit=1")
    policy_id = list_res.json()["policies"][0]["id"]

    res = client.get(f"/api/policies/{policy_id}")
    assert res.status_code == 200
    p = res.json()
    assert p["id"] == policy_id
    assert p["status"] == "PUBLISHED"
    assert "content" in p and len(p["content"]) > 20
    assert "effective_date" in p


def test_get_policy_by_invalid_id(setup_users):
    """Nonexistent policy returns 404."""
    emp = setup_users["emp"]
    app.dependency_overrides[get_current_user] = lambda: emp

    res = client.get("/api/policies/999999")
    assert res.status_code == 404


def test_strictly_read_only(setup_users):
    """Verification that no POST, PUT, PATCH, or DELETE endpoints exist for policies."""
    hr = setup_users["hr"]
    app.dependency_overrides[get_current_user] = lambda: hr

    # POST /api/policies
    res = client.post("/api/policies", json={"title": "Test"})
    assert res.status_code == 405  # Method Not Allowed

    # PUT /api/policies/1
    res = client.put("/api/policies/1", json={"title": "Test"})
    assert res.status_code == 405

    # PATCH /api/policies/1
    res = client.patch("/api/policies/1", json={"title": "Test"})
    assert res.status_code == 405

    # DELETE /api/policies/1
    res = client.delete("/api/policies/1")
    assert res.status_code == 405

    # Nonexistent custom actions
    res = client.post("/api/policies/1/publish")
    assert res.status_code in [404, 405]

    res = client.post("/api/policies/1/archive")
    assert res.status_code in [404, 405]


def test_no_notifications_generated_on_policy_view(setup_users):
    """Viewing policies must not create any notification records."""
    hr = setup_users["hr"]
    app.dependency_overrides[get_current_user] = lambda: hr

    db = SessionLocal()
    try:
        initial_notif_count = db.query(Notification).count()
    finally:
        db.close()

    # View list
    res1 = client.get("/api/policies")
    assert res1.status_code == 200

    # View details
    res2 = client.get("/api/policies/1")
    assert res2.status_code == 200

    db = SessionLocal()
    try:
        after_notif_count = db.query(Notification).count()
        assert after_notif_count == initial_notif_count, "No notifications should be generated when viewing policies!"
    finally:
        db.close()
        app.dependency_overrides.clear()
