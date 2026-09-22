from datetime import datetime, timezone
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.complaint_service.models import (
    Complaint,
    ComplaintPriority,
    ComplaintStatus,
)
from app.employee_service.models import Employee


def create_complaint(db: Session, complaint: Complaint) -> Complaint:
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


def get_complaint_by_id(db: Session, complaint_id: int) -> Complaint | None:
    return (
        db.query(Complaint)
        .options(joinedload(Complaint.employee))
        .filter(Complaint.id == complaint_id)
        .first()
    )


def get_complaints_by_employee(
    db: Session,
    employee_id: int,
    status: ComplaintStatus | None = None,
    priority: ComplaintPriority | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Complaint]:
    query = (
        db.query(Complaint)
        .options(joinedload(Complaint.employee))
        .filter(Complaint.employee_id == employee_id)
    )

    if status:
        query = query.filter(Complaint.status == status)

    if priority:
        query = query.filter(Complaint.priority == priority)

    return (
        query.order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_complaints_by_employee(
    db: Session,
    employee_id: int,
    status: ComplaintStatus | None = None,
    priority: ComplaintPriority | None = None,
) -> int:
    query = db.query(Complaint).filter(Complaint.employee_id == employee_id)

    if status:
        query = query.filter(Complaint.status == status)

    if priority:
        query = query.filter(Complaint.priority == priority)

    return query.count()


def _build_complaints_query(
    db: Session,
    status: ComplaintStatus | None = None,
    priority: ComplaintPriority | None = None,
    category: str | None = None,
    employee_id: int | None = None,
    search: str | None = None,
):
    query = db.query(Complaint).options(joinedload(Complaint.employee))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.join(Complaint.employee).filter(
            or_(
                Complaint.subject.ilike(search_term),
                Complaint.description.ilike(search_term),
                Complaint.category.ilike(search_term),
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term),
                Employee.employee_code.ilike(search_term),
            )
        )

    if status:
        query = query.filter(Complaint.status == status)

    if priority:
        query = query.filter(Complaint.priority == priority)

    if category:
        query = query.filter(Complaint.category.ilike(f"%{category.strip()}%"))

    if employee_id:
        query = query.filter(Complaint.employee_id == employee_id)

    return query


def get_all_complaints(
    db: Session,
    status: ComplaintStatus | None = None,
    priority: ComplaintPriority | None = None,
    category: str | None = None,
    employee_id: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Complaint]:
    query = _build_complaints_query(
        db=db,
        status=status,
        priority=priority,
        category=category,
        employee_id=employee_id,
        search=search,
    )

    return (
        query.order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_all_complaints(
    db: Session,
    status: ComplaintStatus | None = None,
    priority: ComplaintPriority | None = None,
    category: str | None = None,
    employee_id: int | None = None,
    search: str | None = None,
) -> int:
    query = _build_complaints_query(
        db=db,
        status=status,
        priority=priority,
        category=category,
        employee_id=employee_id,
        search=search,
    )

    return query.count()


def update_complaint(
    db: Session,
    complaint: Complaint,
    update_data: dict,
) -> Complaint:
    for field, value in update_data.items():
        if value is not None:
            setattr(complaint, field, value)

    complaint.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(complaint)
    return complaint


def update_complaint_status(
    db: Session,
    complaint: Complaint,
    status: ComplaintStatus,
    hr_remarks: str | None = None,
    resolved_at: datetime | None = None,
) -> Complaint:
    complaint.status = status
    if hr_remarks is not None:
        complaint.hr_remarks = hr_remarks
    complaint.resolved_at = resolved_at
    complaint.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(complaint)
    return complaint


def count_complaints(
    db: Session,
    employee_id: int | None = None,
    status: ComplaintStatus | None = None,
) -> int:
    query = db.query(Complaint)
    if employee_id is not None:
        query = query.filter(Complaint.employee_id == employee_id)
    if status is not None:
        query = query.filter(Complaint.status == status)
    return query.count()


def count_complaints_by_status(db: Session) -> dict[str, int]:
    rows = (
        db.query(Complaint.status, func.count(Complaint.id))
        .group_by(Complaint.status)
        .all()
    )
    result = {s.value: 0 for s in ComplaintStatus}
    for status_val, count in rows:
        val = status_val.value if hasattr(status_val, "value") else str(status_val)
        result[val] = count
    return result
