from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.project_service import repository
from app.project_service.models import Project, ProjectStatus


def generate_project_code(db: Session) -> str:
    project_count = repository.count_projects(db)

    next_number = project_count + 1

    while True:
        project_code = f"PRJ{next_number:03d}"

        existing_project = repository.get_project_by_code(
            db,
            project_code,
            include_deleted=True,
        )

        if not existing_project:
            return project_code

        next_number += 1


def validate_project_dates(
    start_date: date | None,
    end_date: date | None,
):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date",
        )


def create_project(
    db: Session,
    user_id: int,
    project_name: str,
    description: str | None,
    start_date: date | None,
    end_date: date | None,
):
    validate_project_dates(
        start_date,
        end_date,
    )

    project_code = generate_project_code(db)

    project = Project(
        project_name=project_name,
        project_code=project_code,
        description=description,
        start_date=start_date,
        end_date=end_date,
        status=ProjectStatus.PLANNED,
        created_by=user_id,
    )

    return repository.create_project(
        db,
        project,
    )


def get_project(
    db: Session,
    project_id: int,
):
    project = repository.get_project_by_id(
        db,
        project_id,
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def get_projects(
    db: Session,
    project_status: ProjectStatus | None = None,
):
    return repository.get_all_projects(
        db,
        project_status,
    )


def update_project(
    db: Session,
    project_id: int,
    project_name: str | None = None,
    description: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    project = get_project(
        db,
        project_id,
    )

    new_start_date = (
        start_date
        if start_date is not None
        else project.start_date
    )

    new_end_date = (
        end_date
        if end_date is not None
        else project.end_date
    )

    validate_project_dates(
        new_start_date,
        new_end_date,
    )

    update_data = {}

    if project_name is not None:
        update_data["project_name"] = project_name

    if description is not None:
        update_data["description"] = description

    if start_date is not None:
        update_data["start_date"] = start_date

    if end_date is not None:
        update_data["end_date"] = end_date

    if not update_data:
        return project

    return repository.update_project(
        db,
        project,
        update_data,
    )


def update_project_status(
    db: Session,
    project_id: int,
    project_status: ProjectStatus,
):
    project = get_project(
        db,
        project_id,
    )

    return repository.update_project_status(
        db,
        project,
        project_status,
    )


def archive_project(
    db: Session,
    project_id: int,
):
    project = get_project(
        db,
        project_id,
    )

    repository.delete_project(
        db,
        project,
    )

    return {
        "message": "Project archived successfully"
    }


def get_project_count(
    db: Session,
    project_status: ProjectStatus | None = None,
):
    return repository.count_projects(
        db,
        project_status,
    )