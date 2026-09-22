from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db
from app.complaint_service import service
from app.complaint_service.models import ComplaintPriority, ComplaintStatus
from app.complaint_service.schemas import (
    ComplaintCountResponse,
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
    ComplaintStatusUpdate,
    ComplaintUpdate,
)

router = APIRouter(
    prefix="/api/complaints",
    tags=["Complaints"],
)


def require_hr(current_user):
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can perform this action",
        )


# ============================================================
# EMPLOYEE ENDPOINTS
# ============================================================

@router.post(
    "",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_complaint(
    data: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.create_complaint(
        db=db,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "/me",
    response_model=ComplaintListResponse,
)
def get_my_complaints(
    status: ComplaintStatus | None = Query(default=None),
    priority: ComplaintPriority | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    total, complaints = service.get_my_complaints(
        db=db,
        user_id=current_user.id,
        status_filter=status,
        priority_filter=priority,
        skip=skip,
        limit=limit,
    )
    return {
        "total": total,
        "complaints": complaints,
    }


@router.get(
    "/me/{complaint_id}",
    response_model=ComplaintResponse,
)
def get_my_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.get_my_complaint(
        db=db,
        user_id=current_user.id,
        complaint_id=complaint_id,
    )


@router.put(
    "/me/{complaint_id}",
    response_model=ComplaintResponse,
)
def update_my_complaint(
    complaint_id: int,
    data: ComplaintUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.update_my_complaint(
        db=db,
        user_id=current_user.id,
        complaint_id=complaint_id,
        data=data,
    )


# ============================================================
# HR ENDPOINTS
# ============================================================

@router.get(
    "/overview/counts",
    response_model=ComplaintCountResponse,
)
def get_complaint_counts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return service.get_complaint_counts(db=db)


@router.get(
    "",
    response_model=ComplaintListResponse,
)
def get_all_complaints(
    status: ComplaintStatus | None = Query(default=None),
    priority: ComplaintPriority | None = Query(default=None),
    category: str | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    total, complaints = service.get_all_complaints(
        db=db,
        status_filter=status,
        priority_filter=priority,
        category=category,
        employee_id=employee_id,
        search=search,
        skip=skip,
        limit=limit,
    )
    return {
        "total": total,
        "complaints": complaints,
    }


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
)
def get_complaint_details(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return service.get_complaint_details(
        db=db,
        complaint_id=complaint_id,
    )


@router.patch(
    "/{complaint_id}/status",
    response_model=ComplaintResponse,
)
def update_complaint_status(
    complaint_id: int,
    data: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_hr(current_user)
    return service.update_complaint_status(
        db=db,
        complaint_id=complaint_id,
        new_status=data.status,
        hr_remarks=data.hr_remarks,
    )
