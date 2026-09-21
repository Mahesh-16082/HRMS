from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.attendance_service import repository
from app.attendance_service.models import Attendance, AttendanceStatus
from app.employee_service import repository as employee_repository


def get_employee_for_user(
    db: Session,
    user_id: int,
):
    employee = employee_repository.get_employee_by_user_id(
        db,
        user_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return employee


def check_in(
    db: Session,
    user_id: int,
    remarks: str | None = None,
):
    employee = get_employee_for_user(db, user_id)

    today = date.today()

    existing_attendance = (
        repository.get_attendance_by_employee_and_date(
            db,
            employee.id,
            today,
        )
    )

    if existing_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already marked for today",
        )

    now = datetime.now(timezone.utc)

    attendance = Attendance(
        employee_id=employee.id,
        attendance_date=today,
        check_in=now,
        status=AttendanceStatus.PRESENT,
        remarks=remarks,
    )

    return repository.create_attendance(
        db,
        attendance,
    )


def check_out(
    db: Session,
    user_id: int,
    remarks: str | None = None,
):
    employee = get_employee_for_user(db, user_id)

    today = date.today()

    attendance = (
        repository.get_attendance_by_employee_and_date(
            db,
            employee.id,
            today,
        )
    )

    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Please check in before checking out",
        )

    if not attendance.check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in not found",
        )

    if attendance.check_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already checked out",
        )

    update_data = {
        "check_out": datetime.now(timezone.utc),
    }

    if remarks is not None:
        update_data["remarks"] = remarks

    return repository.update_attendance(
        db,
        attendance,
        update_data,
    )


def get_my_attendance(
    db: Session,
    user_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    employee = get_employee_for_user(db, user_id)

    return repository.get_employee_attendance(
        db,
        employee.id,
        start_date,
        end_date,
        status,
    )


def get_my_today_attendance(
    db: Session,
    user_id: int,
):
    employee = get_employee_for_user(db, user_id)

    today = date.today()

    return repository.get_attendance_by_employee_and_date(
        db,
        employee.id,
        today,
    )


def get_employee_attendance(
    db: Session,
    employee_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    employee = employee_repository.get_employee_by_id(
        db,
        employee_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return repository.get_employee_attendance(
        db,
        employee_id,
        start_date,
        end_date,
        status,
    )


def get_all_attendance(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    return repository.get_all_attendance(
        db,
        start_date,
        end_date,
        status,
    )


def get_attendance_count(
    db: Session,
    employee_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    return repository.count_attendance(
        db,
        employee_id,
        start_date,
        end_date,
        status,
    )