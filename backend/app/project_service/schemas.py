from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_service.models import ProjectStatus


class ProjectCreate(BaseModel):
    project_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
    )
    start_date: date | None = None
    end_date: date | None = None


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
    )
    start_date: date | None = None
    end_date: date | None = None


class ProjectStatusUpdate(BaseModel):
    status: ProjectStatus


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_name: str
    project_code: str
    description: str | None
    start_date: date | None
    end_date: date | None
    status: ProjectStatus
    created_by: int
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    total: int
    projects: list[ProjectResponse]