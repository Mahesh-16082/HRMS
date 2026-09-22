from datetime import date

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import get_db
from app.work_report_service import service
from app.work_report_service.models import WorkReportStatus
from app.work_report_service.schemas import (
    WorkReportAttachmentResponse,
    WorkReportCreate,
    WorkReportListResponse,
    WorkReportResponse,
    WorkReportReview,
    WorkReportTodayStatusResponse,
    WorkReportUpdate,
)

router = APIRouter(
    prefix="/api/work-reports",
    tags=["Work Reports"],
)


# ============================================================
# EMPLOYEE ENDPOINTS
# ============================================================

@router.post(
    "",
    response_model=WorkReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or submit daily work report",
)
def create_work_report(
    data: WorkReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee creates a new daily work report (as DRAFT or immediate SUBMISSION)."""
    return service.create_work_report(
        db=db,
        current_user=current_user,
        data=data,
    )


@router.get(
    "/me",
    response_model=WorkReportListResponse,
    summary="List authenticated employee's work reports",
)
def get_my_work_reports(
    status: WorkReportStatus | None = Query(default=None, description="Filter by status"),
    project_id: int | None = Query(default=None, description="Filter by project ID"),
    start_date: date | None = Query(default=None, description="Filter from work date"),
    end_date: date | None = Query(default=None, description="Filter to work date"),
    skip: int = Query(default=0, ge=0, description="Records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee retrieves a paginated and filtered list of their own work reports."""
    total, reports = service.get_my_work_reports(
        db=db,
        current_user=current_user,
        status_filter=status,
        project_id=project_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return WorkReportListResponse(
        total=total,
        work_reports=reports,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/me/today",
    response_model=WorkReportTodayStatusResponse,
    summary="Check status of today's work report",
)
def get_today_work_report_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if the current employee has submitted today's daily work report."""
    return service.get_today_work_report_status(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/me/{report_id}",
    response_model=WorkReportResponse,
    summary="Get single work report belonging to authenticated employee",
)
def get_my_work_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee retrieves details of their own specific work report."""
    return service.get_my_work_report_by_id(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


@router.put(
    "/me/{report_id}",
    response_model=WorkReportResponse,
    summary="Update a draft or rejected work report",
)
def update_my_work_report(
    report_id: int,
    data: WorkReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee updates content of a DRAFT or REJECTED work report."""
    return service.update_my_work_report(
        db=db,
        current_user=current_user,
        report_id=report_id,
        data=data,
    )


@router.patch(
    "/me/{report_id}/submit",
    response_model=WorkReportResponse,
    summary="Submit a draft or rejected work report",
)
def submit_my_work_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee transitions a DRAFT or REJECTED work report to SUBMITTED."""
    return service.submit_my_work_report(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


@router.delete(
    "/me/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft work report",
)
def delete_my_work_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee deletes a DRAFT work report."""
    service.delete_my_work_report(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


# ============================================================
# HR ENDPOINTS
# ============================================================

@router.get(
    "",
    response_model=WorkReportListResponse,
    summary="List all work reports (HR only)",
)
def list_all_work_reports_hr(
    employee_id: int | None = Query(default=None, description="Filter by employee ID"),
    project_id: int | None = Query(default=None, description="Filter by project ID"),
    status: WorkReportStatus | None = Query(default=None, description="Filter by status"),
    work_date: date | None = Query(default=None, description="Filter by specific work date"),
    start_date: date | None = Query(default=None, description="Filter from work date"),
    end_date: date | None = Query(default=None, description="Filter to work date"),
    search: str | None = Query(default=None, description="Search across title, tasks, or employee name"),
    skip: int = Query(default=0, ge=0, description="Records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR lists, filters, searches, and paginates all employee work reports."""
    total, reports = service.list_all_work_reports_hr(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
        project_id=project_id,
        status_filter=status,
        work_date=work_date,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )
    return WorkReportListResponse(
        total=total,
        work_reports=reports,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{report_id}",
    response_model=WorkReportResponse,
    summary="Get work report details (HR only)",
)
def get_work_report_details_hr(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR retrieves full details for any employee work report."""
    return service.get_work_report_details_hr(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


@router.patch(
    "/{report_id}/review",
    response_model=WorkReportResponse,
    summary="Review work report (Approve or Reject) (HR only)",
)
def review_work_report_hr(
    report_id: int,
    data: WorkReportReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR approves or rejects a SUBMITTED work report."""
    return service.review_work_report_hr(
        db=db,
        current_user=current_user,
        report_id=report_id,
        data=data,
    )


# ============================================================
# ATTACHMENT ENDPOINTS
# ============================================================

@router.post(
    "/{report_id}/attachments",
    response_model=WorkReportAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload document attachment for a work report (max 1)",
)
def upload_work_report_attachment(
    report_id: int,
    file: UploadFile = File(..., description="Document file (PDF, Word, Excel, PPT, Image, Text/CSV, max 10MB)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a document attachment for a work report.
    Allowed only in DRAFT or REJECTED status by report author.
    Maximum 1 attachment per report. Rejects with 400 if one already exists.
    """
    return service.upload_report_attachment(
        db=db,
        current_user=current_user,
        report_id=report_id,
        upload_file=file,
    )


@router.get(
    "/{report_id}/attachments",
    response_model=list[WorkReportAttachmentResponse],
    summary="List attachments for a work report",
)
def list_work_report_attachments(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List attachments for a work report (Owner or HR)."""
    return service.list_report_attachments(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


@router.get(
    "/{report_id}/attachment",
    response_model=WorkReportAttachmentResponse,
    summary="Get single attachment details for a work report",
)
def get_work_report_attachment(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the work report's attachment details (Owner or HR)."""
    return service.get_report_attachment(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )


@router.get(
    "/{report_id}/attachments/{attachment_id}",
    response_model=WorkReportAttachmentResponse,
    summary="Get single attachment details by attachment ID",
)
def get_work_report_attachment_by_id(
    report_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single attachment details by attachment ID (Owner or HR)."""
    return service.get_report_attachment(
        db=db,
        current_user=current_user,
        report_id=report_id,
        attachment_id=attachment_id,
    )


@router.delete(
    "/{report_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete attachment from a work report by attachment ID",
)
def delete_work_report_attachment_by_id(
    report_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an attachment (Allowed only in DRAFT or REJECTED status by author)."""
    service.delete_report_attachment(
        db=db,
        current_user=current_user,
        report_id=report_id,
        attachment_id=attachment_id,
    )


@router.delete(
    "/{report_id}/attachment",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete attachment from a work report (convenience endpoint)",
)
def delete_work_report_attachment(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete report's attachment (Allowed only in DRAFT or REJECTED status by author)."""
    service.delete_report_attachment(
        db=db,
        current_user=current_user,
        report_id=report_id,
    )
