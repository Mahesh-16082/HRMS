from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.notification_service.models import Notification, NotificationType


def create_notification(
    db: Session,
    recipient_user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    reference_type: str | None = None,
    reference_id: str | None = None,
    commit: bool = True,
) -> Notification:
    notification = Notification(
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id is not None else None,
        is_read=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    else:
        db.flush()
    return notification


def get_notification_by_id(
    db: Session,
    notification_id: int,
    recipient_user_id: int,
) -> Notification | None:
    return (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_user_id == recipient_user_id,
        )
        .first()
    )


def get_user_notifications(
    db: Session,
    recipient_user_id: int,
    skip: int = 0,
    limit: int = 50,
    is_read: bool | None = None,
    notification_type: NotificationType | None = None,
) -> tuple[list[Notification], int]:
    query = db.query(Notification).filter(Notification.recipient_user_id == recipient_user_id)

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    if notification_type is not None:
        query = query.filter(Notification.notification_type == notification_type)

    total = query.with_entities(func.count(Notification.id)).scalar() or 0

    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return notifications, total


def count_unread_notifications(
    db: Session,
    recipient_user_id: int,
) -> int:
    return (
        db.query(func.count(Notification.id))
        .filter(
            Notification.recipient_user_id == recipient_user_id,
            Notification.is_read.is_(False),
        )
        .scalar()
        or 0
    )


def mark_notification_as_read(
    db: Session,
    notification: Notification,
    commit: bool = True,
) -> Notification:
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    if commit:
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_as_read(
    db: Session,
    recipient_user_id: int,
    commit: bool = True,
) -> int:
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.recipient_user_id == recipient_user_id,
            Notification.is_read.is_(False),
        )
        .update(
            {
                Notification.is_read: True,
                Notification.read_at: datetime.now(timezone.utc),
            },
            synchronize_session=False,
        )
    )
    if commit:
        db.commit()
    return updated_count


def delete_notification(
    db: Session,
    notification: Notification,
    commit: bool = True,
) -> None:
    db.delete(notification)
    if commit:
        db.commit()
