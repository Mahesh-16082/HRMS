from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.work_report_service.models import WorkReportStatus


# Summary Schemas for Nested Relationships
class EmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class ProjectSummary(BaseModel):
    id: int
    project_name: str
    project_code: str

    model_config = ConfigDict(from_attributes=True)


class ReviewerSummary(BaseModel):
    id: int
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


# Request Schemas
class WorkReportCreate(BaseModel):
    work_date: date | None = Field(default=None, description="Report date (defaults to today if omitted)")
    project_id: int | None = Field(default=None, description="Optional assigned project ID")
    title: str = Field(..., min_length=3, max_length=200, description="Brief headline/summary")
    tasks_completed: str = Field(..., min_length=5, description="Detailed deliverables and tasks completed")
    plans_for_tomorrow: str | None = Field(default=None, description="Tasks planned for the next day")
    blockers: str | None = Field(default=None, description="Impediments, blockers, or dependencies")
    hours_worked: float = Field(default=8.0, ge=0.25, le=24.0, description="Hours worked (0.25 to 24.0)")
    submit: bool = Field(default=False, description="Set to True to immediately submit rather than draft")


class WorkReportUpdate(BaseModel):
    project_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=200)
    tasks_completed: str | None = Field(default=None, min_length=5)
    plans_for_tomorrow: str | None = None
    blockers: str | None = None
    hours_worked: float | None = Field(default=None, ge=0.25, le=24.0)


class WorkReportReview(BaseModel):
    status: WorkReportStatus = Field(..., description="Must be APPROVED or REJECTED")
    review_feedback: str | None = Field(default=None, description="Remarks from HR (required for REJECTED)")


# Response Schemas
class WorkReportAttachmentResponse(BaseModel):
    id: int
    work_report_id: int
    original_filename: str
    file_url: str
    file_type: str
    file_size: int
    uploaded_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkReportResponse(BaseModel):
    id: int
    employee_id: int
    project_id: int | None = None
    work_date: date
    title: str
    tasks_completed: str
    plans_for_tomorrow: str | None = None
    blockers: str | None = None
    hours_worked: float
    status: WorkReportStatus
    submitted_at: datetime | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_feedback: str | None = None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeSummary | None = None
    project: ProjectSummary | None = None
    reviewer: ReviewerSummary | None = None
    attachment: WorkReportAttachmentResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkReportListResponse(BaseModel):
    total: int
    work_reports: list[WorkReportResponse]
    skip: int = 0
    limit: int = 20

    model_config = ConfigDict(from_attributes=True)


class WorkReportTodayStatusResponse(BaseModel):
    has_submitted: bool
    report: WorkReportResponse | None = None

    model_config = ConfigDict(from_attributes=True)
