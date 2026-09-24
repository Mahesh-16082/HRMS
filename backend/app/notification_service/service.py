from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.authentication_service.models import User
from app.notification_service import repository
from app.notification_service.models import Notification, NotificationType
from app.notification_service.schemas import (
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadNotificationCountResponse,
)


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
    """
    Reusable internal notification creation function.
    Validates recipient exists, then delegates to repository.
    """
    recipient = db.query(User).filter(User.id == recipient_user_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipient user with ID {recipient_user_id} not found",
        )

    return repository.create_notification(
        db=db,
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        commit=commit,
    )


def get_responsible_hr_user(db: Session, preferred_user_id: int | None = None) -> User | None:
    """
    Dynamically resolve the responsible HR recipient.
    If preferred_user_id is provided and refers to an active HR user, returns that user.
    Otherwise falls back to the primary active HR user.
    """
    if preferred_user_id:
        hr = (
            db.query(User)
            .filter(
                User.id == preferred_user_id,
                User.role == "hr",
                User.is_active.is_(True),
            )
            .first()
        )
        if hr:
            return hr
    return (
        db.query(User)
        .filter(User.role == "hr", User.is_active.is_(True))
        .order_by(User.id.asc())
        .first()
    )


def list_notifications(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 50,
    is_read: bool | None = None,
    notification_type: NotificationType | None = None,
) -> NotificationListResponse:
    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Skip must be greater than or equal to 0",
        )
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Limit must be between 1 and 100",
        )

    notifications, total = repository.get_user_notifications(
        db=db,
        recipient_user_id=current_user.id,
        skip=skip,
        limit=limit,
        is_read=is_read,
        notification_type=notification_type,
    )

    unread_count = repository.count_unread_notifications(
        db=db,
        recipient_user_id=current_user.id,
    )

    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        skip=skip,
        limit=limit,
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
    )


def get_unread_count(
    db: Session,
    current_user: User,
) -> UnreadNotificationCountResponse:
    count = repository.count_unread_notifications(
        db=db,
        recipient_user_id=current_user.id,
    )
    return UnreadNotificationCountResponse(unread_count=count)


def mark_notification_as_read(
    db: Session,
    notification_id: int,
    current_user: User,
) -> NotificationResponse:
    notification = repository.get_notification_by_id(
        db=db,
        notification_id=notification_id,
        recipient_user_id=current_user.id,
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if notification.is_read:
        return NotificationResponse.model_validate(notification)

    updated = repository.mark_notification_as_read(
        db=db,
        notification=notification,
    )
    return NotificationResponse.model_validate(updated)


def mark_all_as_read(
    db: Session,
    current_user: User,
) -> MarkAllReadResponse:
    updated_count = repository.mark_all_notifications_as_read(
        db=db,
        recipient_user_id=current_user.id,
    )
    return MarkAllReadResponse(
        updated_count=updated_count,
        message=f"Marked {updated_count} notification(s) as read",
    )


def delete_notification(
    db: Session,
    notification_id: int,
    current_user: User,
) -> None:
    notification = repository.get_notification_by_id(
        db=db,
        notification_id=notification_id,
        recipient_user_id=current_user.id,
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    repository.delete_notification(
        db=db,
        notification=notification,
    )
