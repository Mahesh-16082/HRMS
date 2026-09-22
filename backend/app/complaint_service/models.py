from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
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
from app.employee_service.models import Employee


class ComplaintPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ComplaintStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    subject: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    priority: Mapped[ComplaintPriority] = mapped_column(
        SQLEnum(
            ComplaintPriority,
            name="complaint_priority",
        ),
        nullable=False,
        default=ComplaintPriority.MEDIUM,
        index=True,
    )

    status: Mapped[ComplaintStatus] = mapped_column(
        SQLEnum(
            ComplaintStatus,
            name="complaint_status",
        ),
        nullable=False,
        default=ComplaintStatus.OPEN,
        index=True,
    )

    hr_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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

    employee: Mapped[Employee] = relationship(
        "Employee",
        foreign_keys=[employee_id],
        lazy="joined",
    )


# Explicit composite / additional indexes if desired
Index("ix_complaints_employee_status", Complaint.employee_id, Complaint.status)
