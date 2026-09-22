from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.announcement_service.models import (
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: AnnouncementCategory
    priority: AnnouncementPriority = AnnouncementPriority.MEDIUM
    expires_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    category: AnnouncementCategory | None = None
    priority: AnnouncementPriority | None = None
    expires_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")


class AnnouncementPublish(BaseModel):
    expires_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")


class AnnouncementArchive(BaseModel):
    reason: str | None = None

    model_config = ConfigDict(extra="forbid")


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    description: str
    category: AnnouncementCategory
    priority: AnnouncementPriority
    status: AnnouncementStatus
    created_by: int
    published_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnnouncementListResponse(BaseModel):
    total: int
    announcements: list[AnnouncementResponse]

    model_config = ConfigDict(from_attributes=True)
