from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.authentication_service.models import User
from app.employee_service.models import Employee


db: Session = SessionLocal()

try:
    hr = db.query(User).filter(User.role == "hr").first()

    if not hr:
        print("No HR user found.")
    else:
        print(f"HR User ID: {hr.id}")
        print(f"HR Email: {hr.email}")
        print(f"HR Role: {hr.role}")

        employee = (
            db.query(Employee)
            .filter(Employee.user_id == hr.id)
            .first()
        )

        if employee:
            print("\nHR employee profile already exists:")
            print(f"Employee ID: {employee.id}")
            print(f"Employee Code: {employee.employee_code}")
            print(f"Name: {employee.first_name} {employee.last_name}")
            print(f"Status: {employee.employment_status}")
        else:
            print("\nHR employee profile does NOT exist yet.")

finally:
    db.close()