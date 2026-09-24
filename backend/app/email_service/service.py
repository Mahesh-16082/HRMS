import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.email_service.assets import get_email_assets, get_project_assignment_email_assets
from app.email_service.templates import (
    get_otp_email_html,
    get_otp_email_text,
    get_project_assignment_email_html,
    get_project_assignment_email_text,
)


def send_otp_email(
    recipient_email: str,
    otp: str
):
    expire_minutes = settings.OTP_EXPIRE_MINUTES
    plain_text = get_otp_email_text(otp=otp, expire_minutes=expire_minutes)
    html_content = get_otp_email_html(otp=otp, expire_minutes=expire_minutes)

    message = EmailMessage()

    message["Subject"] = "HRMS Login OTP"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = recipient_email

    # Plain-text fallback for maximum client compatibility
    message.set_content(plain_text)
    # Rich HTML email matching HRMS enterprise design
    message.add_alternative(html_content, subtype="html")

    # Attach inline CID image assets for 100% reliable icon rendering in Gmail & other clients
    html_part = message.get_payload()[1]
    assets = get_email_assets()
    for cid, data in assets.items():
        html_part.add_related(data, "image", "png", cid=f"<{cid}>")

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT
    ) as server:

        server.starttls()

        server.login(
            settings.SMTP_EMAIL,
            settings.SMTP_PASSWORD
        )

        server.send_message(message)


def send_project_assignment_email(
    recipient_email: str,
    employee_name: str,
    project_name: str,
    project_code: str,
    description: str | None = None,
    start_date = None,
    end_date = None,
    status: str | None = None,
    role_name: str | None = None,
    assigned_date = None,
):
    plain_text = get_project_assignment_email_text(
        employee_name=employee_name,
        project_name=project_name,
        project_code=project_code,
        description=description,
        start_date=start_date,
        end_date=end_date,
        status=status,
        role_name=role_name,
        assigned_date=assigned_date,
    )
    html_content = get_project_assignment_email_html(
        employee_name=employee_name,
        project_name=project_name,
        project_code=project_code,
        description=description,
        start_date=start_date,
        end_date=end_date,
        status=status,
        role_name=role_name,
        assigned_date=assigned_date,
    )

    message = EmailMessage()

    message["Subject"] = "You have been assigned to a new project"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = recipient_email

    # Plain-text fallback for maximum client compatibility
    message.set_content(plain_text)
    # Rich HTML email matching HRMS enterprise design & reference image
    message.add_alternative(html_content, subtype="html")

    # Attach inline CID image assets for 100% reliable icon rendering in Gmail & other clients
    html_part = message.get_payload()[1]
    assets = get_project_assignment_email_assets()
    for cid, data in assets.items():
        html_part.add_related(data, "image", "png", cid=f"<{cid}>")

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT
    ) as server:
        server.starttls()
        server.login(
            settings.SMTP_EMAIL,
            settings.SMTP_PASSWORD
        )
        server.send_message(message)
