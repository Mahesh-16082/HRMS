"""create_audit_logs_table

Revision ID: f5819d42ab17
Revises: e7362316ac43
Create Date: 2026-09-22 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5819d42ab17'
down_revision: Union[str, Sequence[str], None] = 'e7362316ac43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('action', sa.Enum('LOGIN', 'LOGOUT', 'OTP_VERIFICATION', name='audit_action'), nullable=False),
        sa.Column('status', sa.Enum('SUCCESS', 'FAILED', name='audit_status'), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('details', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_email'), 'audit_logs', ['email'], unique=False)
    op.create_index(op.f('ix_audit_logs_status'), 'audit_logs', ['status'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_status'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_email'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_table('audit_logs')
    sa.Enum(name='audit_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='audit_action').drop(op.get_bind(), checkfirst=True)
