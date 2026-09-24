from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.performance_service.models import PerformanceGoalStatus, PerformanceReviewStatus


# Summary Schemas for Nested Relationships
class EmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    id: int
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


# Category Rating Schemas
class CategoryRatingInput(BaseModel):
    category: str = Field(..., min_length=1, max_length=100, description="Category name (e.g., Technical, Quality)")
    rating: int = Field(..., ge=1, le=5, description="Category rating from 1 to 5")
    comments: str | None = Field(default=None, description="Optional feedback on category")


class CategoryRatingResponse(BaseModel):
    id: int
    review_id: int
    category: str
    rating: int
    comments: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Performance Review Schemas
class PerformanceReviewCreate(BaseModel):
    employee_id: int = Field(..., description="ID of the employee being reviewed")
    review_period: str = Field(..., min_length=1, max_length=100, description="e.g. Q1 2026, Annual 2025")
    title: str | None = Field(default=None, max_length=200, description="Optional title for the review")
    review_date: date = Field(..., description="Date review took place")
    status: PerformanceReviewStatus = Field(default=PerformanceReviewStatus.DRAFT, description="Initial review status (DRAFT or COMPLETED)")
    comments: str | None = Field(default=None, description="Overall summary remarks")
    ratings: list[CategoryRatingInput] = Field(default_factory=list, description="List of category ratings")


class PerformanceReviewUpdate(BaseModel):
    review_period: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=200)
    review_date: date | None = None
    comments: str | None = None
    ratings: list[CategoryRatingInput] | None = None


class PerformanceReviewComplete(BaseModel):
    ratings: list[CategoryRatingInput] | None = Field(default=None, description="Category ratings to set or update upon completion")
    comments: str | None = Field(default=None, description="Final overall comments")


class PerformanceReviewResponse(BaseModel):
    id: int
    employee_id: int
    reviewer_id: int
    review_period: str
    title: str | None = None
    review_date: date
    overall_rating: float | None = None
    status: PerformanceReviewStatus
    comments: str | None = None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeSummary | None = None
    reviewer: UserSummary | None = None
    ratings: list[CategoryRatingResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PerformanceReviewListResponse(BaseModel):
    total: int
    reviews: list[PerformanceReviewResponse]


# Performance Goal Schemas
class PerformanceGoalCreate(BaseModel):
    employee_id: int | None = Field(default=None, description="Employee ID (required for HR, inferred for employee)")
    title: str = Field(..., min_length=1, max_length=255, description="Goal title")
    description: str | None = Field(default=None, description="Goal description / milestones")
    start_date: date = Field(..., description="Target start date")
    due_date: date = Field(..., description="Target completion date")
    status: PerformanceGoalStatus = Field(default=PerformanceGoalStatus.NOT_STARTED, description="Initial goal status")


class PerformanceGoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    status: PerformanceGoalStatus | None = None


class PerformanceGoalStatusUpdate(BaseModel):
    status: PerformanceGoalStatus = Field(..., description="New goal status")


class PerformanceGoalResponse(BaseModel):
    id: int
    employee_id: int
    title: str
    description: str | None = None
    start_date: date
    due_date: date
    status: PerformanceGoalStatus
    created_by: int
    created_at: datetime
    updated_at: datetime
    employee: EmployeeSummary | None = None
    creator: UserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class PerformanceGoalListResponse(BaseModel):
    total: int
    goals: list[PerformanceGoalResponse]


# Analytics & Trends Schemas
class CategoryAverageItem(BaseModel):
    category: str
    average_rating: float
    review_count: int


class PerformanceTrendItem(BaseModel):
    review_id: int
    review_date: date
    review_period: str
    overall_rating: float
    title: str | None = None
    employee_id: int
    employee_name: str


class HRPerformanceAnalyticsResponse(BaseModel):
    total_employees: int
    total_completed_reviews: int
    total_draft_reviews: int
    average_overall_rating: float | None = None
    goals_completed: int
    goals_in_progress: int
    goals_not_started: int
    goals_cancelled: int
    category_averages: list[CategoryAverageItem] = []
    recent_trend: list[PerformanceTrendItem] = []


class EmployeePerformanceAnalyticsResponse(BaseModel):
    latest_rating: float | None = None
    average_rating: float | None = None
    highest_rating: float | None = None
    completed_reviews_count: int
    category_ratings: list[CategoryAverageItem] = []
    goals_summary: dict[str, int] = {}
    trend: list[PerformanceTrendItem] = []
