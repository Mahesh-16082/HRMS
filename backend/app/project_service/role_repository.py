from sqlalchemy import func
from sqlalchemy.orm import Session

from app.project_service.assignment_models import ProjectAssignment
from app.project_service.role_models import ProjectRole


def create_role(db: Session, role: ProjectRole) -> ProjectRole:
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def get_role_by_id(db: Session, role_id: int) -> ProjectRole | None:
    return db.query(ProjectRole).filter(ProjectRole.id == role_id).first()


def get_role_by_code(db: Session, code: str) -> ProjectRole | None:
    return db.query(ProjectRole).filter(func.lower(ProjectRole.code) == code.lower()).first()


def get_role_by_name(db: Session, name: str) -> ProjectRole | None:
    return db.query(ProjectRole).filter(func.lower(ProjectRole.name) == name.lower()).first()


def get_all_roles(db: Session, skip: int = 0, limit: int = 100) -> list[ProjectRole]:
    return (
        db.query(ProjectRole)
        .order_by(ProjectRole.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_active_roles(db: Session) -> list[ProjectRole]:
    return (
        db.query(ProjectRole)
        .filter(ProjectRole.is_active == True)
        .order_by(ProjectRole.name.asc())
        .all()
    )


def update_role(db: Session, role: ProjectRole) -> ProjectRole:
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role: ProjectRole) -> None:
    db.delete(role)
    db.commit()


def count_assignments_by_role(db: Session, role_id: int) -> int:
    return (
        db.query(func.count(ProjectAssignment.id))
        .filter(ProjectAssignment.role_id == role_id)
        .scalar()
        or 0
    )
