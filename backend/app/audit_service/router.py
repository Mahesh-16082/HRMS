from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.audit_service import service
from app.audit_service.models import AuditAction, AuditStatus
from app.audit_service.schemas import AuditLogListResponse, AuditLogResponse
from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db

router = APIRouter(
    prefix="/api/audit-logs",
    tags=["Audit Logs"],
)


@router.get(
    "",
    response_model=AuditLogListResponse,
)
def list_audit_logs(
    action: AuditAction | None = Query(default=None, description="Filter by action: LOGIN, LOGOUT, OTP_VERIFICATION"),
    status: AuditStatus | None = Query(default=None, description="Filter by status: SUCCESS, FAILED"),
    user_id: int | None = Query(default=None, description="Filter by user ID"),
    email: str | None = Query(default=None, description="Filter by email address"),
    start_date: datetime | None = Query(default=None, description="Filter from timestamp"),
    end_date: datetime | None = Query(default=None, description="Filter until timestamp"),
    search: str | None = Query(default=None, description="Search across email, details, or IP"),
    skip: int = Query(default=0, ge=0, description="Records to skip"),
    limit: int = Query(default=50, ge=1, le=100, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, audit_logs = service.list_audit_logs(
        db=db,
        current_user=current_user,
        action=action,
        status_filter=status,
        user_id=user_id,
        email=email,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )

    return AuditLogListResponse(
        total=total,
        audit_logs=audit_logs,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{audit_log_id}",
    response_model=AuditLogResponse,
)
def get_audit_log_by_id(
    audit_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_audit_log_details(
        db=db,
        current_user=current_user,
        audit_log_id=audit_log_id,
    )
