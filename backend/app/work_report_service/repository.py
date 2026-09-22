from datetime import date
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.employee_service.models import Employee
from app.project_service.assignment_models import ProjectAssignment
from app.project_service.models import Project
from app.work_report_service.models import (
    WorkReport,
    WorkReportAttachment,
    WorkReportStatus,
)


def create_work_report(db: Session, report: WorkReport) -> WorkReport:
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_work_report_by_id(db: Session, report_id: int) -> WorkReport | None:
    return (
        db.query(WorkReport)
        .options(
            joinedload(WorkReport.employee),
            joinedload(WorkReport.project),
            joinedload(WorkReport.reviewer),
            joinedload(WorkReport.attachment),
        )
        .filter(WorkReport.id == report_id)
        .first()
    )


def get_report_by_employee_and_date(
    db: Session,
    employee_id: int,
    work_date: date,
) -> WorkReport | None:
    return (
        db.query(WorkReport)
        .filter(
            WorkReport.employee_id == employee_id,
            WorkReport.work_date == work_date,
        )
        .first()
    )


def update_work_report(db: Session, report: WorkReport) -> WorkReport:
    db.commit()
    db.refresh(report)
    return report


def delete_work_report(db: Session, report: WorkReport) -> None:
    db.delete(report)
    db.commit()


def check_employee_project_assignment(
    db: Session,
    employee_id: int,
    project_id: int,
) -> bool:
    assignment = (
        db.query(ProjectAssignment)
        .filter(
            ProjectAssignment.employee_id == employee_id,
            ProjectAssignment.project_id == project_id,
        )
        .first()
    )
    return assignment is not None


def get_active_project_by_id(db: Session, project_id: int) -> Project | None:
    return (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
        .first()
    )


def list_employee_reports(
    db: Session,
    employee_id: int,
    status: WorkReportStatus | None = None,
    project_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[WorkReport]]:
    query = (
        db.query(WorkReport)
        .options(
            joinedload(WorkReport.employee),
            joinedload(WorkReport.project),
            joinedload(WorkReport.reviewer),
            joinedload(WorkReport.attachment),
        )
        .filter(WorkReport.employee_id == employee_id)
    )

    if status:
        query = query.filter(WorkReport.status == status)
    if project_id:
        query = query.filter(WorkReport.project_id == project_id)
    if start_date:
        query = query.filter(WorkReport.work_date >= start_date)
    if end_date:
        query = query.filter(WorkReport.work_date <= end_date)

    total = query.count()
    reports = (
        query.order_by(WorkReport.work_date.desc(), WorkReport.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, reports


def list_all_reports_hr(
    db: Session,
    employee_id: int | None = None,
    project_id: int | None = None,
    status: WorkReportStatus | None = None,
    work_date: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[WorkReport]]:
    query = (
        db.query(WorkReport)
        .join(WorkReport.employee)
        .options(
            joinedload(WorkReport.employee),
            joinedload(WorkReport.project),
            joinedload(WorkReport.reviewer),
            joinedload(WorkReport.attachment),
        )
    )

    if employee_id:
        query = query.filter(WorkReport.employee_id == employee_id)
    if project_id:
        query = query.filter(WorkReport.project_id == project_id)
    if status:
        query = query.filter(WorkReport.status == status)
    if work_date:
        query = query.filter(WorkReport.work_date == work_date)
    if start_date:
        query = query.filter(WorkReport.work_date >= start_date)
    if end_date:
        query = query.filter(WorkReport.work_date <= end_date)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                WorkReport.title.ilike(term),
                WorkReport.tasks_completed.ilike(term),
                Employee.first_name.ilike(term),
                Employee.last_name.ilike(term),
                Employee.employee_code.ilike(term),
            )
        )

    total = query.count()
    reports = (
        query.order_by(WorkReport.work_date.desc(), WorkReport.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, reports


# ============================================================
# ATTACHMENT REPOSITORY ACTIONS
# ============================================================

def create_attachment(db: Session, attachment: WorkReportAttachment) -> WorkReportAttachment:
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def get_attachment_by_id(db: Session, attachment_id: int) -> WorkReportAttachment | None:
    return (
        db.query(WorkReportAttachment)
        .filter(WorkReportAttachment.id == attachment_id)
        .first()
    )


def get_attachment_by_report_id(db: Session, report_id: int) -> WorkReportAttachment | None:
    return (
        db.query(WorkReportAttachment)
        .filter(WorkReportAttachment.work_report_id == report_id)
        .first()
    )


def delete_attachment(db: Session, attachment: WorkReportAttachment) -> None:
    db.delete(attachment)
    db.commit()
