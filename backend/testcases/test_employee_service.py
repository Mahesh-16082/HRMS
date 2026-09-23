from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal
from app.employee_service.models import Employee, EmploymentStatus
from app.main import app


client = TestClient(app)


# ============================================================
# FIXTURES & TEST SETUP
# ============================================================

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module")
def test_users(db_session: Session):
    # Ensure HR user exists with Employee profile
    hr_emp = (
        db_session.query(Employee)
        .join(User, Employee.user_id == User.id)
        .filter(User.role == "hr", User.is_active.is_(True), Employee.deleted_at.is_(None))
        .first()
    )
    if not hr_emp:
        hr_user = db_session.query(User).filter(User.role == "hr", User.is_active.is_(True)).first()
        if not hr_user:
            hr_user = User(
                email="test_hr_profile@hrms.com",
                full_name="Mahesh Seereddy",
                role="hr",
                is_active=True,
                is_verified=True,
            )
            db_session.add(hr_user)
            db_session.commit()
            db_session.refresh(hr_user)

        from app.employee_service.service import generate_next_employee_code
        hr_emp = Employee(
            user_id=hr_user.id,
            employee_code=generate_next_employee_code(db_session),
            first_name="Mahesh",
            last_name="Seereddy",
            employment_status=EmploymentStatus.ACTIVE,
        )
        db_session.add(hr_emp)
        db_session.commit()
        db_session.refresh(hr_emp)
    hr_user = hr_emp.user

    # Ensure Employee user exists with Employee profile
    emp_emp = (
        db_session.query(Employee)
        .join(User, Employee.user_id == User.id)
        .filter(User.role == "employee", User.is_active.is_(True), Employee.deleted_at.is_(None))
        .first()
    )
    if not emp_emp:
        emp_user = db_session.query(User).filter(User.role == "employee", User.is_active.is_(True)).first()
        if not emp_user:
            emp_user = User(
                email="test_emp_profile@hrms.com",
                full_name="Ravi Kumar",
                role="employee",
                is_active=True,
                is_verified=True,
            )
            db_session.add(emp_user)
            db_session.commit()
            db_session.refresh(emp_user)

        from app.employee_service.service import generate_next_employee_code
        emp_emp = Employee(
            user_id=emp_user.id,
            employee_code=generate_next_employee_code(db_session),
            first_name="Ravi",
            last_name="Kumar",
            employment_status=EmploymentStatus.ACTIVE,
        )
        db_session.add(emp_emp)
        db_session.commit()
        db_session.refresh(emp_emp)
    emp_user = emp_emp.user

    return {
        "hr_user": hr_user,
        "hr_employee": hr_emp,
        "emp_user": emp_user,
        "emp_employee": emp_emp,
    }


def as_user(user: User):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    app.dependency_overrides.clear()


# ============================================================
# GET MY PROFILE
# ============================================================

def test_hr_get_own_profile(test_users):
    as_user(test_users["hr_user"])
    response = client.get("/api/employees/me/profile")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == test_users["hr_employee"].id
    assert data["user_id"] == test_users["hr_user"].id
    assert data["employee_code"] == test_users["hr_employee"].employee_code
    assert "first_name" in data
    assert "last_name" in data
    assert "email" in data
    assert data["email"] == test_users["hr_user"].email
    assert data["employment_status"] == "ACTIVE"


def test_employee_get_own_profile(test_users):
    as_user(test_users["emp_user"])
    response = client.get("/api/employees/me/profile")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == test_users["emp_employee"].id
    assert data["employee_code"] == test_users["emp_employee"].employee_code
    assert "first_name" in data
    assert "last_name" in data
    assert "email" in data


# ============================================================
# EMPLOYEE PROFILE UPDATE
# ============================================================

