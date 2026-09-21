from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectAssignmentCreate(BaseModel):
    project_id: int
    employee_id: int


class ProjectAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    employee_id: int
    assigned_at: datetime


class ProjectAssignmentListResponse(BaseModel):
    total: int
    assignments: list[ProjectAssignmentResponse]