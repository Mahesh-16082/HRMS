from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.employee_service import repository as employee_repository
from app.employee_service.models import EmploymentStatus
from app.leave_service import repository
from app.leave_service.models import (
    LeaveBalance,
    LeaveRequest,
    LeaveRequestStatus,
    LeaveType,
)
from app.leave_service.schemas import (
    LeaveBalanceCreate,
    LeaveBalanceUpdate,
    LeaveRequestCreate,
    LeaveTypeCreate,
    LeaveTypeUpdate,
)


# ============================================================
# HELPER / VALIDATION FUNCTIONS
# ============================================================

def get_employee_for_user(db: Session, user_id: int):
    employee = employee_repository.get_employee_by_user_id(db, user_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee account is not active",
        )

    return employee


def calculate_leave_days(start_date: date, end_date: date) -> float:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date",
        )

    # Inclusive calendar days
    days = float((end_date - start_date).days + 1)
    return days


def ensure_employee_yearly_balances(
    db: Session,
    employee_id: int,
    year: int | None = None,
) -> list[LeaveBalance]:
    """
    Ensure the employee has LeaveBalance records for all active leave types for the specified calendar year.
    Defaults to the current calendar year (datetime.now(timezone.utc).year).

    Behavior:
    - Queries active leave types (SICK=15, CASUAL=15).
    - Checks existing LeaveBalance records for (employee_id, leave_type_id, year).
    - Creates only missing balances with allocated = lt.annual_quota, used = 0.0, available = lt.annual_quota.
    - Idempotent: Never overwrites, resets, or duplicates existing records.
    - Preserves existing used_days and available_days.
    - Safe against concurrency / unique constraint conflicts.
    - Returns all LeaveBalance records for this employee and year.
    """
    if year is None:
        year = datetime.now(timezone.utc).year

    # 1. Fetch active leave types
    active_types = repository.get_active_leave_types(db)
    if not active_types:
        return repository.get_balances_by_employee(db, employee_id=employee_id, year=year)

    # 2. Fetch existing balances for this employee and year
    existing_balances = repository.get_balances_by_employee(db, employee_id=employee_id, year=year)
    existing_type_ids = {b.leave_type_id for b in existing_balances}

    # 3. Create missing balance records
    new_records_added = False
    for lt in active_types:
        if lt.id not in existing_type_ids:
            new_balance = LeaveBalance(
                employee_id=employee_id,
                leave_type_id=lt.id,
                year=year,
                allocated=lt.annual_quota,
                used=0.0,
                available=lt.annual_quota,
            )
            db.add(new_balance)
            new_records_added = True

    if new_records_added:
        try:
            db.commit()
        except Exception:
            db.rollback()

    return repository.get_balances_by_employee(db, employee_id=employee_id, year=year)


# ============================================================
# EMPLOYEE SERVICE OPERATIONS
# ============================================================

def apply_leave_request(
    db: Session,
    user_id: int,
    data: LeaveRequestCreate,
) -> LeaveRequest:
    employee = get_employee_for_user(db, user_id)

    # Validate dates and calculate number of days
    number_of_days = calculate_leave_days(data.start_date, data.end_date)

    # Verify leave type exists and is active
    leave_type = repository.get_leave_type_by_id(db, data.leave_type_id)
    if not leave_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave type not found",
        )

    if not leave_type.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave type is inactive and cannot be selected",
        )

    # Verify employee leave balance
    request_year = data.start_date.year
    ensure_employee_yearly_balances(db, employee.id, request_year)
    balance = repository.get_leave_balance(
        db,
        employee_id=employee.id,
        leave_type_id=data.leave_type_id,
        year=request_year,
    )

    if not balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No leave balance allocated for this leave type in year {request_year}",
        )

    if balance.available < number_of_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient leave balance. Available: {balance.available}, Requested: {number_of_days}",
        )

    # Verify no overlapping requests (PENDING or APPROVED)
    overlap = repository.check_overlapping_requests(
        db,
        employee_id=employee.id,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave request conflicts with an existing pending or approved leave request",
        )

    # Create leave request with PENDING status (balance is NOT consumed until approved)
    leave_request = LeaveRequest(
        employee_id=employee.id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        number_of_days=number_of_days,
        reason=data.reason.strip(),
        status=LeaveRequestStatus.PENDING,
    )

    return repository.create_leave_request(db, leave_request)


