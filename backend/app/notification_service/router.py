from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db
from app.notification_service import service
from app.notification_service.models import NotificationType
from app.notification_service.schemas import (
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadNotificationCountResponse,
)

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get authenticated user's notifications",
    description="Returns a paginated list of notifications for the currently authenticated user, ordered newest first.",
)
def get_my_notifications(
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of notifications to return (1-100)"),
    is_read: bool | None = Query(None, description="Filter by read status (true/false)"),
    notification_type: NotificationType | None = Query(None, description="Filter by notification type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_notifications(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        is_read=is_read,
        notification_type=notification_type,
    )


@router.get(
    "/unread-count",
    response_model=UnreadNotificationCountResponse,
    summary="Get unread notification count",
    description="Returns the total count of unread notifications for the currently authenticated user.",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_unread_count(
        db=db,
        current_user=current_user,
    )


@router.patch(
    "/read-all",
    response_model=MarkAllReadResponse,
    summary="Mark all notifications as read",
    description="Marks all unread notifications belonging to the currently authenticated user as read.",
)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.mark_all_as_read(
        db=db,
        current_user=current_user,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
    description="Marks a single notification as read if it belongs to the authenticated user. Safely idempotent.",
)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.mark_notification_as_read(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification",
    description="Deletes a notification if it belongs to the currently authenticated user.",
)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_notification(
        db=db,
        notification_id=notification_id,
        current_user=current_user,
    )
