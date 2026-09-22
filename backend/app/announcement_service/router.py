from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.announcement_service import service
from app.announcement_service.models import (
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)
from app.announcement_service.schemas import (
    AnnouncementArchive,
    AnnouncementCreate,
    AnnouncementListResponse,
    AnnouncementPublish,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db

router = APIRouter(
    prefix="/api/announcements",
    tags=["Announcements"],
)


def require_hr(current_user: User):
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can perform this action",
        )


# ============================================================
# HR MANAGEMENT ENDPOINTS
# ============================================================

@router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    return service.create_announcement(
        db=db,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "",
    response_model=AnnouncementListResponse,
)
def list_announcements(
    status: AnnouncementStatus | None = Query(default=None),
    category: AnnouncementCategory | None = Query(default=None),
    priority: AnnouncementPriority | None = Query(default=None),
    search: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    total, announcements = service.list_hr_announcements(
        db=db,
        status_filter=status,
        category_filter=category,
        priority_filter=priority,
        search=search,
        skip=skip,
        limit=limit,
    )
    return AnnouncementListResponse(
        total=total,
        announcements=announcements,
    )


# ============================================================
# EMPLOYEE-FACING ENDPOINT (DEFINED BEFORE /{announcement_id})
# ============================================================

@router.get(
    "/me",
    response_model=AnnouncementListResponse,
)
def get_my_announcements(
    category: AnnouncementCategory | None = Query(default=None),
    priority: AnnouncementPriority | None = Query(default=None),
    search: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, announcements = service.list_employee_announcements(
        db=db,
        category_filter=category,
        priority_filter=priority,
        search=search,
        skip=skip,
        limit=limit,
    )
    return AnnouncementListResponse(
        total=total,
        announcements=announcements,
    )


# ============================================================
# DETAILS, UPDATE, DELETE, PUBLISH, ARCHIVE
# ============================================================

@router.get(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_announcement_details(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_announcement_details(
        db=db,
        announcement_id=announcement_id,
        current_user=current_user,
    )


@router.put(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    return service.update_announcement(
        db=db,
        announcement_id=announcement_id,
        data=data,
    )


@router.delete(
    "/{announcement_id}",
)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    service.delete_announcement(
        db=db,
        announcement_id=announcement_id,
    )
    return {"message": "Announcement deleted successfully"}


@router.patch(
    "/{announcement_id}/publish",
    response_model=AnnouncementResponse,
)
def publish_announcement(
    announcement_id: int,
    data: AnnouncementPublish | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    return service.publish_announcement(
        db=db,
        announcement_id=announcement_id,
        data=data,
    )


@router.patch(
    "/{announcement_id}/archive",
    response_model=AnnouncementResponse,
)
def archive_announcement(
    announcement_id: int,
    data: AnnouncementArchive | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    return service.archive_announcement(
        db=db,
        announcement_id=announcement_id,
        data=data,
    )
