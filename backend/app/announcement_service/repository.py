from datetime import datetime, timezone
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.announcement_service.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)


def create_announcement(db: Session, announcement: Announcement) -> Announcement:
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


def get_announcement_by_id(db: Session, announcement_id: int) -> Announcement | None:
    return (
        db.query(Announcement)
        .filter(Announcement.id == announcement_id)
        .first()
    )


def list_announcements(
    db: Session,
    status: AnnouncementStatus | None = None,
    category: AnnouncementCategory | None = None,
    priority: AnnouncementPriority | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Announcement]]:
    query = db.query(Announcement)

    if status:
        query = query.filter(Announcement.status == status)

    if category:
        query = query.filter(Announcement.category == category)

    if priority:
        query = query.filter(Announcement.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Announcement.title.ilike(term),
                Announcement.description.ilike(term),
            )
        )

    total = query.count()
    items = (
        query.order_by(Announcement.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def list_active_published_announcements(
    db: Session,
    category: AnnouncementCategory | None = None,
    priority: AnnouncementPriority | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[int, list[Announcement]]:
    now = datetime.now(timezone.utc)
    query = db.query(Announcement).filter(
        Announcement.status == AnnouncementStatus.PUBLISHED,
        or_(
            Announcement.expires_at.is_(None),
            Announcement.expires_at > now,
        ),
    )

    if category:
        query = query.filter(Announcement.category == category)

    if priority:
        query = query.filter(Announcement.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Announcement.title.ilike(term),
                Announcement.description.ilike(term),
            )
        )

    total = query.count()
    items = (
        query.order_by(
            Announcement.published_at.desc(),
            Announcement.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def update_announcement(db: Session, announcement: Announcement) -> Announcement:
    db.commit()
    db.refresh(announcement)
    return announcement


def delete_announcement(db: Session, announcement: Announcement) -> None:
    db.delete(announcement)
    db.commit()
