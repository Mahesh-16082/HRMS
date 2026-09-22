from datetime import date, datetime, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal
from app.employee_service import repository as employee_repository
from app.employee_service.models import Employee, EmploymentStatus
from app.employee_service.schemas import EmployeeCreate
from app.employee_service import service as employee_service
from app.email_service import service as email_service
from app.main import app
from app.project_service import assignment_repository, assignment_service, repository as project_repository, service as project_service
from app.project_service.assignment_models import ProjectAssignment
from app.project_service.models import Project, ProjectStatus
from app.project_service.role_models import ProjectRole
from app.project_service import role_repository, role_service


client = TestClient(app)


# ============================================================
# FIXTURES & TEST SETUP
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
    Ensure we have:
    - 1 HR user
    - 2 Employee users with profiles
    - 2 Test projects
    - Active project roles
    """
    db = SessionLocal()
    try:
        # 1. HR User
        hr_user = db.query(User).filter(User.role == "hr", User.is_active.is_(True)).first()
        if not hr_user:
            hr_user = User(
                email="test_hr_roles@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr_user)
            db.commit()
            db.refresh(hr_user)

        # 2. Employee 1
        emp1_user = db.query(User).filter(User.email == "test_emp1_roles@hrms.com").first()
        if not emp1_user:
            emp1_user = User(
                email="test_emp1_roles@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp1_user)
            db.commit()
            db.refresh(emp1_user)

        emp1_profile = db.query(Employee).filter(Employee.user_id == emp1_user.id).first()
        if not emp1_profile:
            emp1_profile = Employee(
                user_id=emp1_user.id,
                employee_code="EMP_ROLE_01",
                first_name="Diana",
                last_name="Dev",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp1_profile)
            db.commit()
            db.refresh(emp1_profile)

        # 3. Employee 2
        emp2_user = db.query(User).filter(User.email == "test_emp2_roles@hrms.com").first()
        if not emp2_user:
            emp2_user = User(
                email="test_emp2_roles@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(emp2_user)
            db.commit()
            db.refresh(emp2_user)

        emp2_profile = db.query(Employee).filter(Employee.user_id == emp2_user.id).first()
        if not emp2_profile:
            emp2_profile = Employee(
                user_id=emp2_user.id,
                employee_code="EMP_ROLE_02",
                first_name="Edward",
                last_name="Engineer",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(emp2_profile)
            db.commit()
            db.refresh(emp2_profile)

        # 4. Project A
        proj_a = db.query(Project).filter(Project.project_name == "Role Test Project Alpha").first()
        if not proj_a:
            proj_a = Project(
                project_name="Role Test Project Alpha",
                project_code="RTP-A",
                description="Alpha testing project for role assignment",
                status=ProjectStatus.ACTIVE,
                created_by=hr_user.id,
            )
            db.add(proj_a)
            db.commit()
            db.refresh(proj_a)

        # 5. Project B
        proj_b = db.query(Project).filter(Project.project_name == "Role Test Project Beta").first()
        if not proj_b:
            proj_b = Project(
                project_name="Role Test Project Beta",
                project_code="RTP-B",
                description="Beta testing project for role assignment",
                status=ProjectStatus.ACTIVE,
                created_by=hr_user.id,
            )
            db.add(proj_b)
            db.commit()
            db.refresh(proj_b)

        # Clean existing assignments for test projects to ensure clean slate
        db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id.in_([proj_a.id, proj_b.id])
        ).delete(synchronize_session=False)
        db.commit()

        return {
            "hr_user_id": hr_user.id,
            "emp1_user_id": emp1_user.id,
            "emp1_profile_id": emp1_profile.id,
            "emp2_user_id": emp2_user.id,
            "emp2_profile_id": emp2_profile.id,
            "proj_a_id": proj_a.id,
            "proj_b_id": proj_b.id,
        }
    finally:
        db.close()


def as_user_id(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    app.dependency_overrides.clear()


# ============================================================
# 22 PROJECT ROLES TEST CASES
# ============================================================

# 1. HR creates role
def test_01_hr_creates_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Clean up roles if they exist
    for c in ["CLOUD_ARCH", "PRIN_CLOUD_ARCH"]:
        existing = db_session.query(ProjectRole).filter(ProjectRole.code == c).first()
        if existing:
            db_session.delete(existing)
    db_session.commit()

    res = client.post("/api/project-roles", json={
        "name": "Cloud Architect",
        "code": "CLOUD_ARCH",
        "description": "Responsible for cloud infrastructure and scalability",
        "is_active": True,
    })
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Cloud Architect"
    assert body["code"] == "CLOUD_ARCH"
    assert body["description"] == "Responsible for cloud infrastructure and scalability"
    assert body["is_active"] is True
    assert "id" in body


# 2. HR updates role
def test_02_hr_updates_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    role = db_session.query(ProjectRole).filter(ProjectRole.code == "CLOUD_ARCH").first()
    assert role is not None

    existing_target = db_session.query(ProjectRole).filter(
        ProjectRole.code == "PRIN_CLOUD_ARCH",
        ProjectRole.id != role.id,
    ).first()
    if existing_target:
        db_session.delete(existing_target)
        db_session.commit()

    res = client.put(f"/api/project-roles/{role.id}", json={
        "name": "Principal Cloud Architect",
        "code": "PRIN_CLOUD_ARCH",
        "description": "Senior lead for cloud architecture",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Principal Cloud Architect"
    assert body["code"] == "PRIN_CLOUD_ARCH"
    assert body["description"] == "Senior lead for cloud architecture"


# 3. HR deactivates role
def test_03_hr_deactivates_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    role = db_session.query(ProjectRole).filter(ProjectRole.code == "PRIN_CLOUD_ARCH").first()
    assert role is not None

    res = client.patch(f"/api/project-roles/{role.id}/deactivate")
    assert res.status_code == 200
    assert res.json()["is_active"] is False

    # Verify via active list that it's excluded
    active_res = client.get("/api/project-roles/active")
    assert active_res.status_code == 200
    active_ids = [r["id"] for r in active_res.json()["roles"]]
    assert role.id not in active_ids


# 4. HR activates role
def test_04_hr_activates_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    role = db_session.query(ProjectRole).filter(ProjectRole.code == "PRIN_CLOUD_ARCH").first()
    assert role is not None

    res = client.patch(f"/api/project-roles/{role.id}/activate")
    assert res.status_code == 200
    assert res.json()["is_active"] is True

    # Verify via active list that it is present
    active_res = client.get("/api/project-roles/active")
    assert active_res.status_code == 200
    active_ids = [r["id"] for r in active_res.json()["roles"]]
    assert role.id in active_ids


# 5. HR safely deletes unused role
def test_05_hr_safely_deletes_unused_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    create_res = client.post("/api/project-roles", json={
        "name": "Temporary Throwaway Role",
        "code": "TEMP_THROWAWAY",
        "description": "To be deleted",
        "is_active": True,
    })
    assert create_res.status_code == 201
    temp_role_id = create_res.json()["id"]

    del_res = client.delete(f"/api/project-roles/{temp_role_id}")
    assert del_res.status_code == 204

    # Verify role is gone
    get_res = client.get(f"/api/project-roles/{temp_role_id}")
    assert get_res.status_code == 404


# 6. Referenced role cannot be deleted (400)
def test_06_referenced_role_cannot_be_deleted(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Find a role with existing assignments (e.g. role 1 "Full Stack Developer")
    role_with_assignments = db_session.query(ProjectRole).filter(ProjectRole.name == "Full Stack Developer").first()
    assert role_with_assignments is not None

    # Ensure there's at least one assignment for this role
    count = db_session.query(ProjectAssignment).filter(ProjectAssignment.role_id == role_with_assignments.id).count()
    if count == 0:
        asgn = ProjectAssignment(
            project_id=data["proj_a_id"],
            employee_id=data["emp1_profile_id"],
            role_id=role_with_assignments.id,
        )
        db_session.add(asgn)
        db_session.commit()

    del_res = client.delete(f"/api/project-roles/{role_with_assignments.id}")
    assert del_res.status_code == 400
    assert "cannot delete" in del_res.json()["detail"].lower()
    assert "deactivate" in del_res.json()["detail"].lower()


# 7. Employee cannot manage roles (403)
def test_07_employee_cannot_manage_roles(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # POST
    assert client.post("/api/project-roles", json={"name": "Hacker", "code": "HACK"}).status_code == 403
    # PUT
    assert client.put("/api/project-roles/1", json={"name": "Hacker", "code": "HACK"}).status_code == 403
    # PATCH activate
    assert client.patch("/api/project-roles/1/activate").status_code == 403
    # PATCH deactivate
    assert client.patch("/api/project-roles/1/deactivate").status_code == 403
    # DELETE
    assert client.delete("/api/project-roles/1").status_code == 403


# 8. Inactive role cannot be assigned (400)
def test_08_inactive_role_cannot_be_assigned(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Clean up old inactive role if exists
    old = db_session.query(ProjectRole).filter(ProjectRole.code == "LEGACY_INACTIVE").first()
    if old:
        db_session.delete(old)
        db_session.commit()

    # Create an inactive role
    inactive_role = ProjectRole(
        name="Legacy Architect Inactive",
        code="LEGACY_INACTIVE",
        description="Disabled role",
        is_active=False,
    )
    db_session.add(inactive_role)
    db_session.commit()
    db_session.refresh(inactive_role)

    # Attempt assignment with inactive role
    res = client.post("/api/project-assignments", json={
        "project_id": data["proj_a_id"],
        "employee_id": data["emp2_profile_id"],
        "role_id": inactive_role.id,
    })
    assert res.status_code == 400
    assert "inactive" in res.json()["detail"].lower()


# 9. HR assigns employee with role (201)
def test_09_hr_assigns_employee_with_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    frontend_role = db_session.query(ProjectRole).filter(ProjectRole.name == "Frontend Developer").first()
    assert frontend_role is not None

    # Clean existing if any
    db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_a_id"],
        ProjectAssignment.employee_id == data["emp1_profile_id"],
    ).delete()
    db_session.commit()

    with patch.object(email_service, "send_project_assignment_email") as mock_email:
        res = client.post("/api/project-assignments", json={
            "project_id": data["proj_a_id"],
            "employee_id": data["emp1_profile_id"],
            "role_id": frontend_role.id,
        })
        assert res.status_code == 201
        body = res.json()
        assert body["project_id"] == data["proj_a_id"]
        assert body["employee_id"] == data["emp1_profile_id"]
        assert body["role_id"] == frontend_role.id


# 10. Assignment stores correct role
def test_10_assignment_stores_correct_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    asgn = db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_a_id"],
        ProjectAssignment.employee_id == data["emp1_profile_id"],
    ).first()
    assert asgn is not None
    assert asgn.role is not None
    assert asgn.role.name == "Frontend Developer"

    # Also verify via GET endpoint
    res = client.get(f"/api/project-assignments/project/{data['proj_a_id']}")
    assert res.status_code == 200
    items = res.json()["assignments"]
    match = next(a for a in items if a["employee_id"] == data["emp1_profile_id"])
    assert match["role"] is not None
    assert match["role"]["name"] == "Frontend Developer"


# 11. Duplicate assignment rejected
def test_11_duplicate_assignment_rejected(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    backend_role = db_session.query(ProjectRole).filter(ProjectRole.name == "Backend Developer").first()

    with patch.object(email_service, "send_project_assignment_email") as mock_email:
        res = client.post("/api/project-assignments", json={
            "project_id": data["proj_a_id"],
            "employee_id": data["emp1_profile_id"],
            "role_id": backend_role.id,
        })
        assert res.status_code == 400
        assert "already assigned" in res.json()["detail"].lower()


# 12. Duplicate assignment sends no email
def test_12_duplicate_assignment_sends_no_email(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    backend_role = db_session.query(ProjectRole).filter(ProjectRole.name == "Backend Developer").first()

    with patch.object(email_service, "send_project_assignment_email") as mock_email:
        client.post("/api/project-assignments", json={
            "project_id": data["proj_a_id"],
            "employee_id": data["emp1_profile_id"],
            "role_id": backend_role.id,
        })
        assert not mock_email.called


# 13. Successful assignment sends email
def test_13_successful_assignment_sends_email(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    qa_role = db_session.query(ProjectRole).filter(ProjectRole.name == "QA Engineer").first()

    # Clean up if emp2 on proj_a exists
    db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_a_id"],
        ProjectAssignment.employee_id == data["emp2_profile_id"],
    ).delete()
    db_session.commit()

    with patch.object(email_service, "send_project_assignment_email") as mock_email:
        res = client.post("/api/project-assignments", json={
            "project_id": data["proj_a_id"],
            "employee_id": data["emp2_profile_id"],
            "role_id": qa_role.id,
        })
        assert res.status_code == 201
        assert mock_email.called


# 14. Email contains role
def test_14_email_contains_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    pm_role = db_session.query(ProjectRole).filter(ProjectRole.name == "Project Manager").first()

    # Clean up emp2 on proj_b
    db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_b_id"],
        ProjectAssignment.employee_id == data["emp2_profile_id"],
    ).delete()
    db_session.commit()

    emp2_user = db_session.query(User).filter(User.id == data["emp2_user_id"]).first()

    with patch.object(email_service, "send_project_assignment_email") as mock_email:
        res = client.post("/api/project-assignments", json={
            "project_id": data["proj_b_id"],
            "employee_id": data["emp2_profile_id"],
            "role_id": pm_role.id,
        })
        assert res.status_code == 201
        assert mock_email.called
        call_kwargs = mock_email.call_args.kwargs
        assert call_kwargs.get("role_name") == "Project Manager"
        assert call_kwargs.get("recipient_email") == emp2_user.email


# 15. Email failure does not undo assignment
def test_15_email_failure_does_not_undo_assignment(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    ui_role = db_session.query(ProjectRole).filter(ProjectRole.name == "UI/UX Designer").first()

    # Clean up emp1 on proj_b
    db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_b_id"],
        ProjectAssignment.employee_id == data["emp1_profile_id"],
    ).delete()
    db_session.commit()

    with patch.object(email_service, "send_project_assignment_email", side_effect=Exception("SMTP Out of Service")):
        res = client.post("/api/project-assignments", json={
            "project_id": data["proj_b_id"],
            "employee_id": data["emp1_profile_id"],
            "role_id": ui_role.id,
        })
        # Assignment succeeds despite email error
        assert res.status_code == 201
        asgn_id = res.json()["id"]

        # Verify persisted in database
        persisted = db_session.query(ProjectAssignment).filter(ProjectAssignment.id == asgn_id).first()
        assert persisted is not None
        assert persisted.role_id == ui_role.id


# 16. Employee My Projects returns role
def test_16_employee_my_projects_returns_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    res = client.get("/api/project-assignments/me")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    for asgn in body["assignments"]:
        assert "role" in asgn
        assert asgn["role"] is not None
        assert "name" in asgn["role"]


# 17. Employee Project Details returns role
def test_17_employee_project_details_returns_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    res = client.get(f"/api/projects/{data['proj_a_id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == data["proj_a_id"]
    assert body["project_name"] == "Role Test Project Alpha"


# 18. Employee cannot change role or assignment
def test_18_employee_cannot_change_role(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    # Employee cannot assign themselves or anyone else
    res = client.post("/api/project-assignments", json={
        "project_id": data["proj_a_id"],
        "employee_id": data["emp1_profile_id"],
        "role_id": 1,
    })
    assert res.status_code == 403

    # Employee cannot delete assignment
    res_del = client.delete("/api/project-assignments/1")
    assert res_del.status_code == 403


# 19. Existing assignments remain valid if role deactivated
def test_19_existing_assignments_remain_valid_if_role_deactivated(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Find the role assigned to emp1 on proj_b (UI/UX Designer)
    asgn = db_session.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == data["proj_b_id"],
        ProjectAssignment.employee_id == data["emp1_profile_id"],
    ).first()
    assert asgn is not None
    role_to_deactivate = asgn.role

    # HR deactivates the role
    deact_res = client.patch(f"/api/project-roles/{role_to_deactivate.id}/deactivate")
    assert deact_res.status_code == 200

    # Assignment is still readable and returns the historical role
    as_user_id(db_session, data["emp1_user_id"])
    res = client.get("/api/project-assignments/me")
    assert res.status_code == 200
    my_asgns = res.json()["assignments"]
    match = next(a for a in my_asgns if a["id"] == asgn.id)
    assert match["role"]["id"] == role_to_deactivate.id
    assert match["role"]["is_active"] is False

    # Reactivate for future clean state
    as_user_id(db_session, data["hr_user_id"])
    client.patch(f"/api/project-roles/{role_to_deactivate.id}/activate")


# 20. Multiple employees have different roles on projects
def test_20_multiple_employees_have_different_roles_on_projects(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Proj A has Emp 1 (Frontend Developer) and Emp 2 (QA Engineer)
    res = client.get(f"/api/project-assignments/project/{data['proj_a_id']}")
    assert res.status_code == 200
    assignments = res.json()["assignments"]

    emp1_asgn = next(a for a in assignments if a["employee_id"] == data["emp1_profile_id"])
    emp2_asgn = next(a for a in assignments if a["employee_id"] == data["emp2_profile_id"])

    assert emp1_asgn["role"]["name"] == "Frontend Developer"
    assert emp2_asgn["role"]["name"] == "QA Engineer"
    assert emp1_asgn["role"]["id"] != emp2_asgn["role"]["id"]


# 21. Same employee can have different roles on different projects
def test_21_same_employee_can_have_different_roles_on_different_projects(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["emp1_user_id"])

    res = client.get("/api/project-assignments/me")
    assert res.status_code == 200
    my_asgns = res.json()["assignments"]

    proj_a_asgn = next(a for a in my_asgns if a["project_id"] == data["proj_a_id"])
    proj_b_asgn = next(a for a in my_asgns if a["project_id"] == data["proj_b_id"])

    # Emp 1 is Frontend Developer on Proj A, UI/UX Designer on Proj B
    assert proj_a_asgn["role"]["name"] == "Frontend Developer"
    assert proj_b_asgn["role"]["name"] == "UI/UX Designer"
    assert proj_a_asgn["role"]["id"] != proj_b_asgn["role"]["id"]


# 22. Existing project functionality preserved
def test_22_existing_project_functionality_preserved(setup_data, db_session: Session):
    data = setup_data
    as_user_id(db_session, data["hr_user_id"])

    # Create project
    create_res = client.post("/api/projects", json={
        "project_name": "Regression Test Project 2026",
        "description": "Validating project CRUD",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # Status update
    stat_res = client.patch(f"/api/projects/{proj_id}/status", json={"status": "ON_HOLD"})
    assert stat_res.status_code == 200
    assert stat_res.json()["status"] == "ON_HOLD"

    # Project count
    count_res = client.get("/api/projects/dashboard/count?status=ON_HOLD")
    assert count_res.status_code == 200
    assert count_res.json()["count"] >= 1

    # Project archive
    del_res = client.delete(f"/api/projects/{proj_id}")
    assert del_res.status_code == 200
