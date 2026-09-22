from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectRoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    is_active: bool = True


class ProjectRoleCreate(ProjectRoleBase):
    pass


class ProjectRoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    is_active: bool | None = None


class ProjectRoleResponse(ProjectRoleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectRoleListResponse(BaseModel):
    total: int
    roles: list[ProjectRoleResponse]
