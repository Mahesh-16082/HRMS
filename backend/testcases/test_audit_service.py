from datetime import datetime, timedelta
import secrets
from unittest.mock import patch
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.audit_service.models import AuditAction, AuditLog, AuditStatus
from app.audit_service import service as audit_service_module
from app.authentication_service.dependencies import (
    get_current_user,
    get_current_user_and_session,
)
from app.authentication_service.models import OTPVerification, User, UserSession
from app.authentication_service import service as auth_service
from app.core.database import SessionLocal, get_db
from app.main import app

client = TestClient(app)


# ============================================================
# FIXTURES & SETUP
# ============================================================

@pytest.fixture(scope="module")
def setup_data():
    """Ensure HR and Employee test users exist."""
    db = SessionLocal()
    try:
        hr_user = db.query(User).filter(User.email == "test_hr_audit@hrms.com").first()
        if not hr_user:
            hr_user = User(
                email="test_hr_audit@hrms.com",
                full_name="HR Audit Admin",
                role="hr",
                is_active=True,
                is_verified=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        emp_user = db.query(User).filter(User.email == "test_emp_audit@hrms.com").first()
        if not emp_user:
            emp_user = User(
                email="test_emp_audit@hrms.com",
                full_name="Employee Audit User",
                role="employee",
                is_active=True,
                is_verified=True,
            )
            db.add(emp_user)
            db.commit()
            db.refresh(emp_user)

        return {
            "hr_user_id": hr_user.id,
            "emp_user_id": emp_user.id,
            "hr_email": hr_user.email,
            "emp_email": emp_user.email,
        }
    finally:
        db.close()


def as_user(user_id: int):
    def _override(db: Session = Depends(get_db)):
        return db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = _override


def as_user_and_session(user_id: int, session_id: str):
    def _override_user(db: Session = Depends(get_db)):
        return db.query(User).filter(User.id == user_id).first()

    def _override_both(db: Session = Depends(get_db)):
        user = db.query(User).filter(User.id == user_id).first()
        session = db.query(UserSession).filter(UserSession.session_id == session_id).first()
        return user, session

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_current_user_and_session] = _override_both


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_all():
    yield
    app.dependency_overrides.clear()


# ============================================================
# 1. ACCESS CONTROL & IMMUTABILITY TESTS
# ============================================================

def test_01_hr_can_view_audit_logs(setup_data):
    as_user(setup_data["hr_user_id"])
    response = client.get("/api/audit-logs")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "audit_logs" in data
    assert isinstance(data["audit_logs"], list)


def test_02_employee_cannot_view_audit_logs(setup_data):
    as_user(setup_data["emp_user_id"])
    response = client.get("/api/audit-logs")
    assert response.status_code == 403
    assert "Only HR" in response.json()["detail"]


def test_03_unauthenticated_request_is_rejected():
    app.dependency_overrides.clear()
    response = client.get("/api/audit-logs")
    assert response.status_code in [401, 403]


def test_04_audit_records_are_immutable():
    """Verify that POST, PUT, PATCH, DELETE are rejected on /api/audit-logs."""
    as_user(1)
    assert client.post("/api/audit-logs", json={"action": "LOGIN"}).status_code == 405
    assert client.put("/api/audit-logs/1", json={"details": "tamper"}).status_code == 405
    assert client.patch("/api/audit-logs/1", json={"details": "tamper"}).status_code == 405
    assert client.delete("/api/audit-logs/1").status_code == 405


# ============================================================
# 2. AUTHENTICATION INTEGRATION & EVENT LOGGING TESTS
# ============================================================

