from datetime import date
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.authentication_service.models import User
from app.employee_service import repository as employee_repository
from app.employee_service.models import Employee, EmploymentStatus
from app.notification_service.models import NotificationType
from app.notification_service.service import create_notification
from app.performance_service import repository
from app.performance_service.models import (
    PerformanceGoal,
    PerformanceGoalStatus,
    PerformanceReview,
    PerformanceReviewStatus,
    ReviewCategoryRating,
)
from app.performance_service.schemas import (
    CategoryAverageItem,
    CategoryRatingInput,
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


# ============================================================
# HELPER / VALIDATION FUNCTIONS
# ============================================================

def require_hr(current_user: User) -> None:
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR is authorized to perform this action",
        )


def get_active_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = employee_repository.get_employee_by_user_id(db, user_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )
    if employee.employment_status != EmploymentStatus.ACTIVE or employee.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile is inactive or deleted",
        )
    return employee


def validate_category_ratings(ratings: list[CategoryRatingInput | ReviewCategoryRating]) -> None:
    if not ratings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one category rating is required",
        )

    seen_categories: set[str] = set()
    for item in ratings:
        category_name = item.category.strip() if item.category else ""
        if not category_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category name cannot be empty",
            )
        cat_key = category_name.lower()
        if cat_key in seen_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate category '{item.category}' is not allowed in a single review",
            )
        seen_categories.add(cat_key)

        if not isinstance(item.rating, int) or item.rating < 1 or item.rating > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rating for category '{item.category}' must be an integer between 1 and 5",
            )


def calculate_overall_rating(ratings: list[CategoryRatingInput | ReviewCategoryRating]) -> float:
    validate_category_ratings(ratings)
    total_score = sum(r.rating for r in ratings)
    return round(total_score / len(ratings), 1)


def _execute_review_completion(
    db: Session,
    review: PerformanceReview,
    ratings_input: list[CategoryRatingInput] | None = None,
    comments: str | None = None,
) -> PerformanceReview:
    """
    Single authoritative completion workflow:
    - Verifies review is not already completed (immutability).
    - Validates category ratings presence and value ranges (1–5).
    - Calculates overall_rating solely from category ratings: round(sum/len, 1).
    - Persists ratings and calculated overall_rating.
    - Transitions review status to COMPLETED.
    """
    if review.status == PerformanceReviewStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete review: review is already completed and immutable",
        )

    if ratings_input is not None:
        if len(ratings_input) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category ratings are required to complete a review",
            )
        validate_category_ratings(ratings_input)
        overall = calculate_overall_rating(ratings_input)
        repository.save_category_ratings(db, review.id, ratings_input)
    else:
        existing_ratings = repository.get_ratings_by_review_id(db, review.id)
        if not existing_ratings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot complete review without category ratings",
            )
        validate_category_ratings(existing_ratings)
        overall = calculate_overall_rating(existing_ratings)

    review.overall_rating = overall
    review.status = PerformanceReviewStatus.COMPLETED
    if comments is not None:
        review.comments = comments.strip() if comments else None

    target_emp = review.employee or employee_repository.get_employee_by_id(db, review.employee_id)
    if target_emp and target_emp.user_id:
        create_notification(
            db=db,
            recipient_user_id=target_emp.user_id,
            notification_type=NotificationType.PERFORMANCE_REVIEW_COMPLETED,
            title="Performance Review Completed",
            message=f"Your performance review for {review.review_period} has been completed.",
            reference_type="performance_review",
            reference_id=str(review.id),
            commit=False,
        )

    return repository.update_review(db, review)


# ============================================================
# PERFORMANCE REVIEWS SERVICE
# ============================================================

