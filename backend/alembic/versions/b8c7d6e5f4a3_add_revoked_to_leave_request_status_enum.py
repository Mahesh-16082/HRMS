"""add_revoked_to_leave_request_status_enum

Revision ID: b8c7d6e5f4a3
Revises: e3458e248377
Create Date: 2026-09-23 10:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c7d6e5f4a3'
down_revision: Union[str, Sequence[str], None] = 'e3458e248377'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE leave_request_status ADD VALUE IF NOT EXISTS 'REVOKED'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type easily.
    pass
