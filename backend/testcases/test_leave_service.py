from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal
from app.employee_service import service as employee_service
from app.employee_service.models import Employee, EmploymentStatus
from app.employee_service.schemas import EmployeeCreate
from app.leave_service import repository as leave_repo
from app.leave_service import service as leave_service
from app.leave_service.models import LeaveBalance, LeaveRequest, LeaveRequestStatus, LeaveType
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
def setup_users_and_employees(db_session: Session):
    """
    Ensure we have:
    - 1 HR user
    - 2 Active employee users with Employee profiles
    - Active leave types: SICK (15), CASUAL (15)
    - Inactive leave type: ANNUAL (0 or 15, is_active=False)
    """
    # 1. Ensure SICK and CASUAL exist and are active with quota 15.0
    sick = leave_repo.get_leave_type_by_code(db_session, "SICK")
    if not sick:
        sick = LeaveType(name="Sick Leave", code="SICK", annual_quota=15.0, is_active=True)
        db_session.add(sick)
    else:
        sick.annual_quota = 15.0
        sick.is_active = True

    casual = leave_repo.get_leave_type_by_code(db_session, "CASUAL")
    if not casual:
        casual = LeaveType(name="Casual Leave", code="CASUAL", annual_quota=15.0, is_active=True)
        db_session.add(casual)
    else:
        casual.annual_quota = 15.0
        casual.is_active = True

    # Ensure ANNUAL is inactive
    annual = leave_repo.get_leave_type_by_code(db_session, "ANNUAL")
    if not annual:
        annual = LeaveType(name="Annual Leave", code="ANNUAL", annual_quota=15.0, is_active=False)
        db_session.add(annual)
    else:
        annual.is_active = False

    # Deactivate any temporary test types
    extra_types = db_session.query(LeaveType).filter(~LeaveType.code.in_(["SICK", "CASUAL"])).all()
    for et in extra_types:
        et.is_active = False

    db_session.commit()

    # 2. HR User
    hr_user = db_session.query(User).filter(User.role == "hr", User.is_active.is_(True)).first()
    if not hr_user:
        hr_user = User(
            email="test_hr_leave@hrms.com",
            role="hr",
            is_active=True,
        )
        db_session.add(hr_user)
        db_session.commit()
        db_session.refresh(hr_user)

    # 3. Employee 1
    emp1_user = db_session.query(User).filter(User.email == "test_emp1_leave@hrms.com").first()
    if not emp1_user:
        emp1_user = User(
            email="test_emp1_leave@hrms.com",
            role="employee",
            is_active=True,
        )
        db_session.add(emp1_user)
        db_session.commit()
        db_session.refresh(emp1_user)

    emp1_profile = db_session.query(Employee).filter(Employee.user_id == emp1_user.id).first()
    if not emp1_profile:
        emp1_profile = Employee(
            user_id=emp1_user.id,
            employee_code="EMP_TEST_01",
            first_name="Alice",
            last_name="Tester",
            employment_status=EmploymentStatus.ACTIVE,
            joining_date=date(2025, 1, 1),
        )
        db_session.add(emp1_profile)
        db_session.commit()
        db_session.refresh(emp1_profile)

    # 4. Employee 2
    emp2_user = db_session.query(User).filter(User.email == "test_emp2_leave@hrms.com").first()
    if not emp2_user:
        emp2_user = User(
            email="test_emp2_leave@hrms.com",
            role="employee",
            is_active=True,
        )
        db_session.add(emp2_user)
        db_session.commit()
        db_session.refresh(emp2_user)

    emp2_profile = db_session.query(Employee).filter(Employee.user_id == emp2_user.id).first()
    if not emp2_profile:
        emp2_profile = Employee(
            user_id=emp2_user.id,
            employee_code="EMP_TEST_02",
            first_name="Bob",
            last_name="Tester",
            employment_status=EmploymentStatus.ACTIVE,
            joining_date=date(2025, 1, 1),
        )
        db_session.add(emp2_profile)
        db_session.commit()
        db_session.refresh(emp2_profile)

    # Clean existing leave requests for test employees on SICK/CASUAL to start cleanly
    db_session.query(LeaveRequest).filter(
        LeaveRequest.employee_id.in_([emp1_profile.id, emp2_profile.id]),
        LeaveRequest.leave_type_id.in_([sick.id, casual.id]),
    ).delete(synchronize_session=False)

    # Ensure balances exist for Alice and Bob
    current_year = datetime.now(timezone.utc).year
    leave_service.ensure_employee_yearly_balances(db_session, emp1_profile.id, current_year)
    leave_service.ensure_employee_yearly_balances(db_session, emp2_profile.id, current_year)

    # Reset Alice & Bob SICK and CASUAL balances to 15.0 allocated, 0.0 used, 15.0 available
    for emp_id in [emp1_profile.id, emp2_profile.id]:
        for lt_id in [sick.id, casual.id]:
            bal = leave_repo.get_leave_balance(db_session, emp_id, lt_id, current_year)
            if bal:
                bal.allocated = 15.0
                bal.used = 0.0
                bal.available = 15.0

    db_session.commit()

    return {
        "hr_user": hr_user,
        "emp1_user": emp1_user,
        "emp1_profile": emp1_profile,
        "emp2_user": emp2_user,
        "emp2_profile": emp2_profile,
        "sick_type": sick,
        "casual_type": casual,
        "annual_type": annual,
    }