def create_review(
    db: Session,
    current_user: User,
    data: PerformanceReviewCreate,
) -> PerformanceReview:
    require_hr(current_user)

    target_employee = employee_repository.get_employee_by_id(db, data.employee_id)
    if not target_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target employee not found",
        )
    if target_employee.employment_status != EmploymentStatus.ACTIVE or target_employee.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create performance review for inactive or deleted employee",
        )

    # Initial creation is recorded as DRAFT in session
    review = PerformanceReview(
        employee_id=data.employee_id,
        reviewer_id=current_user.id,
        review_period=data.review_period.strip(),
        title=data.title.strip() if data.title else None,
        review_date=data.review_date,
        status=PerformanceReviewStatus.DRAFT,
        comments=data.comments.strip() if data.comments else None,
        overall_rating=None,
    )
    db.add(review)
    db.flush()

    if data.ratings:
        validate_category_ratings(data.ratings)
        repository.save_category_ratings(db, review.id, data.ratings)

    # If requested as COMPLETED, run the single authoritative completion workflow
    if data.status == PerformanceReviewStatus.COMPLETED:
        if not data.ratings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category ratings are required to create a completed review",
            )
        return _execute_review_completion(
            db=db,
            review=review,
            ratings_input=data.ratings,
            comments=data.comments,
        )

    db.commit()
    db.refresh(review)
    return review


def get_reviews_for_hr(
    db: Session,
    current_user: User,
    employee_id: int | None = None,
    status_filter: PerformanceReviewStatus | None = None,
    review_period: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 50,
) -> PerformanceReviewListResponse:
    require_hr(current_user)
    total, reviews = repository.get_reviews(
        db=db,
        employee_id=employee_id,
        status=status_filter,
        review_period=review_period,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return PerformanceReviewListResponse(total=total, reviews=reviews)


def get_review_by_id_for_hr(
    db: Session,
    current_user: User,
    review_id: int,
) -> PerformanceReview:
    require_hr(current_user)
    review = repository.get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )
    return review


def update_review(
    db: Session,
    current_user: User,
    review_id: int,
    data: PerformanceReviewUpdate,
) -> PerformanceReview:
    require_hr(current_user)
    review = repository.get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )

    if review.status == PerformanceReviewStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a completed performance review. Completed reviews are immutable.",
        )

    if data.review_period is not None:
        review.review_period = data.review_period.strip()
    if data.title is not None:
        review.title = data.title.strip() if data.title else None
    if data.review_date is not None:
        review.review_date = data.review_date
    if data.comments is not None:
        review.comments = data.comments.strip() if data.comments else None

    if data.ratings is not None:
        if len(data.ratings) > 0:
            validate_category_ratings(data.ratings)
        repository.save_category_ratings(db, review.id, data.ratings)

    return repository.update_review(db, review)


def complete_review(
    db: Session,
    current_user: User,
    review_id: int,
    data: PerformanceReviewComplete,
) -> PerformanceReview:
    require_hr(current_user)
    review = repository.get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )

    return _execute_review_completion(
        db=db,
        review=review,
        ratings_input=data.ratings,
        comments=data.comments,
    )


def delete_review(
    db: Session,
    current_user: User,
    review_id: int,
) -> None:
    require_hr(current_user)
    review = repository.get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )

    if review.status == PerformanceReviewStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a completed performance review. Only draft reviews can be deleted.",
        )

    repository.delete_review(db, review)


# ============================================================
# EMPLOYEE REVIEWS SERVICE
# ============================================================

def get_my_reviews(
    db: Session,
    current_user: User,
    review_period: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> PerformanceReviewListResponse:
    employee = get_active_employee_for_user(db, current_user.id)
    total, reviews = repository.get_reviews(
        db=db,
        employee_id=employee.id,
        review_period=review_period,
        skip=skip,
        limit=limit,
    )
    return PerformanceReviewListResponse(total=total, reviews=reviews)


def get_my_review_by_id(
    db: Session,
    current_user: User,
    review_id: int,
) -> PerformanceReview:
    employee = get_active_employee_for_user(db, current_user.id)
    review = repository.get_review_by_id(db, review_id)
    if not review or review.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )
    return review


# ============================================================
# PERFORMANCE GOALS SERVICE
# ============================================================

def create_goal(
    db: Session,
    current_user: User,
    data: PerformanceGoalCreate,
) -> PerformanceGoal:
    if current_user.role == "hr":
        if data.employee_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee ID is required when HR creates a performance goal",
            )
        target_employee = employee_repository.get_employee_by_id(db, data.employee_id)
        if not target_employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        employee_id = target_employee.id
    else:
        employee = get_active_employee_for_user(db, current_user.id)
        employee_id = employee.id

    if data.due_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before start date",
        )

    goal = PerformanceGoal(
        employee_id=employee_id,
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        start_date=data.start_date,
        due_date=data.due_date,
        status=data.status,
        created_by=current_user.id,
    )
    return repository.create_goal(db, goal)


