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


class PerformanceReviewStatus(str, Enum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"


class PerformanceGoalStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

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

    reviewer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    review_period: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    review_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    overall_rating: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    status: Mapped[PerformanceReviewStatus] = mapped_column(
        SQLEnum(
            PerformanceReviewStatus,
            name="performance_review_status",
        ),
        nullable=False,
        default=PerformanceReviewStatus.DRAFT,
        index=True,
    )

    comments: Mapped[str | None] = mapped_column(
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

    reviewer = relationship(
        "User",
        foreign_keys=[reviewer_id],
        lazy="joined",
    )

    ratings = relationship(
        "ReviewCategoryRating",
        back_populates="review",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="ReviewCategoryRating.id",
    )

    __table_args__ = (
        Index("ix_performance_reviews_emp_period", "employee_id", "review_period"),
        Index("ix_performance_reviews_status_date", "status", "review_date"),
    )


class ReviewCategoryRating(Base):
    __tablename__ = "review_category_ratings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    review_id: Mapped[int] = mapped_column(
        ForeignKey("performance_reviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    comments: Mapped[str | None] = mapped_column(
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
    review = relationship(
        "PerformanceReview",
        back_populates="ratings",
    )

    __table_args__ = (
        UniqueConstraint("review_id", "category", name="uq_review_category"),
    )


class PerformanceGoal(Base):
    __tablename__ = "performance_goals"

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

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    status: Mapped[PerformanceGoalStatus] = mapped_column(
        SQLEnum(
            PerformanceGoalStatus,
            name="performance_goal_status",
        ),
        nullable=False,
        default=PerformanceGoalStatus.NOT_STARTED,
        index=True,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
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

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined",
    )

    __table_args__ = (
        Index("ix_performance_goals_emp_status", "employee_id", "status"),
    )