def as_user(user: User):
    app.dependency_overrides[get_current_user] = lambda: user


# Clean up dependency overrides after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    app.dependency_overrides.clear()


# ============================================================
# COMPREHENSIVE LEAVE SERVICE TEST SUITE (20 REQUIREMENTS + OPS)
# ============================================================

# 1, 2, 3: New employee automatically receives SICK=15, CASUAL=15, TOTAL=30
def test_01_new_employee_auto_receives_30_days(setup_users_and_employees, db_session: Session):
    test_email = f"test_new_emp_{datetime.now().timestamp()}@hrms.com"
    new_emp_data = EmployeeCreate(
        first_name="Charlie",
        last_name="Newbie",
        email=test_email,
        phone="9876543210",
        date_of_birth=date(1995, 5, 20),
        address="123 Developer Way",
        joining_date=date.today(),
        department_id=None,
        designation_id=None,
    )
    new_employee = employee_service.create_employee(db_session, new_emp_data)
    current_year = datetime.now(timezone.utc).year

    # Verify balances were automatically created upon employee creation
    balances = leave_repo.get_balances_by_employee(db_session, new_employee.id, current_year)
    active_balances = [b for b in balances if b.leave_type.is_active]

    assert len(active_balances) == 2

    sick_bal = next((b for b in active_balances if b.leave_type.code == "SICK"), None)
    casual_bal = next((b for b in active_balances if b.leave_type.code == "CASUAL"), None)

    # 1. SICK = 15
    assert sick_bal is not None
    assert sick_bal.allocated == 15.0
    assert sick_bal.used == 0.0
    assert sick_bal.available == 15.0

    # 2. CASUAL = 15
    assert casual_bal is not None
    assert casual_bal.allocated == 15.0
    assert casual_bal.used == 0.0
    assert casual_bal.available == 15.0

    # 3. Total = 30
    total_available = sum(b.available for b in active_balances)
    assert total_available == 30.0


# 4: Existing employee missing current-year balances receives 30 upon check
def test_04_existing_employee_missing_balances_gets_30(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp2 = users["emp2_profile"]
    current_year = datetime.now(timezone.utc).year

    # Temporarily delete emp2 balances for current year
    db_session.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp2.id,
        LeaveBalance.year == current_year,
    ).delete()
    db_session.commit()

    # Query via API /api/leave/balances/me
    as_user(users["emp2_user"])
    res = client.get("/api/leave/balances/me")
    assert res.status_code == 200
    data = res.json()
    current_year = datetime.now(timezone.utc).year
    active_balances = [b for b in data["balances"] if b["leave_type"]["is_active"] and b["year"] == current_year]

    assert len(active_balances) == 2
    sick = next(b for b in active_balances if b["leave_type"]["code"] == "SICK")
    casual = next(b for b in active_balances if b["leave_type"]["code"] == "CASUAL")
    assert sick["available"] == 15.0
    assert casual["available"] == 15.0
    total = sum(b["available"] for b in active_balances)
    assert total == 30.0


