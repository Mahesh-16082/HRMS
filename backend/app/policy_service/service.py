from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.policy_service import repository
from app.policy_service.models import Policy


def list_policies(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category: str | None = None,
    search: str | None = None,
) -> dict:
    total, policies = repository.get_policies(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        search=search,
    )
    return {
        "total": total,
        "policies": policies,
        "skip": skip,
        "limit": limit,
    }


def get_policy(db: Session, policy_id: int) -> Policy:
    policy = repository.get_policy_by_id(db=db, policy_id=policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy with ID {policy_id} not found",
        )
    return policy
