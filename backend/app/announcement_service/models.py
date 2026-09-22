from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AnnouncementCategory(str, Enum):
    GENERAL = "GENERAL"
    POLICY = "POLICY"
    EVENT = "EVENT"
    HOLIDAY = "HOLIDAY"
    IMPORTANT = "IMPORTANT"


class AnnouncementPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class AnnouncementStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    category: Mapped[AnnouncementCategory] = mapped_column(
        SQLEnum(
            AnnouncementCategory,
            name="announcement_category",
        ),
        nullable=False,
        index=True,
    )

    priority: Mapped[AnnouncementPriority] = mapped_column(
        SQLEnum(
            AnnouncementPriority,
            name="announcement_priority",
        ),
        nullable=False,
        default=AnnouncementPriority.MEDIUM,
        index=True,
    )

    status: Mapped[AnnouncementStatus] = mapped_column(
        SQLEnum(
            AnnouncementStatus,
            name="announcement_status",
        ),
        nullable=False,
        default=AnnouncementStatus.DRAFT,
        index=True,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined",
    )
