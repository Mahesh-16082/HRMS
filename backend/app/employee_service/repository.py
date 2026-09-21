from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.employee_service.models import (
    Employee,
    EmploymentStatus,
)


# =========================
# GET EMPLOYEE
# =========================

def get_employee_by_id(
    db: Session,
    employee_id: int,
):
    return (
        db.query(Employee)
        .filter(
            Employee.id == employee_id,
            Employee.deleted_at.is_(None),
        )
        .first()
    )


def get_employee_by_user_id(
    db: Session,
    user_id: int,
):
    return (
        db.query(Employee)
        .filter(
            Employee.user_id == user_id,
            Employee.deleted_at.is_(None),
        )
        .first()
    )


def get_employee_by_code(
    db: Session,
    employee_code: str,
):
    return (
        db.query(Employee)
        .filter(
            Employee.employee_code == employee_code,
            Employee.deleted_at.is_(None),
        )
        .first()
    )


# =========================
# CHECK DUPLICATES
# =========================

def employee_exists_for_user(
    db: Session,
    user_id: int,
):
    return (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
        is not None
    )


# =========================
# CREATE EMPLOYEE
# =========================

def create_employee(
    db: Session,
    employee: Employee,
):
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


# =========================
# UPDATE EMPLOYEE
# =========================

def update_employee(
    db: Session,
    employee: Employee,
    update_data: dict,
):
    for field, value in update_data.items():
        setattr(employee, field, value)

    employee.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(employee)

    return employee


# =========================
# DELETE / ARCHIVE EMPLOYEE
# =========================

def soft_delete_employee(
    db: Session,
    employee: Employee,
):
    employee.deleted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(employee)

    return employee


# =========================
# EMPLOYEE STATUS
# =========================

def update_employee_status(
    db: Session,
    employee: Employee,
    status: EmploymentStatus,
):
    employee.employment_status = status
    employee.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(employee)

    return employee


# =========================
# LIST EMPLOYEES
# =========================

def get_employees(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    return (
        db.query(Employee)
        .filter(Employee.deleted_at.is_(None))
        .order_by(Employee.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# =========================
# COUNT EMPLOYEES
# =========================

def count_employees(
    db: Session,
):
    return (
        db.query(Employee)
        .filter(Employee.deleted_at.is_(None))
        .count()
    )


# =========================
# COUNT ACTIVE EMPLOYEES
# =========================

def count_active_employees(
    db: Session,
):
    return (
        db.query(Employee)
        .filter(
            Employee.deleted_at.is_(None),
            Employee.employment_status
            == EmploymentStatus.ACTIVE,
        )
        .count()
    )