from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from email.message import EmailMessage

from app.announcement_service.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementPriority,
    AnnouncementStatus,
)
from app.announcement_service.schemas import AnnouncementCreate
from app.announcement_service import service as announcement_service
from app.authentication_service.models import User
from app.core.config import settings
from app.core.database import SessionLocal
from app.email_service import service as email_service
from app.email_service.templates import (
    get_announcement_email_html,
    get_announcement_email_text,
)
from app.employee_service.models import Employee, EmploymentStatus
from app.notification_service.models import Notification, NotificationType


def test_01_announcement_email_text_content():
    """Verify plain text fallback contains all dynamic fields and required corporate HRMS sections."""
    text = get_announcement_email_text(
        employee_name="Jane Doe",
        announcement_title="Company Q4 Town Hall",
        announcement_description="Quarterly performance review and upcoming milestones discussion.",
        announcement_date=date(2026, 10, 7),
        publisher_name="HR Operations",
        category="EVENT",
        priority="HIGH",
    )

    assert "Hello Jane Doe," in text
    assert "The HR department has published a new announcement on the HRMS portal." in text
    assert "NEW ANNOUNCEMENT" in text
    assert "Company Q4 Town Hall" in text
    assert "Announcement Date: 07 October 2026" in text
    assert "Published By: HR Operations" in text
    assert "Category: EVENT" in text
    assert "Priority: HIGH" in text
    assert "Announcement Content:" in text
    assert "Quarterly performance review and upcoming milestones discussion." in text
    assert "Please check your HRMS dashboard for more details about this announcement." in text
    assert "Regards," in text
    assert "HRMS Team" in text
    assert "This is an automated email from HRMS. Please do not reply." in text


def test_02_announcement_email_html_structure_and_no_attachments():
    """
    Verify HTML template layout, branding, dynamic content, and STRICT absence of:
    - CID references
    - External img tags
    - CTA buttons
    - Downloadable files
    """
    html = get_announcement_email_html(
        employee_name="Jane Doe",
        announcement_title="New Health Insurance Benefits 2026",
        announcement_description="All full-time staff are eligible for updated comprehensive health coverage.",
        announcement_date=date(2026, 10, 7),
        publisher_name="HR Benefits Team",
        category="POLICY",
        priority="URGENT",
    )

    # Dynamic fields
    assert "Hello Jane Doe," in html
    assert "The HR department has published a new announcement on the HRMS portal." in html
    assert "NEW ANNOUNCEMENT" in html
    assert "New Health Insurance Benefits 2026" in html
    assert "Announcement Date" in html
    assert "07 October 2026" in html
    assert "Published By" in html
    assert "HR Benefits Team" in html
    assert "Category" in html
    assert "POLICY" in html
    assert "Priority" in html
    assert "URGENT" in html
    assert "All full-time staff are eligible for updated comprehensive health coverage." in html
    assert "Please check your HRMS dashboard for more details about this announcement." in html

    # Brand typography and layout elements
    assert "HRMS" in html
    assert "Enterprise Portal" in html
    assert "Streamlining People" in html
    assert "Projects and Growth" in html
    assert "Regards," in html
    assert "This is an automated email from HRMS. Please do not reply." in html

    # Container width
    assert 'width="640"' in html
    assert "max-width: 640px;" in html

    # STRICTLY NO CID OR IMAGE ATTACHMENTS (Zero downloadable files in Gmail)
    assert "cid:" not in html.lower()
    assert "<img" not in html.lower()

    # Zero SVG tags (which are stripped by Gmail's HTML sanitizer)
    assert "<svg" not in html.lower()

    # NO CTA BUTTONS OR EXTERNAL HYPERLINKS
    assert "<button" not in html.lower()
    assert "<a " not in html.lower()
    assert "href=" not in html.lower()


