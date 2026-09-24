from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.employee_service.models import EmploymentStatus


# =========================
# CREATE EMPLOYEE
# =========================

class EmployeeCreate(BaseModel):
    email: EmailStr

    first_name: str = Field(
        min_length=1,
        max_length=100
    )

    last_name: str = Field(
        min_length=1,
        max_length=100
    )

    phone: str | None = Field(
        default=None,
        max_length=20
    )

    date_of_birth: date | None = None

    address: str | None = Field(
        default=None,
        max_length=255
    )

    joining_date: date | None = None

    department_id: int | None = None

    designation_id: int | None = None

    @field_validator("date_of_birth", "joining_date", mode="before")
    @classmethod
    def parse_flexible_date(cls, v):
        if not v or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y"):
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
        return v


# =========================
# UPDATE EMPLOYEE
# =========================

class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100
    )

    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100
    )

    phone: str | None = Field(
        default=None,
        max_length=20
    )

    date_of_birth: date | None = None

    address: str | None = Field(
        default=None,
        max_length=255
    )

    joining_date: date | None = None

    department_id: int | None = None

    designation_id: int | None = None

    employment_status: EmploymentStatus | None = None


# =========================
# EMPLOYEE PROFILE UPDATE
# =========================

class EmployeeProfileUpdate(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100
    )
    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100
    )
    email: EmailStr | None = None
    phone: str | None = Field(
        default=None,
        max_length=20
    )
    date_of_birth: date | None = None
    address: str | None = Field(
        default=None,
        max_length=255
    )

# =========================
# EMPLOYEE RESPONSE
# =========================

class EmployeeResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    user_id: int
    employee_code: str

    first_name: str
    last_name: str
    email: str | None = None

    phone: str | None
    date_of_birth: date | None
    address: str | None

    joining_date: date | None

    department_id: int | None
    designation_id: int | None

    employment_status: EmploymentStatus

    profile_photo_url: str | None
    profile_photo_public_id: str | None
    created_at: datetime
    updated_at: datetime


# =========================
# EMPLOYEE LIST RESPONSE
# =========================

class EmployeeListResponse(BaseModel):
    total: int
    employees: list[EmployeeResponse]


# =========================
# EMPLOYEE STATUS UPDATE
# =========================

class EmployeeStatusUpdate(BaseModel):
    employment_status: EmploymentStatus