# 5 & 20: Running initialization twice creates no duplicates
def test_05_and_20_idempotent_initialization_no_duplicates(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    current_year = datetime.now(timezone.utc).year

    # Call ensure_employee_yearly_balances twice
    b1 = leave_service.ensure_employee_yearly_balances(db_session, emp1.id, current_year)
    b2 = leave_service.ensure_employee_yearly_balances(db_session, emp1.id, current_year)

    # Count records in DB for current year
    records = db_session.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp1.id,
        LeaveBalance.year == current_year,
        LeaveBalance.leave_type_id.in_([users["sick_type"].id, users["casual_type"].id]),
    ).all()

    assert len(records) == 2
    assert len(b1) == len(b2)


# 6: Existing used balance is preserved during re-check
def test_06_existing_used_balance_is_preserved(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    current_year = datetime.now(timezone.utc).year
    casual = users["casual_type"]

    bal = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    bal.allocated = 15.0
    bal.used = 4.0
    bal.available = 11.0
    db_session.commit()

    # Re-run initialization
    leave_service.ensure_employee_yearly_balances(db_session, emp1.id, current_year)

    refreshed = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    assert refreshed.allocated == 15.0
    assert refreshed.used == 4.0
    assert refreshed.available == 11.0

    # Reset used to 0 for subsequent tests
    refreshed.used = 0.0
    refreshed.available = 15.0
    db_session.commit()


# 7: Annual Leave is inactive
def test_07_annual_leave_is_inactive(setup_users_and_employees, db_session: Session):
    annual = leave_repo.get_leave_type_by_code(db_session, "ANNUAL")
    assert annual is not None
    assert annual.is_active is False

    # Check GET /api/leave/types/active does NOT contain ANNUAL
    res = client.get("/api/leave/types/active")
    assert res.status_code == 200
    active_codes = [lt["code"] for lt in res.json()["leave_types"]]
    assert "ANNUAL" not in active_codes
    assert "SICK" in active_codes
    assert "CASUAL" in active_codes


# 8: Annual Leave cannot be selected or applied
def test_08_annual_leave_cannot_be_applied(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    annual = users["annual_type"]
    as_user(users["emp1_user"])

    today = date.today()
    res = client.post("/api/leave/requests", json={
        "leave_type_id": annual.id,
        "start_date": (today + timedelta(days=10)).isoformat(),
        "end_date": (today + timedelta(days=12)).isoformat(),
        "reason": "Trying to take annual leave",
    })
    assert res.status_code == 400
    assert "inactive" in res.json()["detail"].lower()


# 9, 12, 13: Pending leave does not reduce balance, Approved leave reduces selected policy balance
def test_09_12_13_pending_does_not_reduce_approved_reduces_balance(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    casual = users["casual_type"]
    current_year = datetime.now(timezone.utc).year

    as_user(users["emp1_user"])
    today = date.today()
    start_date = today + timedelta(days=15)
    end_date = today + timedelta(days=17)  # 3 days: 15, 16, 17

    # 1. Submit 3 days Casual Leave
    create_res = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "reason": "Family vacation",
    })
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # 9. While PENDING: balance is NOT reduced
    bal_res = client.get("/api/leave/balances/me")
    assert bal_res.status_code == 200
    b_data = bal_res.json()["balances"]
    casual_b = next(b for b in b_data if b["leave_type"]["code"] == "CASUAL" and b["year"] == current_year)
    assert casual_b["used"] == 0.0
    assert casual_b["available"] == 15.0
    total_avail = sum(b["available"] for b in b_data if b["leave_type"]["is_active"] and b["year"] == current_year)
    assert total_avail == 30.0

    # 12 & 13. HR Approves the request
    as_user(users["hr_user"])
    approve_res = client.patch(f"/api/leave/requests/{req_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"

    # Verify balance is reduced
    as_user(users["emp1_user"])
    bal_after = client.get("/api/leave/balances/me").json()["balances"]
    casual_after = next(b for b in bal_after if b["leave_type"]["code"] == "CASUAL" and b["year"] == current_year)
    sick_after = next(b for b in bal_after if b["leave_type"]["code"] == "SICK" and b["year"] == current_year)

    assert casual_after["used"] == 3.0
    assert casual_after["available"] == 12.0
    assert sick_after["available"] == 15.0

    # Total available decreases from 30 to 27
    total_after = sum(b["available"] for b in bal_after if b["leave_type"]["is_active"] and b["year"] == current_year)
    assert total_after == 27.0


# 10: Rejected leave does not reduce balance
def test_10_rejected_leave_does_not_reduce_balance(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    sick = users["sick_type"]
    today = date.today()

    as_user(users["emp1_user"])
    create_res = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": (today + timedelta(days=25)).isoformat(),
        "end_date": (today + timedelta(days=26)).isoformat(),  # 2 days
        "reason": "Headache",
    })
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # HR rejects with reason
    as_user(users["hr_user"])
    rej_res = client.patch(f"/api/leave/requests/{req_id}/reject", json={
        "rejection_reason": "Documentation required",
    })
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"

    # Sick balance must still be 15.0 available, 0.0 used
    as_user(users["emp1_user"])
    current_year = datetime.now(timezone.utc).year
    b_data = client.get("/api/leave/balances/me").json()["balances"]
    sick_b = next(b for b in b_data if b["leave_type"]["code"] == "SICK" and b["year"] == current_year)
    assert sick_b["used"] == 0.0
    assert sick_b["available"] == 15.0


# 11: Cancelled leave does not reduce balance
def test_11_cancelled_leave_does_not_reduce_balance(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    sick = users["sick_type"]
    today = date.today()

    as_user(users["emp1_user"])
    create_res = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": (today + timedelta(days=35)).isoformat(),
        "end_date": (today + timedelta(days=36)).isoformat(),
        "reason": "Dentist visit",
    })
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # Employee cancels
    cancel_res = client.patch(f"/api/leave/requests/me/{req_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Sick balance unchanged
    current_year = datetime.now(timezone.utc).year
    b_data = client.get("/api/leave/balances/me").json()["balances"]
    sick_b = next(b for b in b_data if b["leave_type"]["code"] == "SICK" and b["year"] == current_year)
    assert sick_b["used"] == 0.0
    assert sick_b["available"] == 15.0


# 14: Insufficient balance is rejected by backend
def test_14_insufficient_balance_is_rejected(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    casual = users["casual_type"]
    today = date.today()

    # Casual currently has 12 available. Request 13 days (days 50 to 62 inclusive)
    as_user(users["emp1_user"])
    start_date = today + timedelta(days=50)
    end_date = today + timedelta(days=62)

    res = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "reason": "Extended break",
    })
    assert res.status_code == 400
    assert "Insufficient leave balance" in res.json()["detail"]