def get_my_leave_requests(
    db: Session,
    user_id: int,
    status_filter: LeaveRequestStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveRequest]:
    employee = get_employee_for_user(db, user_id)
    return repository.get_employee_leave_requests(
        db,
        employee_id=employee.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )


def get_my_leave_request(
    db: Session,
    user_id: int,
    request_id: int,
) -> LeaveRequest:
    employee = get_employee_for_user(db, user_id)
    leave_request = repository.get_leave_request_by_id(db, request_id)

    if not leave_request or leave_request.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    return leave_request


def cancel_my_leave_request(
    db: Session,
    user_id: int,
    request_id: int,
) -> LeaveRequest:
    employee = get_employee_for_user(db, user_id)
    leave_request = repository.get_leave_request_by_id(db, request_id)

    if not leave_request or leave_request.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave_request.status != LeaveRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be cancelled. Current status is {leave_request.status.value}",
        )

    leave_request.status = LeaveRequestStatus.CANCELLED
    # Balance is untouched as pending requests never consume balance
    return repository.update_leave_request(db, leave_request)


def get_my_leave_balances(
    db: Session,
    user_id: int,
    year: int | None = None,
) -> list[LeaveBalance]:
    employee = get_employee_for_user(db, user_id)
    target_year = year or datetime.now(timezone.utc).year
    ensure_employee_yearly_balances(db, employee.id, target_year)
    return repository.get_balances_by_employee(
        db,
        employee_id=employee.id,
        year=year,
    )


def get_active_leave_types(db: Session) -> list[LeaveType]:
    return repository.get_active_leave_types(db)


# ============================================================
# HR SERVICE OPERATIONS: LEAVE REQUESTS
# ============================================================

def get_all_leave_requests(
    db: Session,
    employee_id: int | None = None,
    leave_type_id: int | None = None,
    status_filter: LeaveRequestStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveRequest]:
    requests = repository.get_all_leave_requests(
        db=db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        status=status_filter,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    if requests:
        emp_ids = {r.employee_id for r in requests}
        type_ids = {r.leave_type_id for r in requests}
        years = {r.start_date.year for r in requests}
        balances = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id.in_(emp_ids),
                LeaveBalance.leave_type_id.in_(type_ids),
                LeaveBalance.year.in_(years),
            )
            .all()
        )
        balance_map = {
            (b.employee_id, b.leave_type_id, b.year): b
            for b in balances
        }
        for r in requests:
            b = balance_map.get((r.employee_id, r.leave_type_id, r.start_date.year))
            if not b:
                ensure_employee_yearly_balances(db, r.employee_id, r.start_date.year)
                b = repository.get_leave_balance(db, r.employee_id, r.leave_type_id, r.start_date.year)
            r.leave_balance = b
    return requests


def get_leave_request_by_id(db: Session, request_id: int) -> LeaveRequest:
    leave_request = repository.get_leave_request_by_id(db, request_id)
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )
    b = repository.get_leave_balance(
        db,
        employee_id=leave_request.employee_id,
        leave_type_id=leave_request.leave_type_id,
        year=leave_request.start_date.year,
    )
    if not b:
        ensure_employee_yearly_balances(db, leave_request.employee_id, leave_request.start_date.year)
        b = repository.get_leave_balance(
            db,
            employee_id=leave_request.employee_id,
            leave_type_id=leave_request.leave_type_id,
            year=leave_request.start_date.year,
        )
    leave_request.leave_balance = b
    return leave_request


