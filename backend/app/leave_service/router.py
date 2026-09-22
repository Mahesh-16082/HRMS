from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db
from app.leave_service import service
from app.leave_service.models import LeaveRequestStatus
from app.leave_service.schemas import (
    LeaveBalanceCreate,
    LeaveBalanceListResponse,
    LeaveBalanceResponse,
    LeaveBalanceUpdate,
    LeaveRequestCreate,
    LeaveRequestListResponse,
    LeaveRequestReject,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeListResponse,
    LeaveTypeResponse,
    LeaveTypeUpdate,
)


router = APIRouter(
    prefix="/api/leave",
    tags=["Leave"],
)


def require_hr(user):
    if user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR is authorized to perform this action",
        )


# ============================================================
# EMPLOYEE ENDPOINTS
# ============================================================

@router.post(
    "/requests",
    response_model=LeaveRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_leave_request(
    data: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee submits a new leave request (validated against available balance & overlaps)."""
    return service.apply_leave_request(
        db=db,
        user_id=current_user.id,
        data=data,
    )


@router.get(
    "/requests/me",
    response_model=LeaveRequestListResponse,
)
def get_my_leave_requests(
    status_filter: LeaveRequestStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee views their own leave requests."""
    requests = service.get_my_leave_requests(
        db=db,
        user_id=current_user.id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return {
        "total": len(requests),
        "requests": requests,
    }


@router.get(
    "/requests/me/{request_id}",
    response_model=LeaveRequestResponse,
)
def get_my_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee views a specific leave request belonging to them."""
    return service.get_my_leave_request(
        db=db,
        user_id=current_user.id,
        request_id=request_id,
    )


@router.patch(
    "/requests/me/{request_id}/cancel",
    response_model=LeaveRequestResponse,
)
def cancel_my_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee cancels their own eligible pending leave request."""
    return service.cancel_my_leave_request(
        db=db,
        user_id=current_user.id,
        request_id=request_id,
    )


@router.get(
    "/balances/me",
    response_model=LeaveBalanceListResponse,
)
def get_my_leave_balances(
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee views their real leave balances."""
    balances = service.get_my_leave_balances(
        db=db,
        user_id=current_user.id,
        year=year,
    )
    return {
        "total": len(balances),
        "balances": balances,
    }


@router.get(
    "/types/active",
    response_model=LeaveTypeListResponse,
)
def get_active_leave_types(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Employee and HR can view active leave types available for requests."""
    leave_types = service.get_active_leave_types(db=db)
    return {
        "total": len(leave_types),
        "leave_types": leave_types,
    }


# ============================================================
# HR ENDPOINTS: LEAVE REQUESTS
# ============================================================

@router.get(
    "/requests",
    response_model=LeaveRequestListResponse,
)
def get_all_leave_requests(
    employee_id: int | None = Query(default=None),
    leave_type_id: int | None = Query(default=None),
    status_filter: LeaveRequestStatus | None = Query(default=None, alias="status"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR lists organization-wide leave requests with optional filters."""
    require_hr(current_user)
    requests = service.get_all_leave_requests(
        db=db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        status_filter=status_filter,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return {
        "total": len(requests),
        "requests": requests,
    }


@router.get(
    "/requests/{request_id}",
    response_model=LeaveRequestResponse,
)
def get_leave_request_by_id(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR views details of any employee's leave request."""
    require_hr(current_user)
    return service.get_leave_request_by_id(db=db, request_id=request_id)


@router.patch(
    "/requests/{request_id}/approve",
    response_model=LeaveRequestResponse,
)
def approve_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR approves a pending leave request, deducting employee balance."""
    require_hr(current_user)
    return service.approve_leave_request(
        db=db,
        reviewer_user_id=current_user.id,
        request_id=request_id,
    )


@router.patch(
    "/requests/{request_id}/reject",
    response_model=LeaveRequestResponse,
)
def reject_leave_request(
    request_id: int,
    data: LeaveRequestReject,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR rejects a pending leave request with a required rejection reason."""
    require_hr(current_user)
    return service.reject_leave_request(
        db=db,
        reviewer_user_id=current_user.id,
        request_id=request_id,
        rejection_reason=data.rejection_reason,
    )


# ============================================================
# HR ENDPOINTS: LEAVE BALANCES
# ============================================================

@router.get(
    "/balances",
    response_model=LeaveBalanceListResponse,
)
def get_all_balances(
    employee_id: int | None = Query(default=None),
    year: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR lists organization-wide employee balances."""
    require_hr(current_user)
    balances = service.get_all_balances(
        db=db,
        employee_id=employee_id,
        year=year,
        skip=skip,
        limit=limit,
    )
    return {
        "total": len(balances),
        "balances": balances,
    }


@router.get(
    "/balances/{employee_id}",
    response_model=LeaveBalanceListResponse,
)
def get_employee_balances(
    employee_id: int,
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR views a specific employee's leave balances."""
    require_hr(current_user)
    balances = service.get_balances_by_employee_id(
        db=db,
        employee_id=employee_id,
        year=year,
    )
    return {
        "total": len(balances),
        "balances": balances,
    }


@router.post(
    "/balances",
    response_model=LeaveBalanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_leave_balance(
    data: LeaveBalanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR allocates or initializes an employee's leave balance."""
    require_hr(current_user)
    return service.create_leave_balance(db=db, data=data)


@router.put(
    "/balances/{balance_id}",
    response_model=LeaveBalanceResponse,
)
@router.patch(
    "/balances/{balance_id}",
    response_model=LeaveBalanceResponse,
)
def update_leave_balance(
    balance_id: int,
    data: LeaveBalanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR modifies an existing leave balance record."""
    require_hr(current_user)
    return service.update_leave_balance(
        db=db,
        balance_id=balance_id,
        data=data,
    )


# ============================================================
# HR ENDPOINTS: LEAVE TYPES
# ============================================================

@router.post(
    "/types",
    response_model=LeaveTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_leave_type(
    data: LeaveTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR creates a new leave type."""
    require_hr(current_user)
    return service.create_leave_type(db=db, data=data)


@router.get(
    "/types",
    response_model=LeaveTypeListResponse,
)
def get_all_leave_types(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR lists all leave types (active and inactive)."""
    require_hr(current_user)
    types = service.get_all_leave_types(db=db)
    return {
        "total": len(types),
        "leave_types": types,
    }


@router.get(
    "/types/{leave_type_id}",
    response_model=LeaveTypeResponse,
)
def get_leave_type_by_id(
    leave_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR views details of a specific leave type."""
    require_hr(current_user)
    return service.get_leave_type_by_id(db=db, leave_type_id=leave_type_id)


@router.put(
    "/types/{leave_type_id}",
    response_model=LeaveTypeResponse,
)
def update_leave_type(
    leave_type_id: int,
    data: LeaveTypeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR updates a leave type."""
    require_hr(current_user)
    return service.update_leave_type(
        db=db,
        leave_type_id=leave_type_id,
        data=data,
    )


@router.patch(
    "/types/{leave_type_id}/activate",
    response_model=LeaveTypeResponse,
)
def activate_leave_type(
    leave_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR activates a leave type."""
    require_hr(current_user)
    return service.activate_leave_type(db=db, leave_type_id=leave_type_id)


@router.patch(
    "/types/{leave_type_id}/deactivate",
    response_model=LeaveTypeResponse,
)
def deactivate_leave_type(
    leave_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR deactivates a leave type."""
    require_hr(current_user)
    return service.deactivate_leave_type(db=db, leave_type_id=leave_type_id)


@router.delete(
    "/types/{leave_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_leave_type(
    leave_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """HR safely deletes a leave type only if no balances or requests depend on it."""
    require_hr(current_user)
    service.delete_leave_type(db=db, leave_type_id=leave_type_id)
    return None
