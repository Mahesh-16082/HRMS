import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


# ============================================================
# TEST DATA
# ============================================================

HR_EMPLOYEE_ID = 3
EMPLOYEE_ID = 2


# ============================================================
# AUTHENTICATION
# ============================================================
#
# These tests assume your authentication uses Bearer JWT.
# Replace these tokens with valid tokens when testing.
#
# You can also load them from environment variables later.
# ============================================================

HR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJtYWhlc2hzZWVyZWRkeUBnbWFpbC5jb20iLCJyb2xlIjoiaHIiLCJzZXNzaW9uX2lkIjoiUjFMYkt5dlE1aUUyRnNuMUY5NGdES0FiOEJ6VFRTd0NnV1YwbktXcDV2ZyIsImV4cCI6MTc4OTk4NDE0Mn0.GTLLnjTNZ35_vSCWBY3rcTWx4cHutnyWJIJ0Z3j3FH0"
EMPLOYEE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiZW1haWwiOiJtYWhlc2hzZXRyZWRkeUBnbWFpbC5jb20iLCJyb2xlIjoiZW1wbG95ZWUiLCJzZXNzaW9uX2lkIjoiZHhhTl9pTExPZ1pUdnd1MnlSaU1NWlRmYmtYYVBvSC1HSTM0MmVnckVvOCIsImV4cCI6MTc4OTk4NDI4OX0.JsUheSwQJNL80IeAe5xKah0KCumaXJ00inVZpNdVXo8"


def hr_headers():
    return {
        "Authorization": f"Bearer {HR_TOKEN}"
    }


def employee_headers():
    return {
        "Authorization": f"Bearer {EMPLOYEE_TOKEN}"
    }


# ============================================================
# GET MY PROFILE
# ============================================================

def test_hr_get_own_profile():
    response = client.get(
        "/api/employees/me/profile",
        headers=hr_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert "id" in data
    assert "user_id" in data
    assert "employee_code" in data
    assert "first_name" in data
    assert "last_name" in data
    assert "employment_status" in data


def test_employee_get_own_profile():
    response = client.get(
        "/api/employees/me/profile",
        headers=employee_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert "id" in data
    assert "employee_code" in data
    assert "first_name" in data
    assert "last_name" in data


# ============================================================
# EMPLOYEE PROFILE UPDATE
# ============================================================

def test_employee_update_own_profile():
    payload = {
        "first_name": "Updated",
        "last_name": "Employee",
        "phone": "9876543210",
        "date_of_birth": "2002-01-15",
        "address": "Hyderabad",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
        headers=employee_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["first_name"] == "Updated"
    assert data["last_name"] == "Employee"
    assert data["phone"] == "9876543210"
    assert data["address"] == "Hyderabad"


def test_hr_cannot_use_employee_self_update():
    payload = {
        "first_name": "HR Updated",
        "last_name": "Name",
        "phone": "9999999999",
    }

    response = client.put(
        "/api/employees/me/profile",
        json=payload,
        headers=hr_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only employees can update their own profile."
    )


# ============================================================
# HR UPDATE ANOTHER EMPLOYEE
# ============================================================

def test_hr_update_employee():
    payload = {
        "first_name": "HR Updated",
        "last_name": "Employee",
        "phone": "8888888888",
    }

    response = client.put(
        f"/api/employees/{EMPLOYEE_ID}",
        json=payload,
        headers=hr_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == EMPLOYEE_ID
    assert data["first_name"] == "HR Updated"
    assert data["last_name"] == "Employee"
    assert data["phone"] == "8888888888"


def test_employee_cannot_update_another_employee():
    payload = {
        "first_name": "Unauthorized",
        "last_name": "Update",
    }

    response = client.put(
        f"/api/employees/{HR_EMPLOYEE_ID}",
        json=payload,
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can update employees."
    )


# ============================================================
# EMPLOYEE LIST
# ============================================================

def test_hr_can_list_employees():
    response = client.get(
        "/api/employees",
        headers=hr_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert "total" in data
    assert "employees" in data

    assert isinstance(data["employees"], list)


def test_employee_cannot_list_employees():
    response = client.get(
        "/api/employees",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can view the employee list."
    )


# ============================================================
# GET EMPLOYEE BY ID
# ============================================================

def test_hr_can_get_employee():
    response = client.get(
        f"/api/employees/{EMPLOYEE_ID}",
        headers=hr_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == EMPLOYEE_ID


def test_employee_cannot_get_employee_by_id():
    response = client.get(
        f"/api/employees/{HR_EMPLOYEE_ID}",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can view employee details."
    )


# ============================================================
# EMPLOYEE COUNTS
# ============================================================

def test_hr_can_get_employee_counts():
    response = client.get(
        "/api/employees/dashboard/counts",
        headers=hr_headers(),
    )

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, dict)


def test_employee_cannot_get_employee_counts():
    response = client.get(
        "/api/employees/dashboard/counts",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can view employee statistics."
    )


# ============================================================
# HR STATUS MANAGEMENT
# ============================================================

def test_hr_cannot_change_own_status():
    payload = {
        "employment_status": "INACTIVE"
    }

    response = client.patch(
        f"/api/employees/{HR_EMPLOYEE_ID}/status",
        json=payload,
        headers=hr_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "You cannot change your own employment status."
    )


def test_hr_cannot_deactivate_self():
    response = client.patch(
        f"/api/employees/{HR_EMPLOYEE_ID}/deactivate",
        headers=hr_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "You cannot activate or deactivate your own account."
    )


def test_hr_cannot_activate_self():
    response = client.patch(
        f"/api/employees/{HR_EMPLOYEE_ID}/activate",
        headers=hr_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "You cannot activate or deactivate your own account."
    )


# ============================================================
# EMPLOYEE STATUS MANAGEMENT
# ============================================================

def test_employee_cannot_change_employee_status():
    payload = {
        "employment_status": "INACTIVE"
    }

    response = client.patch(
        f"/api/employees/{EMPLOYEE_ID}/status",
        json=payload,
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can change employee status."
    )


def test_employee_cannot_activate_employee():
    response = client.patch(
        f"/api/employees/{EMPLOYEE_ID}/activate",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can activate employees."
    )


def test_employee_cannot_deactivate_employee():
    response = client.patch(
        f"/api/employees/{EMPLOYEE_ID}/deactivate",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can deactivate employees."
    )


# ============================================================
# ARCHIVE
# ============================================================

def test_hr_cannot_archive_self():
    response = client.delete(
        f"/api/employees/{HR_EMPLOYEE_ID}",
        headers=hr_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "You cannot archive your own employee profile."
    )


def test_employee_cannot_archive_employee():
    response = client.delete(
        f"/api/employees/{EMPLOYEE_ID}",
        headers=employee_headers(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Only HR can archive employees."
    )