def test_05_successful_otp_verification_logs_otp_and_login_events(setup_data):
    """
    When an employee successfully verifies OTP:
    1. An OTP_VERIFICATION (SUCCESS) event is recorded.
    2. A LOGIN (SUCCESS) event is recorded only after session creation.
    3. The raw OTP is NEVER recorded.
    """
    db = SessionLocal()
    try:
        email = setup_data["emp_email"]
        test_otp = "123456"
        otp_hash = auth_service.hash_otp(test_otp)

        # Invalidate old OTPs and create a fresh one
        db.query(OTPVerification).filter(OTPVerification.email == email).delete()
        otp_record = OTPVerification(
            email=email,
            otp_hash=otp_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            attempts=0,
            is_used=False,
        )
        db.add(otp_record)
        db.commit()

        # Perform verify-otp via service
        res = auth_service.verify_login_otp(
            db=db,
            email=email,
            otp=test_otp,
            ip_address="192.168.1.50",
            user_agent="Mozilla/5.0 TestBrowser",
        )
        assert "access_token" in res

        # Check audit records in isolated session
        recent_logs = (
            db.query(AuditLog)
            .filter(AuditLog.email == email)
            .order_by(AuditLog.id.desc())
            .limit(2)
            .all()
        )

        actions = [log.action for log in recent_logs]
        statuses = [log.status for log in recent_logs]

        assert AuditAction.LOGIN in actions
        assert AuditAction.OTP_VERIFICATION in actions
        assert all(s == AuditStatus.SUCCESS for s in statuses)

        # Verify raw OTP was NOT stored
        for log in recent_logs:
            assert log.ip_address == "192.168.1.50"
            assert "TestBrowser" in (log.user_agent or "")
            assert test_otp not in (log.details or "")
            assert test_otp not in (log.email or "")

    finally:
        db.close()


def test_06_failed_otp_verification_logs_failed_audit_event(setup_data):
    """
    When OTP verification fails due to incorrect OTP:
    1. An OTP_VERIFICATION (FAILED) event is recorded.
    2. The raw wrong OTP is NEVER recorded.
    """
    db = SessionLocal()
    try:
        email = setup_data["emp_email"]
        wrong_otp = "999888"

        # Create valid OTP record in DB
        otp_record = OTPVerification(
            email=email,
            otp_hash=auth_service.hash_otp("111222"),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            attempts=0,
            is_used=False,
        )
        db.add(otp_record)
        db.commit()

        # Perform verify-otp with incorrect code
        with pytest.raises(Exception):
            auth_service.verify_login_otp(
                db=db,
                email=email,
                otp=wrong_otp,
                ip_address="10.0.0.1",
                user_agent="Pytest Client",
            )

        failed_log = (
            db.query(AuditLog)
            .filter(
                AuditLog.email == email,
                AuditLog.action == AuditAction.OTP_VERIFICATION,
                AuditLog.status == AuditStatus.FAILED,
            )
            .order_by(AuditLog.id.desc())
            .first()
        )

        assert failed_log is not None
        assert failed_log.status == AuditStatus.FAILED
        assert failed_log.ip_address == "10.0.0.1"
        assert wrong_otp not in (failed_log.details or "")
        assert "111222" not in (failed_log.details or "")
    finally:
        db.close()


