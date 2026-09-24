from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import (
    Date,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PolicyCategory(str, Enum):
    OFFICE_RULES = "OFFICE RULES"
    LEAVE_POLICIES = "LEAVE POLICIES"
    ATTENDANCE = "ATTENDANCE"
    WORKPLACE_CONDUCT = "WORKPLACE CONDUCT"
    TECHNOLOGY_SECURITY = "TECHNOLOGY & SECURITY"
    EMPLOYEE_GUIDELINES = "EMPLOYEE GUIDELINES"


class PolicyStatus(str, Enum):
    PUBLISHED = "PUBLISHED"


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=PolicyStatus.PUBLISHED.value,
        index=True,
    )

    effective_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=lambda: date(2026, 10, 1),
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
