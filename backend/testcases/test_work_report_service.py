from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal, get_db
from app.employee_service.models import Employee, EmploymentStatus
from app.main import app
from app.project_service.assignment_models import ProjectAssignment
from app.project_service.models import Project, ProjectStatus
from app.project_service.role_models import ProjectRole
from app.work_report_service.models import WorkReport, WorkReportStatus

client = TestClient(app)


# ============================================================
# FIXTURES & SETUP
# ============================================================

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture(scope="module")
def setup_data():
    """
    Ensure:
    - 1 HR user
    - 2 Active Employees (Alice & Bob)
    - 1 Project (Project Titan)
    - 1 Project Assignment: Alice is assigned to Project Titan, Bob is NOT
    """
    db = SessionLocal()
    try:
        # 1. HR User
        hr = db.query(User).filter(User.email == "test_hr_work_reports@hrms.com").first()
        if not hr:
            hr = User(
                email="test_hr_work_reports@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr)
            db.commit()
            db.refresh(hr)

        # 2. Employee 1 (Alice)
        emp1_user = db.query(User).filter(User.email == "test_alice_wr@hrms.com").first()
        if not emp1_user:
            emp1_user = User(
                email="test_alice_wr@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp1_user)
            db.commit()
            db.refresh(emp1_user)

        emp1 = db.query(Employee).filter(Employee.user_id == emp1_user.id).first()
        if not emp1:
            emp1 = Employee(
                user_id=emp1_user.id,
                employee_code="EMP_WR_01",
                first_name="Alice",
                last_name="Reporter",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp1)
            db.commit()
            db.refresh(emp1)

        # 3. Employee 2 (Bob)
        emp2_user = db.query(User).filter(User.email == "test_bob_wr@hrms.com").first()
        if not emp2_user:
            emp2_user = User(
                email="test_bob_wr@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp2_user)
            db.commit()
            db.refresh(emp2_user)

        emp2 = db.query(Employee).filter(Employee.user_id == emp2_user.id).first()
        if not emp2:
            emp2 = Employee(
                user_id=emp2_user.id,
                employee_code="EMP_WR_02",
                first_name="Bob",
                last_name="Reviewee",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp2)
            db.commit()
            db.refresh(emp2)

        # 4. Project
        proj = db.query(Project).filter(Project.project_code == "PROJ_WR_TITAN").first()
        if not proj:
            proj = Project(
                project_name="Project Titan",
                project_code="PROJ_WR_TITAN",
                status=ProjectStatus.ACTIVE,
                created_by=hr.id,
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)

        # 5. Project Role & Assignment
        role = db.query(ProjectRole).filter(ProjectRole.name == "Developer").first()
        if not role:
            role = ProjectRole(name="Developer", code="DEV_WR_01", description="Core dev", is_active=True)
            db.add(role)
            db.commit()
            db.refresh(role)

        assign = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == proj.id,
            ProjectAssignment.employee_id == emp1.id,
        ).first()
        if not assign:
            assign = ProjectAssignment(
                project_id=proj.id,
                employee_id=emp1.id,
                role_id=role.id,
            )
            db.add(assign)
            db.commit()

        # Clean existing test work reports for these employees
        db.query(WorkReport).filter(
            WorkReport.employee_id.in_([emp1.id, emp2.id])
        ).delete(synchronize_session=False)
        db.commit()

        return {
            "hr_id": hr.id,
            "emp1_user_id": emp1_user.id,
            "emp1_id": emp1.id,
            "emp2_user_id": emp2_user.id,
            "emp2_id": emp2.id,
            "project_id": proj.id,
        }
    finally:
        db.close()


def as_user(user_id: int):
    def _override(db: Session = Depends(get_db)):
        return db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = _override


def clear_auth():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_all():
    yield
    app.dependency_overrides.clear()


# ============================================================
# TESTS
# ============================================================

def test_01_employee_create_draft_report(setup_data):
    as_user(setup_data["emp1_user_id"])
    yesterday = date.today() - timedelta(days=5)

    payload = {
        "work_date": str(yesterday),
        "title": "Backend API Optimization",
        "tasks_completed": "Profiled database queries, added missing index on employee status.",
        "plans_for_tomorrow": "Work on caching layer.",
        "blockers": "None",
        "hours_worked": 7.5,
        "submit": False,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "DRAFT"
    assert data["submitted_at"] is None
    assert data["title"] == payload["title"]
    assert data["hours_worked"] == 7.5
    assert data["employee"]["employee_code"] == "EMP_WR_01"


def test_02_employee_create_and_submit_report_with_project(setup_data):
    as_user(setup_data["emp1_user_id"])
    four_days_ago = date.today() - timedelta(days=4)

    payload = {
        "work_date": str(four_days_ago),
        "project_id": setup_data["project_id"],
        "title": "Titan Frontend Integration",
        "tasks_completed": "Wired the React API client to the project endpoints.",
        "hours_worked": 8.0,
        "submit": True,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "SUBMITTED"
    assert data["submitted_at"] is not None
    assert data["project_id"] == setup_data["project_id"]
    assert data["project"]["project_name"] == "Project Titan"


def test_03_future_work_date_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    tomorrow = date.today() + timedelta(days=1)

    payload = {
        "work_date": str(tomorrow),
        "title": "Future Work",
        "tasks_completed": "Cannot do future tasks ahead of time.",
        "submit": False,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 400
    assert "future" in res.json()["detail"].lower()


def test_04_duplicate_report_same_day_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    four_days_ago = date.today() - timedelta(days=4)

    payload = {
        "work_date": str(four_days_ago),
        "title": "Duplicate Day Report",
        "tasks_completed": "Trying to submit second report for same day.",
        "submit": False,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_05_unassigned_project_rejected(setup_data):
    # Bob is not assigned to Project Titan
    as_user(setup_data["emp2_user_id"])
    work_date = date.today() - timedelta(days=3)

    payload = {
        "work_date": str(work_date),
        "project_id": setup_data["project_id"],
        "title": "Unauthorized Project Report",
        "tasks_completed": "Attempting to log work for project I am not assigned to.",
        "submit": False,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 400
    assert "not assigned" in res.json()["detail"].lower()


def test_06_nonexistent_project_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    work_date = date.today() - timedelta(days=3)

    payload = {
        "work_date": str(work_date),
        "project_id": 999999,
        "title": "Invalid Project Report",
        "tasks_completed": "Project does not exist in DB.",
        "submit": False,
    }
    res = client.post("/api/work-reports", json=payload)
    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower()


def test_07_employee_views_own_reports_and_filters(setup_data):
    as_user(setup_data["emp1_user_id"])
    res = client.get("/api/work-reports/me")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert len(data["work_reports"]) >= 2

    # Filter by status=DRAFT
    res_draft = client.get("/api/work-reports/me?status=DRAFT")
    assert res_draft.status_code == 200
    assert all(r["status"] == "DRAFT" for r in res_draft.json()["work_reports"])

    # Filter by status=SUBMITTED
    res_sub = client.get("/api/work-reports/me?status=SUBMITTED")
    assert res_sub.status_code == 200
    assert all(r["status"] == "SUBMITTED" for r in res_sub.json()["work_reports"])


def test_08_employee_check_today_status(setup_data):
    as_user(setup_data["emp1_user_id"])
    # Currently no report created for today
    res = client.get("/api/work-reports/me/today")
    assert res.status_code == 200
    data = res.json()
    assert data["has_submitted"] is False
    assert data["report"] is None

    # Now create today's report as DRAFT
    client.post("/api/work-reports", json={
        "title": "Today's Work In Progress",
        "tasks_completed": "Drafting features for today.",
        "submit": False,
    })

    res_after = client.get("/api/work-reports/me/today")
    assert res_after.status_code == 200
    data_after = res_after.json()
    assert data_after["has_submitted"] is False
    assert data_after["report"]["status"] == "DRAFT"


def test_09_employee_views_own_report_by_id(setup_data):
    as_user(setup_data["emp1_user_id"])
    my_reports = client.get("/api/work-reports/me").json()["work_reports"]
    report_id = my_reports[0]["id"]

    res = client.get(f"/api/work-reports/me/{report_id}")
    assert res.status_code == 200
    assert res.json()["id"] == report_id


def test_10_employee_cannot_view_another_employee_report(setup_data):
    as_user(setup_data["emp1_user_id"])
    alice_reports = client.get("/api/work-reports/me").json()["work_reports"]
    alice_report_id = alice_reports[0]["id"]

    # Bob tries to access Alice's report
    as_user(setup_data["emp2_user_id"])
    res = client.get(f"/api/work-reports/me/{alice_report_id}")
    assert res.status_code == 404


def test_11_employee_updates_draft_report(setup_data):
    as_user(setup_data["emp1_user_id"])
    today_report = client.get("/api/work-reports/me/today").json()["report"]
    report_id = today_report["id"]

    update_payload = {
        "title": "Today's Work - Updated Title",
        "tasks_completed": "Completed initial draft, now refined with more details.",
        "hours_worked": 8.5,
    }
    res = client.put(f"/api/work-reports/me/{report_id}", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == update_payload["title"]
    assert data["tasks_completed"] == update_payload["tasks_completed"]
    assert data["hours_worked"] == 8.5


def test_12_employee_submits_draft_report(setup_data):
    as_user(setup_data["emp1_user_id"])
    today_report = client.get("/api/work-reports/me/today").json()["report"]
    report_id = today_report["id"]

    res = client.patch(f"/api/work-reports/me/{report_id}/submit")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUBMITTED"
    assert data["submitted_at"] is not None

    # Check today's status now has_submitted == True
    status_check = client.get("/api/work-reports/me/today").json()
    assert status_check["has_submitted"] is True


def test_13_employee_cannot_edit_submitted_report(setup_data):
    as_user(setup_data["emp1_user_id"])
    today_report = client.get("/api/work-reports/me/today").json()["report"]
    report_id = today_report["id"]
    assert today_report["status"] == "SUBMITTED"

    res = client.put(f"/api/work-reports/me/{report_id}", json={
        "title": "Should Not Be Allowed",
        "tasks_completed": "Trying to edit a submitted report.",
    })
    assert res.status_code == 400
    assert "cannot edit" in res.json()["detail"].lower()


def test_14_employee_delete_draft_and_forbidden_on_submitted(setup_data):
    as_user(setup_data["emp2_user_id"])
    # Bob creates a draft
    create_res = client.post("/api/work-reports", json={
        "work_date": str(date.today() - timedelta(days=2)),
        "title": "Bob's Draft Report",
        "tasks_completed": "Drafting some testing documentation.",
        "submit": False,
    })
    draft_id = create_res.json()["id"]

    # Delete draft report
    del_res = client.delete(f"/api/work-reports/me/{draft_id}")
    assert del_res.status_code == 204

    # Verify deleted
    get_res = client.get(f"/api/work-reports/me/{draft_id}")
    assert get_res.status_code == 404

    # Now create and submit a report for Bob
    sub_res = client.post("/api/work-reports", json={
        "work_date": str(date.today() - timedelta(days=2)),
        "title": "Bob's Submitted Report",
        "tasks_completed": "Submitted documentation tasks.",
        "submit": True,
    })
    sub_id = sub_res.json()["id"]

    # Attempt to delete submitted report
    del_sub_res = client.delete(f"/api/work-reports/me/{sub_id}")
    assert del_sub_res.status_code == 400
    assert "only draft" in del_sub_res.json()["detail"].lower()


def test_15_employee_cannot_access_hr_endpoints(setup_data):
    as_user(setup_data["emp1_user_id"])

    # Employee tries to list all reports
    res1 = client.get("/api/work-reports")
    assert res1.status_code == 403

    # Employee tries to inspect another report via HR endpoint
    res2 = client.get("/api/work-reports/1")
    assert res2.status_code == 403

    # Employee tries to review
    res3 = client.patch("/api/work-reports/1/review", json={
        "status": "APPROVED",
    })
    assert res3.status_code == 403


def test_16_hr_lists_all_reports_and_filters(setup_data):
    as_user(setup_data["hr_id"])

    # List all
    res = client.get("/api/work-reports")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert len(data["work_reports"]) >= 2

    # Filter by employee
    emp1_res = client.get(f"/api/work-reports?employee_id={setup_data['emp1_id']}")
    assert emp1_res.status_code == 200
    assert all(r["employee_id"] == setup_data["emp1_id"] for r in emp1_res.json()["work_reports"])

    # Search keyword
    search_res = client.get("/api/work-reports?search=Titan")
    assert search_res.status_code == 200
    assert search_res.json()["total"] >= 1


def test_17_hr_approves_submitted_report(setup_data):
    as_user(setup_data["hr_id"])
    reports = client.get("/api/work-reports?status=SUBMITTED").json()["work_reports"]
    assert len(reports) > 0
    target_id = reports[0]["id"]

    review_payload = {
        "status": "APPROVED",
        "review_feedback": "Great progress on database indexing!",
    }
    res = client.patch(f"/api/work-reports/{target_id}/review", json=review_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPROVED"
    assert data["reviewed_by"] == setup_data["hr_id"]
    assert data["reviewed_at"] is not None
    assert data["review_feedback"] == review_payload["review_feedback"]


def test_18_hr_rejects_report_requires_feedback(setup_data):
    as_user(setup_data["hr_id"])
    reports = client.get("/api/work-reports?status=SUBMITTED").json()["work_reports"]
    assert len(reports) > 0
    target_id = reports[0]["id"]

    # Reject without feedback -> 400
    bad_res = client.patch(f"/api/work-reports/{target_id}/review", json={
        "status": "REJECTED",
        "review_feedback": "",
    })
    assert bad_res.status_code == 400
    assert "feedback is required" in bad_res.json()["detail"].lower()

    # Reject with feedback -> 200
    good_res = client.patch(f"/api/work-reports/{target_id}/review", json={
        "status": "REJECTED",
        "review_feedback": "Please add the specific unit test metrics for the documentation tasks.",
    })
    assert good_res.status_code == 200
    data = good_res.json()
    assert data["status"] == "REJECTED"
    assert data["reviewed_by"] == setup_data["hr_id"]
    assert "unit test metrics" in data["review_feedback"]


def test_19_employee_edits_and_resubmits_rejected_report(setup_data):
    # Find the rejected report
    as_user(setup_data["hr_id"])
    rejected_list = client.get("/api/work-reports?status=REJECTED").json()["work_reports"]
    target_reports = [r for r in rejected_list if r["employee_id"] in (setup_data["emp1_id"], setup_data["emp2_id"])]
    assert len(target_reports) > 0
    rejected_report = target_reports[0]
    report_id = rejected_report["id"]
    emp_id = rejected_report["employee_id"]

    # Switch to the employee who owns the report
    user_id = setup_data["emp1_user_id"] if emp_id == setup_data["emp1_id"] else setup_data["emp2_user_id"]
    as_user(user_id)

    # Edit the rejected report
    edit_res = client.put(f"/api/work-reports/me/{report_id}", json={
        "tasks_completed": "Added test cases: 14 passing unit tests covering documentation tasks.",
    })
    assert edit_res.status_code == 200
    assert "14 passing unit tests" in edit_res.json()["tasks_completed"]

    # Resubmit the rejected report
    resubmit_res = client.patch(f"/api/work-reports/me/{report_id}/submit")
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "SUBMITTED"


def test_20_unauthenticated_requests_rejected():
    clear_auth()
    res = client.get("/api/work-reports/me")
    assert res.status_code in (401, 403)

    res_post = client.post("/api/work-reports", json={"title": "No Auth", "tasks_completed": "Nothing"})
    assert res_post.status_code in (401, 403)


# ============================================================
# ATTACHMENT TESTS
# ============================================================

from unittest.mock import patch

MOCK_UPLOAD_RESULT = {
    "url": "https://res.cloudinary.com/demo/raw/upload/v1/hrms/work_reports/sample.pdf",
    "public_id": "hrms/work_reports/1/sample_abc123",
}


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_21_upload_pdf_attachment_to_draft(mock_upload, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=10)

    # 1. Create a draft report
    create_res = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Report with Attachment",
        "tasks_completed": "Drafting technical spec with architectural diagrams.",
        "submit": False,
    })
    assert create_res.status_code == 201
    report_id = create_res.json()["id"]

    # 2. Upload valid PDF
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_res = client.post(
        f"/api/work-reports/{report_id}/attachments",
        files={"file": ("architecture_spec.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 201, upload_res.text
    att_data = upload_res.json()
    assert att_data["original_filename"] == "architecture_spec.pdf"
    assert att_data["file_type"] == "application/pdf"
    assert att_data["file_url"] == MOCK_UPLOAD_RESULT["url"]
    assert att_data["work_report_id"] == report_id

    # 3. Check report details embeds attachment
    report_check = client.get(f"/api/work-reports/me/{report_id}").json()
    assert report_check["attachment"] is not None
    assert report_check["attachment"]["id"] == att_data["id"]


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_22_second_attachment_rejected_one_attachment_rule(mock_upload, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=10)

    # Find the report with attachment
    my_reports = client.get("/api/work-reports/me").json()["work_reports"]
    report = next(r for r in my_reports if r["work_date"] == str(target_date))
    report_id = report["id"]

    # Attempt to upload a second attachment -> must be rejected with 400 Bad Request
    pdf_bytes = b"%PDF-1.4 second document %%EOF"
    second_upload = client.post(
        f"/api/work-reports/{report_id}/attachments",
        files={"file": ("second_spec.pdf", pdf_bytes, "application/pdf")},
    )
    assert second_upload.status_code == 400
    assert "already has an attachment" in second_upload.json()["detail"].lower()


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_23_upload_valid_docx_xlsx_and_png(mock_upload, setup_data):
    as_user(setup_data["emp2_user_id"])

    # 1. Test DOCX
    d1 = date.today() - timedelta(days=11)
    r1 = client.post("/api/work-reports", json={
        "work_date": str(d1),
        "title": "DOCX Report",
        "tasks_completed": "Documentation written in Word.",
        "submit": False,
    }).json()["id"]

    docx_bytes = b"PK\x03\x04\x14\x00\x00\x00word/document.xml"
    res_docx = client.post(
        f"/api/work-reports/{r1}/attachments",
        files={"file": ("deliverable.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert res_docx.status_code == 201

    # 2. Test PNG Image
    d2 = date.today() - timedelta(days=12)
    r2 = client.post("/api/work-reports", json={
        "work_date": str(d2),
        "title": "PNG Screenshot Report",
        "tasks_completed": "UI testing screenshot captured.",
        "submit": False,
    }).json()["id"]

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    res_png = client.post(
        f"/api/work-reports/{r2}/attachments",
        files={"file": ("screenshot.png", png_bytes, "image/png")},
    )
    assert res_png.status_code == 201

    # 3. Test CSV
    d3 = date.today() - timedelta(days=13)
    r3 = client.post("/api/work-reports", json={
        "work_date": str(d3),
        "title": "CSV Data Report",
        "tasks_completed": "Metrics exported to CSV.",
        "submit": False,
    }).json()["id"]

    csv_bytes = b"id,name,metric\n1,task,99.9\n"
    res_csv = client.post(
        f"/api/work-reports/{r3}/attachments",
        files={"file": ("metrics.csv", csv_bytes, "text/csv")},
    )
    assert res_csv.status_code == 201


def test_24_disallowed_extension_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=14)
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Security Check Report",
        "tasks_completed": "Testing security uploads.",
        "submit": False,
    }).json()["id"]

    # Executable .exe
    exe_res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("malware.exe", b"MZ\x90\x00executable", "application/octet-stream")},
    )
    assert exe_res.status_code == 400
    assert "not allowed" in exe_res.json()["detail"].lower()

    # Script .sh
    sh_res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("script.sh", b"#!/bin/bash\necho hi", "text/x-sh")},
    )
    assert sh_res.status_code == 400


def test_25_mismatched_mime_or_corrupted_header_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=15)
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Corrupted Header Report",
        "tasks_completed": "Testing corrupted file rejection.",
        "submit": False,
    }).json()["id"]

    # Named .pdf but plain text without %PDF-
    corrupt_pdf = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("corrupt.pdf", b"This is not a real PDF file header", "application/pdf")},
    )
    assert corrupt_pdf.status_code == 400
    assert "header" in corrupt_pdf.json()["detail"].lower()

    # Named .pdf but has executable MZ header
    fake_pdf = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("fake_exec.pdf", b"MZ\x90\x00this is an exe disguised as pdf", "application/pdf")},
    )
    assert fake_pdf.status_code == 400
    assert "executable" in fake_pdf.json()["detail"].lower()