def test_employee_update_own_profile(test_users):
    as_user(test_users["emp_user"])
    payload = {
        "first_name": "UpdatedEmp",
        "last_name": "Kumar",
        "phone": "9876543210",
        "date_of_birth": "2002-01-15",
        "address": "Hyderabad",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["first_name"] == "UpdatedEmp"
    assert data["last_name"] == "Kumar"
    assert data["phone"] == "9876543210"
    assert data["address"] == "Hyderabad"


def test_employee_cannot_update_email(test_users):
    as_user(test_users["emp_user"])
    payload = {
        "first_name": "UpdatedEmp",
        "last_name": "Kumar",
        "email": "hacked_email@hrms.com",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 400
    assert "Employees cannot change their email address" in response.json()["detail"]


# ============================================================
# HR PROFILE UPDATE (SELF-EDITING)
# ============================================================

def test_hr_can_update_own_name_and_phone(test_users):
    as_user(test_users["hr_user"])
    payload = {
        "first_name": "MaheshUpdated",
        "last_name": "SeereddyAdmin",
        "phone": "+1 (555) 123-4567",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["first_name"] == "MaheshUpdated"
    assert data["last_name"] == "SeereddyAdmin"
    assert data["phone"] == "+1 (555) 123-4567"


def test_hr_can_update_own_email(test_users, db_session: Session):
    as_user(test_users["hr_user"])
    original_email = test_users["hr_user"].email
    new_email = f"hr_updated_{int(datetime.now(timezone.utc).timestamp())}@hrms.com"
    payload = {
        "first_name": "MaheshUpdated",
        "last_name": "SeereddyAdmin",
        "email": new_email,
        "phone": "+1 (555) 123-4567",
    }

    try:
        response = client.put(
            "/api/employees/me/profile",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == new_email

        # Verify directly in the database
        db_session.expire_all()
        updated_user = db_session.query(User).filter(User.id == test_users["hr_user"].id).first()
        assert updated_user.email == new_email
    finally:
        # Restore original email
        client.put(
            "/api/employees/me/profile",
            json={"email": original_email},
        )
        db_session.expire_all()




def test_hr_update_email_conflict_rejected(test_users):
    as_user(test_users["hr_user"])
    # Attempt to change to Employee's existing email
    payload = {
        "first_name": "Mahesh",
        "last_name": "Seereddy",
        "email": test_users["emp_user"].email,
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 409
    assert "A user with this email address already exists" in response.json()["detail"]


# ============================================================
# BACKEND PROTECTION: REJECT PROTECTED FIELDS
# ============================================================

def test_hr_cannot_update_employee_code(test_users):
    as_user(test_users["hr_user"])
    payload = {
        "first_name": "Mahesh",
        "employee_code": "HACKED_EMP_01",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 400
    assert "Modifying protected field 'employee_code' is strictly prohibited" in response.json()["detail"]


def test_hr_cannot_update_role(test_users):
    as_user(test_users["hr_user"])
    payload = {
        "first_name": "Mahesh",
        "role": "superadmin",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 400
    assert "Modifying protected field 'role' is strictly prohibited" in response.json()["detail"]


def test_hr_cannot_update_employment_status_in_profile(test_users):
    as_user(test_users["hr_user"])
    payload = {
        "first_name": "Mahesh",
        "employment_status": "TERMINATED",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 400
    assert "Modifying protected field 'employment_status' is strictly prohibited" in response.json()["detail"]


def test_hr_cannot_update_joining_date(test_users):
    as_user(test_users["hr_user"])
    payload = {
        "first_name": "Mahesh",
        "joining_date": "2020-01-01",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
    )

    assert response.status_code == 400
    assert "Modifying protected field 'joining_date' is strictly prohibited" in response.json()["detail"]


# ============================================================
# HR UPDATE ANOTHER EMPLOYEE
# ============================================================

def test_hr_update_employee(test_users):
    as_user(test_users["hr_user"])
    emp_id = test_users["emp_employee"].id
    payload = {
        "first_name": "HRUpdatedName",
        "last_name": "Employee",
        "phone": "8888888888",
    }

    response = client.put(
        f"/api/employees/{emp_id}",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == emp_id
    assert data["first_name"] == "HRUpdatedName"
    assert data["phone"] == "8888888888"


def test_employee_cannot_update_another_employee(test_users):
    as_user(test_users["emp_user"])
    hr_emp_id = test_users["hr_employee"].id
    payload = {
        "first_name": "Unauthorized",
        "last_name": "Update",
    }

    response = client.put(
        f"/api/employees/{hr_emp_id}",
        json=payload,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can update employees."


# ============================================================
# EMPLOYEE LIST & COUNTS
# ============================================================

def test_hr_can_list_employees(test_users):
    as_user(test_users["hr_user"])
    response = client.get("/api/employees")

    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "employees" in data
    assert isinstance(data["employees"], list)


def test_employee_cannot_list_employees(test_users):
    as_user(test_users["emp_user"])
    response = client.get("/api/employees")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can view the employee list."


def test_hr_can_get_employee(test_users):
    as_user(test_users["hr_user"])
    emp_id = test_users["emp_employee"].id
    response = client.get(f"/api/employees/{emp_id}")

    assert response.status_code == 200
    assert response.json()["id"] == emp_id


def test_employee_cannot_get_employee_by_id(test_users):
    as_user(test_users["emp_user"])
    hr_emp_id = test_users["hr_employee"].id
    response = client.get(f"/api/employees/{hr_emp_id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can view employee details."


def test_hr_can_get_employee_counts(test_users):
    as_user(test_users["hr_user"])
    response = client.get("/api/employees/dashboard/counts")

    assert response.status_code == 200
    assert isinstance(response.json(), dict)


def test_employee_cannot_get_employee_counts(test_users):
    as_user(test_users["emp_user"])
    response = client.get("/api/employees/dashboard/counts")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can view employee statistics."


# ============================================================
# STATUS & ARCHIVE SAFETY CHECKS
# ============================================================

def test_hr_cannot_change_own_status(test_users):
    as_user(test_users["hr_user"])
    hr_emp_id = test_users["hr_employee"].id
    payload = {"employment_status": "INACTIVE"}

    response = client.patch(
        f"/api/employees/{hr_emp_id}/status",
        json=payload,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You cannot change your own employment status."


def test_hr_cannot_deactivate_self(test_users):
    as_user(test_users["hr_user"])
    hr_emp_id = test_users["hr_employee"].id
    response = client.patch(f"/api/employees/{hr_emp_id}/deactivate")

    assert response.status_code == 403
    assert response.json()["detail"] == "You cannot activate or deactivate your own account."


def test_hr_cannot_activate_self(test_users):
    as_user(test_users["hr_user"])
    hr_emp_id = test_users["hr_employee"].id
    response = client.patch(f"/api/employees/{hr_emp_id}/activate")

    assert response.status_code == 403
    assert response.json()["detail"] == "You cannot activate or deactivate your own account."


def test_employee_cannot_change_employee_status(test_users):
    as_user(test_users["emp_user"])
    emp_id = test_users["emp_employee"].id
    payload = {"employment_status": "INACTIVE"}

    response = client.patch(
        f"/api/employees/{emp_id}/status",
        json=payload,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can change employee status."


def test_employee_cannot_activate_employee(test_users):
    as_user(test_users["emp_user"])
    emp_id = test_users["emp_employee"].id
    response = client.patch(f"/api/employees/{emp_id}/activate")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can activate employees."


def test_employee_cannot_deactivate_employee(test_users):
    as_user(test_users["emp_user"])
    emp_id = test_users["emp_employee"].id
    response = client.patch(f"/api/employees/{emp_id}/deactivate")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can deactivate employees."


def test_hr_cannot_archive_self(test_users):
    as_user(test_users["hr_user"])
    hr_emp_id = test_users["hr_employee"].id
    response = client.delete(f"/api/employees/{hr_emp_id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "You cannot archive your own employee profile."


def test_employee_cannot_archive_employee(test_users):
    as_user(test_users["emp_user"])
    emp_id = test_users["emp_employee"].id
    response = client.delete(f"/api/employees/{emp_id}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Only HR can archive employees."