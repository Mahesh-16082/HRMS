from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PolicyResponse(BaseModel):
    id: int
    title: str
    category: str
    description: str | None = None
    content: str
    status: str
    effective_date: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PolicyListResponse(BaseModel):
    total: int
    policies: list[PolicyResponse]
    skip: int = 0
    limit: int = 100

    model_config = ConfigDict(from_attributes=True)
