import os
import re
from datetime import date, datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.authentication_service.models import User
from app.cloudinary_service import service as cloudinary_service
from app.employee_service import repository as employee_repository
from app.employee_service.models import Employee, EmploymentStatus
from app.notification_service.models import NotificationType
from app.notification_service.service import create_notification, get_responsible_hr_user
from app.work_report_service import repository
from app.work_report_service.models import (
    WorkReport,
    WorkReportAttachment,
    WorkReportStatus,
)
from app.work_report_service.schemas import (
    WorkReportCreate,
    WorkReportReview,
    WorkReportUpdate,
)

# 10 MB maximum file size
MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf": ["application/pdf"],
    ".doc": ["application/msword"],
    ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ".xls": ["application/vnd.ms-excel"],
    ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ".ppt": ["application/vnd.ms-powerpoint"],
    ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".webp": ["image/webp"],
    ".txt": ["text/plain"],
    ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
}

DANGEROUS_EXTENSIONS = {
    ".exe", ".sh", ".bat", ".cmd", ".py", ".js", ".vbs", ".php", ".dll",
    ".bin", ".scr", ".msi", ".jar", ".ps1", ".com", ".pif", ".wsf",
}


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and illegal characters."""
    base = os.path.basename(filename).strip()
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', base)
    return clean[:200] or "attachment"


def validate_attachment_file(filename: str, content_type: str, file_bytes: bytes) -> tuple[str, str, str]:
    """
    Validate uploaded file:
    - Size (<= 10 MB)
    - Extension
    - MIME type
    - Magic bytes / headers
    - Reject executable signatures
    Returns (clean_filename, verified_mime_type, cloudinary_resource_type).
    """
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 10 MB",
        )

    clean_name = sanitize_filename(filename)
    _, ext = os.path.splitext(clean_name)
    ext = ext.lower()

    if not ext or ext in DANGEROUS_EXTENSIONS or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, Images, Text/CSV.",
        )

    allowed_mimes = ALLOWED_EXTENSIONS[ext]
    norm_content_type = content_type.lower().split(';')[0].strip() if content_type else ""

    if norm_content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MIME type '{norm_content_type}' is invalid for extension '{ext}'",
        )

    # Magic byte inspection
    if file_bytes.startswith(b"MZ") or file_bytes.startswith(b"\x7fELF") or file_bytes.startswith(b"#!/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Executable files and binary scripts are strictly prohibited",
        )

    if ext == ".pdf" and not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid PDF header",
        )

    if ext == ".png" and not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid PNG header",
        )

    if ext in (".jpg", ".jpeg") and not file_bytes.startswith(b"\xff\xd8\xff"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid JPEG header",
        )

    if ext == ".webp":
        if not (file_bytes.startswith(b"RIFF") and len(file_bytes) > 12 and file_bytes[8:12] == b"WEBP"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid WebP header",
            )

    if ext in (".docx", ".xlsx", ".pptx") and not file_bytes.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid Office OpenXML document",
        )

    if ext in (".doc", ".xls", ".ppt") and not file_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid legacy Office document",
        )

    resource_type = "image" if ext in (".jpg", ".jpeg", ".png", ".webp") else "raw"
    return clean_name, norm_content_type, resource_type


def get_active_employee_for_user(db: Session, user_id: int) -> Employee:
    """
    Look up the employee record corresponding to the authenticated user.
    Enforces that employee profile exists and is active.
    """
    employee = employee_repository.get_employee_by_user_id(db, user_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee account is not active",
        )

    return employee


# ============================================================
# EMPLOYEE ACTIONS
# ============================================================

def create_work_report(
    db: Session,
    current_user: User,
    data: WorkReportCreate,
) -> WorkReport:
    employee = get_active_employee_for_user(db, current_user.id)

    work_date = data.work_date or date.today()
    if work_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit work reports for future dates",
        )

    # Check duplicate report for this employee & date
    existing = repository.get_report_by_employee_and_date(db, employee.id, work_date)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A work report already exists for date {work_date}",
        )

    # Validate project association if provided
    if data.project_id is not None:
        project = repository.get_active_project_by_id(db, data.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project not found or is inactive",
            )

        is_assigned = repository.check_employee_project_assignment(
            db, employee.id, data.project_id
        )
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee is not assigned to this project",
            )

    report_status = WorkReportStatus.SUBMITTED if data.submit else WorkReportStatus.DRAFT
    submitted_at = datetime.now(timezone.utc) if data.submit else None

    report = WorkReport(
        employee_id=employee.id,
        project_id=data.project_id,
        work_date=work_date,
        title=data.title.strip(),
        tasks_completed=data.tasks_completed.strip(),
        plans_for_tomorrow=data.plans_for_tomorrow.strip() if data.plans_for_tomorrow else None,
        blockers=data.blockers.strip() if data.blockers else None,
        hours_worked=data.hours_worked,
        status=report_status,
        submitted_at=submitted_at,
    )

    saved_report = repository.create_work_report(db, report)

    if saved_report.status == WorkReportStatus.SUBMITTED:
        hr_user = get_responsible_hr_user(db)
        if hr_user:
            create_notification(
                db=db,
                recipient_user_id=hr_user.id,
                notification_type=NotificationType.WORK_REPORT_SUBMITTED,
                title="Work Report Submitted",
                message=f"{employee.first_name} {employee.last_name} submitted a work report for {saved_report.work_date}.",
                reference_type="work_report",
                reference_id=str(saved_report.id),
                commit=True,
            )

    return saved_report


def get_my_work_reports(
    db: Session,
    current_user: User,
    status_filter: WorkReportStatus | None = None,
    project_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[WorkReport]]:
    employee = get_active_employee_for_user(db, current_user.id)
    return repository.list_employee_reports(
        db=db,
        employee_id=employee.id,
        status=status_filter,
        project_id=project_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


def get_today_work_report_status(
    db: Session,
    current_user: User,
) -> dict:
    employee = get_active_employee_for_user(db, current_user.id)
    today = date.today()
    report = repository.get_report_by_employee_and_date(db, employee.id, today)
    has_submitted = (
        report is not None
        and report.status in (WorkReportStatus.SUBMITTED, WorkReportStatus.APPROVED)
    )
    return {
        "has_submitted": has_submitted,
        "report": report,
    }


def get_my_work_report_by_id(
    db: Session,
    current_user: User,
    report_id: int,
) -> WorkReport:
    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )
    return report


def update_my_work_report(
    db: Session,
    current_user: User,
    report_id: int,
    data: WorkReportUpdate,
) -> WorkReport:
    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status not in (WorkReportStatus.DRAFT, WorkReportStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit report in {getattr(report.status, 'value', report.status)} status. Only DRAFT and REJECTED reports can be edited.",
        )

    # Validate project association if updating project_id
    if data.project_id is not None and data.project_id != report.project_id:
        project = repository.get_active_project_by_id(db, data.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project not found or is inactive",
            )

        is_assigned = repository.check_employee_project_assignment(
            db, employee.id, data.project_id
        )
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee is not assigned to this project",
            )
        report.project_id = data.project_id

    if data.title is not None:
        report.title = data.title.strip()
    if data.tasks_completed is not None:
        report.tasks_completed = data.tasks_completed.strip()
    if data.plans_for_tomorrow is not None:
        report.plans_for_tomorrow = data.plans_for_tomorrow.strip() if data.plans_for_tomorrow else None
    if data.blockers is not None:
        report.blockers = data.blockers.strip() if data.blockers else None
    if data.hours_worked is not None:
        report.hours_worked = data.hours_worked

    return repository.update_work_report(db, report)


def submit_my_work_report(
    db: Session,
    current_user: User,
    report_id: int,
) -> WorkReport:
    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status not in (WorkReportStatus.DRAFT, WorkReportStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit report in {getattr(report.status, 'value', report.status)} status. Only DRAFT and REJECTED reports can be submitted.",
        )

    report.status = WorkReportStatus.SUBMITTED
    report.submitted_at = datetime.now(timezone.utc)

    saved_report = repository.update_work_report(db, report)

    hr_user = get_responsible_hr_user(db, report.reviewed_by)
    if hr_user:
        create_notification(
            db=db,
            recipient_user_id=hr_user.id,
            notification_type=NotificationType.WORK_REPORT_SUBMITTED,
            title="Work Report Submitted",
            message=f"{employee.first_name} {employee.last_name} submitted a work report for {saved_report.work_date}.",
            reference_type="work_report",
            reference_id=str(saved_report.id),
            commit=True,
        )

    return saved_report


def delete_my_work_report(
    db: Session,
    current_user: User,
    report_id: int,
) -> None:
    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status != WorkReportStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only DRAFT reports can be deleted",
        )

    if report.attachment:
        res_type = "image" if report.attachment.file_type.startswith("image/") else "raw"
        try:
            cloudinary_service.delete_work_report_attachment(
                report.attachment.storage_public_id,
                resource_type=res_type,
            )
        except Exception:
            pass

    repository.delete_work_report(db, report)


# ============================================================
# ATTACHMENT ACTIONS
# ============================================================

def upload_report_attachment(
    db: Session,
    current_user: User,
    report_id: int,
    upload_file: UploadFile,
) -> WorkReportAttachment:
    """
    Upload an attachment to a work report.
    Rules:
    - Only the authoring employee can upload.
    - Allowed only when report is in DRAFT or REJECTED status.
    - MAXIMUM 1 attachment per Work Report. If one exists, returns 400.
    - Validates extension, MIME type, magic bytes, size (<= 10MB).
    """
    if current_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can attach files to work reports",
        )

    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status not in (WorkReportStatus.DRAFT, WorkReportStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload attachment when report is in {getattr(report.status, 'value', report.status)} status. Attachments can only be modified in DRAFT or REJECTED status.",
        )

    # ONE ATTACHMENT RULE
    existing = repository.get_attachment_by_report_id(db, report_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Work report already has an attachment. Maximum 1 attachment allowed. Delete the existing attachment before uploading a new one.",
        )

    file_bytes = upload_file.file.read()
    clean_filename, verified_mime, resource_type = validate_attachment_file(
        filename=upload_file.filename or "attachment",
        content_type=upload_file.content_type or "",
        file_bytes=file_bytes,
    )

    upload_file.file.seek(0)
    upload_res = cloudinary_service.upload_work_report_attachment(
        file=upload_file.file,
        report_id=report_id,
        original_filename=clean_filename,
        resource_type=resource_type,
    )

    attachment = WorkReportAttachment(
        work_report_id=report_id,
        original_filename=clean_filename,
        file_url=upload_res["url"],
        file_type=verified_mime,
        file_size=len(file_bytes),
        storage_public_id=upload_res["public_id"],
        uploaded_by=current_user.id,
    )

    return repository.create_attachment(db, attachment)


def get_report_attachment(
    db: Session,
    current_user: User,
    report_id: int,
    attachment_id: int | None = None,
) -> WorkReportAttachment:
    report = repository.get_work_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    # Permission: HR or authoring employee
    if current_user.role != "hr":
        employee = get_active_employee_for_user(db, current_user.id)
        if report.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work report not found",
            )

    attachment = repository.get_attachment_by_report_id(db, report_id)
    if not attachment or (attachment_id is not None and attachment.id != attachment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    return attachment


def list_report_attachments(
    db: Session,
    current_user: User,
    report_id: int,
) -> list[WorkReportAttachment]:
    report = repository.get_work_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    # Permission: HR or authoring employee
    if current_user.role != "hr":
        employee = get_active_employee_for_user(db, current_user.id)
        if report.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work report not found",
            )

    attachment = repository.get_attachment_by_report_id(db, report_id)
    return [attachment] if attachment else []


def delete_report_attachment(
    db: Session,
    current_user: User,
    report_id: int,
    attachment_id: int | None = None,
) -> None:
    """
    Delete a work report attachment.
    Rules:
    - Only the authoring employee can delete (HR cannot delete employee attachments).
    - Allowed only when report is in DRAFT or REJECTED status.
    - Cleans up database record and Cloudinary remote asset.
    """
    if current_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authoring employees can delete work report attachments",
        )

    employee = get_active_employee_for_user(db, current_user.id)
    report = repository.get_work_report_by_id(db, report_id)
    if not report or report.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status not in (WorkReportStatus.DRAFT, WorkReportStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete attachment when report is in {getattr(report.status, 'value', report.status)} status. Attachments can only be modified in DRAFT or REJECTED status.",
        )

    attachment = repository.get_attachment_by_report_id(db, report_id)
    if not attachment or (attachment_id is not None and attachment.id != attachment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    res_type = "image" if attachment.file_type.startswith("image/") else "raw"
    try:
        cloudinary_service.delete_work_report_attachment(
            attachment.storage_public_id,
            resource_type=res_type,
        )
    except Exception:
        pass

    repository.delete_attachment(db, attachment)


# ============================================================
# HR ACTIONS
# ============================================================

def list_all_work_reports_hr(
    db: Session,
    current_user: User,
    employee_id: int | None = None,
    project_id: int | None = None,
    status_filter: WorkReportStatus | None = None,
    work_date: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[WorkReport]]:
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can view all work reports",
        )

    return repository.list_all_reports_hr(
        db=db,
        employee_id=employee_id,
        project_id=project_id,
        status=status_filter,
        work_date=work_date,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )


def get_work_report_details_hr(
    db: Session,
    current_user: User,
    report_id: int,
) -> WorkReport:
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can view work report details",
        )

    report = repository.get_work_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    return report


def review_work_report_hr(
    db: Session,
    current_user: User,
    report_id: int,
    data: WorkReportReview,
) -> WorkReport:
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can review work reports",
        )

    report = repository.get_work_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status != WorkReportStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review report in {getattr(report.status, 'value', report.status)} status. Only SUBMITTED reports can be reviewed.",
        )

    if data.status == WorkReportStatus.REJECTED:
        if not data.review_feedback or not data.review_feedback.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Review feedback is required when rejecting a report",
            )

    report.status = data.status
    report.reviewed_by = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.review_feedback = data.review_feedback.strip() if data.review_feedback else None

    saved_report = repository.update_work_report(db, report)

    emp = saved_report.employee or employee_repository.get_employee_by_id(db, saved_report.employee_id)
    if emp and emp.user_id:
        if data.status == WorkReportStatus.APPROVED:
            create_notification(
                db=db,
                recipient_user_id=emp.user_id,
                notification_type=NotificationType.WORK_REPORT_APPROVED,
                title="Work Report Approved",
                message=f"Your work report for {saved_report.work_date} has been approved.",
                reference_type="work_report",
                reference_id=str(saved_report.id),
                commit=True,
            )
        elif data.status == WorkReportStatus.REJECTED:
            create_notification(
                db=db,
                recipient_user_id=emp.user_id,
                notification_type=NotificationType.WORK_REPORT_REJECTED,
                title="Work Report Rejected",
                message=f"Your work report for {saved_report.work_date} has been rejected. Feedback: {saved_report.review_feedback}",
                reference_type="work_report",
                reference_id=str(saved_report.id),
                commit=True,
            )

    return saved_report


def revoke_work_report_hr(
    db: Session,
    current_user: User,
    report_id: int,
) -> WorkReport:
    """
    HR revokes approval of a work report, transitioning it from APPROVED back to SUBMITTED.
    Only HR can perform this action.
    """
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can revoke work report approval",
        )

    report = repository.get_work_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work report not found",
        )

    if report.status != WorkReportStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke approval for report in {getattr(report.status, 'value', report.status)} status. Only APPROVED reports can be revoked.",
        )

    report.status = WorkReportStatus.SUBMITTED
    report.reviewed_by = None
    report.reviewed_at = None
    report.review_feedback = None

    saved_report = repository.update_work_report(db, report)
    return saved_report

