import sys
from unittest.mock import patch, MagicMock
import app.authentication_service.models
from app.core.database import SessionLocal
from app.project_service import assignment_service, assignment_repository, repository as project_repository
from app.employee_service import repository as employee_repository
from app.email_service import service as email_service
from fastapi import HTTPException

def run_tests():
    db = SessionLocal()
    try:
        print("1. Finding or creating test project and employee...")
        # Get all projects
        projects = project_repository.get_all_projects(db)
        if not projects:
            print("No projects found to test.")
            return

        test_project = projects[0]
        print(f"Using project: {test_project.project_name} (ID: {test_project.id}, Code: {test_project.project_code})")

        employees = employee_repository.get_employees(db)
        if not employees:
            print("No employees found to test.")
            return

        test_employee = employees[0]
        print(f"Using employee: {test_employee.first_name} {test_employee.last_name} (ID: {test_employee.id})")

        # Clean up existing assignment if any
        existing = assignment_repository.get_assignment(db, test_project.id, test_employee.id)
        if existing:
            assignment_repository.delete_assignment(db, existing)
            print("Cleaned up existing test assignment.")

        # Test 1: Assignment creation triggers email
        print("\n--- Test 1: Successful assignment triggers email ---")
        with patch.object(email_service, "send_project_assignment_email") as mock_send_email:
            assignment = assignment_service.create_assignment(db, test_project.id, test_employee.id)
            assert assignment is not None
            assert assignment.project_id == test_project.id
            assert assignment.employee_id == test_employee.id
            assert mock_send_email.called, "Expected send_project_assignment_email to be called"
            call_kwargs = mock_send_email.call_args.kwargs
            print(f"Email sent with recipient: {call_kwargs.get('recipient_email')}")
            print(f"Email subject info: Project {call_kwargs.get('project_name')} ({call_kwargs.get('project_code')})")
            print("PASS: Test 1")

        # Test 2: Duplicate assignment check
        print("\n--- Test 2: Duplicate assignment raises HTTPException and does NOT send email ---")
        with patch.object(email_service, "send_project_assignment_email") as mock_send_email:
            try:
                assignment_service.create_assignment(db, test_project.id, test_employee.id)
                assert False, "Should have raised HTTPException for duplicate assignment"
            except HTTPException as e:
                assert e.status_code == 400
                assert "already assigned" in e.detail
                assert not mock_send_email.called, "Email should NOT be called on duplicate"
                print(f"PASS: Duplicate correctly rejected with {e.detail}")

        # Clean up for Test 3
        existing = assignment_repository.get_assignment(db, test_project.id, test_employee.id)
        if existing:
            assignment_repository.delete_assignment(db, existing)

        # Test 3: Email failure does NOT rollback assignment
        print("\n--- Test 3: Email failure does NOT undo/rollback assignment ---")
        with patch.object(email_service, "send_project_assignment_email", side_effect=Exception("SMTP connection failed")):
            assignment = assignment_service.create_assignment(db, test_project.id, test_employee.id)
            assert assignment is not None
            # Verify assignment is in DB
            persisted = assignment_repository.get_assignment(db, test_project.id, test_employee.id)
            assert persisted is not None, "Assignment MUST be persisted even if email sending fails"
            print(f"PASS: Assignment persisted with ID {persisted.id} despite email failure.")

        # Test 4: Assignment model has relationship to Project
        print("\n--- Test 4: Assignment has project details populated ---")
        assignments = assignment_repository.get_employee_assignments(db, test_employee.id)
        assert len(assignments) > 0
        assigned_item = assignments[0]
        assert assigned_item.project is not None, "Relationship project should be populated"
        assert assigned_item.project.project_name == test_project.project_name
        print(f"PASS: Project relationship accessible: {assigned_item.project.project_name}")

        print("\nALL BACKEND UNIT TESTS PASSED!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
