from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db
from app.policy_service import service
from app.policy_service.schemas import PolicyListResponse, PolicyResponse

router = APIRouter(
    prefix="/api/policies",
    tags=["Workplace Policies"],
)


@router.get(
    "",
    response_model=PolicyListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all published workplace policies",
)
def get_policies(
    category: str | None = Query(default=None, description="Filter by category"),
    search: str | None = Query(default=None, description="Search in title or content"),
    skip: int = Query(default=0, ge=0, description="Offset for pagination"),
    limit: int = Query(default=100, ge=1, le=100, description="Page limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all published workplace policies.
    Accessible by both HR and Employee users.
    Read-only endpoint.
    """
    return service.list_policies(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        search=search,
    )


@router.get(
    "/{policy_id}",
    response_model=PolicyResponse,
    status_code=status.HTTP_200_OK,
    summary="Get workplace policy details by ID",
)
def get_policy_by_id(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve single policy details by ID.
    Accessible by both HR and Employee users.
    Read-only endpoint.
    """
    return service.get_policy(db=db, policy_id=policy_id)
