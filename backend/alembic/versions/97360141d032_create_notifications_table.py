"""create_notifications_table

Revision ID: 97360141d032
Revises: f6cff5de584c
Create Date: 2026-09-23 20:24:34.151117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97360141d032'
down_revision: Union[str, Sequence[str], None] = 'f6cff5de584c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('recipient_user_id', sa.Integer(), nullable=False),
        sa.Column(
            'notification_type',
            sa.Enum(
                'LEAVE_REQUEST_SUBMITTED',
                'LEAVE_REQUEST_APPROVED',
                'LEAVE_REQUEST_REJECTED',
                'LEAVE_REQUEST_REVOKED',
                'COMPLAINT_SUBMITTED',
                'COMPLAINT_UPDATED',
                'COMPLAINT_RESOLVED',
                'PROJECT_ASSIGNED',
                'PROJECT_ROLE_ASSIGNED',
                'ANNOUNCEMENT_PUBLISHED',
                'PERFORMANCE_REVIEW_COMPLETED',
                'WORK_REPORT_SUBMITTED',
                'WORK_REPORT_APPROVED',
                'WORK_REPORT_REJECTED',
                'ATTENDANCE_RELATED',
                'GENERAL',
                name='notification_type',
            ),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reference_type', sa.String(length=100), nullable=True),
        sa.Column('reference_id', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['recipient_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index(op.f('ix_notifications_recipient_user_id'), 'notifications', ['recipient_user_id'], unique=False)
    op.create_index(op.f('ix_notifications_notification_type'), 'notifications', ['notification_type'], unique=False)
    op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'], unique=False)
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)
    op.create_index('ix_notifications_user_unread_created', 'notifications', ['recipient_user_id', 'is_read', 'created_at'], unique=False)
    op.create_index('ix_notifications_user_created', 'notifications', ['recipient_user_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_index('ix_notifications_user_unread_created', table_name='notifications')
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_is_read'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_notification_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_user_id'), table_name='notifications')
    op.drop_table('notifications')
    sa.Enum(name='notification_type').drop(op.get_bind(), checkfirst=True)