def get_goals_for_hr(
    db: Session,
    current_user: User,
    employee_id: int | None = None,
    status_filter: PerformanceGoalStatus | None = None,
    skip: int = 0,
    limit: int = 50,
) -> PerformanceGoalListResponse:
    require_hr(current_user)
    total, goals = repository.get_goals(
        db=db,
        employee_id=employee_id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return PerformanceGoalListResponse(total=total, goals=goals)


def get_goal_by_id_for_hr(
    db: Session,
    current_user: User,
    goal_id: int,
) -> PerformanceGoal:
    require_hr(current_user)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )
    return goal


def update_goal_for_hr(
    db: Session,
    current_user: User,
    goal_id: int,
    data: PerformanceGoalUpdate,
) -> PerformanceGoal:
    require_hr(current_user)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )

    new_start = data.start_date or goal.start_date
    new_due = data.due_date or goal.due_date
    if new_due < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before start date",
        )

    if data.title is not None:
        goal.title = data.title.strip()
    if data.description is not None:
        goal.description = data.description.strip() if data.description else None
    if data.start_date is not None:
        goal.start_date = data.start_date
    if data.due_date is not None:
        goal.due_date = data.due_date
    if data.status is not None:
        goal.status = data.status

    return repository.update_goal(db, goal)


def update_goal_status_for_hr(
    db: Session,
    current_user: User,
    goal_id: int,
    data: PerformanceGoalStatusUpdate,
) -> PerformanceGoal:
    require_hr(current_user)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )
    goal.status = data.status
    return repository.update_goal(db, goal)


def delete_goal_for_hr(
    db: Session,
    current_user: User,
    goal_id: int,
) -> None:
    require_hr(current_user)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )
    repository.delete_goal(db, goal)


def get_my_goals(
    db: Session,
    current_user: User,
    status_filter: PerformanceGoalStatus | None = None,
    skip: int = 0,
    limit: int = 50,
) -> PerformanceGoalListResponse:
    employee = get_active_employee_for_user(db, current_user.id)
    total, goals = repository.get_goals(
        db=db,
        employee_id=employee.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return PerformanceGoalListResponse(total=total, goals=goals)


def get_my_goal_by_id(
    db: Session,
    current_user: User,
    goal_id: int,
) -> PerformanceGoal:
    employee = get_active_employee_for_user(db, current_user.id)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal or goal.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )
    return goal


def update_my_goal(
    db: Session,
    current_user: User,
    goal_id: int,
    data: PerformanceGoalUpdate,
) -> PerformanceGoal:
    employee = get_active_employee_for_user(db, current_user.id)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal or goal.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )

    new_start = data.start_date or goal.start_date
    new_due = data.due_date or goal.due_date
    if new_due < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Due date cannot be before start date",
        )

    if data.title is not None:
        goal.title = data.title.strip()
    if data.description is not None:
        goal.description = data.description.strip() if data.description else None
    if data.start_date is not None:
        goal.start_date = data.start_date
    if data.due_date is not None:
        goal.due_date = data.due_date
    if data.status is not None:
        goal.status = data.status

    return repository.update_goal(db, goal)


def update_my_goal_status(
    db: Session,
    current_user: User,
    goal_id: int,
    data: PerformanceGoalStatusUpdate,
) -> PerformanceGoal:
    employee = get_active_employee_for_user(db, current_user.id)
    goal = repository.get_goal_by_id(db, goal_id)
    if not goal or goal.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance goal not found",
        )
    goal.status = data.status
    return repository.update_goal(db, goal)


# ============================================================
# ANALYTICS & TRENDS SERVICE
# ============================================================

