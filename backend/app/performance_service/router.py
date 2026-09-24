from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db
from app.performance_service import service
from app.performance_service.models import PerformanceGoalStatus, PerformanceReviewStatus
from app.performance_service.schemas import (
    CategoryAverageItem,
    EmployeePerformanceAnalyticsResponse,
    HRPerformanceAnalyticsResponse,
    PerformanceGoalCreate,
    PerformanceGoalListResponse,
    PerformanceGoalResponse,
    PerformanceGoalStatusUpdate,
    PerformanceGoalUpdate,
    PerformanceReviewComplete,
    PerformanceReviewCreate,
    PerformanceReviewListResponse,
    PerformanceReviewResponse,
    PerformanceReviewUpdate,
    PerformanceTrendItem,
)

router = APIRouter(
    prefix="/api/performance",
    tags=["Performance"],
)


# ============================================================
# PERFORMANCE REVIEWS: EMPLOYEE ENDPOINTS (must be before {review_id})
# ============================================================

@router.get(
    "/reviews/me",
    response_model=PerformanceReviewListResponse,
    summary="Get authenticated employee's performance reviews",
)
def get_my_reviews(
    review_period: str | None = Query(default=None, description="Filter by review period"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_my_reviews(
        db=db,
        current_user=current_user,
        review_period=review_period,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reviews/me/{review_id}",
    response_model=PerformanceReviewResponse,
    summary="Get authenticated employee's single performance review",
)
def get_my_review_by_id(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_my_review_by_id(
        db=db,
        current_user=current_user,
        review_id=review_id,
    )


# ============================================================
# PERFORMANCE REVIEWS: HR ENDPOINTS
# ============================================================

@router.post(
    "/reviews",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a performance review (HR only)",
)
def create_review(
    data: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_review(
        db=db,
        current_user=current_user,
        data=data,
    )


@router.get(
    "/reviews",
    response_model=PerformanceReviewListResponse,
    summary="List organization performance reviews (HR only)",
)
def get_reviews_for_hr(
    employee_id: int | None = Query(default=None, description="Filter by employee ID"),
    status_filter: PerformanceReviewStatus | None = Query(default=None, alias="status"),
    review_period: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_reviews_for_hr(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
        status_filter=status_filter,
        review_period=review_period,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reviews/{review_id}",
    response_model=PerformanceReviewResponse,
    summary="Get performance review by ID (HR only)",
)
def get_review_by_id(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_review_by_id_for_hr(
        db=db,
        current_user=current_user,
        review_id=review_id,
    )


@router.put(
    "/reviews/{review_id}",
    response_model=PerformanceReviewResponse,
    summary="Update draft performance review (HR only)",
)
def update_review(
    review_id: int,
    data: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_review(
        db=db,
        current_user=current_user,
        review_id=review_id,
        data=data,
    )


@router.post(
    "/reviews/{review_id}/complete",
    response_model=PerformanceReviewResponse,
    summary="Complete performance review (HR only)",
)
def complete_review(
    review_id: int,
    data: PerformanceReviewComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.complete_review(
        db=db,
        current_user=current_user,
        review_id=review_id,
        data=data,
    )


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete draft performance review (HR only)",
)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_review(
        db=db,
        current_user=current_user,
        review_id=review_id,
    )
    return {"message": "Performance review deleted successfully"}


# ============================================================
# PERFORMANCE GOALS: EMPLOYEE ENDPOINTS (must be before {goal_id})
# ============================================================

@router.get(
    "/goals/me",
    response_model=PerformanceGoalListResponse,
    summary="List authenticated employee's goals",
)
def get_my_goals(
    status_filter: PerformanceGoalStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_my_goals(
        db=db,
        current_user=current_user,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/goals/me",
    response_model=PerformanceGoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create own performance goal (Employee)",
)
def create_my_goal(
    data: PerformanceGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_goal(
        db=db,
        current_user=current_user,
        data=data,
    )


@router.get(
    "/goals/me/{goal_id}",
    response_model=PerformanceGoalResponse,
    summary="Get authenticated employee's goal by ID",
)
def get_my_goal_by_id(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_my_goal_by_id(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
    )


@router.put(
    "/goals/me/{goal_id}",
    response_model=PerformanceGoalResponse,
    summary="Update authenticated employee's goal",
)
def update_my_goal(
    goal_id: int,
    data: PerformanceGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_my_goal(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
        data=data,
    )


@router.patch(
    "/goals/me/{goal_id}/status",
    response_model=PerformanceGoalResponse,
    summary="Update authenticated employee's goal status",
)
def update_my_goal_status(
    goal_id: int,
    data: PerformanceGoalStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_my_goal_status(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
        data=data,
    )


# ============================================================
# PERFORMANCE GOALS: HR ENDPOINTS
# ============================================================

@router.post(
    "/goals",
    response_model=PerformanceGoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a performance goal for employee (HR)",
)
def create_goal_for_hr(
    data: PerformanceGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_goal(
        db=db,
        current_user=current_user,
        data=data,
    )


@router.get(
    "/goals",
    response_model=PerformanceGoalListResponse,
    summary="List organization performance goals (HR only)",
)
def get_goals_for_hr(
    employee_id: int | None = Query(default=None, description="Filter by employee ID"),
    status_filter: PerformanceGoalStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_goals_for_hr(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/goals/{goal_id}",
    response_model=PerformanceGoalResponse,
    summary="Get performance goal by ID (HR only)",
)
def get_goal_by_id_for_hr(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_goal_by_id_for_hr(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
    )


@router.put(
    "/goals/{goal_id}",
    response_model=PerformanceGoalResponse,
    summary="Update performance goal (HR only)",
)
def update_goal_for_hr(
    goal_id: int,
    data: PerformanceGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_goal_for_hr(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
        data=data,
    )


@router.patch(
    "/goals/{goal_id}/status",
    response_model=PerformanceGoalResponse,
    summary="Update performance goal status (HR only)",
)
def update_goal_status_for_hr(
    goal_id: int,
    data: PerformanceGoalStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_goal_status_for_hr(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
        data=data,
    )


@router.delete(
    "/goals/{goal_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete performance goal (HR only)",
)
def delete_goal_for_hr(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_goal_for_hr(
        db=db,
        current_user=current_user,
        goal_id=goal_id,
    )
    return {"message": "Performance goal deleted successfully"}


# ============================================================
# ANALYTICS & TRENDS: HR ENDPOINTS
# ============================================================

@router.get(
    "/analytics/overview",
    response_model=HRPerformanceAnalyticsResponse,
    summary="Organization performance analytics overview (HR only)",
)
def get_hr_analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_hr_analytics_overview(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/analytics/category-averages",
    response_model=list[CategoryAverageItem],
    summary="Organization category average scores (HR only)",
)
def get_hr_category_averages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_hr_category_averages(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/analytics/trend",
    response_model=list[PerformanceTrendItem],
    summary="Organization completed reviews trend (HR only)",
)
def get_hr_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_hr_trend(
        db=db,
        current_user=current_user,
    )


# ============================================================
# ANALYTICS & TRENDS: EMPLOYEE ENDPOINTS
# ============================================================

@router.get(
    "/analytics/me",
    response_model=EmployeePerformanceAnalyticsResponse,
    summary="Authenticated employee's personal performance analytics",
)
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_employee_analytics(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/analytics/me/trend",
    response_model=list[PerformanceTrendItem],
    summary="Authenticated employee's personal performance trend",
)
def get_my_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_employee_trend(
        db=db,
        current_user=current_user,
    )
