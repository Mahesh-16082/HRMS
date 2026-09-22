import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_otp_email(
    recipient_email: str,
    otp: str
):
    message = EmailMessage()

    message["Subject"] = "HRMS Login OTP"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

Your HRMS login OTP is:

{otp}

This OTP is valid for {settings.OTP_EXPIRE_MINUTES} minutes.

If you did not request this OTP, please ignore this email.

Regards,
HRMS Team
"""
    )

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
):
    message = EmailMessage()

    message["Subject"] = "You have been assigned to a new project"
    message["From"] = settings.SMTP_EMAIL
    message["To"] = recipient_email

    desc_line = f"Description: {description}\n" if description else ""
    start_str = start_date.strftime("%b %d, %Y") if hasattr(start_date, "strftime") else (str(start_date) if start_date else "Not specified")
    end_str = end_date.strftime("%b %d, %Y") if hasattr(end_date, "strftime") else (str(end_date) if end_date else "Not specified")
    status_str = f"Status: {status}\n" if status else ""

    message.set_content(
        f"""Hello {employee_name},

You have been successfully assigned to a new project in the HRMS system.

Project Details:
----------------
Project Name: {project_name}
Project Code: {project_code}
{status_str}Start Date: {start_str}
End Date: {end_str}
{desc_line}
Please log in to your HRMS Employee Portal to view complete project information and track your assignments under 'My Projects'.

Best regards,
HRMS Administration
"""
    )

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