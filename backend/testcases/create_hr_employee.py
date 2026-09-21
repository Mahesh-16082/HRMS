from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.authentication_service.models import User
from app.employee_service.models import Employee, EmploymentStatus


db: Session = SessionLocal()

try:
    hr = db.query(User).filter(User.id == 2, User.role == "hr").first()

    if not hr:
        print("HR user not found.")
        exit()

    existing_employee = (
        db.query(Employee)
        .filter(Employee.user_id == hr.id)
        .first()
    )

    if existing_employee:
        print("HR employee profile already exists.")
        print(f"Employee ID: {existing_employee.id}")
        print(f"Employee Code: {existing_employee.employee_code}")
        exit()

    hr_employee = Employee(
        user_id=hr.id,
        employee_code="EMP003",
        first_name="Mahesh",
        last_name="Seereddy",
        employment_status=EmploymentStatus.ACTIVE,
    )

    db.add(hr_employee)
    db.commit()
    db.refresh(hr_employee)

    print("HR employee profile created successfully!")
    print(f"Employee ID: {hr_employee.id}")
    print(f"Employee Code: {hr_employee.employee_code}")
    print(f"Name: {hr_employee.first_name} {hr_employee.last_name}")
    print(f"Status: {hr_employee.employment_status.value}")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")

finally:
    db.close()