def approve_leave_request(
    db: Session,
    reviewer_user_id: int,
    request_id: int,
) -> LeaveRequest:
    leave_request = repository.get_leave_request_by_id(db, request_id)
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave_request.status != LeaveRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be approved. Current status is {leave_request.status.value}",
        )

    # Fetch employee balance for the request year
    request_year = leave_request.start_date.year
    balance = repository.get_leave_balance(
        db,
        employee_id=leave_request.employee_id,
        leave_type_id=leave_request.leave_type_id,
        year=request_year,
    )

    if not balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee does not have a leave balance record for this leave type",
        )

    if balance.available < leave_request.number_of_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance to approve request. Available: {balance.available}, Required: {leave_request.number_of_days}",
        )

    # Deduct balance: increase used, decrease available, keep allocated unchanged
    balance.used += leave_request.number_of_days
    balance.available = round(balance.allocated - balance.used, 2)

    if balance.available < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calculated available balance cannot be negative",
        )

    now = datetime.now(timezone.utc)
    leave_request.status = LeaveRequestStatus.APPROVED
    leave_request.reviewed_by = reviewer_user_id
    leave_request.reviewed_at = now

    db.commit()
    db.refresh(leave_request)
    db.refresh(balance)
    leave_request.leave_balance = balance
    return leave_request


def reject_leave_request(
    db: Session,
    reviewer_user_id: int,
    request_id: int,
    rejection_reason: str,
) -> LeaveRequest:
    leave_request = repository.get_leave_request_by_id(db, request_id)
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave_request.status != LeaveRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be rejected. Current status is {leave_request.status.value}",
        )

    if not rejection_reason or not rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required",
        )

    now = datetime.now(timezone.utc)
    leave_request.status = LeaveRequestStatus.REJECTED
    leave_request.rejection_reason = rejection_reason.strip()
    leave_request.reviewed_by = reviewer_user_id
    leave_request.reviewed_at = now

    # Balance is NOT consumed
    db.commit()
    db.refresh(leave_request)
    leave_request.leave_balance = repository.get_leave_balance(
        db,
        employee_id=leave_request.employee_id,
        leave_type_id=leave_request.leave_type_id,
        year=leave_request.start_date.year,
    )
    return leave_request


def revoke_leave_request(
    db: Session,
    reviewer_user_id: int,
    request_id: int,
) -> LeaveRequest:
    leave_request = repository.get_leave_request_by_id(db, request_id)
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave_request.status == LeaveRequestStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This leave request has already been revoked",
        )

    if leave_request.status != LeaveRequestStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only approved leave requests can be revoked. Current status is {leave_request.status.value}",
        )

    # Fetch employee balance for the request year
    request_year = leave_request.start_date.year
    balance = repository.get_leave_balance(
        db,
        employee_id=leave_request.employee_id,
        leave_type_id=leave_request.leave_type_id,
        year=request_year,
    )

    if not balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee leave balance record not found to restore days",
        )

    # Restore the EXACT number of days that were deducted when the leave was approved:
    # balance.used decreases, balance.available increases, balance.allocated stays unchanged
    balance.used = max(0.0, round(balance.used - leave_request.number_of_days, 2))
    balance.available = round(balance.allocated - balance.used, 2)

    now = datetime.now(timezone.utc)
    leave_request.status = LeaveRequestStatus.REVOKED
    leave_request.reviewed_by = reviewer_user_id
    leave_request.reviewed_at = now

    db.commit()
    db.refresh(leave_request)
    db.refresh(balance)
    leave_request.leave_balance = balance
    return leave_request


# ============================================================
# HR SERVICE OPERATIONS: LEAVE TYPES
# ============================================================

def create_leave_type(db: Session, data: LeaveTypeCreate) -> LeaveType:
    code = data.code.strip().upper()
    name = data.name.strip()

    if repository.get_leave_type_by_code(db, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave type with code '{code}' already exists",
        )

    if repository.get_leave_type_by_name(db, name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave type with name '{name}' already exists",
        )

    leave_type = LeaveType(
        name=name,
        code=code,
        description=data.description.strip() if data.description else None,
        annual_quota=data.annual_quota,
        is_active=data.is_active,
    )

    return repository.create_leave_type(db, leave_type)


def get_all_leave_types(db: Session) -> list[LeaveType]:
    return repository.get_all_leave_types(db)


def get_leave_type_by_id(db: Session, leave_type_id: int) -> LeaveType:
    leave_type = repository.get_leave_type_by_id(db, leave_type_id)
    if not leave_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave type not found",
        )
    return leave_type


