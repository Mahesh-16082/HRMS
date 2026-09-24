"""create_policies_table

Revision ID: 29f5fcbb4076
Revises: 97360141d032
Create Date: 2026-09-24 12:55:44.700994

"""
from datetime import date
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29f5fcbb4076'
down_revision: Union[str, Sequence[str], None] = '97360141d032'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and seed initial 20 workplace policies."""
    policies_table = op.create_table(
        'policies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PUBLISHED'),
        sa.Column('effective_date', sa.Date(), nullable=False, server_default=sa.text("'2026-10-01'")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_policies_title'), 'policies', ['title'], unique=False)
    op.create_index(op.f('ix_policies_category'), 'policies', ['category'], unique=False)
    op.create_index(op.f('ix_policies_status'), 'policies', ['status'], unique=False)
    op.create_index(op.f('ix_policies_created_at'), 'policies', ['created_at'], unique=False)

    # Predefined policies
    predefined_policies = [
        # OFFICE RULES (3 policies)
        {
            "title": "Workplace Etiquette Policy",
            "category": "OFFICE RULES",
            "description": "Employees are expected to maintain a professional, respectful, and collaborative environment at all times.",
            "content": (
                "Employees are expected to maintain a professional, respectful, and collaborative environment at all times. "
                "Employees should communicate respectfully with colleagues, managers, clients, and visitors.\n\n"
                "Employees should keep shared workspaces clean and organized, use meeting rooms responsibly, "
                "and avoid behavior that unnecessarily disrupts other employees.\n\n"
                "Company facilities and common areas should be used responsibly. Employees are expected to follow "
                "workplace safety instructions and cooperate with reasonable office procedures."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Office Working Hours Policy",
            "category": "OFFICE RULES",
            "description": "Employees are expected to follow the working hours and schedules assigned to their role or team.",
            "content": (
                "Employees are expected to follow the working hours and schedules assigned to their role or team.\n\n"
                "Employees should be available during their scheduled working hours unless they are on approved leave, "
                "working under an approved flexible arrangement, or have received authorization from their manager.\n\n"
                "Meetings, team activities, and business responsibilities should be planned in accordance with the "
                "employee's assigned working schedule."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Professional Communication Policy",
            "category": "OFFICE RULES",
            "description": "All workplace communication should be professional, respectful, clear, and appropriate for a business environment.",
            "content": (
                "All workplace communication should be professional, respectful, clear, and appropriate for a business environment.\n\n"
                "Employees should use official communication channels for business-related discussions and should avoid sharing "
                "confidential company information through unauthorized channels.\n\n"
                "Communication that is abusive, threatening, discriminatory, or deliberately disruptive is not acceptable in the workplace."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },

        # LEAVE POLICIES (3 policies)
        {
            "title": "Leave Application Policy",
            "category": "LEAVE POLICIES",
            "description": "Employees must submit leave requests through the HRMS leave management system whenever planned leave is required.",
            "content": (
                "Employees must submit leave requests through the HRMS leave management system whenever planned leave is required.\n\n"
                "Planned leave should be requested sufficiently in advance to allow the manager and HR to review the request and make appropriate work arrangements.\n\n"
                "Leave is considered approved only after the request has been approved through the designated process.\n\n"
                "Employees should not assume that submitting a leave request constitutes approval."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Sick Leave Policy",
            "category": "LEAVE POLICIES",
            "description": "Employees who are unable to work because of illness should inform their manager or designated reporting contact as soon as reasonably possible.",
            "content": (
                "Employees who are unable to work because of illness should inform their manager or designated reporting contact as soon as reasonably possible.\n\n"
                "Where required by company policy or applicable law, appropriate documentation may be requested for extended or repeated periods of sick leave.\n\n"
                "Employees should keep their leave information accurate in the HRMS so attendance and leave records remain up to date."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Unplanned Absence Policy",
            "category": "LEAVE POLICIES",
            "description": "If an employee is unexpectedly unable to attend work, the employee should notify the appropriate manager or reporting contact as soon as reasonably possible.",
            "content": (
                "If an employee is unexpectedly unable to attend work, the employee should notify the appropriate manager or reporting contact as soon as reasonably possible.\n\n"
                "Failure to communicate an unplanned absence may result in the absence being recorded as unauthorized, subject to the organization's attendance procedures and applicable requirements."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },

        # ATTENDANCE (3 policies)
        {
            "title": "Attendance and Punctuality Policy",
            "category": "ATTENDANCE",
            "description": "Employees are expected to maintain regular attendance and arrive at work according to their assigned schedule.",
            "content": (
                "Employees are expected to maintain regular attendance and arrive at work according to their assigned schedule.\n\n"
                "Employees should record attendance through the organization's approved attendance system where applicable.\n\n"
                "Repeated late arrival, early departure, or unexplained absence may be reviewed by the appropriate manager and HR in accordance with company procedures.\n\n"
                "Employees should promptly report attendance-related issues or system errors through the appropriate process."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Remote Work Policy",
            "category": "ATTENDANCE",
            "description": "Remote or work-from-home arrangements are subject to organizational requirements and applicable approval procedures.",
            "content": (
                "Remote or work-from-home arrangements are subject to organizational requirements and applicable approval procedures.\n\n"
                "Employees working remotely are expected to remain available during agreed working hours, attend scheduled meetings, maintain appropriate productivity, and protect company information.\n\n"
                "Company devices, systems, and information must be used in accordance with applicable security requirements regardless of the employee's work location."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Late Arrival and Early Departure Policy",
            "category": "ATTENDANCE",
            "description": "Employees are expected to follow their assigned working schedule.",
            "content": (
                "Employees are expected to follow their assigned working schedule.\n\n"
                "If an employee expects to arrive late or leave early, the employee should notify the appropriate manager and follow the applicable attendance or leave procedure.\n\n"
                "Repeated or unexplained deviations from scheduled working hours may be reviewed under the organization's attendance management procedures."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },

        # WORKPLACE CONDUCT (4 policies)
        {
            "title": "Code of Professional Conduct",
            "category": "WORKPLACE CONDUCT",
            "description": "Employees are expected to conduct themselves honestly, professionally, and respectfully.",
            "content": (
                "Employees are expected to conduct themselves honestly, professionally, and respectfully.\n\n"
                "Employees should perform their responsibilities with appropriate care, cooperate with colleagues, protect company interests, and comply with applicable organizational procedures.\n\n"
                "Employees must not engage in workplace behavior that is threatening, abusive, discriminatory, dishonest, or otherwise inappropriate."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Respectful Workplace and Anti-Harassment Policy",
            "category": "WORKPLACE CONDUCT",
            "description": "The organization is committed to maintaining a workplace where employees are treated with dignity and respect.",
            "content": (
                "The organization is committed to maintaining a workplace where employees are treated with dignity and respect.\n\n"
                "Harassment, bullying, intimidation, discrimination, retaliation, or other inappropriate workplace conduct is not acceptable.\n\n"
                "Employees who experience or witness conduct that may violate this policy should use the organization's designated complaint or reporting process.\n\n"
                "Reports should be handled through appropriate organizational procedures, with confidentiality maintained to the extent reasonably possible."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Conflict of Interest Policy",
            "category": "WORKPLACE CONDUCT",
            "description": "Employees should avoid situations in which personal interests could improperly influence their professional responsibilities.",
            "content": (
                "Employees should avoid situations in which personal interests could improperly influence, or appear to influence, their professional responsibilities.\n\n"
                "Employees should disclose potential conflicts of interest through the appropriate organizational process.\n\n"
                "Employees must not use their position, company information, or company resources for unauthorized personal benefit."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Equal Opportunity Policy",
            "category": "WORKPLACE CONDUCT",
            "description": "The organization is committed to providing a professional environment where employment decisions are made fairly.",
            "content": (
                "The organization is committed to providing a professional environment where employment-related decisions are made fairly and in accordance with applicable laws and organizational policies.\n\n"
                "Discrimination based on legally protected characteristics is not permitted.\n\n"
                "Employees are expected to support an inclusive and respectful workplace."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },

        # TECHNOLOGY & SECURITY (4 policies)
        {
            "title": "Acceptable Use of IT Resources",
            "category": "TECHNOLOGY & SECURITY",
            "description": "Company-provided technology resources are intended primarily for authorized business purposes.",
            "content": (
                "Company-provided computers, systems, networks, software, and other technology resources are intended primarily for authorized business purposes.\n\n"
                "Employees must use company systems responsibly and must not intentionally access, distribute, modify, or introduce unauthorized content or software.\n\n"
                "Employees must follow applicable information security procedures when using company technology."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Password and Account Security Policy",
            "category": "TECHNOLOGY & SECURITY",
            "description": "Employees are responsible for protecting their account credentials and security authentication information.",
            "content": (
                "Employees are responsible for protecting their account credentials and must not share passwords or authentication information with other individuals.\n\n"
                "Employees should use strong passwords and follow the organization's authentication requirements.\n\n"
                "Suspected credential compromise, unauthorized access, or unusual account activity should be reported promptly through the appropriate security or IT process."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Company Data Protection Policy",
            "category": "TECHNOLOGY & SECURITY",
            "description": "Employees must protect confidential, personal, and business-sensitive information.",
            "content": (
                "Employees must protect confidential, personal, and business-sensitive information accessed during their employment.\n\n"
                "Company information should only be accessed, copied, stored, or shared when authorized and required for legitimate business purposes.\n\n"
                "Sensitive information must not be disclosed to unauthorized individuals or transferred through unapproved services or communication channels."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Email and Internet Usage Policy",
            "category": "TECHNOLOGY & SECURITY",
            "description": "Company email, internet access, and communication systems must be used responsibly.",
            "content": (
                "Company email, internet access, and communication systems must be used responsibly and in accordance with organizational requirements.\n\n"
                "Employees must exercise caution when opening links, downloading files, or responding to unexpected requests for information.\n\n"
                "Confidential company information must not be transmitted through unauthorized personal accounts or services."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },

        # EMPLOYEE GUIDELINES (3 policies)
        {
            "title": "Performance and Feedback Policy",
            "category": "EMPLOYEE GUIDELINES",
            "description": "Employees are expected to understand assigned responsibilities and participate in performance feedback processes.",
            "content": (
                "Employees are expected to understand their assigned responsibilities, meet reasonable performance expectations, and participate in performance discussions and feedback processes.\n\n"
                "Managers and employees should use performance discussions to identify achievements, development opportunities, goals, and areas requiring improvement.\n\n"
                "Employees are encouraged to raise questions about expectations or required support through the appropriate reporting channels."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Employee Grievance and Complaint Policy",
            "category": "EMPLOYEE GUIDELINES",
            "description": "Employees may raise workplace concerns or complaints through the designated HRMS complaint process.",
            "content": (
                "Employees may raise workplace concerns or complaints through the organization's designated HRMS complaint process.\n\n"
                "Employees should provide accurate and relevant information when submitting a complaint.\n\n"
                "Complaints should be handled through the appropriate organizational process, and employees should not engage in retaliation against individuals who raise concerns in good faith."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
        {
            "title": "Company Property and Equipment Policy",
            "category": "EMPLOYEE GUIDELINES",
            "description": "Company-provided equipment and property must be used responsibly and protected from loss or damage.",
            "content": (
                "Company-provided equipment, devices, access cards, documents, and other property must be used responsibly and protected from loss, damage, or unauthorized access.\n\n"
                "Employees must report lost, damaged, or compromised company property through the appropriate process.\n\n"
                "Company property should be returned when requested or when employment ends, subject to applicable company procedures."
            ),
            "status": "PUBLISHED",
            "effective_date": date(2026, 10, 1),
        },
    ]

    op.bulk_insert(policies_table, predefined_policies)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_policies_created_at'), table_name='policies')
    op.drop_index(op.f('ix_policies_status'), table_name='policies')
    op.drop_index(op.f('ix_policies_category'), table_name='policies')
    op.drop_index(op.f('ix_policies_title'), table_name='policies')
    op.drop_table('policies')
