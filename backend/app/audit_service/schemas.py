from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.audit_service.models import AuditAction, AuditStatus


class AuditLogUserSummary(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    role: str

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    action: AuditAction
    status: AuditStatus
    user_id: int | None = None
    email: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    details: str | None = None
    created_at: datetime
    user: AuditLogUserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    total: int
    audit_logs: list[AuditLogResponse]
    skip: int = 0
    limit: int = 50

    model_config = ConfigDict(from_attributes=True)
