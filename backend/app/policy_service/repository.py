from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.policy_service.models import Policy


def get_policies(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category: str | None = None,
    search: str | None = None,
) -> tuple[int, list[Policy]]:
    query = db.query(Policy)

    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(Policy.category.ilike(category.strip()))

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Policy.title.ilike(search_term),
                Policy.description.ilike(search_term),
                Policy.content.ilike(search_term),
            )
        )

    total = query.count()
    policies = query.order_by(Policy.id.asc()).offset(skip).limit(limit).all()
    return total, policies


def get_policy_by_id(db: Session, policy_id: int) -> Policy | None:
    return db.query(Policy).filter(Policy.id == policy_id).first()
