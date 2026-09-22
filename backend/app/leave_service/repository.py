from datetime import date
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

from app.leave_service.models import (
    LeaveBalance,
    LeaveRequest,
    LeaveRequestStatus,
    LeaveType,
)


# ============================================================
# LEAVE TYPE REPOSITORY
# ============================================================

def get_leave_type_by_id(db: Session, leave_type_id: int) -> LeaveType | None:
    return db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()


def get_leave_type_by_code(db: Session, code: str) -> LeaveType | None:
    return db.query(LeaveType).filter(LeaveType.code == code).first()


def get_leave_type_by_name(db: Session, name: str) -> LeaveType | None:
    return db.query(LeaveType).filter(LeaveType.name == name).first()


def get_all_leave_types(db: Session) -> list[LeaveType]:
    return db.query(LeaveType).order_by(LeaveType.id.asc()).all()


def get_active_leave_types(db: Session) -> list[LeaveType]:
    return (
        db.query(LeaveType)
        .filter(LeaveType.is_active.is_(True))
        .order_by(LeaveType.name.asc())
        .all()
    )


def create_leave_type(db: Session, leave_type: LeaveType) -> LeaveType:
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


def update_leave_type(db: Session, leave_type: LeaveType) -> LeaveType:
    db.commit()
    db.refresh(leave_type)
    return leave_type


def delete_leave_type(db: Session, leave_type: LeaveType) -> None:
    db.delete(leave_type)
    db.commit()


def count_balances_by_leave_type(db: Session, leave_type_id: int) -> int:
    return (
        db.query(LeaveBalance)
        .filter(LeaveBalance.leave_type_id == leave_type_id)
        .count()
    )


def count_requests_by_leave_type(db: Session, leave_type_id: int) -> int:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.leave_type_id == leave_type_id)
        .count()
    )


# ============================================================
# LEAVE BALANCE REPOSITORY
# ============================================================

def get_leave_balance_by_id(db: Session, balance_id: int) -> LeaveBalance | None:
    return (
        db.query(LeaveBalance)
        .options(
            joinedload(LeaveBalance.leave_type),
            joinedload(LeaveBalance.employee),
        )
        .filter(LeaveBalance.id == balance_id)
        .first()
    )


def get_leave_balance(
    db: Session,
    employee_id: int,
    leave_type_id: int,
    year: int,
) -> LeaveBalance | None:
    return (
        db.query(LeaveBalance)
        .options(
            joinedload(LeaveBalance.leave_type),
            joinedload(LeaveBalance.employee),
        )
        .filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        )
        .first()
    )


def get_balances_by_employee(
    db: Session,
    employee_id: int,
    year: int | None = None,
) -> list[LeaveBalance]:
    query = (
        db.query(LeaveBalance)
        .options(
            joinedload(LeaveBalance.leave_type),
            joinedload(LeaveBalance.employee),
        )
        .filter(LeaveBalance.employee_id == employee_id)
    )

    if year is not None:
        query = query.filter(LeaveBalance.year == year)

    return query.order_by(LeaveBalance.leave_type_id.asc()).all()


def get_all_balances(
    db: Session,
    employee_id: int | None = None,
    year: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveBalance]:
    query = (
        db.query(LeaveBalance)
        .options(
            joinedload(LeaveBalance.leave_type),
            joinedload(LeaveBalance.employee),
        )
    )

    if employee_id is not None:
        query = query.filter(LeaveBalance.employee_id == employee_id)

    if year is not None:
        query = query.filter(LeaveBalance.year == year)

    return query.order_by(LeaveBalance.id.desc()).offset(skip).limit(limit).all()


def create_leave_balance(db: Session, balance: LeaveBalance) -> LeaveBalance:
    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


def update_leave_balance(db: Session, balance: LeaveBalance) -> LeaveBalance:
    db.commit()
    db.refresh(balance)
    return balance


# ============================================================
# LEAVE REQUEST REPOSITORY
# ============================================================

def get_leave_request_by_id(db: Session, request_id: int) -> LeaveRequest | None:
    return (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.id == request_id)
        .first()
    )


def get_employee_leave_requests(
    db: Session,
    employee_id: int,
    status: LeaveRequestStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveRequest]:
    query = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.employee_id == employee_id)
    )

    if status:
        query = query.filter(LeaveRequest.status == status)

    return query.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()


def get_all_leave_requests(
    db: Session,
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status: LeaveRequestStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveRequest]:
    query = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.reviewer),
        )
    )

    if employee_id is not None:
        query = query.filter(LeaveRequest.employee_id == employee_id)

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status is not None:
        query = query.filter(LeaveRequest.status == status)

    if start_date is not None:
        query = query.filter(LeaveRequest.start_date >= start_date)

    if end_date is not None:
        query = query.filter(LeaveRequest.end_date <= end_date)

    return query.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()


def check_overlapping_requests(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
    exclude_request_id: int | None = None,
) -> LeaveRequest | None:
    """
    Checks if there is any PENDING or APPROVED leave request for this employee
    that overlaps with the date range [start_date, end_date].
    Overlap formula: existing.start_date <= new.end_date AND existing.end_date >= new.start_date
    """
    query = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_([
                LeaveRequestStatus.PENDING,
                LeaveRequestStatus.APPROVED,
            ]),
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
        )
    )

    if exclude_request_id is not None:
        query = query.filter(LeaveRequest.id != exclude_request_id)

    return query.first()


def create_leave_request(db: Session, request: LeaveRequest) -> LeaveRequest:
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def update_leave_request(db: Session, request: LeaveRequest) -> LeaveRequest:
    db.commit()
    db.refresh(request)
    return request