# 15, 16, 17, 18: Previous year's balance untouched, New calendar year creates 15+15=30 with no carry-forward
def test_15_16_17_18_yearly_reset_and_no_carry_forward(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    sick = users["sick_type"]
    casual = users["casual_type"]

    # 1. Setup 2025 balance: SICK used 5, available 10; CASUAL used 8, available 7
    prev_year = 2025
    b_sick_2025 = leave_repo.get_leave_balance(db_session, emp1.id, sick.id, prev_year)
    if not b_sick_2025:
        b_sick_2025 = LeaveBalance(employee_id=emp1.id, leave_type_id=sick.id, year=prev_year, allocated=15.0, used=5.0, available=10.0)
        db_session.add(b_sick_2025)
    else:
        b_sick_2025.allocated = 15.0
        b_sick_2025.used = 5.0
        b_sick_2025.available = 10.0

    b_cas_2025 = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, prev_year)
    if not b_cas_2025:
        b_cas_2025 = LeaveBalance(employee_id=emp1.id, leave_type_id=casual.id, year=prev_year, allocated=15.0, used=8.0, available=7.0)
        db_session.add(b_cas_2025)
    else:
        b_cas_2025.allocated = 15.0
        b_cas_2025.used = 8.0
        b_cas_2025.available = 7.0

    db_session.commit()

    # 2. Simulate next year (2027) automatic balance allocation
    next_year = 2027
    new_balances = leave_service.ensure_employee_yearly_balances(db_session, emp1.id, next_year)
    assert len(new_balances) == 2

    # 15. Previous year 2025 remains untouched
    b_2025_check = leave_repo.get_balances_by_employee(db_session, emp1.id, prev_year)
    s_2025 = next(b for b in b_2025_check if b.leave_type_id == sick.id)
    c_2025 = next(b for b in b_2025_check if b.leave_type_id == casual.id)
    assert s_2025.used == 5.0
    assert s_2025.available == 10.0
    assert c_2025.used == 8.0
    assert c_2025.available == 7.0

    # 16 & 17. 2027 starts at 15 + 15 = 30 with used = 0
    s_2027 = next(b for b in new_balances if b.leave_type_id == sick.id)
    c_2027 = next(b for b in new_balances if b.leave_type_id == casual.id)
    assert s_2027.allocated == 15.0
    assert s_2027.used == 0.0
    assert s_2027.available == 15.0
    assert c_2027.allocated == 15.0
    assert c_2027.used == 0.0
    assert c_2027.available == 15.0

    # 18. No carry-forward: 2027 available is 15.0 (NOT 15 + 10 or 15 + 7)
    assert s_2027.available == 15.0
    assert c_2027.available == 15.0


