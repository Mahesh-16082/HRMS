from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.attendance_service import service
from app.attendance_service.models import AttendanceStatus
from app.attendance_service.schemas import (
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceListResponse,
    AttendanceResponse,
)
from app.authentication_service.dependencies import get_current_user
from app.core.database import get_db


router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance"],
)


# =========================
# EMPLOYEE ENDPOINTS
# =========================

@router.post(
    "/check-in",
    response_model=AttendanceResponse,
)
def check_in(
    data: AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.check_in(
        db=db,
        user_id=current_user.id,
        remarks=data.remarks,
    )


@router.post(
    "/check-out",
    response_model=AttendanceResponse,
)
def check_out(
    data: AttendanceCheckOut,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.check_out(
        db=db,
        user_id=current_user.id,
        remarks=data.remarks,
    )


@router.get(
    "/me",
    response_model=AttendanceListResponse,
)
def get_my_attendance(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    attendance_status: AttendanceStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    attendance = service.get_my_attendance(
        db=db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        status=attendance_status,
    )

    return {
        "total": len(attendance),
        "attendance": attendance,
    }


@router.get(
    "/me/today",
    response_model=AttendanceResponse | None,
)
def get_my_today_attendance(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.get_my_today_attendance(
        db=db,
        user_id=current_user.id,
    )


# =========================
# HR ENDPOINTS
# =========================

@router.get(
    "/",
    response_model=AttendanceListResponse,
)
def get_all_attendance(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    attendance_status: AttendanceStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.value != "hr":
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can access all employee attendance",
        )

    attendance = service.get_all_attendance(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status=attendance_status,
    )

    return {
        "total": len(attendance),
        "attendance": attendance,
    }


@router.get(
    "/employee/{employee_id}",
    response_model=AttendanceListResponse,
)
def get_employee_attendance(
    employee_id: int,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    attendance_status: AttendanceStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.value != "hr":
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can access employee attendance",
        )

    attendance = service.get_employee_attendance(
        db=db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        status=attendance_status,
    )

    return {
        "total": len(attendance),
        "attendance": attendance,
    }


@router.get(
    "/count",
)
def get_attendance_count(
    employee_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    attendance_status: AttendanceStatus | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role.value != "hr":
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can access attendance counts",
        )

    count = service.get_attendance_count(
        db=db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        status=attendance_status,
    )

    return {
        "count": count,
    }