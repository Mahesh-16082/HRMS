from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NotificationType(str, Enum):
    LEAVE_REQUEST_SUBMITTED = "LEAVE_REQUEST_SUBMITTED"
    LEAVE_REQUEST_APPROVED = "LEAVE_REQUEST_APPROVED"
    LEAVE_REQUEST_REJECTED = "LEAVE_REQUEST_REJECTED"
    LEAVE_REQUEST_REVOKED = "LEAVE_REQUEST_REVOKED"
    COMPLAINT_SUBMITTED = "COMPLAINT_SUBMITTED"
    COMPLAINT_UPDATED = "COMPLAINT_UPDATED"
    COMPLAINT_RESOLVED = "COMPLAINT_RESOLVED"
    PROJECT_ASSIGNED = "PROJECT_ASSIGNED"
    PROJECT_ROLE_ASSIGNED = "PROJECT_ROLE_ASSIGNED"
    ANNOUNCEMENT_PUBLISHED = "ANNOUNCEMENT_PUBLISHED"
    PERFORMANCE_REVIEW_COMPLETED = "PERFORMANCE_REVIEW_COMPLETED"
    WORK_REPORT_SUBMITTED = "WORK_REPORT_SUBMITTED"
    WORK_REPORT_APPROVED = "WORK_REPORT_APPROVED"
    WORK_REPORT_REJECTED = "WORK_REPORT_REJECTED"
    ATTENDANCE_RELATED = "ATTENDANCE_RELATED"
    GENERAL = "GENERAL"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notification_type"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    reference_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    reference_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    recipient = relationship(
        "User",
        foreign_keys=[recipient_user_id],
        lazy="joined",
    )

    __table_args__ = (
        Index("ix_notifications_user_unread_created", "recipient_user_id", "is_read", "created_at"),
        Index("ix_notifications_user_created", "recipient_user_id", "created_at"),
    )