def get_hr_analytics_overview(
    db: Session,
    current_user: User,
) -> HRPerformanceAnalyticsResponse:
    require_hr(current_user)

    total_employees = repository.get_total_employees_count(db)
    review_counts = repository.get_review_counts_by_status(db)
    avg_rating = repository.get_organization_average_rating(db)
    goal_counts = repository.get_goal_counts_by_status(db)
    raw_cat_avgs = repository.get_category_averages(db)
    raw_trends = repository.get_recent_performance_trend(db, limit=20)

    category_averages = [
        CategoryAverageItem(
            category=item["category"],
            average_rating=item["average_rating"],
            review_count=item["review_count"],
        )
        for item in raw_cat_avgs
    ]

    recent_trend = [
        PerformanceTrendItem(
            review_id=rev.id,
            review_date=rev.review_date,
            review_period=rev.review_period,
            overall_rating=rev.overall_rating or 0.0,
            title=rev.title,
            employee_id=rev.employee_id,
            employee_name=f"{rev.employee.first_name} {rev.employee.last_name}" if rev.employee else "Unknown",
        )
        for rev in raw_trends
    ]

    return HRPerformanceAnalyticsResponse(
        total_employees=total_employees,
        total_completed_reviews=review_counts.get(PerformanceReviewStatus.COMPLETED.value, 0),
        total_draft_reviews=review_counts.get(PerformanceReviewStatus.DRAFT.value, 0),
        average_overall_rating=avg_rating,
        goals_completed=goal_counts.get(PerformanceGoalStatus.COMPLETED.value, 0),
        goals_in_progress=goal_counts.get(PerformanceGoalStatus.IN_PROGRESS.value, 0),
        goals_not_started=goal_counts.get(PerformanceGoalStatus.NOT_STARTED.value, 0),
        goals_cancelled=goal_counts.get(PerformanceGoalStatus.CANCELLED.value, 0),
        category_averages=category_averages,
        recent_trend=recent_trend,
    )


def get_hr_category_averages(
    db: Session,
    current_user: User,
) -> list[CategoryAverageItem]:
    require_hr(current_user)
    raw_avgs = repository.get_category_averages(db)
    return [
        CategoryAverageItem(
            category=item["category"],
            average_rating=item["average_rating"],
            review_count=item["review_count"],
        )
        for item in raw_avgs
    ]


def get_hr_trend(
    db: Session,
    current_user: User,
) -> list[PerformanceTrendItem]:
    require_hr(current_user)
    raw_trends = repository.get_recent_performance_trend(db, limit=50)
    return [
        PerformanceTrendItem(
            review_id=rev.id,
            review_date=rev.review_date,
            review_period=rev.review_period,
            overall_rating=rev.overall_rating or 0.0,
            title=rev.title,
            employee_id=rev.employee_id,
            employee_name=f"{rev.employee.first_name} {rev.employee.last_name}" if rev.employee else "Unknown",
        )
        for rev in raw_trends
    ]


def get_employee_analytics(
    db: Session,
    current_user: User,
) -> EmployeePerformanceAnalyticsResponse:
    employee = get_active_employee_for_user(db, current_user.id)
    stats = repository.get_employee_rating_stats(db, employee.id)
    raw_cat_avgs = repository.get_category_averages(db, employee_id=employee.id)
    goal_counts = repository.get_goal_counts_by_status(db, employee_id=employee.id)
    raw_trends = repository.get_recent_performance_trend(db, employee_id=employee.id, limit=50)

    category_ratings = [
        CategoryAverageItem(
            category=item["category"],
            average_rating=item["average_rating"],
            review_count=item["review_count"],
        )
        for item in raw_cat_avgs
    ]

    trend = [
        PerformanceTrendItem(
            review_id=rev.id,
            review_date=rev.review_date,
            review_period=rev.review_period,
            overall_rating=rev.overall_rating or 0.0,
            title=rev.title,
            employee_id=rev.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}",
        )
        for rev in raw_trends
    ]

    return EmployeePerformanceAnalyticsResponse(
        latest_rating=stats["latest_rating"],
        average_rating=stats["average_rating"],
        highest_rating=stats["highest_rating"],
        completed_reviews_count=stats["completed_reviews_count"],
        category_ratings=category_ratings,
        goals_summary=goal_counts,
        trend=trend,
    )


def get_employee_trend(
    db: Session,
    current_user: User,
) -> list[PerformanceTrendItem]:
    employee = get_active_employee_for_user(db, current_user.id)
    raw_trends = repository.get_recent_performance_trend(db, employee_id=employee.id, limit=50)
    return [
        PerformanceTrendItem(
            review_id=rev.id,
            review_date=rev.review_date,
            review_period=rev.review_period,
            overall_rating=rev.overall_rating or 0.0,
            title=rev.title,
            employee_id=rev.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}",
        )
        for rev in raw_trends
    ]
