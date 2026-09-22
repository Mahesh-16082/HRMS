from sqlalchemy.orm import Session

from app.project_service.models import Project, ProjectStatus


def get_project_by_id(
    db: Session,
    project_id: int,
):
    return (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
        .first()
    )


def get_project_by_code(
    db: Session,
    project_code: str,
    include_deleted: bool = False,
):
    query = db.query(Project).filter(Project.project_code == project_code)
    if not include_deleted:
        query = query.filter(Project.deleted_at.is_(None))
    return query.first()


def create_project(
    db: Session,
    project: Project,
):
    db.add(project)
    db.commit()
    db.refresh(project)

    return project


def update_project(
    db: Session,
    project: Project,
    update_data: dict,
):
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    return project


def update_project_status(
    db: Session,
    project: Project,
    status: ProjectStatus,
):
    project.status = status

    db.commit()
    db.refresh(project)

    return project


def delete_project(
    db: Session,
    project: Project,
):
    from datetime import datetime, timezone

    project.deleted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)

    return project


def get_all_projects(
    db: Session,
    status: ProjectStatus | None = None,
):
    query = (
        db.query(Project)
        .filter(Project.deleted_at.is_(None))
    )

    if status is not None:
        query = query.filter(
            Project.status == status
        )

    return (
        query
        .order_by(Project.created_at.desc())
        .all()
    )


def count_projects(
    db: Session,
    status: ProjectStatus | None = None,
):
    query = (
        db.query(Project)
        .filter(Project.deleted_at.is_(None))
    )

    if status is not None:
        query = query.filter(
            Project.status == status
        )

    return query.count()