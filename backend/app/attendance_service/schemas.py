from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.attendance_service.models import AttendanceStatus


class AttendanceCheckIn(BaseModel):
    remarks: str | None = Field(
        default=None,
        max_length=500,
    )


class AttendanceCheckOut(BaseModel):
    remarks: str | None = Field(
        default=None,
        max_length=500,
    )


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    attendance_date: date
    check_in: datetime | None
    check_out: datetime | None
    status: AttendanceStatus
    remarks: str | None
    created_at: datetime
    updated_at: datetime


class AttendanceListResponse(BaseModel):
    total: int
    attendance: list[AttendanceResponse]


class AttendanceDateFilter(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    status: AttendanceStatus | None = None