def test_03_send_announcement_email_has_zero_attachments():
    """
    Verify send_announcement_email generates ONLY text/plain and text/html parts.
    Must contain ZERO attachments, ZERO CID images, and NO multipart/related container.
    """
    recipient = "employee_test@example.com"

    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        email_service.send_announcement_email(
            recipient_email=recipient,
            employee_name="Jane Doe",
            announcement_title="Office Relocation Notice",
            announcement_description="Moving to the new downtown tech tower next Monday.",
            announcement_date=date(2026, 10, 15),
            publisher_name="HR Facilities",
            category="GENERAL",
            priority="MEDIUM",
        )

        mock_smtp_class.assert_called_once_with(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
        mock_server.send_message.assert_called_once()

        sent_msg = mock_server.send_message.call_args[0][0]
        assert isinstance(sent_msg, EmailMessage)
        assert sent_msg["To"] == recipient
        assert sent_msg["From"] == settings.SMTP_EMAIL
        assert sent_msg["Subject"] == "New Announcement: Office Relocation Notice"

        # Content structure must be pure multipart/alternative
        assert sent_msg.is_multipart()
        assert sent_msg.get_content_type() == "multipart/alternative"
        payloads = sent_msg.get_payload()
        assert len(payloads) == 2

        # Part 0 is plain text
        assert payloads[0].get_content_type() == "text/plain"
        assert "Office Relocation Notice" in payloads[0].get_content()

        # Part 1 is HTML
        assert payloads[1].get_content_type() == "text/html"
        assert "Office Relocation Notice" in payloads[1].get_content()

        # STRICTLY ZERO ATTACHMENTS
        assert list(sent_msg.iter_attachments()) == []


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module")
def setup_announcement_email_env(db_session):
    """Set up HR user, multiple active employees, an inactive employee, and a terminated employee."""
    # 1. HR User
    hr_user = db_session.query(User).filter(User.email == "hr_announcer@hrms.com").first()
    if not hr_user:
        hr_user = User(
            email="hr_announcer@hrms.com",
            full_name="HR Director",
            role="hr",
            is_active=True,
            is_verified=True,
        )
        db_session.add(hr_user)
        db_session.commit()
        db_session.refresh(hr_user)

    # 2. Active Employee 1
    emp1_user = db_session.query(User).filter(User.email == "active_emp1@hrms.com").first()
    if not emp1_user:
        emp1_user = User(
            email="active_emp1@hrms.com",
            full_name="Alice Adams",
            role="employee",
            is_active=True,
            is_verified=True,
        )
        db_session.add(emp1_user)
        db_session.commit()
        db_session.refresh(emp1_user)

    emp1 = db_session.query(Employee).filter(Employee.user_id == emp1_user.id).first()
    if not emp1:
        emp1 = Employee(
            user_id=emp1_user.id,
            employee_code="EMP_ALICE_01",
            first_name="Alice",
            last_name="Adams",
            employment_status=EmploymentStatus.ACTIVE,
        )
        db_session.add(emp1)
        db_session.commit()

    # 3. Active Employee 2
    emp2_user = db_session.query(User).filter(User.email == "active_emp2@hrms.com").first()
    if not emp2_user:
        emp2_user = User(
            email="active_emp2@hrms.com",
            full_name="Bob Brown",
            role="employee",
            is_active=True,
            is_verified=True,
        )
        db_session.add(emp2_user)
        db_session.commit()
        db_session.refresh(emp2_user)

    emp2 = db_session.query(Employee).filter(Employee.user_id == emp2_user.id).first()
    if not emp2:
        emp2 = Employee(
            user_id=emp2_user.id,
            employee_code="EMP_BOB_02",
            first_name="Bob",
            last_name="Brown",
            employment_status=EmploymentStatus.ACTIVE,
        )
        db_session.add(emp2)
        db_session.commit()

    # 4. Inactive / Terminated Employee
    term_user = db_session.query(User).filter(User.email == "terminated_emp@hrms.com").first()
    if not term_user:
        term_user = User(
            email="terminated_emp@hrms.com",
            full_name="Charlie Former",
            role="employee",
            is_active=False,
            is_verified=True,
        )
        db_session.add(term_user)
        db_session.commit()
        db_session.refresh(term_user)

    term_emp = db_session.query(Employee).filter(Employee.user_id == term_user.id).first()
    if not term_emp:
        term_emp = Employee(
            user_id=term_user.id,
            employee_code="EMP_CHARLIE_03",
            first_name="Charlie",
            last_name="Former",
            employment_status=EmploymentStatus.TERMINATED,
        )
        db_session.add(term_emp)
        db_session.commit()

    return {
        "hr_user": hr_user,
        "emp1_user": emp1_user,
        "emp2_user": emp2_user,
        "term_user": term_user,
    }


def test_04_draft_does_not_trigger_email(setup_announcement_email_env, db_session):
    """Creating an announcement in DRAFT status must NEVER send emails."""
    hr_user = setup_announcement_email_env["hr_user"]

    with patch.object(email_service, "send_announcement_email") as mock_email:
        data = AnnouncementCreate(
            title="Draft Only Announcement",
            description="Should not trigger any email.",
            category=AnnouncementCategory.GENERAL,
            priority=AnnouncementPriority.LOW,
        )
        ann = announcement_service.create_announcement(db_session, hr_user.id, data)
        assert ann.status == AnnouncementStatus.DRAFT
        assert not mock_email.called


def test_05_publish_triggers_email_to_eligible_employees_only(setup_announcement_email_env, db_session):
    """
    Publishing an announcement must:
    - Send email to eligible active employees only
    - NOT send email to HR actor/publisher
    - NOT send email to terminated or inactive employees
    - Create in-app notifications
    """
    hr_user = setup_announcement_email_env["hr_user"]
    emp1_user = setup_announcement_email_env["emp1_user"]
    emp2_user = setup_announcement_email_env["emp2_user"]
    term_user = setup_announcement_email_env["term_user"]

    data = AnnouncementCreate(
        title="Annual Holiday Party 2026",
        description="Celebrate with the entire team on Friday Dec 18.",
        category=AnnouncementCategory.HOLIDAY,
        priority=AnnouncementPriority.MEDIUM,
    )
    ann = announcement_service.create_announcement(db_session, hr_user.id, data)

    with patch.object(email_service, "send_announcement_email") as mock_email:
        published = announcement_service.publish_announcement(
            db=db_session,
            announcement_id=ann.id,
            current_user=hr_user,
        )
        assert published.status == AnnouncementStatus.PUBLISHED
        assert published.published_at is not None

        # Verify email was called for active employees
        sent_recipients = [call.kwargs["recipient_email"] for call in mock_email.call_args_list]
        assert emp1_user.email in sent_recipients
        assert emp2_user.email in sent_recipients

        # HR and Terminated user must NEVER receive the announcement email
        assert hr_user.email not in sent_recipients
        assert term_user.email not in sent_recipients


def test_06_publishing_succeeds_even_if_email_fails(setup_announcement_email_env, db_session):
    """
    If the email service fails (network error, SMTP exception), the announcement
    MUST still be published and in-app notifications must still exist.
    """
    hr_user = setup_announcement_email_env["hr_user"]
    emp1_user = setup_announcement_email_env["emp1_user"]

    data = AnnouncementCreate(
        title="Resilient Announcement Test",
        description="Even if SMTP is down, announcement must be published successfully.",
        category=AnnouncementCategory.IMPORTANT,
        priority=AnnouncementPriority.URGENT,
    )
    ann = announcement_service.create_announcement(db_session, hr_user.id, data)

    with patch.object(email_service, "send_announcement_email", side_effect=Exception("SMTP Connection Error")):
        published = announcement_service.publish_announcement(
            db=db_session,
            announcement_id=ann.id,
            current_user=hr_user,
        )
        assert published.status == AnnouncementStatus.PUBLISHED
        assert published.published_at is not None

        # Confirm in-app notification was still persisted
        notif = (
            db_session.query(Notification)
            .filter(
                Notification.recipient_user_id == emp1_user.id,
                Notification.reference_type == "announcement",
                Notification.reference_id == str(ann.id),
            )
            .first()
        )
        assert notif is not None
        assert notif.notification_type == NotificationType.ANNOUNCEMENT_PUBLISHED
