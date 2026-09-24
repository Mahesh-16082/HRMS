from datetime import date, timedelta
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.authentication_service.dependencies import get_current_user
from app.authentication_service.models import User
from app.core.database import SessionLocal, get_db
from app.employee_service.models import Employee, EmploymentStatus
from app.main import app
from app.performance_service.models import (
    PerformanceGoal,
    PerformanceGoalStatus,
    PerformanceReview,
    PerformanceReviewStatus,
    ReviewCategoryRating,
)

client = TestClient(app)


# ============================================================
# FIXTURES & SETUP
# ============================================================

@pytest.fixture(scope="module")
def setup_performance_data():
    """
    Ensure:
    - 1 HR user
    - 2 Active Employees (Alice & Bob)
    """
    db = SessionLocal()
    try:
        # HR User
        hr = db.query(User).filter(User.email == "test_hr_perf@hrms.com").first()
        if not hr:
            hr = User(
                email="test_hr_perf@hrms.com",
                role="hr",
                is_active=True,
            )
            db.add(hr)
            db.commit()
            db.refresh(hr)

        # Employee 1 (Alice)
        alice_user = db.query(User).filter(User.email == "test_alice_perf@hrms.com").first()
        if not alice_user:
            alice_user = User(
                email="test_alice_perf@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(alice_user)
            db.commit()
            db.refresh(alice_user)

        alice_emp = db.query(Employee).filter(Employee.user_id == alice_user.id).first()
        if not alice_emp:
            alice_emp = Employee(
                user_id=alice_user.id,
                employee_code="EMP_PERF_01",
                first_name="Alice",
                last_name="Performer",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(alice_emp)
            db.commit()
            db.refresh(alice_emp)

        # Employee 2 (Bob)
        bob_user = db.query(User).filter(User.email == "test_bob_perf@hrms.com").first()
        if not bob_user:
            bob_user = User(
                email="test_bob_perf@hrms.com",
                role="employee",
                is_active=True,
            )
            db.add(bob_user)
            db.commit()
            db.refresh(bob_user)

        bob_emp = db.query(Employee).filter(Employee.user_id == bob_user.id).first()
        if not bob_emp:
            bob_emp = Employee(
                user_id=bob_user.id,
                employee_code="EMP_PERF_02",
                first_name="Bob",
                last_name="Reviewee",
                employment_status=EmploymentStatus.ACTIVE,
                joining_date=date(2025, 1, 1),
            )
            db.add(bob_emp)
            db.commit()
            db.refresh(bob_emp)

        # Clean existing test data for these employees
        db.query(ReviewCategoryRating).filter(
            ReviewCategoryRating.review_id.in_(
                db.query(PerformanceReview.id).filter(
                    PerformanceReview.employee_id.in_([alice_emp.id, bob_emp.id])
                )
            )
        ).delete(synchronize_session=False)

        db.query(PerformanceReview).filter(
            PerformanceReview.employee_id.in_([alice_emp.id, bob_emp.id])
        ).delete(synchronize_session=False)

        db.query(PerformanceGoal).filter(
            PerformanceGoal.employee_id.in_([alice_emp.id, bob_emp.id])
        ).delete(synchronize_session=False)

        db.commit()

        return {
            "hr_id": hr.id,
            "alice_user_id": alice_user.id,
            "alice_emp_id": alice_emp.id,
            "bob_user_id": bob_user.id,
            "bob_emp_id": bob_emp.id,
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
# REVIEW LIFECYCLE & AUTHORITATIVE CALCULATION TESTS
# ============================================================

def test_create_draft_review(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    payload = {
        "employee_id": data["alice_emp_id"],
        "review_period": "Q1 2026",
        "title": "Alice Q1 Draft Evaluation",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "comments": "Initial draft review notes",
        "ratings": [
            {"category": "Communication", "rating": 4, "comments": "Good communication"},
            {"category": "Quality", "rating": 5, "comments": "Excellent delivery"},
        ],
    }

    response = client.post("/api/performance/reviews", json=payload)
    assert response.status_code == 201, response.text
    res_data = response.json()
    assert res_data["status"] == "DRAFT"
    assert res_data["overall_rating"] is None
    assert len(res_data["ratings"]) == 2
    assert res_data["employee_id"] == data["alice_emp_id"]


def test_complete_draft_review_with_authoritative_calculation(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # 1. Create a draft with no ratings
    create_res = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q2 2026",
        "title": "Alice Q2 Evaluation",
        "review_date": str(date.today()),
        "status": "DRAFT",
    })
    assert create_res.status_code == 201
    review_id = create_res.json()["id"]

    # 2. Complete draft review with ratings: [5, 4, 3] -> sum=12, len=3 -> overall_rating = 4.0
    complete_res = client.post(f"/api/performance/reviews/{review_id}/complete", json={
        "ratings": [
            {"category": "Leadership", "rating": 5},
            {"category": "Execution", "rating": 4},
            {"category": "Initiative", "rating": 3},
        ],
        "comments": "Finalized Q2 review with 4.0 score",
    })
    assert complete_res.status_code == 200, complete_res.text
    comp_data = complete_res.json()
    assert comp_data["status"] == "COMPLETED"
    assert comp_data["overall_rating"] == 4.0
    assert len(comp_data["ratings"]) == 3


def test_authoritative_rounding_calculation(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Ratings [4, 4, 3] -> sum = 11, len = 3 -> 11 / 3 = 3.6666... -> rounded to 3.7
    create_res = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q3 2026",
        "title": "Alice Q3 Evaluation",
        "review_date": str(date.today()),
        "status": "DRAFT",
    })
    review_id = create_res.json()["id"]

    complete_res = client.post(f"/api/performance/reviews/{review_id}/complete", json={
        "ratings": [
            {"category": "Technical", "rating": 4},
            {"category": "Delivery", "rating": 4},
            {"category": "Collaboration", "rating": 3},
        ],
    })
    assert complete_res.status_code == 200
    assert complete_res.json()["overall_rating"] == 3.7


def test_create_review_directly_as_completed_enforces_calculation(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Client tries to send status=COMPLETED and ratings [5, 5, 4] -> sum=14, len=3 -> 4.7
    payload = {
        "employee_id": data["bob_emp_id"],
        "review_period": "Q1 2026",
        "title": "Bob Q1 Direct Complete",
        "review_date": str(date.today()),
        "status": "COMPLETED",
        "comments": "Directly completed by HR",
        "ratings": [
            {"category": "Punctuality", "rating": 5},
            {"category": "Quality", "rating": 5},
            {"category": "Teamwork", "rating": 4},
        ],
    }

    response = client.post("/api/performance/reviews", json=payload)
    assert response.status_code == 201, response.text
    res_data = response.json()
    assert res_data["status"] == "COMPLETED"
    assert res_data["overall_rating"] == 4.7
    assert len(res_data["ratings"]) == 3


def test_create_completed_review_without_ratings_rejected(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Cannot create completed review without category ratings
    payload = {
        "employee_id": data["bob_emp_id"],
        "review_period": "Q2 2026",
        "review_date": str(date.today()),
        "status": "COMPLETED",
        "ratings": [],
    }

    response = client.post("/api/performance/reviews", json=payload)
    assert response.status_code == 400
    assert "Category ratings are required" in response.text


def test_complete_review_without_ratings_rejected(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Create draft with no ratings
    create_res = client.post("/api/performance/reviews", json={
        "employee_id": data["bob_emp_id"],
        "review_period": "Q3 2026",
        "review_date": str(date.today()),
        "status": "DRAFT",
    })
    review_id = create_res.json()["id"]

    # Attempt to complete without ratings
    complete_res = client.post(f"/api/performance/reviews/{review_id}/complete", json={})
    assert complete_res.status_code == 400
    assert "without category ratings" in complete_res.text


def test_category_ratings_range_and_duplicate_validation(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Rating < 1
    res1 = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q4 2026",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "ratings": [{"category": "Code Quality", "rating": 0}],
    })
    assert res1.status_code in (400, 422)

    # Rating > 5
    res2 = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q4 2026",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "ratings": [{"category": "Code Quality", "rating": 6}],
    })
    assert res2.status_code in (400, 422)

    # Duplicate category in same review
    res3 = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q4 2026",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "ratings": [
            {"category": "Communication", "rating": 4},
            {"category": "communication", "rating": 5},
        ],
    })
    assert res3.status_code == 400
    assert "Duplicate category" in res3.text


