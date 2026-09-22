from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.complaint_service import repository
from app.complaint_service.models import (
    Complaint,
    ComplaintPriority,
    ComplaintStatus,
)
from app.complaint_service.schemas import (
    ComplaintCreate,
    ComplaintUpdate,
)
from app.employee_service import repository as employee_repository
from app.employee_service.models import Employee, EmploymentStatus


# ============================================================
# HELPER / VALIDATION FUNCTIONS
# ============================================================

def get_active_employee_for_user(db: Session, user_id: int) -> Employee:
    """
    Look up the employee record corresponding to the authenticated user.
    Enforces that employee profile exists and is active.
    """
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


# ============================================================
# EMPLOYEE SERVICE ACTIONS
# ============================================================

def create_complaint(
    db: Session,
    user_id: int,
    data: ComplaintCreate,
) -> Complaint:
    """
    Create a new complaint for the authenticated employee.
    Employee ID is strictly resolved from the authenticated session.
    """
    employee = get_active_employee_for_user(db, user_id)

    complaint = Complaint(
        employee_id=employee.id,
        subject=data.subject.strip(),
        description=data.description.strip(),
        category=data.category.strip(),
        priority=data.priority,
        status=ComplaintStatus.OPEN,
        hr_remarks=None,
        resolved_at=None,
    )

    return repository.create_complaint(db, complaint)


def get_my_complaints(
    db: Session,
    user_id: int,
    status_filter: ComplaintStatus | None = None,
    priority_filter: ComplaintPriority | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Complaint]]:
    """
    List complaints belonging only to the authenticated employee.
    """
    employee = get_active_employee_for_user(db, user_id)

    complaints = repository.get_complaints_by_employee(
        db=db,
        employee_id=employee.id,
        status=status_filter,
        priority=priority_filter,
        skip=skip,
        limit=limit,
    )
    total = repository.count_complaints_by_employee(
        db=db,
        employee_id=employee.id,
        status=status_filter,
        priority=priority_filter,
    )

    return total, complaints


def get_my_complaint(
    db: Session,
    user_id: int,
    complaint_id: int,
) -> Complaint:
    """
    Retrieve a single complaint for the authenticated employee.
    Enforces ownership check.
    """
    employee = get_active_employee_for_user(db, user_id)

    complaint = repository.get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )

    if complaint.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this complaint",
        )

    return complaint


def update_my_complaint(
    db: Session,
    user_id: int,
    complaint_id: int,
    data: ComplaintUpdate,
) -> Complaint:
    """
    Update an OPEN complaint. Only allowed if status is OPEN.
    Employee cannot modify status, hr_remarks, or resolved_at.
    """
    employee = get_active_employee_for_user(db, user_id)

    complaint = repository.get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )

    if complaint.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this complaint",
        )

    if complaint.status != ComplaintStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only complaints with OPEN status can be updated by employee",
        )

    update_dict = {}
    if data.subject is not None:
        update_dict["subject"] = data.subject.strip()
    if data.description is not None:
        update_dict["description"] = data.description.strip()
    if data.category is not None:
        update_dict["category"] = data.category.strip()
    if data.priority is not None:
        update_dict["priority"] = data.priority

    return repository.update_complaint(db, complaint, update_dict)


# ============================================================
# HR SERVICE ACTIONS
# ============================================================

ALLOWED_STATUS_TRANSITIONS: dict[ComplaintStatus, set[ComplaintStatus]] = {
    ComplaintStatus.OPEN: {ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED},
    ComplaintStatus.IN_PROGRESS: {ComplaintStatus.OPEN, ComplaintStatus.RESOLVED},
    ComplaintStatus.RESOLVED: {ComplaintStatus.IN_PROGRESS, ComplaintStatus.CLOSED},
    ComplaintStatus.CLOSED: set(),  # CLOSED remains CLOSED
}


def get_all_complaints(
    db: Session,
    status_filter: ComplaintStatus | None = None,
    priority_filter: ComplaintPriority | None = None,
    category: str | None = None,
    employee_id: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Complaint]]:
    """
    HR listing with filtering, search, and pagination.
    """
    complaints = repository.get_all_complaints(
        db=db,
        status=status_filter,
        priority=priority_filter,
        category=category,
        employee_id=employee_id,
        search=search,
        skip=skip,
        limit=limit,
    )
    total = repository.count_all_complaints(
        db=db,
        status=status_filter,
        priority=priority_filter,
        category=category,
        employee_id=employee_id,
        search=search,
    )

    return total, complaints


def get_complaint_details(
    db: Session,
    complaint_id: int,
) -> Complaint:
    """
    HR viewing individual complaint details.
    """
    complaint = repository.get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )
    return complaint


def update_complaint_status(
    db: Session,
    complaint_id: int,
    new_status: ComplaintStatus,
    hr_remarks: str | None = None,
) -> Complaint:
    """
    HR updates complaint status and remarks.
    Enforces allowed lifecycle:
    - OPEN -> IN_PROGRESS, RESOLVED
    - IN_PROGRESS -> OPEN, RESOLVED
    - RESOLVED -> IN_PROGRESS, CLOSED
    - CLOSED remains CLOSED
    Automatically sets/clears resolved_at.
    """
    complaint = repository.get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )

    current_status = complaint.status

    # If status is changing, validate transition
    if new_status != current_status:
        allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition complaint status from {current_status.value} to {new_status.value}",
            )

    # Handle resolved_at
    if new_status == ComplaintStatus.RESOLVED:
        resolved_at = datetime.now(timezone.utc)
    elif current_status == ComplaintStatus.RESOLVED and new_status == ComplaintStatus.IN_PROGRESS:
        resolved_at = None
    elif new_status == ComplaintStatus.CLOSED:
        # Preserve existing resolved_at or set if not present
        resolved_at = complaint.resolved_at or datetime.now(timezone.utc)
    else:
        resolved_at = complaint.resolved_at

    return repository.update_complaint_status(
        db=db,
        complaint=complaint,
        status=new_status,
        hr_remarks=hr_remarks,
        resolved_at=resolved_at,
    )


def get_complaint_counts(db: Session) -> dict:
    """
    Return total complaints and count broken down by status.
    """
    total = repository.count_complaints(db)
    by_status = repository.count_complaints_by_status(db)
    return {
        "total": total,
        "by_status": by_status,
    }
