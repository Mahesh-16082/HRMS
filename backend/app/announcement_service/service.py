from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.announcement_service import repository
from app.announcement_service.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)
from app.announcement_service.schemas import (
    AnnouncementArchive,
    AnnouncementCreate,
    AnnouncementPublish,
    AnnouncementUpdate,
)
from app.authentication_service.models import User


def validate_future_expiry(expires_at: datetime | None) -> None:
    if expires_at is not None:
        now = datetime.now(timezone.utc)
        exp = (
            expires_at
            if expires_at.tzinfo is not None
            else expires_at.replace(tzinfo=timezone.utc)
        )
        if exp <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expiration date must be in the future",
            )


# ============================================================
# HR SERVICE OPERATIONS
# ============================================================

def create_announcement(
    db: Session,
    user_id: int,
    data: AnnouncementCreate,
) -> Announcement:
    """Create a new announcement in DRAFT status with authenticated user as created_by."""
    if data.expires_at is not None:
        validate_future_expiry(data.expires_at)

    announcement = Announcement(
        title=data.title.strip(),
        description=data.description.strip(),
        category=data.category,
        priority=data.priority,
        status=AnnouncementStatus.DRAFT,
        created_by=user_id,
        published_at=None,
        expires_at=data.expires_at,
    )
    return repository.create_announcement(db, announcement)


def list_hr_announcements(
    db: Session,
    status_filter: AnnouncementStatus | None = None,
    category_filter: AnnouncementCategory | None = None,
    priority_filter: AnnouncementPriority | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Announcement]]:
    """List announcements for HR with filtering, search, and pagination."""
    return repository.list_announcements(
        db=db,
        status=status_filter,
        category=category_filter,
        priority=priority_filter,
        search=search,
        skip=skip,
        limit=limit,
    )


def update_announcement(
    db: Session,
    announcement_id: int,
    data: AnnouncementUpdate,
) -> Announcement:
    """Update announcement details. Archived announcements cannot be updated."""
    announcement = repository.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    if announcement.status == AnnouncementStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived announcements cannot be updated",
        )

    if data.expires_at is not None:
        validate_future_expiry(data.expires_at)
        announcement.expires_at = data.expires_at

    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title cannot be empty",
            )
        announcement.title = data.title.strip()

    if data.description is not None:
        if not data.description.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Description cannot be empty",
            )
        announcement.description = data.description.strip()

    if data.category is not None:
        announcement.category = data.category

    if data.priority is not None:
        announcement.priority = data.priority

    announcement.updated_at = datetime.now(timezone.utc)
    return repository.update_announcement(db, announcement)


def publish_announcement(
    db: Session,
    announcement_id: int,
    data: AnnouncementPublish | None = None,
) -> Announcement:
    """Publish a DRAFT announcement and set published_at timestamp."""
    announcement = repository.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    if announcement.status != AnnouncementStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DRAFT announcements can be published",
        )

    if data and data.expires_at is not None:
        validate_future_expiry(data.expires_at)
        announcement.expires_at = data.expires_at
    elif announcement.expires_at is not None:
        now = datetime.now(timezone.utc)
        exp = (
            announcement.expires_at
            if announcement.expires_at.tzinfo is not None
            else announcement.expires_at.replace(tzinfo=timezone.utc)
        )
        if exp <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot publish an announcement with an expiration date in the past",
            )

    now = datetime.now(timezone.utc)
    announcement.status = AnnouncementStatus.PUBLISHED
    announcement.published_at = now
    announcement.updated_at = now
    return repository.update_announcement(db, announcement)


def archive_announcement(
    db: Session,
    announcement_id: int,
    data: AnnouncementArchive | None = None,
) -> Announcement:
    """Archive a PUBLISHED announcement."""
    announcement = repository.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    if announcement.status != AnnouncementStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PUBLISHED announcements can be archived",
        )

    announcement.status = AnnouncementStatus.ARCHIVED
    announcement.updated_at = datetime.now(timezone.utc)
    return repository.update_announcement(db, announcement)


def delete_announcement(
    db: Session,
    announcement_id: int,
) -> None:
    """Safely delete an announcement by ID."""
    announcement = repository.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    repository.delete_announcement(db, announcement)


# ============================================================
# SHARED / EMPLOYEE SERVICE OPERATIONS
# ============================================================

def list_employee_announcements(
    db: Session,
    category_filter: AnnouncementCategory | None = None,
    priority_filter: AnnouncementPriority | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Announcement]]:
    """List active, non-expired, published announcements for employees ordered newest first."""
    return repository.list_active_published_announcements(
        db=db,
        category=category_filter,
        priority=priority_filter,
        search=search,
        skip=skip,
        limit=limit,
    )


def get_announcement_details(
    db: Session,
    announcement_id: int,
    current_user: User,
) -> Announcement:
    """
    Get announcement details.
    HR can view any announcement (including draft, archived, expired).
    Employees can only view PUBLISHED, non-expired announcements.
    """
    announcement = repository.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    if current_user.role == "hr":
        return announcement

    now = datetime.now(timezone.utc)
    exp = announcement.expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    is_expired = exp is not None and exp <= now

    if announcement.status != AnnouncementStatus.PUBLISHED or is_expired:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return announcement
