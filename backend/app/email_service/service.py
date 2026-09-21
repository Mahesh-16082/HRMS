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