def test_26_file_too_large_rejected(setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=16)
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Size Test Report",
        "tasks_completed": "Testing max file size limit.",
        "submit": False,
    }).json()["id"]

    # 10MB + 1 byte
    too_large = b"%PDF-1.4\n" + b"X" * (10 * 1024 * 1024 + 1)
    res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("big.pdf", too_large, "application/pdf")},
    )
    assert res.status_code == 400
    assert "exceeds" in res.json()["detail"].lower()


def test_27_employee_cannot_upload_to_another_employee_report(setup_data):
    # Alice has report for 10 days ago
    my_reports = client.get("/api/work-reports/me").json()["work_reports"]
    alice_report_id = next(r for r in my_reports if r["employee_id"] == setup_data["emp1_id"])["id"]

    # Bob tries to upload attachment to Alice's report
    as_user(setup_data["emp2_user_id"])
    pdf_bytes = b"%PDF-1.4\nBob upload %%EOF"
    res = client.post(
        f"/api/work-reports/{alice_report_id}/attachments",
        files={"file": ("bob.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 404


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_28_cannot_upload_to_submitted_or_approved_report(mock_upload, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=17)

    # Create report and immediately submit
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Directly Submitted Report",
        "tasks_completed": "Completed work submitted right away.",
        "submit": True,
    }).json()["id"]

    # Attempt upload on SUBMITTED report
    pdf_bytes = b"%PDF-1.4 %%EOF"
    upload_res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("after_submit.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 400
    assert "cannot upload attachment when report is in submitted status" in upload_res.json()["detail"].lower()


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_29_upload_allowed_on_rejected_report(mock_upload, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=18)

    # 1. Create and submit
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Report for Rejection & Revision",
        "tasks_completed": "Tasks needing revision.",
        "submit": True,
    }).json()["id"]

    # 2. HR rejects the report
    as_user(setup_data["hr_id"])
    client.patch(f"/api/work-reports/{r_id}/review", json={
        "status": "REJECTED",
        "review_feedback": "Please attach the architecture document.",
    })

    # 3. Employee uploads attachment to the REJECTED report
    as_user(setup_data["emp1_user_id"])
    pdf_bytes = b"%PDF-1.4\nRevision attachment %%EOF"
    upload_res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("architecture_revision.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 201
    assert upload_res.json()["original_filename"] == "architecture_revision.pdf"


def test_30_hr_can_view_attachments_but_cannot_upload_or_delete(setup_data):
    # Find a report with attachment (e.g. from test 21)
    as_user(setup_data["hr_id"])
    all_reports = client.get("/api/work-reports").json()["work_reports"]
    report_with_att = next(r for r in all_reports if r["attachment"] is not None)
    report_id = report_with_att["id"]
    att_id = report_with_att["attachment"]["id"]

    # HR lists attachments
    list_res = client.get(f"/api/work-reports/{report_id}/attachments")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # HR gets single attachment
    get_res = client.get(f"/api/work-reports/{report_id}/attachment")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == att_id

    # HR tries to upload attachment -> 403 Forbidden
    upload_attempt = client.post(
        f"/api/work-reports/{report_id}/attachments",
        files={"file": ("hr_doc.pdf", b"%PDF-1.4 %%EOF", "application/pdf")},
    )
    assert upload_attempt.status_code == 403

    # HR tries to delete attachment -> 403 Forbidden
    delete_attempt = client.delete(f"/api/work-reports/{report_id}/attachment")
    assert delete_attempt.status_code == 403


@patch("app.cloudinary_service.service.delete_work_report_attachment", return_value={"result": "ok"})
@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_31_employee_delete_and_replace_attachment_in_draft(mock_upload, mock_delete, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=19)

    # 1. Create draft report
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Replacement Test Report",
        "tasks_completed": "Will test replace attachment flow.",
        "submit": False,
    }).json()["id"]

    # 2. Upload initial attachment
    pdf1 = b"%PDF-1.4\nInitial file %%EOF"
    client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("initial.pdf", pdf1, "application/pdf")},
    )

    # 3. Delete attachment
    del_res = client.delete(f"/api/work-reports/{r_id}/attachment")
    assert del_res.status_code == 204

    # 4. Verify no attachment exists now
    get_res = client.get(f"/api/work-reports/{r_id}/attachment")
    assert get_res.status_code == 404

    # 5. Upload replacement attachment (Allowed now since max 1 constraint is cleared)
    pdf2 = b"%PDF-1.4\nReplacement file %%EOF"
    replace_res = client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("replacement.pdf", pdf2, "application/pdf")},
    )
    assert replace_res.status_code == 201
    assert replace_res.json()["original_filename"] == "replacement.pdf"


@patch("app.cloudinary_service.service.upload_work_report_attachment", return_value=MOCK_UPLOAD_RESULT)
def test_32_cannot_delete_attachment_on_submitted_report(mock_upload, setup_data):
    as_user(setup_data["emp1_user_id"])
    target_date = date.today() - timedelta(days=20)

    # 1. Create draft report
    r_id = client.post("/api/work-reports", json={
        "work_date": str(target_date),
        "title": "Locked Attachment Test",
        "tasks_completed": "Testing delete lock after submit.",
        "submit": False,
    }).json()["id"]

    # 2. Upload attachment
    pdf_bytes = b"%PDF-1.4 %%EOF"
    client.post(
        f"/api/work-reports/{r_id}/attachments",
        files={"file": ("locked.pdf", pdf_bytes, "application/pdf")},
    )

    # 3. Submit report
    client.patch(f"/api/work-reports/me/{r_id}/submit")

    # 4. Try to delete attachment
    del_res = client.delete(f"/api/work-reports/{r_id}/attachment")
    assert del_res.status_code == 400
    assert "cannot delete attachment when report is in submitted status" in del_res.json()["detail"].lower()

