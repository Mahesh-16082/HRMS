from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.core.config import settings
from app.core.database import Base

# Import models here so Alembic can detect them
from app.authentication_service import models
from app.employee_service.models import Employee
from app.attendance_service.models import Attendance
from app.project_service.models import Project
from app.project_service.role_models import ProjectRole
from app.project_service.assignment_models import ProjectAssignment
from app.leave_service.models import LeaveType, LeaveBalance, LeaveRequest
from app.complaint_service.models import Complaint
from app.announcement_service.models import Announcement
from app.audit_service.models import AuditLog
from app.work_report_service.models import WorkReport, WorkReportAttachment
from app.performance_service.models import PerformanceReview, ReviewCategoryRating, PerformanceGoal
from app.notification_service.models import Notification

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""

    url = settings.DATABASE_URL

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    configuration = config.get_section(
        config.config_ini_section,
        {}
    )

    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()