# 19: Multiple employees have independent balances
def test_19_multiple_employees_independent_balances(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    emp2 = users["emp2_profile"]
    casual = users["casual_type"]
    current_year = datetime.now(timezone.utc).year

    # Alice (emp1) has 3 days approved leave used on Casual (available = 12)
    b_emp1 = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    assert b_emp1.used == 3.0
    assert b_emp1.available == 12.0

    # Bob (emp2) has not used any Casual leave (available = 15)
    b_emp2 = leave_repo.get_leave_balance(db_session, emp2.id, casual.id, current_year)
    assert b_emp2.used == 0.0
    assert b_emp2.available == 15.0


# ============================================================
# OPERATIONAL & PERMISSION TESTS
# ============================================================

def test_hr_crud_custom_leave_type(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    as_user(users["hr_user"])

    # 1. Create custom leave type
    payload = {
        "name": "Maternity Test Leave",
        "code": "MAT_TEST",
        "description": "Parental leave test",
        "annual_quota": 90.0,
        "is_active": False,  # Keep inactive so it doesn't affect active allocation
    }
    create_res = client.post("/api/leave/types", json=payload)
    assert create_res.status_code == 201
    lt_id = create_res.json()["id"]

    # 2. Update
    upd_res = client.put(f"/api/leave/types/{lt_id}", json={"description": "Updated parental leave"})
    assert upd_res.status_code == 200
    assert upd_res.json()["description"] == "Updated parental leave"

    # 3. Safe delete (allowed since no records reference it)
    del_res = client.delete(f"/api/leave/types/{lt_id}")
    assert del_res.status_code in [200, 204]


def test_permissions_employee_cannot_approve_or_manage_types(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    as_user(users["emp1_user"])

    # Cannot approve
    res_appr = client.patch("/api/leave/requests/1/approve")
    assert res_appr.status_code == 403

    # Cannot create leave type
    res_type = client.post("/api/leave/types", json={"name": "X", "code": "X", "annual_quota": 5})
    assert res_type.status_code == 403


def test_employee_cannot_view_another_employee_request(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1_req = db_session.query(LeaveRequest).filter(LeaveRequest.employee_id == users["emp1_profile"].id).first()
    assert emp1_req is not None

    as_user(users["emp2_user"])
    res = client.get(f"/api/leave/requests/me/{emp1_req.id}")
    assert res.status_code == 404


def test_invalid_date_range_is_rejected(setup_users_and_employees):
    users = setup_users_and_employees
    sick = users["sick_type"]
    as_user(users["emp1_user"])
    today = date.today()

    res = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": (today + timedelta(days=20)).isoformat(),
        "end_date": (today + timedelta(days=10)).isoformat(),
        "reason": "Negative duration",
    })
    assert res.status_code == 400
    assert "End date cannot be before start date" in res.json()["detail"]


def test_overlapping_leave_is_rejected(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    casual = users["casual_type"]
    as_user(users["emp1_user"])
    today = date.today()

    # Create first request on days 70 to 73
    res1 = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": (today + timedelta(days=70)).isoformat(),
        "end_date": (today + timedelta(days=73)).isoformat(),
        "reason": "Trip 1",
    })
    assert res1.status_code == 201

    # Overlapping attempt on days 72 to 75
    res2 = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": (today + timedelta(days=72)).isoformat(),
        "end_date": (today + timedelta(days=75)).isoformat(),
        "reason": "Trip 2 overlapping",
    })
    assert res2.status_code == 400
    assert "conflicts with an existing pending or approved leave request" in res2.json()["detail"]


