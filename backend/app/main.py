from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.authentication_service.router import router as auth_router
from app.employee_service.router import router as employee_router
from app.attendance_service.router import router as attendance_router
from app.project_service.router import router as project_router
from app.project_service.assignment_router import router as project_assignment_router
from app.project_service.role_router import router as project_role_router
from app.leave_service.router import router as leave_router
from app.complaint_service.router import router as complaint_router
from app.announcement_service.router import router as announcement_router
from app.audit_service.router import router as audit_router
from app.work_report_service.router import router as work_report_router
from app.performance_service.router import router as performance_router
from app.notification_service.router import router as notification_router

app = FastAPI(
    title="HRMS Backend",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(employee_router)
app.include_router(attendance_router)
app.include_router(project_router)
app.include_router(project_assignment_router)
app.include_router(project_role_router)
app.include_router(leave_router)
app.include_router(complaint_router)
app.include_router(announcement_router)
app.include_router(audit_router)
app.include_router(work_report_router)
app.include_router(performance_router)
app.include_router(notification_router)

@app.get("/")
def root():
    return {
        "message": "HRMS Backend is running"
    }