from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.audit_service.models import AuditAction, AuditLog, AuditStatus


def create_audit_log(
    db: Session,
    action: AuditAction,
    status: AuditStatus,
    user_id: int | None = None,
    email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: str | None = None,
) -> AuditLog:
    """Create and persist an audit log entry."""
    audit_log = AuditLog(
        action=action,
        status=status,
        user_id=user_id,
        email=email,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
        details=details[:255] if details else None,
    )
    db.add(audit_log)
    db.flush()
    return audit_log


def get_audit_logs(
    db: Session,
    action: AuditAction | None = None,
    status: AuditStatus | None = None,
    user_id: int | None = None,
    email: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[AuditLog]]:
    """Retrieve filtered, paginated audit logs ordered by creation time descending."""
    query = db.query(AuditLog).options(joinedload(AuditLog.user))

    if action:
        query = query.filter(AuditLog.action == action)
    if status:
        query = query.filter(AuditLog.status == status)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if email:
        query = query.filter(AuditLog.email.ilike(f"%{email.strip()}%"))
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.email.ilike(term),
                AuditLog.details.ilike(term),
                AuditLog.ip_address.ilike(term),
            )
        )

    total = query.count()
    records = (
        query.order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, records


def get_audit_log_by_id(
    db: Session,
    audit_log_id: int,
) -> AuditLog | None:
    """Fetch a single audit log entry by ID."""
    return (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(AuditLog.id == audit_log_id)
        .first()
    )
