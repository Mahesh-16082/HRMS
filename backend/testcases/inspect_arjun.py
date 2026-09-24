import sys
sys.path.insert(0, ".")
import app.authentication_service.models
from app.core.database import SessionLocal
from app.employee_service.models import Employee
from app.authentication_service.models import User

def inspect():
    db = SessionLocal()
    print("--- Searching for Arjun ---")
    arjun_emps = db.query(Employee).filter(Employee.first_name.ilike("%arjun%")).all()
    for e in arjun_emps:
        print(f"Emp ID: {e.id}, User ID: {e.user_id}, Name: {e.first_name} {e.last_name}, User Email: {e.user.email if e.user else None}")
    
    print("--- Searching for Mahesh ---")
    mahesh_emps = db.query(Employee).filter(Employee.first_name.ilike("%mahesh%")).all()
    for e in mahesh_emps:
        print(f"Emp ID: {e.id}, User ID: {e.user_id}, Name: {e.first_name} {e.last_name}, User Email: {e.user.email if e.user else None}")

    print("--- Searching for HR users ---")
    hr_users = db.query(User).filter(User.role == "hr").all()
    for u in hr_users:
        print(f"User ID: {u.id}, Email: {u.email}, Role: {u.role}")

if __name__ == "__main__":
    inspect()