def test_07_expired_otp_verification_logs_failed_audit_event(setup_data):
    db = SessionLocal()
    try:
        email = setup_data["emp_email"]
        # Create an expired OTP
        otp_record = OTPVerification(
            email=email,
            otp_hash=auth_service.hash_otp("333444"),
            expires_at=datetime.utcnow() - timedelta(minutes=1),
            attempts=0,
            is_used=False,
        )
        db.add(otp_record)
        db.commit()

        with pytest.raises(Exception):
            auth_service.verify_login_otp(
                db=db,
                email=email,
                otp="333444",
                ip_address="10.0.0.2",
            )

        expired_log = (
            db.query(AuditLog)
            .filter(
                AuditLog.email == email,
                AuditLog.details == "OTP has expired",
            )
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert expired_log is not None
        assert expired_log.status == AuditStatus.FAILED
    finally:
        db.close()


def test_08_logout_logs_logout_audit_event(setup_data):
    db = SessionLocal()
    try:
        user_id = setup_data["emp_user_id"]
        session_id = secrets.token_urlsafe(32)

        # Create session
        sess = UserSession(
            user_id=user_id,
            session_id=session_id,
            expires_at=datetime.utcnow() + timedelta(hours=1),
            is_active=True,
        )
        db.add(sess)
        db.commit()

        # Perform logout
        auth_service.logout(
            db=db,
            session_id=session_id,
            ip_address="192.168.1.99",
            user_agent="LogoutBrowser/1.0",
        )

        logout_log = (
            db.query(AuditLog)
            .filter(
                AuditLog.user_id == user_id,
                AuditLog.action == AuditAction.LOGOUT,
            )
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert logout_log is not None
        assert logout_log.status == AuditStatus.SUCCESS
        assert logout_log.ip_address == "192.168.1.99"
    finally:
        db.close()


def test_09_logout_all_devices_logs_audit_event(setup_data):
    db = SessionLocal()
    try:
        user_id = setup_data["emp_user_id"]
        auth_service.logout_all_devices(
            db=db,
            user_id=user_id,
            ip_address="127.0.0.1",
            user_agent="DeviceManager",
        )

        log_record = (
            db.query(AuditLog)
            .filter(
                AuditLog.user_id == user_id,
                AuditLog.action == AuditAction.LOGOUT,
                AuditLog.details == "Logged out from all devices",
            )
            .first()
        )
        assert log_record is not None
        assert log_record.status == AuditStatus.SUCCESS
    finally:
        db.close()


# ============================================================
# 3. SEARCH, FILTERING, & PAGINATION TESTS
# ============================================================

def test_10_filter_audit_logs_by_action(setup_data):
    as_user(setup_data["hr_user_id"])
    response = client.get("/api/audit-logs?action=LOGIN")
    assert response.status_code == 200
    data = response.json()
    for log in data["audit_logs"]:
        assert log["action"] == "LOGIN"


def test_11_filter_audit_logs_by_status(setup_data):
    as_user(setup_data["hr_user_id"])
    response = client.get("/api/audit-logs?status=FAILED")
    assert response.status_code == 200
    data = response.json()
    for log in data["audit_logs"]:
        assert log["status"] == "FAILED"


def test_12_filter_audit_logs_by_user_id(setup_data):
    as_user(setup_data["hr_user_id"])
    emp_id = setup_data["emp_user_id"]
    response = client.get(f"/api/audit-logs?user_id={emp_id}")
    assert response.status_code == 200
    data = response.json()
    for log in data["audit_logs"]:
        assert log["user_id"] == emp_id


def test_13_filter_audit_logs_by_email(setup_data):
    as_user(setup_data["hr_user_id"])
    emp_email = setup_data["emp_email"]
    response = client.get(f"/api/audit-logs?email={emp_email}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["audit_logs"]) > 0
    for log in data["audit_logs"]:
        assert emp_email in (log["email"] or "")


def test_14_audit_logs_pagination(setup_data):
    as_user(setup_data["hr_user_id"])
    response = client.get("/api/audit-logs?skip=0&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["audit_logs"]) <= 2
    assert data["limit"] == 2
    assert data["skip"] == 0


def test_15_get_audit_log_details(setup_data):
    db = SessionLocal()
    try:
        latest = db.query(AuditLog).first()
        assert latest is not None
        target_id = latest.id
    finally:
        db.close()

    as_user(setup_data["hr_user_id"])
    response = client.get(f"/api/audit-logs/{target_id}")
    assert response.status_code == 200
    log = response.json()
    assert log["id"] == target_id
    assert "action" in log
    assert "status" in log


def test_16_get_audit_log_details_not_found(setup_data):
    as_user(setup_data["hr_user_id"])
    response = client.get("/api/audit-logs/9999999")
    assert response.status_code == 404


# ============================================================
# 4. RESILIENCE / FAULT TOLERANCE TESTS
# ============================================================

def test_17_audit_logging_failure_does_not_break_authentication(setup_data):
    """
    CRITICAL REQUIREMENT:
    If record_audit_event or audit database connection fails,
    it must NEVER rollback or prevent successful login/OTP verification!
    """
    db = SessionLocal()
    try:
        email = setup_data["emp_email"]
        test_otp = "777888"

        # Create valid OTP
        db.query(OTPVerification).filter(OTPVerification.email == email).delete()
        otp_rec = OTPVerification(
            email=email,
            otp_hash=auth_service.hash_otp(test_otp),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            attempts=0,
            is_used=False,
        )
        db.add(otp_rec)
        db.commit()

        # Mock repository.create_audit_log inside audit_service_module to simulate DB failure
        with patch("app.audit_service.repository.create_audit_log", side_effect=RuntimeError("Simulated Audit DB Failure")):
            # verify_login_otp MUST STILL SUCCEED
            result = auth_service.verify_login_otp(
                db=db,
                email=email,
                otp=test_otp,
            )
            assert "access_token" in result
            assert result["token_type"] == "bearer"

            # Verify session was created in main db
            user = db.query(User).filter(User.email == email).first()
            assert user.is_verified is True
    finally:
        db.close()
