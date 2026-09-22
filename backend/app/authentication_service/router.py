from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.audit_service.service import extract_client_info
from app.authentication_service import service
from app.authentication_service.dependencies import (
    get_current_user,
    get_current_user_and_session,
)
from app.authentication_service.schemas import (
    MessageResponse,
    SendOTPRequest,
    TokenResponse,
    VerifyOTPRequest,
)
from app.core.database import get_db


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/send-otp",
    response_model=MessageResponse
)
def send_otp(
    request: SendOTPRequest,
    db: Session = Depends(get_db)
):
    return service.send_login_otp(
        db=db,
        email=request.email
    )
@router.post(
    "/resend-otp",
    response_model=MessageResponse
)
def resend_otp(
    request: SendOTPRequest,
    db: Session = Depends(get_db)
):
    return service.send_login_otp(
        db=db,
        email=request.email
    )


@router.post(
    "/verify-otp",
    response_model=TokenResponse
)
def verify_otp(
    request: VerifyOTPRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    ip_address, user_agent = extract_client_info(req)
    return service.verify_login_otp(
        db=db,
        email=request.email,
        otp=request.otp,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/logout",
    response_model=MessageResponse
)
def logout(
    req: Request,
    db: Session = Depends(get_db),
    auth_data=Depends(get_current_user_and_session)
):
    user, session = auth_data
    ip_address, user_agent = extract_client_info(req)

    return service.logout(
        db=db,
        session_id=session.session_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/logout-all",
    response_model=MessageResponse
)
def logout_all_devices(
    req: Request,
    db: Session = Depends(get_db),
    auth_data=Depends(get_current_user_and_session)
):
    user, session = auth_data
    ip_address, user_agent = extract_client_info(req)

    return service.logout_all_devices(
        db=db,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/me")
def get_me(
    current_user=Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
    }