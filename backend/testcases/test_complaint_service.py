from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.complaint_service.models import Complaint, ComplaintPriority, ComplaintStatus
from app.core.database import SessionLocal
from app.employee_service.models import Employee, EmploymentStatus
from app.main import app


client = TestClient(app)


# ============================================================
# FIXTURES & TEST SETUP
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
    """
    Ensure we have:
    - 1 HR user
    - 2 Active employee users with Employee profiles
    - 1 Inactive employee user with Inactive profile
    """
    db = SessionLocal()
    try:
        # 1. HR User
        hr_user = db.query(User).filter(User.email == "test_hr_complaints@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_hr_complaints@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        # 2. Employee 1 (Active)
        emp1_user = db.query(User).filter(User.email == "test_emp1_complaints@hrms.com").first()
        if not emp1_user:
            emp1_user = User(
                email="test_emp1_complaints@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp1_user)
            db.commit()
            db.refresh(emp1_user)

        emp1_profile = db.query(Employee).filter(Employee.user_id == emp1_user.id).first()
        if not emp1_profile:
            emp1_profile = Employee(
                user_id=emp1_user.id,
                employee_code="EMP_COMP_01",
                first_name="Alice",
                last_name="Complainant",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp1_profile)
            db.commit()
            db.refresh(emp1_profile)

        # 3. Employee 2 (Active)
        emp2_user = db.query(User).filter(User.email == "test_emp2_complaints@hrms.com").first()
        if not emp2_user:
            emp2_user = User(
                email="test_emp2_complaints@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp2_user)
            db.commit()
            db.refresh(emp2_user)

        emp2_profile = db.query(Employee).filter(Employee.user_id == emp2_user.id).first()
        if not emp2_profile:
            emp2_profile = Employee(
                user_id=emp2_user.id,
                employee_code="EMP_COMP_02",
                first_name="Bob",
                last_name="Complainant",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp2_profile)
            db.commit()
            db.refresh(emp2_profile)

        # 4. Inactive Employee (Terminated)
        emp_inactive_user = db.query(User).filter(User.email == "test_emp_inactive_complaints@hrms.com").first()
        if not emp_inactive_user:
            emp_inactive_user = User(
                email="test_emp_inactive_complaints@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp_inactive_user)
            db.commit()
            db.refresh(emp_inactive_user)

        emp_inactive_profile = db.query(Employee).filter(Employee.user_id == emp_inactive_user.id).first()
        if not emp_inactive_profile:
            emp_inactive_profile = Employee(
                user_id=emp_inactive_user.id,
                employee_code="EMP_COMP_03",
                first_name="Charlie",
                last_name="Inactive",
                employment_status=EmploymentStatus.TERMINATED,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp_inactive_profile)
            db.commit()
            db.refresh(emp_inactive_profile)
        else:
            emp_inactive_profile.employment_status = EmploymentStatus.TERMINATED
            db.commit()

        # Clean existing test complaints created by these test employees to ensure isolation
        db.query(Complaint).filter(
            Complaint.employee_id.in_([emp1_profile.id, emp2_profile.id, emp_inactive_profile.id])
        ).delete(synchronize_session=False)
        db.commit()

        return {
            "hr_user_id": hr_user.id,
            "emp1_user_id": emp1_user.id,
            "emp1_profile_id": emp1_profile.id,
            "emp2_user_id": emp2_user.id,
            "emp2_profile_id": emp2_profile.id,
            "emp_inactive_user_id": emp_inactive_user.id,
            "emp_inactive_profile_id": emp_inactive_profile.id,
        }
    finally:
        db.close()


def as_user_id(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    app.dependency_overrides.clear()


# ============================================================
# 22 COMPLAINT SERVICE TEST CASES
# ============================================================

# 1. Employee can create a complaint
def test_01_employee_can_create_complaint(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    response = client.post(
        "/api/complaints",
        json={
            "subject": "Broken air conditioning",
            "description": "The AC in room 302 has completely stopped cooling.",
            "category": "Facilities",
            "priority": "HIGH",
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["id"] is not None
    assert res["employee_id"] == data["emp1_profile_id"]
    assert res["subject"] == "Broken air conditioning"
    assert res["description"] == "The AC in room 302 has completely stopped cooling."
    assert res["category"] == "Facilities"
    assert res["priority"] == "HIGH"
    assert res["status"] == "OPEN"
    assert res["hr_remarks"] is None
    assert res["resolved_at"] is None
    assert res["employee"]["employee_code"] == "EMP_COMP_01"


# 2. Employee cannot create complaint for another employee (extra field rejected with 422)
def test_02_employee_cannot_create_complaint_for_another_employee(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # Attempting to supply employee_id in request body
    response = client.post(
        "/api/complaints",
        json={
            "subject": "Spoofed complaint",
            "description": "Attempting to assign complaint to employee 2",
            "category": "Security",
            "priority": "LOW",
            "employee_id": data["emp2_profile_id"],
        },
    )

    # Extra field is forbidden by Pydantic schema
    assert response.status_code == 422


# 3. Employee can list own complaints
def test_03_employee_can_list_own_complaints(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    response = client.get("/api/complaints/me")
    assert response.status_code == 200
    res = response.json()
    assert "total" in res
    assert res["total"] >= 1
    assert all(c["employee_id"] == data["emp1_profile_id"] for c in res["complaints"])


# 4. Employee cannot access another employee's complaint (403)
def test_04_employee_cannot_access_another_employee_complaint(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # Create a complaint by emp1
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Emp1 private complaint",
            "description": "This is emp1's private issue.",
            "category": "Payroll",
            "priority": "MEDIUM",
        },
    )
    assert create_res.status_code == 201
    complaint_id = create_res.json()["id"]

    # Now switch to emp2 and try to access it
    as_user_id(db_session, data["emp2_user_id"])
    response = client.get(f"/api/complaints/me/{complaint_id}")
    assert response.status_code == 403
    assert "permission" in response.json()["detail"].lower()


# 5. Employee can update an OPEN complaint
def test_05_employee_can_update_open_complaint(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # Create an open complaint
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Initial subject line",
            "description": "Initial complaint description text.",
            "category": "Equipment",
            "priority": "LOW",
        },
    )
    assert create_res.status_code == 201
    complaint_id = create_res.json()["id"]

    # Update the open complaint
    update_res = client.put(
        f"/api/complaints/me/{complaint_id}",
        json={
            "subject": "Updated subject line",
            "description": "Updated complaint description text with more details.",
            "priority": "MEDIUM",
        },
    )
    assert update_res.status_code == 200
    res = update_res.json()
    assert res["subject"] == "Updated subject line"
    assert res["description"] == "Updated complaint description text with more details."
    assert res["priority"] == "MEDIUM"
    assert res["status"] == "OPEN"


# 6. Employee cannot update a non-OPEN complaint (400)
def test_06_employee_cannot_update_non_open_complaint(setup_data, db_session: Session):
    data = setup_data
    # 1. Create open complaint by emp1
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Moving to in progress",
            "description": "This will soon be changed to IN_PROGRESS.",
            "category": "IT",
            "priority": "MEDIUM",
        },
    )
    complaint_id = create_res.json()["id"]

    # 2. HR transitions it to IN_PROGRESS
    as_user_id(db_session, data["hr_user_id"])
    patch_res = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "IN_PROGRESS", "hr_remarks": "Assigned to tech team"},
    )
    assert patch_res.status_code == 200

    # 3. Employee attempts to update now
    as_user_id(db_session, data["emp1_user_id"])
    update_res = client.put(
        f"/api/complaints/me/{complaint_id}",
        json={"subject": "Trying to edit in progress complaint"},
    )
    assert update_res.status_code == 400
    assert "OPEN" in update_res.json()["detail"]


# 7. Employee cannot change complaint status
def test_07_employee_cannot_change_complaint_status(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # Create complaint
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Testing status immutability",
            "description": "Employee should not be able to set status.",
            "category": "Admin",
            "priority": "LOW",
        },
    )
    complaint_id = create_res.json()["id"]

    # Attempting to pass status in PUT request
    response = client.put(
        f"/api/complaints/me/{complaint_id}",
        json={"status": "RESOLVED"},
    )
    # Extra field forbidden by schema
    assert response.status_code == 422


# 8. Employee cannot modify HR remarks
def test_08_employee_cannot_modify_hr_remarks(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Testing remarks immutability",
            "description": "Employee cannot modify HR remarks.",
            "category": "Admin",
            "priority": "LOW",
        },
    )
    complaint_id = create_res.json()["id"]

    # Attempting to modify hr_remarks via PUT
    response = client.put(
        f"/api/complaints/me/{complaint_id}",
        json={"hr_remarks": "Forged HR remark"},
    )
    # Extra field forbidden by schema
    assert response.status_code == 422


# 9. HR can list all complaints
def test_09_hr_can_list_all_complaints(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    response = client.get("/api/complaints")
    assert response.status_code == 200
    res = response.json()
    assert "total" in res
    assert "complaints" in res
    assert res["total"] >= 1


# 10. HR can filter complaints by status
def test_10_hr_can_filter_complaints_by_status(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    response = client.get("/api/complaints?status=OPEN")
    assert response.status_code == 200
    res = response.json()
    assert all(c["status"] == "OPEN" for c in res["complaints"])


# 11. HR can filter complaints by priority
def test_11_hr_can_filter_complaints_by_priority(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    response = client.get("/api/complaints?priority=HIGH")
    assert response.status_code == 200
    res = response.json()
    assert all(c["priority"] == "HIGH" for c in res["complaints"])


# 12. HR can search complaints
def test_12_hr_can_search_complaints(setup_data, db_session: Session):
    data = setup_data
    # 1. Emp2 creates complaint with unique search term
    as_user_id(db_session, data["emp2_user_id"])
    client.post(
        "/api/complaints",
        json={
            "subject": "UniqueErgonomicChairNeeded",
            "description": "Ergonomic chair is requested for lumbar support.",
            "category": "Workplace",
            "priority": "LOW",
        },
    )

    # 2. HR searches for the keyword
    as_user_id(db_session, data["hr_user_id"])
    response = client.get("/api/complaints?search=UniqueErgonomicChairNeeded")
    assert response.status_code == 200
    res = response.json()
    assert res["total"] >= 1
    assert any("UniqueErgonomicChairNeeded" in c["subject"] for c in res["complaints"])


# 13. HR can view complaint details
def test_13_hr_can_view_complaint_details(setup_data, db_session: Session):
    data = setup_data
    # Create complaint by emp1
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Detailed inspection test",
            "description": "HR should view full details including joined employee.",
            "category": "Operations",
            "priority": "MEDIUM",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR retrieves complaint details
    as_user_id(db_session, data["hr_user_id"])
    response = client.get(f"/api/complaints/{complaint_id}")
    assert response.status_code == 200
    res = response.json()
    assert res["id"] == complaint_id
    assert res["subject"] == "Detailed inspection test"
    assert res["employee"] is not None
    assert res["employee"]["employee_code"] == "EMP_COMP_01"


# 14. HR can change status to IN_PROGRESS
def test_14_hr_can_change_status_to_in_progress(setup_data, db_session: Session):
    data = setup_data
    # Create open complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Transition to In Progress test",
            "description": "Complaint to transition to IN_PROGRESS.",
            "category": "Operations",
            "priority": "MEDIUM",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR transitions to IN_PROGRESS
    as_user_id(db_session, data["hr_user_id"])
    response = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={
            "status": "IN_PROGRESS",
            "hr_remarks": "Investigation in progress.",
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "IN_PROGRESS"
    assert res["hr_remarks"] == "Investigation in progress."
    assert res["resolved_at"] is None


# 15. HR can resolve complaint (status -> RESOLVED)
def test_15_hr_can_resolve_complaint(setup_data, db_session: Session):
    data = setup_data
    # Create open complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Transition to Resolved test",
            "description": "Complaint to transition to RESOLVED directly.",
            "category": "Facilities",
            "priority": "HIGH",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR resolves complaint
    as_user_id(db_session, data["hr_user_id"])
    response = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={
            "status": "RESOLVED",
            "hr_remarks": "Issue resolved successfully.",
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "RESOLVED"
    assert res["hr_remarks"] == "Issue resolved successfully."


# 16. RESOLVED automatically sets resolved_at
def test_16_resolved_automatically_sets_resolved_at(setup_data, db_session: Session):
    data = setup_data
    # Create complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Resolved timestamp test",
            "description": "Verify resolved_at timestamp is automatically populated.",
            "category": "Facilities",
            "priority": "HIGH",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR transitions to RESOLVED
    as_user_id(db_session, data["hr_user_id"])
    response = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "RESOLVED", "hr_remarks": "Done"},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "RESOLVED"
    assert res["resolved_at"] is not None
    # Parse timestamp to ensure validity
    resolved_dt = datetime.fromisoformat(res["resolved_at"])
    assert resolved_dt is not None


# 17. HR can close resolved complaint (status -> CLOSED)
def test_17_hr_can_close_resolved_complaint(setup_data, db_session: Session):
    data = setup_data
    # Create complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Close complaint test",
            "description": "Verify transition from RESOLVED to CLOSED.",
            "category": "Facilities",
            "priority": "LOW",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR resolves first
    as_user_id(db_session, data["hr_user_id"])
    client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "RESOLVED", "hr_remarks": "Resolved step"},
    )

    # HR closes
    response = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "CLOSED", "hr_remarks": "Closed permanently."},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "CLOSED"
    assert res["hr_remarks"] == "Closed permanently."


# 18. CLOSED preserves resolved_at timestamp
def test_18_closed_preserves_resolved_at_timestamp(setup_data, db_session: Session):
    data = setup_data
    # Create complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Preserve timestamp test",
            "description": "Checking resolved_at timestamp preservation on close.",
            "category": "General",
            "priority": "MEDIUM",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR resolves
    as_user_id(db_session, data["hr_user_id"])
    res_step = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "RESOLVED"},
    )
    resolved_at_first = res_step.json()["resolved_at"]
    assert resolved_at_first is not None

    # HR closes
    close_step = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "CLOSED"},
    )
    assert close_step.status_code == 200
    resolved_at_closed = close_step.json()["resolved_at"]
    assert resolved_at_closed == resolved_at_first


