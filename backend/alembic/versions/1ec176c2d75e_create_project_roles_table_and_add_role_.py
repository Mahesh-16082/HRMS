"""create project roles table and add role_id to project assignments

Revision ID: 1ec176c2d75e
Revises: 670280ec7643
Create Date: 2026-09-22 14:40:07.825559

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ec176c2d75e'
down_revision: Union[str, Sequence[str], None] = '670280ec7643'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create project_roles table
    op.create_table(
        'project_roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_project_roles_code'), 'project_roles', ['code'], unique=True)

    # 2. Seed default initial roles
    project_roles_table = sa.table(
        'project_roles',
        sa.column('name', sa.String),
        sa.column('code', sa.String),
        sa.column('description', sa.Text),
        sa.column('is_active', sa.Boolean),
        sa.column('created_at', sa.DateTime(timezone=True)),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        project_roles_table,
        [
            {
                "name": "Full Stack Developer",
                "code": "FULLSTACK_DEV",
                "description": "Full stack application development across frontend and backend",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Frontend Developer",
                "code": "FRONTEND_DEV",
                "description": "Client-side and UI implementation",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Backend Developer",
                "code": "BACKEND_DEV",
                "description": "Server-side architecture and database integration",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "QA Engineer",
                "code": "QA_ENG",
                "description": "Quality assurance and automated testing",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "UI/UX Designer",
                "code": "UI_UX_DESIGNER",
                "description": "User interface, design systems, and user research",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Project Manager",
                "code": "PROJECT_MGR",
                "description": "Sprint planning, coordination, and delivery management",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        ]
    )

    # 3. Add role_id column to project_assignments (nullable initially)
    op.add_column('project_assignments', sa.Column('role_id', sa.Integer(), nullable=True))

    # 4. Safely backfill existing project assignments with default Full Stack Developer role
    op.execute(
        """
        UPDATE project_assignments
        SET role_id = (SELECT id FROM project_roles WHERE code = 'FULLSTACK_DEV' LIMIT 1)
        WHERE role_id IS NULL
        """
    )

    # 5. Alter role_id column to nullable=False
    op.alter_column('project_assignments', 'role_id', existing_type=sa.Integer(), nullable=False)

    # 6. Create index and foreign key constraint
    op.create_index(op.f('ix_project_assignments_role_id'), 'project_assignments', ['role_id'], unique=False)
    op.create_foreign_key(
        'fk_project_assignments_role_id_project_roles',
        'project_assignments',
        'project_roles',
        ['role_id'],
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_project_assignments_role_id_project_roles', 'project_assignments', type_='foreignkey')
    op.drop_index(op.f('ix_project_assignments_role_id'), table_name='project_assignments')
    op.drop_column('project_assignments', 'role_id')
    op.drop_index(op.f('ix_project_roles_code'), table_name='project_roles')
    op.drop_table('project_roles')
