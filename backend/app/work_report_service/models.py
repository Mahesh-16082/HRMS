from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WorkReportStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class WorkReport(Base):
    __tablename__ = "work_reports"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    work_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    tasks_completed: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    plans_for_tomorrow: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    blockers: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    hours_worked: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=8.0,
    )

    status: Mapped[WorkReportStatus] = mapped_column(
        SQLEnum(
            WorkReportStatus,
            name="work_report_status",
        ),
        nullable=False,
        default=WorkReportStatus.DRAFT,
        index=True,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    review_feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    employee = relationship(
        "Employee",
        foreign_keys=[employee_id],
        lazy="joined",
    )

    project = relationship(
        "Project",
        foreign_keys=[project_id],
        lazy="joined",
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
        lazy="joined",
    )

    attachment = relationship(
        "WorkReportAttachment",
        back_populates="work_report",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "work_date",
            name="uq_work_reports_employee_date",
        ),
        Index("ix_work_reports_employee_status", "employee_id", "status"),
        Index("ix_work_reports_date_status", "work_date", "status"),
    )


class WorkReportAttachment(Base):
    __tablename__ = "work_report_attachments"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    work_report_id: Mapped[int] = mapped_column(
        ForeignKey("work_reports.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    file_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    storage_public_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    work_report = relationship(
        "WorkReport",
        back_populates="attachment",
    )

    uploader = relationship(
        "User",
        foreign_keys=[uploaded_by],
        lazy="joined",
    )