# 19. Moving RESOLVED -> IN_PROGRESS clears resolved_at
def test_19_moving_resolved_to_in_progress_clears_resolved_at(setup_data, db_session: Session):
    data = setup_data
    # Create complaint
    as_user_id(db_session, data["emp1_user_id"])
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Reopening resolved complaint",
            "description": "Testing clearing of resolved_at when reopened.",
            "category": "General",
            "priority": "MEDIUM",
        },
    )
    complaint_id = create_res.json()["id"]

    # HR resolves
    as_user_id(db_session, data["hr_user_id"])
    client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "RESOLVED"},
    )

    # HR moves back to IN_PROGRESS
    reopen_res = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "IN_PROGRESS", "hr_remarks": "Reopening issue due to recurring symptom."},
    )
    assert reopen_res.status_code == 200
    res = reopen_res.json()
    assert res["status"] == "IN_PROGRESS"
    assert res["resolved_at"] is None


# 20. Employee receives 403 when accessing HR-only endpoints
def test_20_employee_receives_403_when_accessing_hr_endpoints(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # 1. GET /api/complaints
    r1 = client.get("/api/complaints")
    assert r1.status_code == 403

    # 2. GET /api/complaints/{id}
    r2 = client.get("/api/complaints/1")
    assert r2.status_code == 403

    # 3. PATCH /api/complaints/{id}/status
    r3 = client.patch("/api/complaints/1/status", json={"status": "IN_PROGRESS"})
    assert r3.status_code == 403

    # 4. GET /api/complaints/overview/counts
    r4 = client.get("/api/complaints/overview/counts")
    assert r4.status_code == 403


# 21. Inactive employee cannot create complaint (400)
def test_21_inactive_employee_cannot_create_complaint(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp_inactive_user_id"])

    response = client.post(
        "/api/complaints",
        json={
            "subject": "Inactive employee attempt",
            "description": "Terminated employee attempting to file a complaint.",
            "category": "Payroll",
            "priority": "LOW",
        },
    )
    assert response.status_code == 400
    assert "not active" in response.json()["detail"].lower()


# 22. Complaint validation errors are handled correctly
def test_22_complaint_validation_errors(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # A. Subject too short (< 3 chars)
    r1 = client.post(
        "/api/complaints",
        json={
            "subject": "Hi",
            "description": "Valid description length.",
            "category": "General",
        },
    )
    assert r1.status_code == 422

    # B. Description too short (< 5 chars)
    r2 = client.post(
        "/api/complaints",
        json={
            "subject": "Valid Subject",
            "description": "bad",
            "category": "General",
        },
    )
    assert r2.status_code == 422

    # C. Invalid priority
    r3 = client.post(
        "/api/complaints",
        json={
            "subject": "Valid Subject",
            "description": "Valid description length.",
            "category": "General",
            "priority": "URGENT",  # Invalid enum value
        },
    )
    assert r3.status_code == 422

    # D. Invalid status transition from CLOSED -> OPEN
    # First create a complaint, resolve it, and close it
    create_res = client.post(
        "/api/complaints",
        json={
            "subject": "Lifecycle transition test",
            "description": "Testing invalid transition from CLOSED.",
            "category": "Admin",
            "priority": "LOW",
        },
    )
    complaint_id = create_res.json()["id"]

    as_user_id(db_session, data["hr_user_id"])
    client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "RESOLVED"},
    )
    client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "CLOSED"},
    )

    # Attempt transition from CLOSED to OPEN
    bad_transition_res = client.patch(
        f"/api/complaints/{complaint_id}/status",
        json={"status": "OPEN"},
    )
    assert bad_transition_res.status_code == 400
    assert "Cannot transition" in bad_transition_res.json()["detail"]
