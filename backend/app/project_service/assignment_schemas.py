from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.project_service.role_schemas import ProjectRoleResponse
from app.project_service.schemas import ProjectResponse


class EmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class ProjectAssignmentCreate(BaseModel):
    project_id: int
    employee_id: int
    role_id: int


class ProjectAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    employee_id: int
    role_id: int
    assigned_at: datetime
    project: ProjectResponse | None = None
    role: ProjectRoleResponse | None = None
    employee: EmployeeSummary | None = None


class ProjectAssignmentListResponse(BaseModel):
    total: int
    assignments: list[ProjectAssignmentResponse]