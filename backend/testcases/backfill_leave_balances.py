from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.employee_service.models import Employee, EmploymentStatus
from app.leave_service.models import LeaveBalance, LeaveType
from app.leave_service.service import ensure_employee_yearly_balances

def backfill_active_employees():
    db = SessionLocal()
    current_year = datetime.now(timezone.utc).year
    print(f"=== Starting Leave Balance Backfill for Calendar Year {current_year} ===")

    try:
        # 1. Fetch active employees
        active_employees = (
            db.query(Employee)
            .filter(Employee.employment_status == EmploymentStatus.ACTIVE)
            .all()
        )
        print(f"Found {len(active_employees)} active employee(s).")

        # 2. Ensure SICK and CASUAL balances for each active employee
        for emp in active_employees:
            print(f"\nProcessing Employee ID={emp.id}, Code={emp.employee_code}, Name={emp.first_name} {emp.last_name}:")
            
            # Check existing balances before
            existing = (
                db.query(LeaveBalance)
                .filter(LeaveBalance.employee_id == emp.id, LeaveBalance.year == current_year)
                .all()
            )
            print(f"  Existing balances count before: {len(existing)}")
            for b in existing:
                print(f"    TypeID={b.leave_type_id}, Allocated={b.allocated}, Used={b.used}, Available={b.available}")

            # Safe initialization / backfill
            balances = ensure_employee_yearly_balances(db, emp.id, current_year)

            # Check balances after
            print(f"  Balances count after: {len(balances)}")
            for b in balances:
                lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
                code = lt.code if lt else "UNKNOWN"
                print(f"    [{code}] Allocated={b.allocated}, Used={b.used}, Available={b.available}")

        print("\n=== Leave Balance Backfill Completed Successfully ===")
    finally:
        db.close()

if __name__ == "__main__":
    backfill_active_employees()