def update_leave_type(
    db: Session,
    leave_type_id: int,
    data: LeaveTypeUpdate,
) -> LeaveType:
    leave_type = get_leave_type_by_id(db, leave_type_id)

    if data.name is not None:
        name = data.name.strip()
        existing = repository.get_leave_type_by_name(db, name)
        if existing and existing.id != leave_type.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leave type with name '{name}' already exists",
            )
        leave_type.name = name

    if data.code is not None:
        code = data.code.strip().upper()
        existing = repository.get_leave_type_by_code(db, code)
        if existing and existing.id != leave_type.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leave type with code '{code}' already exists",
            )
        leave_type.code = code

    if data.description is not None:
        leave_type.description = data.description.strip() if data.description else None

    if data.annual_quota is not None:
        leave_type.annual_quota = data.annual_quota

    if data.is_active is not None:
        leave_type.is_active = data.is_active

    return repository.update_leave_type(db, leave_type)


def activate_leave_type(db: Session, leave_type_id: int) -> LeaveType:
    leave_type = get_leave_type_by_id(db, leave_type_id)
    leave_type.is_active = True
    return repository.update_leave_type(db, leave_type)


def deactivate_leave_type(db: Session, leave_type_id: int) -> LeaveType:
    leave_type = get_leave_type_by_id(db, leave_type_id)
    leave_type.is_active = False
    return repository.update_leave_type(db, leave_type)


def delete_leave_type(db: Session, leave_type_id: int) -> None:
    leave_type = get_leave_type_by_id(db, leave_type_id)

    balance_count = repository.count_balances_by_leave_type(db, leave_type_id)
    request_count = repository.count_requests_by_leave_type(db, leave_type_id)

    if balance_count > 0 or request_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete leave type with existing records "
                f"({balance_count} balances, {request_count} requests). "
                f"Please deactivate it instead."
            ),
        )

    repository.delete_leave_type(db, leave_type)


# ============================================================
# HR SERVICE OPERATIONS: LEAVE BALANCES
# ============================================================

def create_leave_balance(db: Session, data: LeaveBalanceCreate) -> LeaveBalance:
    # Verify employee exists
    employee = employee_repository.get_employee_by_id(db, data.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {data.employee_id} not found",
        )

    # Verify leave type exists
    leave_type = repository.get_leave_type_by_id(db, data.leave_type_id)
    if not leave_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave type with ID {data.leave_type_id} not found",
        )

    # Check for duplicate balance
    existing = repository.get_leave_balance(
        db,
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        year=data.year,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Leave balance already exists for employee {data.employee_id}, "
                f"leave type {data.leave_type_id}, year {data.year}"
            ),
        )

    available = (
        data.available
        if data.available is not None
        else round(data.allocated - data.used, 2)
    )

    if available < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Available balance cannot be negative",
        )

    balance = LeaveBalance(
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        year=data.year,
        allocated=data.allocated,
        used=data.used,
        available=available,
    )

    return repository.create_leave_balance(db, balance)


def get_all_balances(
    db: Session,
    employee_id: int | None = None,
    year: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[LeaveBalance]:
    return repository.get_all_balances(
        db=db,
        employee_id=employee_id,
        year=year,
        skip=skip,
        limit=limit,
    )


def get_balances_by_employee_id(
    db: Session,
    employee_id: int,
    year: int | None = None,
) -> list[LeaveBalance]:
    employee = employee_repository.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    target_year = year or datetime.now(timezone.utc).year
    ensure_employee_yearly_balances(db, employee_id, target_year)
    return repository.get_balances_by_employee(db, employee_id, year)


def update_leave_balance(
    db: Session,
    balance_id: int,
    data: LeaveBalanceUpdate,
) -> LeaveBalance:
    balance = repository.get_leave_balance_by_id(db, balance_id)
    if not balance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave balance record not found",
        )

    if data.allocated is not None:
        balance.allocated = data.allocated

    if data.used is not None:
        balance.used = data.used

    if data.available is not None:
        balance.available = data.available
    else:
        balance.available = round(balance.allocated - balance.used, 2)

    if balance.available < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Available balance cannot be negative",
        )

    return repository.update_leave_balance(db, balance)
