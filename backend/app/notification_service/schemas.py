from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.notification_service.models import NotificationType


class NotificationResponse(BaseModel):
    id: int
    notification_type: NotificationType
    title: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None
    reference_type: str | None = None
    reference_id: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    skip: int
    limit: int
    notifications: list[NotificationResponse]

    model_config = ConfigDict(from_attributes=True)


class UnreadNotificationCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    updated_count: int
    message: str = "All notifications marked as read"


class NotificationCreateInternal(BaseModel):
    recipient_user_id: int
    notification_type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    reference_type: str | None = Field(default=None, max_length=100)
    reference_id: str | None = Field(default=None, max_length=100)

    model_config = ConfigDict(extra="forbid")