# ============================================================
# COMPLETED REVIEW IMMUTABILITY TESTS
# ============================================================

def test_completed_review_immutability(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # 1. Create a completed review
    create_res = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Annual 2025",
        "review_date": str(date.today()),
        "status": "COMPLETED",
        "ratings": [
            {"category": "Speed", "rating": 5},
            {"category": "Accuracy", "rating": 5},
        ],
    })
    assert create_res.status_code == 201
    review_id = create_res.json()["id"]

    # 2. Try to update via PUT -> MUST FAIL (400)
    update_res = client.put(f"/api/performance/reviews/{review_id}", json={
        "title": "Hacked Review Title",
    })
    assert update_res.status_code == 400
    assert "immutable" in update_res.text.lower() or "completed" in update_res.text.lower()

    # 3. Try to complete again -> MUST FAIL (400)
    re_complete_res = client.post(f"/api/performance/reviews/{review_id}/complete", json={})
    assert re_complete_res.status_code == 400
    assert "already completed" in re_complete_res.text.lower()

    # 4. Try to delete completed review -> MUST FAIL (400)
    delete_res = client.delete(f"/api/performance/reviews/{review_id}")
    assert delete_res.status_code == 400
    assert "Cannot delete a completed" in delete_res.text


def test_delete_draft_review_succeeds(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Create draft review
    create_res = client.post("/api/performance/reviews", json={
        "employee_id": data["bob_emp_id"],
        "review_period": "Draft to Delete",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "ratings": [{"category": "Temp", "rating": 3}],
    })
    assert create_res.status_code == 201
    review_id = create_res.json()["id"]

    # Delete draft review -> MUST SUCCEED (200)
    delete_res = client.delete(f"/api/performance/reviews/{review_id}")
    assert delete_res.status_code == 200

    # Ensure it no longer exists
    get_res = client.get(f"/api/performance/reviews/{review_id}")
    assert get_res.status_code == 404


# ============================================================
# PERFORMANCE GOALS MANAGEMENT TESTS
# ============================================================

def test_hr_create_and_manage_goals(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    today = date.today()
    # 1. HR creates goal for Alice
    goal_res = client.post("/api/performance/goals", json={
        "employee_id": data["alice_emp_id"],
        "title": "Complete Microservice Certification",
        "description": "Earn cloud architect credential",
        "start_date": str(today),
        "due_date": str(today + timedelta(days=90)),
        "status": "NOT_STARTED",
    })
    assert goal_res.status_code == 201, goal_res.text
    goal_id = goal_res.json()["id"]
    assert goal_res.json()["title"] == "Complete Microservice Certification"

    # 2. HR updates goal status
    patch_res = client.patch(f"/api/performance/goals/{goal_id}/status", json={
        "status": "IN_PROGRESS",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"

    # 3. HR updates goal details
    put_res = client.put(f"/api/performance/goals/{goal_id}", json={
        "title": "Complete Advanced Cloud Certification",
        "status": "COMPLETED",
    })
    assert put_res.status_code == 200
    assert put_res.json()["title"] == "Complete Advanced Cloud Certification"
    assert put_res.json()["status"] == "COMPLETED"


def test_goal_date_validation(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    today = date.today()
    # due_date < start_date MUST FAIL
    goal_res = client.post("/api/performance/goals", json={
        "employee_id": data["alice_emp_id"],
        "title": "Invalid Goal Dates",
        "start_date": str(today),
        "due_date": str(today - timedelta(days=5)),
    })
    assert goal_res.status_code == 400
    assert "Due date cannot be before start date" in goal_res.text


def test_employee_manage_own_goal(setup_performance_data):
    data = setup_performance_data
    as_user(data["bob_user_id"])

    today = date.today()
    # 1. Bob creates own goal via /me
    create_res = client.post("/api/performance/goals/me", json={
        "title": "Master FastAPI & SQLAlchemy",
        "start_date": str(today),
        "due_date": str(today + timedelta(days=30)),
        "status": "NOT_STARTED",
    })
    assert create_res.status_code == 201, create_res.text
    goal_id = create_res.json()["id"]

    # 2. Bob views own goals
    list_res = client.get("/api/performance/goals/me")
    assert list_res.status_code == 200
    assert any(g["id"] == goal_id for g in list_res.json()["goals"])

    # 3. Bob updates status
    patch_res = client.patch(f"/api/performance/goals/me/{goal_id}/status", json={
        "status": "IN_PROGRESS",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"


# ============================================================
# ROLE PERMISSIONS & IDOR PROTECTION TESTS
# ============================================================

def test_employee_cannot_access_hr_review_endpoints(setup_performance_data):
    data = setup_performance_data
    as_user(data["alice_user_id"])

    # Cannot create review
    res1 = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Q1 2026",
        "review_date": str(date.today()),
    })
    assert res1.status_code == 403

    # Cannot list all reviews
    res2 = client.get("/api/performance/reviews")
    assert res2.status_code == 403

    # Cannot access HR analytics
    res3 = client.get("/api/performance/analytics/overview")
    assert res3.status_code == 403


def test_employee_cross_idor_protection(setup_performance_data):
    data = setup_performance_data

    # HR creates a review and a goal specifically for Alice
    as_user(data["hr_id"])
    alice_rev_res = client.post("/api/performance/reviews", json={
        "employee_id": data["alice_emp_id"],
        "review_period": "Alice Secret Review",
        "review_date": str(date.today()),
        "status": "COMPLETED",
        "ratings": [{"category": "Confidential", "rating": 5}],
    })
    alice_review_id = alice_rev_res.json()["id"]

    alice_goal_res = client.post("/api/performance/goals", json={
        "employee_id": data["alice_emp_id"],
        "title": "Alice Private Goal",
        "start_date": str(date.today()),
        "due_date": str(date.today() + timedelta(days=10)),
    })
    alice_goal_id = alice_goal_res.json()["id"]

    # Now Bob attempts to view Alice's review via /me/{alice_review_id}
    as_user(data["bob_user_id"])
    bob_view_alice_rev = client.get(f"/api/performance/reviews/me/{alice_review_id}")
    assert bob_view_alice_rev.status_code == 404

    # Bob attempts to view Alice's goal via /me/{alice_goal_id}
    bob_view_alice_goal = client.get(f"/api/performance/goals/me/{alice_goal_id}")
    assert bob_view_alice_goal.status_code == 404

    # Bob attempts to update Alice's goal via /me/{alice_goal_id}
    bob_patch_alice_goal = client.patch(f"/api/performance/goals/me/{alice_goal_id}/status", json={
        "status": "COMPLETED",
    })
    assert bob_patch_alice_goal.status_code == 404


# ============================================================
# ANALYTICS & TRENDS TESTS
# ============================================================

def test_hr_analytics_overview_and_draft_exclusion(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    # Create a completed review for Bob (score: 5.0)
    client.post("/api/performance/reviews", json={
        "employee_id": data["bob_emp_id"],
        "review_period": "Analytics Period 1",
        "review_date": str(date.today() - timedelta(days=10)),
        "status": "COMPLETED",
        "ratings": [
            {"category": "Engineering", "rating": 5},
            {"category": "Communication", "rating": 5},
        ],
    })

    # Create a draft review for Bob (should be excluded from averages and trends!)
    client.post("/api/performance/reviews", json={
        "employee_id": data["bob_emp_id"],
        "review_period": "Draft Pending",
        "review_date": str(date.today()),
        "status": "DRAFT",
        "ratings": [
            {"category": "Engineering", "rating": 1},
        ],
    })

    res = client.get("/api/performance/analytics/overview")
    assert res.status_code == 200, res.text
    analytics = res.json()

    assert analytics["total_employees"] >= 2
    assert analytics["total_completed_reviews"] >= 1
    assert analytics["total_draft_reviews"] >= 1
    assert analytics["average_overall_rating"] is not None
    assert isinstance(analytics["category_averages"], list)
    assert isinstance(analytics["recent_trend"], list)

    # Ensure draft reviews are not in recent_trend
    trend_ids = [t["review_id"] for t in analytics["recent_trend"]]
    db = SessionLocal()
    try:
        drafts = db.query(PerformanceReview).filter(PerformanceReview.status == PerformanceReviewStatus.DRAFT).all()
        for draft in drafts:
            assert draft.id not in trend_ids
    finally:
        db.close()


def test_employee_analytics_me(setup_performance_data):
    data = setup_performance_data
    as_user(data["bob_user_id"])

    res = client.get("/api/performance/analytics/me")
    assert res.status_code == 200, res.text
    my_analytics = res.json()

    assert my_analytics["completed_reviews_count"] >= 1
    assert my_analytics["latest_rating"] is not None
    assert my_analytics["average_rating"] is not None
    assert my_analytics["highest_rating"] is not None
    assert isinstance(my_analytics["category_ratings"], list)
    assert isinstance(my_analytics["goals_summary"], dict)
    assert isinstance(my_analytics["trend"], list)


def test_hr_trend_endpoint(setup_performance_data):
    data = setup_performance_data
    as_user(data["hr_id"])

    res = client.get("/api/performance/analytics/trend")
    assert res.status_code == 200
    trends = res.json()
    assert isinstance(trends, list)
    if len(trends) > 0:
        assert "overall_rating" in trends[0]
        assert "employee_name" in trends[0]
        assert "review_date" in trends[0]
