from app.core.database import SessionLocal
from app.leave_service.models import LeaveType

INITIAL_LEAVE_TYPES = [
    {
        "name": "Sick Leave",
        "code": "SICK",
        "annual_quota": 15.0,
        "description": "Medical or health-related leave",
        "is_active": True,
    },
    {
        "name": "Casual Leave",
        "code": "CASUAL",
        "annual_quota": 15.0,
        "description": "Personal or short-term leave",
        "is_active": True,
    },
]

def seed_leave_types():
    db = SessionLocal()
    try:
        # 1. Update or create official active types (SICK=15, CASUAL=15)
        for item in INITIAL_LEAVE_TYPES:
            existing = (
                db.query(LeaveType)
                .filter((LeaveType.code == item["code"]) | (LeaveType.name == item["name"]))
                .first()
            )
            if not existing:
                lt = LeaveType(
                    name=item["name"],
                    code=item["code"],
                    annual_quota=item["annual_quota"],
                    description=item["description"],
                    is_active=item["is_active"],
                )
                db.add(lt)
                print(f"Created leave type: {item['name']} ({item['code']}) with quota {item['annual_quota']}")
            else:
                existing.annual_quota = item["annual_quota"]
                existing.is_active = True
                print(f"Updated leave type: {existing.name} ({existing.code}) to quota {item['annual_quota']}, active=True")

        # 2. Safely deactivate Annual Leave (ANNUAL) if it exists, without deleting
        annual_type = db.query(LeaveType).filter(LeaveType.code == "ANNUAL").first()
        if annual_type:
            annual_type.is_active = False
            print(f"Deactivated Annual Leave ({annual_type.code}) - preserved for historical records.")

        # 3. Deactivate any test/temporary types (e.g. TEST_SICK)
        test_types = db.query(LeaveType).filter(~LeaveType.code.in_(["SICK", "CASUAL"])).all()
        for tt in test_types:
            if tt.is_active:
                tt.is_active = False
                print(f"Deactivated temporary/test leave type: {tt.name} ({tt.code})")

        db.commit()
        print("Leave types seed/update completed successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_leave_types()
