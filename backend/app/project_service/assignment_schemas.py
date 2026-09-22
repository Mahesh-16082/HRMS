from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.project_service.schemas import ProjectResponse


class ProjectAssignmentCreate(BaseModel):
    project_id: int
    employee_id: int


class ProjectAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    employee_id: int
    assigned_at: datetime
    project: ProjectResponse | None = None


class ProjectAssignmentListResponse(BaseModel):
    total: int
    assignments: list[ProjectAssignmentResponse]