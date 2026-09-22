from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.complaint_service.models import ComplaintPriority, ComplaintStatus


class EmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class ComplaintCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5)
    category: str = Field(..., min_length=2, max_length=100)
    priority: ComplaintPriority = ComplaintPriority.MEDIUM

    model_config = ConfigDict(extra="forbid")


class ComplaintUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=5)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    priority: ComplaintPriority | None = None

    model_config = ConfigDict(extra="forbid")


class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    hr_remarks: str | None = None

    model_config = ConfigDict(extra="forbid")


class ComplaintResponse(BaseModel):
    id: int
    employee_id: int
    subject: str
    description: str
    category: str
    priority: ComplaintPriority
    status: ComplaintStatus
    hr_remarks: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class ComplaintListResponse(BaseModel):
    total: int
    complaints: list[ComplaintResponse]


class ComplaintCountResponse(BaseModel):
    total: int
    by_status: dict[str, int]
