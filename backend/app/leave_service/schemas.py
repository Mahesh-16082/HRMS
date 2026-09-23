from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.leave_service.models import LeaveRequestStatus


# ============================================================
# SUMMARY SCHEMAS FOR NESTED RESPONSES
# ============================================================

class EmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    id: int
    email: str

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# LEAVE TYPE SCHEMAS
# ============================================================

class LeaveTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    annual_quota: float = Field(default=0.0, ge=0.0)
    is_active: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    annual_quota: float | None = Field(default=None, ge=0.0)
    is_active: bool | None = None


class LeaveTypeResponse(LeaveTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveTypeListResponse(BaseModel):
    total: int
    leave_types: list[LeaveTypeResponse]


# ============================================================
# LEAVE BALANCE SCHEMAS
# ============================================================

class LeaveBalanceCreate(BaseModel):
    employee_id: int
    leave_type_id: int
    year: int = Field(..., ge=2000, le=2100)
    allocated: float = Field(..., ge=0.0)
    used: float = Field(default=0.0, ge=0.0)
    available: float | None = None


class LeaveBalanceUpdate(BaseModel):
    allocated: float | None = Field(default=None, ge=0.0)
    used: float | None = Field(default=None, ge=0.0)
    available: float | None = Field(default=None, ge=0.0)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    year: int
    allocated: float
    used: float
    available: float
    created_at: datetime
    updated_at: datetime
    leave_type: LeaveTypeResponse | None = None
    employee: EmployeeSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceSummary(BaseModel):
    id: int | None = None
    allocated: float
    used: float
    available: float

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceListResponse(BaseModel):
    total: int
    balances: list[LeaveBalanceResponse]


# ============================================================
# LEAVE REQUEST SCHEMAS
# ============================================================

class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: str = Field(..., min_length=1, max_length=1000)


class LeaveRequestReject(BaseModel):
    rejection_reason: str = Field(..., min_length=1, max_length=1000)


class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    start_date: date
    end_date: date
    number_of_days: float
    reason: str
    status: LeaveRequestStatus
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    leave_type: LeaveTypeResponse | None = None
    employee: EmployeeSummary | None = None
    reviewer: UserSummary | None = None
    leave_balance: LeaveBalanceSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class LeaveRequestListResponse(BaseModel):
    total: int
    requests: list[LeaveRequestResponse]

