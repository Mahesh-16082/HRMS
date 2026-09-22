from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.project_service import role_repository
from app.project_service.role_models import ProjectRole
from app.project_service.role_schemas import ProjectRoleCreate, ProjectRoleUpdate


def create_project_role(db: Session, data: ProjectRoleCreate) -> ProjectRole:
    code = data.code.strip().upper()
    name = data.name.strip()

    if not code or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project role name and code cannot be empty",
        )

    if role_repository.get_role_by_code(db, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project role with code '{code}' already exists",
        )

    if role_repository.get_role_by_name(db, name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project role with name '{name}' already exists",
        )

    role = ProjectRole(
        name=name,
        code=code,
        description=data.description.strip() if data.description else None,
        is_active=data.is_active,
    )

    return role_repository.create_role(db, role)


def get_all_project_roles(db: Session, skip: int = 0, limit: int = 100) -> list[ProjectRole]:
    return role_repository.get_all_roles(db, skip=skip, limit=limit)


def get_active_project_roles(db: Session) -> list[ProjectRole]:
    return role_repository.get_active_roles(db)


def get_project_role_by_id(db: Session, role_id: int) -> ProjectRole:
    role = role_repository.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project role with ID {role_id} not found",
        )
    return role


def update_project_role(
    db: Session,
    role_id: int,
    data: ProjectRoleUpdate,
) -> ProjectRole:
    role = get_project_role_by_id(db, role_id)

    if data.name is not None:
        name = data.name.strip()
        existing = role_repository.get_role_by_name(db, name)
        if existing and existing.id != role.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project role with name '{name}' already exists",
            )
        role.name = name

    if data.code is not None:
        code = data.code.strip().upper()
        existing = role_repository.get_role_by_code(db, code)
        if existing and existing.id != role.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project role with code '{code}' already exists",
            )
        role.code = code

    if data.description is not None:
        role.description = data.description.strip() if data.description else None

    if data.is_active is not None:
        role.is_active = data.is_active

    return role_repository.update_role(db, role)


def activate_project_role(db: Session, role_id: int) -> ProjectRole:
    role = get_project_role_by_id(db, role_id)
    role.is_active = True
    return role_repository.update_role(db, role)


def deactivate_project_role(db: Session, role_id: int) -> ProjectRole:
    role = get_project_role_by_id(db, role_id)
    role.is_active = False
    return role_repository.update_role(db, role)


def delete_project_role(db: Session, role_id: int) -> None:
    role = get_project_role_by_id(db, role_id)

    assignment_count = role_repository.count_assignments_by_role(db, role_id)
    if assignment_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete project role with existing assignments "
                f"({assignment_count} assignment(s)). Please deactivate it instead."
            ),
        )

    role_repository.delete_role(db, role)
