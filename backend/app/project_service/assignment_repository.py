from sqlalchemy.orm import Session

from app.project_service.assignment_models import ProjectAssignment


def get_assignment_by_id(
    db: Session,
    assignment_id: int,
):
    return (
        db.query(ProjectAssignment)
        .filter(ProjectAssignment.id == assignment_id)
        .first()
    )


def get_assignment(
    db: Session,
    project_id: int,
    employee_id: int,
):
    return (
        db.query(ProjectAssignment)
        .filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.employee_id == employee_id,
        )
        .first()
    )


def create_assignment(
    db: Session,
    assignment: ProjectAssignment,
):
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return assignment


def get_project_assignments(
    db: Session,
    project_id: int,
):
    return (
        db.query(ProjectAssignment)
        .filter(
            ProjectAssignment.project_id == project_id
        )
        .order_by(ProjectAssignment.assigned_at.desc())
        .all()
    )


def get_employee_assignments(
    db: Session,
    employee_id: int,
):
    return (
        db.query(ProjectAssignment)
        .filter(
            ProjectAssignment.employee_id == employee_id
        )
        .order_by(ProjectAssignment.assigned_at.desc())
        .all()
    )


def delete_assignment(
    db: Session,
    assignment: ProjectAssignment,
):
    db.delete(assignment)
    db.commit()