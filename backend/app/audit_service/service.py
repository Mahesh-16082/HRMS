import logging
from datetime import datetime

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit_service import repository
from app.audit_service.models import AuditAction, AuditLog, AuditStatus
from app.authentication_service.models import User
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


def extract_client_info(request: Request | None) -> tuple[str | None, str | None]:
    """Safely extract client IP and User-Agent from a FastAPI Request."""
    if not request:
        return None, None

    # Check forward headers if behind reverse proxy
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            ip = real_ip.strip()
        else:
            ip = request.client.host if request.client else None

    user_agent = request.headers.get("user-agent")
    if user_agent and len(user_agent) > 500:
        user_agent = user_agent[:500]

    return ip, user_agent


def record_audit_event(
    action: AuditAction,
    status: AuditStatus,
    user_id: int | None = None,
    email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: str | None = None,
) -> AuditLog | None:
    """
    Record an authentication audit log in an isolated database session.

    Guarantees:
    - Dedicated database transaction: An audit failure will NEVER rollback
      or interfere with the main authentication transaction.
    - Zero sensitive data: Never pass or log raw OTPs, passwords, or tokens.
    - Non-blocking: Catch and log all errors, returning None gracefully.
    """
    audit_db: Session = SessionLocal()
    try:
        log_entry = repository.create_audit_log(
            db=audit_db,
            action=action,
            status=status,
            user_id=user_id,
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )
        audit_db.commit()
        audit_db.refresh(log_entry)
        return log_entry
    except Exception as exc:
        logger.error(
            "Failed to record audit log for action=%s, user_id=%s, email=%s: %s",
            action,
            user_id,
            email,
            exc,
            exc_info=True,
        )
        try:
            audit_db.rollback()
        except Exception:
            pass
        return None
    finally:
        try:
            audit_db.close()
        except Exception:
            pass


def list_audit_logs(
    db: Session,
    current_user: User,
    action: AuditAction | None = None,
    status_filter: AuditStatus | None = None,
    user_id: int | None = None,
    email: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[AuditLog]]:
    """Retrieve audit logs for authorized HR personnel."""
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR personnel can view audit logs.",
        )

    return repository.get_audit_logs(
        db=db,
        action=action,
        status=status_filter,
        user_id=user_id,
        email=email,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )


def get_audit_log_details(
    db: Session,
    current_user: User,
    audit_log_id: int,
) -> AuditLog:
    """Fetch single audit log by ID for authorized HR personnel."""
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR personnel can view audit logs.",
        )

    log_entry = repository.get_audit_log_by_id(db=db, audit_log_id=audit_log_id)
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log record not found.",
        )
    return log_entry