def test_only_pending_requests_can_be_approved_or_rejected(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    as_user(users["hr_user"])

    approved_req = db_session.query(LeaveRequest).filter(
        LeaveRequest.employee_id == users["emp1_profile"].id,
        LeaveRequest.status == LeaveRequestStatus.APPROVED,
    ).first()
    assert approved_req is not None

    res = client.patch(f"/api/leave/requests/{approved_req.id}/approve")
    assert res.status_code == 400
    assert "Only pending leave requests can be approved" in res.json()["detail"]


def test_historical_leave_records_prevent_deletion_of_leave_type(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    as_user(users["hr_user"])
    casual = users["casual_type"]

    # Deleting casual leave must be blocked because balances and requests exist
    del_res = client.delete(f"/api/leave/types/{casual.id}")
    assert del_res.status_code == 400
    assert "Cannot delete leave type with existing records" in del_res.json()["detail"]


def test_hr_can_view_and_manage_balances(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    as_user(users["hr_user"])
    emp2 = users["emp2_profile"]

    # HR views employee 2's balances
    res = client.get(f"/api/leave/balances/{emp2.id}")
    assert res.status_code == 200
    balances = res.json()["balances"]
    assert len(balances) >= 2

    # HR adjusts a balance
    target_bal = balances[0]
    update_res = client.put(f"/api/leave/balances/{target_bal['id']}", json={
        "allocated": 18.0,
    })
    assert update_res.status_code == 200
    assert update_res.json()["allocated"] == 18.0
    assert update_res.json()["available"] == 18.0

    # Revert back to 15.0
    client.put(f"/api/leave/balances/{target_bal['id']}", json={"allocated": 15.0})


def test_revoke_approved_leave_restores_exact_balance_and_prevents_double_revoke(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    casual = users["casual_type"]
    current_year = datetime.now(timezone.utc).year

    # Check baseline balance
    bal_before = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    used_initial = bal_before.used
    avail_initial = bal_before.available

    # 1. Employee creates a 4-day leave request
    today = date(current_year, 11, 20)
    as_user(users["emp1_user"])
    create_res = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=3)).isoformat(),  # 4 calendar days: Nov 20, 21, 22, 23
        "reason": "4-day family event",
    })
    assert create_res.status_code == 201
    req_data = create_res.json()
    assert req_data["number_of_days"] == 4.0
    req_id = req_data["id"]

    # 2. HR approves the 4-day request -> balance deducted by 4
    as_user(users["hr_user"])
    approve_res = client.patch(f"/api/leave/requests/{req_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"

    db_session.expire_all()
    bal_after_approve = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    assert bal_after_approve.used == round(used_initial + 4.0, 2)
    assert bal_after_approve.available == round(avail_initial - 4.0, 2)

    # 3. Employee attempts to revoke -> 403 Forbidden
    as_user(users["emp1_user"])
    emp_revoke_res = client.patch(f"/api/leave/requests/{req_id}/revoke")
    assert emp_revoke_res.status_code == 403

    # 4. HR revokes the approved request -> status becomes REVOKED, exact 4 days restored
    as_user(users["hr_user"])
    revoke_res = client.patch(f"/api/leave/requests/{req_id}/revoke")
    assert revoke_res.status_code == 200
    revoked_data = revoke_res.json()
    assert revoked_data["status"] == "REVOKED"
    assert revoked_data["reviewed_by"] == users["hr_user"].id

    db_session.expire_all()
    bal_after_revoke = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    assert bal_after_revoke.used == used_initial
    assert bal_after_revoke.available == avail_initial

    # 5. Double-revoke attempt -> 400 Bad Request
    double_revoke_res = client.patch(f"/api/leave/requests/{req_id}/revoke")
    assert double_revoke_res.status_code == 400
    assert "already been revoked" in double_revoke_res.json()["detail"]


def test_revoke_invalid_statuses_and_1_day_leave(setup_users_and_employees, db_session: Session):
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    sick = users["sick_type"]
    current_year = datetime.now(timezone.utc).year

    # Check baseline balance
    bal_before = leave_repo.get_leave_balance(db_session, emp1.id, sick.id, current_year)
    used_initial = bal_before.used
    avail_initial = bal_before.available

    # 1. Create a 1-day leave request
    day1 = date(current_year, 11, 10)
    as_user(users["emp1_user"])
    res1 = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": day1.isoformat(),
        "end_date": day1.isoformat(),  # 1 day
        "reason": "Doctor appointment",
    })
    assert res1.status_code == 201
    req1_id = res1.json()["id"]

    # 2. Cannot revoke a PENDING request -> 400 Bad Request
    as_user(users["hr_user"])
    pending_revoke_res = client.patch(f"/api/leave/requests/{req1_id}/revoke")
    assert pending_revoke_res.status_code == 400
    assert "Only approved leave requests can be revoked" in pending_revoke_res.json()["detail"]

    # 3. Reject the request -> Cannot revoke a REJECTED request -> 400 Bad Request
    reject_res = client.patch(f"/api/leave/requests/{req1_id}/reject", json={"rejection_reason": "Not approved"})
    assert reject_res.status_code == 200
    rejected_revoke_res = client.patch(f"/api/leave/requests/{req1_id}/revoke")
    assert rejected_revoke_res.status_code == 400
    assert "Only approved leave requests can be revoked" in rejected_revoke_res.json()["detail"]

    # 4. Create another 1-day request, cancel it as employee -> Cannot revoke CANCELLED -> 400
    day2 = date(current_year, 11, 12)
    as_user(users["emp1_user"])
    res2 = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": day2.isoformat(),
        "end_date": day2.isoformat(),
        "reason": "Dentist visit",
    })
    req2_id = res2.json()["id"]
    cancel_res = client.patch(f"/api/leave/requests/me/{req2_id}/cancel")
    assert cancel_res.status_code == 200

    as_user(users["hr_user"])
    cancelled_revoke_res = client.patch(f"/api/leave/requests/{req2_id}/revoke")
    assert cancelled_revoke_res.status_code == 400
    assert "Only approved leave requests can be revoked" in cancelled_revoke_res.json()["detail"]

    # 5. Create a 1-day request, approve it, and revoke it -> exactly 1 day restored
    day3 = date(current_year, 11, 15)
    as_user(users["emp1_user"])
    res3 = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": day3.isoformat(),
        "end_date": day3.isoformat(),
        "reason": "Fever checkup",
    })
    req3_id = res3.json()["id"]

    as_user(users["hr_user"])
    client.patch(f"/api/leave/requests/{req3_id}/approve")
    db_session.expire_all()
    bal_after_appr = leave_repo.get_leave_balance(db_session, emp1.id, sick.id, current_year)
    assert bal_after_appr.used == round(used_initial + 1.0, 2)
    assert bal_after_appr.available == round(avail_initial - 1.0, 2)

    rev_res = client.patch(f"/api/leave/requests/{req3_id}/revoke")
    assert rev_res.status_code == 200
    db_session.expire_all()
    bal_after_rev = leave_repo.get_leave_balance(db_session, emp1.id, sick.id, current_year)
    assert bal_after_rev.used == used_initial
    assert bal_after_rev.available == avail_initial


