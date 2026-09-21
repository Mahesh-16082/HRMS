from datetime import date, datetime

from sqlalchemy.orm import Session

from app.attendance_service.models import Attendance, AttendanceStatus


def get_attendance_by_id(
    db: Session,
    attendance_id: int,
):
    return (
        db.query(Attendance)
        .filter(Attendance.id == attendance_id)
        .first()
    )


def get_attendance_by_employee_and_date(
    db: Session,
    employee_id: int,
    attendance_date: date,
):
    return (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == attendance_date,
        )
        .first()
    )


def create_attendance(
    db: Session,
    attendance: Attendance,
):
    db.add(attendance)
    db.commit()
    db.refresh(attendance)

    return attendance


def update_attendance(
    db: Session,
    attendance: Attendance,
    update_data: dict,
):
    for field, value in update_data.items():
        setattr(attendance, field, value)

    attendance.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(attendance)

    return attendance


def get_employee_attendance(
    db: Session,
    employee_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    query = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee_id)
    )

    if start_date is not None:
        query = query.filter(
            Attendance.attendance_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            Attendance.attendance_date <= end_date
        )

    if status is not None:
        query = query.filter(
            Attendance.status == status
        )

    return (
        query
        .order_by(Attendance.attendance_date.desc())
        .all()
    )


def get_all_attendance(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    query = db.query(Attendance)

    if start_date is not None:
        query = query.filter(
            Attendance.attendance_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            Attendance.attendance_date <= end_date
        )

    if status is not None:
        query = query.filter(
            Attendance.status == status
        )

    return (
        query
        .order_by(Attendance.attendance_date.desc())
        .all()
    )


def count_attendance(
    db: Session,
    employee_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    status: AttendanceStatus | None = None,
):
    query = db.query(Attendance)

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if start_date is not None:
        query = query.filter(
            Attendance.attendance_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            Attendance.attendance_date <= end_date
        )

    if status is not None:
        query = query.filter(
            Attendance.status == status
        )

    return query.count()