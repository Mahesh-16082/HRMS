from app.core.database import SessionLocal
from app.leave_service.models import LeaveType, LeaveBalance, LeaveRequest
from app.employee_service.models import Employee

def inspect():
    db = SessionLocal()
    try:
        types = db.query(LeaveType).all()
        print("Leave Types:")
        for t in types:
            print(f"  ID={t.id}, Name={t.name}, Code={t.code}, Quota={t.annual_quota}, Active={t.is_active}")

        employees = db.query(Employee).all()
        print(f"\nEmployees ({len(employees)}):")
        for e in employees:
            print(f"  ID={e.id}, Code={e.employee_code}, Name={e.first_name} {e.last_name}, Status={e.employment_status.value}")

        balances = db.query(LeaveBalance).all()
        print(f"\nBalances ({len(balances)}):")
        for b in balances:
            print(f"  ID={b.id}, EmpID={b.employee_id}, TypeID={b.leave_type_id}, Year={b.year}, Allocated={b.allocated}, Used={b.used}, Available={b.available}")

        requests = db.query(LeaveRequest).all()
        print(f"\nRequests ({len(requests)}):")
        for r in requests:
            print(f"  ID={r.id}, EmpID={r.employee_id}, TypeID={r.leave_type_id}, Days={r.number_of_days}, Status={r.status.value}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