def test_hr_leave_requests_surfaces_exact_employee_leave_balance(setup_users_and_employees, db_session: Session):
    """
    Verifies:
    1. HR listing leave requests surfaces employee leave balance strictly for the EXACT requested leave type.
    2. employee_id + leave_type_id + request.start_date.year is matched.
    3. Different employees and leave types have independent and accurate balances.
    4. Approve updates returned leave_balance.
    5. Revoke restores returned leave_balance.
    6. Reject keeps leave_balance unchanged.
    """
    users = setup_users_and_employees
    emp1 = users["emp1_profile"]
    emp2 = users["emp2_profile"]
    current_year = datetime.now(timezone.utc).year

    casual = users["casual_type"]
    sick = users["sick_type"]

    # Initial balances for Casual and Sick
    bal_emp1_casual = leave_repo.get_leave_balance(db_session, emp1.id, casual.id, current_year)
    bal_emp2_sick = leave_repo.get_leave_balance(db_session, emp2.id, sick.id, current_year)

    emp1_casual_avail_before = bal_emp1_casual.available
    emp1_casual_used_before = bal_emp1_casual.used
    emp2_sick_avail_before = bal_emp2_sick.available
    emp2_sick_used_before = bal_emp2_sick.used

    # Emp1 submits 2-day Casual Leave request (days 90 to 91 to avoid overlap with earlier tests)
    t_base = date.today()
    d1_start = t_base + timedelta(days=90)
    d1_end = t_base + timedelta(days=91)
    as_user(users["emp1_user"])
    r1 = client.post("/api/leave/requests", json={
        "leave_type_id": casual.id,
        "start_date": d1_start.isoformat(),
        "end_date": d1_end.isoformat(),
        "reason": "Personal family event",
    })
    assert r1.status_code == 201
    req1_id = r1.json()["id"]

    # Emp2 submits 3-day Sick Leave request (days 95 to 97)
    d2_start = t_base + timedelta(days=95)
    d2_end = t_base + timedelta(days=97)
    as_user(users["emp2_user"])
    r2 = client.post("/api/leave/requests", json={
        "leave_type_id": sick.id,
        "start_date": d2_start.isoformat(),
        "end_date": d2_end.isoformat(),
        "reason": "Severe migraine and medical checkup",
    })
    assert r2.status_code == 201
    req2_id = r2.json()["id"]

    # HR lists all leave requests
    as_user(users["hr_user"])
    list_res = client.get("/api/leave/requests")
    assert list_res.status_code == 200
    all_requests = list_res.json()["requests"]

    req1_data = next((r for r in all_requests if r["id"] == req1_id), None)
    req2_data = next((r for r in all_requests if r["id"] == req2_id), None)
    assert req1_data is not None
    assert req2_data is not None

    # Check Req1: Employee 1 + Casual Leave balance
    assert "leave_balance" in req1_data
    assert req1_data["leave_balance"] is not None
    assert req1_data["leave_balance"]["allocated"] == bal_emp1_casual.allocated
    assert req1_data["leave_balance"]["used"] == emp1_casual_used_before
    assert req1_data["leave_balance"]["available"] == emp1_casual_avail_before

    # Check Req2: Employee 2 + Sick Leave balance (NOT casual, NOT total)
    assert "leave_balance" in req2_data
    assert req2_data["leave_balance"] is not None
    assert req2_data["leave_balance"]["allocated"] == bal_emp2_sick.allocated
    assert req2_data["leave_balance"]["used"] == emp2_sick_used_before
    assert req2_data["leave_balance"]["available"] == emp2_sick_avail_before

    # HR approves Req1 (2 days) -> balance updated
    appr_res = client.patch(f"/api/leave/requests/{req1_id}/approve")
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["leave_balance"]["allocated"] == bal_emp1_casual.allocated
    assert appr_data["leave_balance"]["used"] == round(emp1_casual_used_before + 2.0, 2)
    assert appr_data["leave_balance"]["available"] == round(emp1_casual_avail_before - 2.0, 2)

    # HR revokes Req1 -> balance restored
    rev_res = client.patch(f"/api/leave/requests/{req1_id}/revoke")
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["leave_balance"]["used"] == emp1_casual_used_before
    assert rev_data["leave_balance"]["available"] == emp1_casual_avail_before

    # HR rejects Req2 -> balance untouched
    rej_res = client.patch(f"/api/leave/requests/{req2_id}/reject", json={"rejection_reason": "Team critical deadline"})
    assert rej_res.status_code == 200
    rej_data = rej_res.json()
    assert rej_data["leave_balance"]["used"] == emp2_sick_used_before
    assert rej_data["leave_balance"]["available"] == emp2_sick_avail_before

