from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.employee_service.models import Employee, EmploymentStatus
from app.performance_service.models import (
    PerformanceGoal,
    PerformanceGoalStatus,
    PerformanceReview,
    PerformanceReviewStatus,
    ReviewCategoryRating,
)
from app.performance_service.schemas import CategoryRatingInput


# ============================================================
# PERFORMANCE REVIEWS REPOSITORY
# ============================================================

def create_review(db: Session, review: PerformanceReview) -> PerformanceReview:
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_review_by_id(db: Session, review_id: int) -> PerformanceReview | None:
    return (
        db.query(PerformanceReview)
        .options(
            joinedload(PerformanceReview.employee),
            joinedload(PerformanceReview.reviewer),
            joinedload(PerformanceReview.ratings),
        )
        .filter(PerformanceReview.id == review_id)
        .first()
    )


def get_reviews(
    db: Session,
    employee_id: int | None = None,
    status: PerformanceReviewStatus | None = None,
    review_period: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[PerformanceReview]]:
    query = db.query(PerformanceReview)

    if employee_id is not None:
        query = query.filter(PerformanceReview.employee_id == employee_id)
    if status is not None:
        query = query.filter(PerformanceReview.status == status)
    if review_period is not None:
        query = query.filter(PerformanceReview.review_period == review_period)
    if start_date is not None:
        query = query.filter(PerformanceReview.review_date >= start_date)
    if end_date is not None:
        query = query.filter(PerformanceReview.review_date <= end_date)

    total = query.count()

    reviews = (
        query.options(
            joinedload(PerformanceReview.employee),
            joinedload(PerformanceReview.reviewer),
            joinedload(PerformanceReview.ratings),
        )
        .order_by(PerformanceReview.review_date.desc(), PerformanceReview.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return total, reviews


def update_review(db: Session, review: PerformanceReview) -> PerformanceReview:
    db.commit()
    db.refresh(review)
    return review


def delete_review(db: Session, review: PerformanceReview) -> None:
    db.delete(review)
    db.commit()


# ============================================================
# CATEGORY RATINGS REPOSITORY
# ============================================================

def save_category_ratings(
    db: Session,
    review_id: int,
    ratings_input: list[CategoryRatingInput],
) -> list[ReviewCategoryRating]:
    # Remove existing ratings for this review to prevent duplicates
    db.query(ReviewCategoryRating).filter(
        ReviewCategoryRating.review_id == review_id
    ).delete(synchronize_session=False)

    new_ratings: list[ReviewCategoryRating] = []
    for item in ratings_input:
        rating_obj = ReviewCategoryRating(
            review_id=review_id,
            category=item.category.strip(),
            rating=item.rating,
            comments=item.comments.strip() if item.comments else None,
        )
        db.add(rating_obj)
        new_ratings.append(rating_obj)

    db.flush()
    return new_ratings


def get_ratings_by_review_id(db: Session, review_id: int) -> list[ReviewCategoryRating]:
    return (
        db.query(ReviewCategoryRating)
        .filter(ReviewCategoryRating.review_id == review_id)
        .order_by(ReviewCategoryRating.id.asc())
        .all()
    )


# ============================================================
# PERFORMANCE GOALS REPOSITORY
# ============================================================

def create_goal(db: Session, goal: PerformanceGoal) -> PerformanceGoal:
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def get_goal_by_id(db: Session, goal_id: int) -> PerformanceGoal | None:
    return (
        db.query(PerformanceGoal)
        .options(
            joinedload(PerformanceGoal.employee),
            joinedload(PerformanceGoal.creator),
        )
        .filter(PerformanceGoal.id == goal_id)
        .first()
    )


def get_goals(
    db: Session,
    employee_id: int | None = None,
    status: PerformanceGoalStatus | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[PerformanceGoal]]:
    query = db.query(PerformanceGoal)

    if employee_id is not None:
        query = query.filter(PerformanceGoal.employee_id == employee_id)
    if status is not None:
        query = query.filter(PerformanceGoal.status == status)

    total = query.count()

    goals = (
        query.options(
            joinedload(PerformanceGoal.employee),
            joinedload(PerformanceGoal.creator),
        )
        .order_by(PerformanceGoal.due_date.asc(), PerformanceGoal.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return total, goals


def update_goal(db: Session, goal: PerformanceGoal) -> PerformanceGoal:
    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, goal: PerformanceGoal) -> None:
    db.delete(goal)
    db.commit()


# ============================================================
# ANALYTICS & AGGREGATIONS
# ============================================================

def get_total_employees_count(db: Session) -> int:
    return (
        db.query(func.count(Employee.id))
        .filter(
            Employee.employment_status == EmploymentStatus.ACTIVE,
            Employee.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )


def get_review_counts_by_status(db: Session) -> dict[str, int]:
    rows = (
        db.query(PerformanceReview.status, func.count(PerformanceReview.id))
        .group_by(PerformanceReview.status)
        .all()
    )
    result = {
        PerformanceReviewStatus.DRAFT.value: 0,
        PerformanceReviewStatus.COMPLETED.value: 0,
    }
    for status_val, count in rows:
        val = getattr(status_val, "value", str(status_val))
        result[val] = count
    return result


def get_organization_average_rating(db: Session) -> float | None:
    avg_val = (
        db.query(func.avg(PerformanceReview.overall_rating))
        .filter(
            PerformanceReview.status == PerformanceReviewStatus.COMPLETED,
            PerformanceReview.overall_rating.isnot(None),
        )
        .scalar()
    )
    return round(float(avg_val), 1) if avg_val is not None else None


def get_category_averages(
    db: Session,
    employee_id: int | None = None,
) -> list[dict]:
    query = (
        db.query(
            ReviewCategoryRating.category,
            func.avg(ReviewCategoryRating.rating).label("avg_rating"),
            func.count(ReviewCategoryRating.id).label("count"),
        )
        .join(PerformanceReview, ReviewCategoryRating.review_id == PerformanceReview.id)
        .filter(
            PerformanceReview.status == PerformanceReviewStatus.COMPLETED,
        )
    )

    if employee_id is not None:
        query = query.filter(PerformanceReview.employee_id == employee_id)

    rows = (
        query.group_by(ReviewCategoryRating.category)
        .order_by(ReviewCategoryRating.category.asc())
        .all()
    )

    return [
        {
            "category": r[0],
            "average_rating": round(float(r[1]), 1),
            "review_count": int(r[2]),
        }
        for r in rows
    ]


def get_recent_performance_trend(
    db: Session,
    employee_id: int | None = None,
    limit: int = 50,
) -> list[PerformanceReview]:
    query = (
        db.query(PerformanceReview)
        .options(
            joinedload(PerformanceReview.employee),
        )
        .filter(
            PerformanceReview.status == PerformanceReviewStatus.COMPLETED,
            PerformanceReview.overall_rating.isnot(None),
        )
    )

    if employee_id is not None:
        query = query.filter(PerformanceReview.employee_id == employee_id)

    return (
        query.order_by(
            PerformanceReview.review_date.asc(),
            PerformanceReview.id.asc(),
        )
        .limit(limit)
        .all()
    )


def get_employee_rating_stats(db: Session, employee_id: int) -> dict:
    # 1. Latest review
    latest_review = (
        db.query(PerformanceReview)
        .filter(
            PerformanceReview.employee_id == employee_id,
            PerformanceReview.status == PerformanceReviewStatus.COMPLETED,
            PerformanceReview.overall_rating.isnot(None),
        )
        .order_by(PerformanceReview.review_date.desc(), PerformanceReview.id.desc())
        .first()
    )

    # 2. Avg, Max, Count
    stats = (
        db.query(
            func.avg(PerformanceReview.overall_rating),
            func.max(PerformanceReview.overall_rating),
            func.count(PerformanceReview.id),
        )
        .filter(
            PerformanceReview.employee_id == employee_id,
            PerformanceReview.status == PerformanceReviewStatus.COMPLETED,
            PerformanceReview.overall_rating.isnot(None),
        )
        .first()
    )

    avg_val = round(float(stats[0]), 1) if stats and stats[0] is not None else None
    max_val = round(float(stats[1]), 1) if stats and stats[1] is not None else None
    count_val = int(stats[2]) if stats and stats[2] is not None else 0

    return {
        "latest_rating": latest_review.overall_rating if latest_review else None,
        "average_rating": avg_val,
        "highest_rating": max_val,
        "completed_reviews_count": count_val,
    }


def get_goal_counts_by_status(
    db: Session,
    employee_id: int | None = None,
) -> dict[str, int]:
    query = db.query(PerformanceGoal.status, func.count(PerformanceGoal.id))
    if employee_id is not None:
        query = query.filter(PerformanceGoal.employee_id == employee_id)

    rows = query.group_by(PerformanceGoal.status).all()

    counts = {
        PerformanceGoalStatus.NOT_STARTED.value: 0,
        PerformanceGoalStatus.IN_PROGRESS.value: 0,
        PerformanceGoalStatus.COMPLETED.value: 0,
        PerformanceGoalStatus.CANCELLED.value: 0,
    }
    for status_val, count in rows:
        val = getattr(status_val, "value", str(status_val))
        counts[val] = count
    return counts
