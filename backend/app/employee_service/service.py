from datetime import datetime, timezone
import math
import re

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.authentication_service.models import User
from app.employee_service.models import Employee, EmploymentStatus
from app.employee_service import repository
from app.employee_service.schemas import (
    EmployeeCreate,
    EmployeeProfileUpdate,
    EmployeeStatusUpdate,
    EmployeeUpdate,
)


# ============================================================
# Employee Code Generator
# ============================================================

def generate_next_employee_code(db: Session) -> str:
    """
    Generate the next employee code.

    Example:
        EMP001
        EMP002
        EMP003
    """

    employee_codes = (
        db.query(Employee.employee_code)
        .filter(Employee.employee_code.like("EMP%"))
        .all()
    )

    max_number = 0

    pattern = re.compile(
        r"^EMP(\d+)$",
        re.IGNORECASE
    )

    for row in employee_codes:
        code = row[0]

        if not code:
            continue

        match = pattern.match(code)

        if match:
            number = int(match.group(1))

            if number > max_number:
                max_number = number

    return f"EMP{max_number + 1:03d}"


# ============================================================
# Create Employee
# ============================================================

def create_employee(
    db: Session,
    data: EmployeeCreate,
) -> Employee:

    # --------------------------------------------------------
    # 1. Check email
    # --------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # --------------------------------------------------------
    # 2. Generate employee code
    # --------------------------------------------------------

    employee_code = generate_next_employee_code(db)

    # --------------------------------------------------------
    # 3. Create User
    # --------------------------------------------------------

    user = User(
        email=data.email,
        full_name=(
            f"{data.first_name} {data.last_name}"
        ).strip(),
        role="employee",
        is_active=True,
        is_verified=False,
    )

    db.add(user)
    db.flush()

    # --------------------------------------------------------
    # 4. Create Employee profile
    # --------------------------------------------------------

    employee = Employee(
        user_id=user.id,
        employee_code=employee_code,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        date_of_birth=data.date_of_birth,
        address=data.address,
        joining_date=data.joining_date,
        department_id=data.department_id,
        designation_id=data.designation_id,
        employment_status=EmploymentStatus.ACTIVE,
    )

    db.add(employee)

    # --------------------------------------------------------
    # 5. Commit transaction
    # --------------------------------------------------------

    try:
        db.commit()
        db.refresh(employee)

    except Exception:
        db.rollback()
        raise

    return employee


# ============================================================
# Get Employee By ID
# ============================================================

def get_employee_by_id(
    db: Session,
    employee_id: int,
) -> Employee:

    employee = repository.get_employee_by_id(
        db,
        employee_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return employee


# ============================================================
# Get Employee By User ID
# ============================================================

def get_employee_by_user_id(
    db: Session,
    user_id: int,
) -> Employee:

    employee = repository.get_employee_by_user_id(
        db,
        user_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    return employee


# ============================================================
# List Employees
# ============================================================

def list_employees(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    department_id: int | None = None,
    designation_id: int | None = None,
    employment_status: EmploymentStatus | None = None,
):

    if page < 1:
        page = 1

    if limit < 1:
        limit = 20

    if limit > 100:
        limit = 100

    query = (
        db.query(Employee)
        .join(User, Employee.user_id == User.id)
        .filter(Employee.deleted_at.is_(None))
    )

    # --------------------------------------------------------
    # Department filter
    # --------------------------------------------------------

    if department_id is not None:
        query = query.filter(
            Employee.department_id == department_id
        )

    # --------------------------------------------------------
    # Designation filter
    # --------------------------------------------------------

    if designation_id is not None:
        query = query.filter(
            Employee.designation_id == designation_id
        )

    # --------------------------------------------------------
    # Employment status filter
    # --------------------------------------------------------

    if employment_status is not None:
        query = query.filter(
            Employee.employment_status
            == employment_status
        )

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    if search:
        search_pattern = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Employee.employee_code.ilike(
                    search_pattern
                ),
                Employee.first_name.ilike(
                    search_pattern
                ),
                Employee.last_name.ilike(
                    search_pattern
                ),
                User.email.ilike(
                    search_pattern
                ),
            )
        )

    # --------------------------------------------------------
    # Total count
    # --------------------------------------------------------

    total = query.count()

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    offset = (page - 1) * limit

    employees = (
        query
        .order_by(Employee.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_pages = (
        math.ceil(total / limit)
        if total > 0
        else 1
    )

    return {
        "items": employees,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
    }


# ============================================================
# Update Employee
# ============================================================

def update_employee(
    db: Session,
    employee_id: int,
    data: EmployeeUpdate,
) -> Employee:

    employee = get_employee_by_id(
        db,
        employee_id,
    )

    update_data = data.model_dump(
        exclude_unset=True
    )

    return repository.update_employee(
        db,
        employee,
        update_data,
    )


# ============================================================
# Update Employment Status
# ============================================================

def update_employee_status(
    db: Session,
    employee_id: int,
    data: EmployeeStatusUpdate,
) -> Employee:

    employee = get_employee_by_id(
        db,
        employee_id,
    )

    employee = repository.update_employee_status(
        db,
        employee,
        data.employment_status,
    )

    # Keep User account status synchronized
    if data.employment_status in (
        EmploymentStatus.INACTIVE,
        EmploymentStatus.TERMINATED,
    ):
        employee.user.is_active = False

    elif data.employment_status == EmploymentStatus.ACTIVE:
        employee.user.is_active = True

    db.commit()
    db.refresh(employee)

    return employee


# ============================================================
# Activate Employee
# ============================================================

def activate_employee(
    db: Session,
    employee_id: int,
) -> Employee:

    employee = get_employee_by_id(
        db,
        employee_id,
    )

    employee.employment_status = (
        EmploymentStatus.ACTIVE
    )

    employee.user.is_active = True
    employee.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(employee)

    return employee


# ============================================================
# Deactivate Employee
# ============================================================

def deactivate_employee(
    db: Session,
    employee_id: int,
) -> Employee:

    employee = get_employee_by_id(
        db,
        employee_id,
    )

    employee.employment_status = (
        EmploymentStatus.INACTIVE
    )

    employee.user.is_active = False
    employee.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(employee)

    return employee


# ============================================================
# Archive Employee
# ============================================================

def archive_employee(
    db: Session,
    employee_id: int,
) -> Employee:

    employee = get_employee_by_id(
        db,
        employee_id,
    )

    now = datetime.now(timezone.utc)

    employee.deleted_at = now

    employee.employment_status = (
        EmploymentStatus.INACTIVE
    )

    employee.user.is_active = False

    employee.updated_at = now

    db.commit()
    db.refresh(employee)

    return employee


# ============================================================
# Update Own Profile
# ============================================================

def update_self_profile(
    db: Session,
    user_id: int,
    data: EmployeeProfileUpdate,
) -> Employee:

    employee = get_employee_by_user_id(
        db,
        user_id,
    )

    update_data = data.model_dump(
        exclude_unset=True
    )

    return repository.update_employee(
        db,
        employee,
        update_data,
    )


# ============================================================
# Employee Counts
# ============================================================

def get_employee_counts(
    db: Session,
):

    total_employees = repository.count_employees(
        db
    )

    active_employees = repository.count_active_employees(
        db
    )

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
    }