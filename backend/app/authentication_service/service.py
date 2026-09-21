import hashlib
import secrets
from datetime import datetime, timedelta

import jwt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.authentication_service import repository
from app.core.config import settings
from app.email_service.service import send_otp_email


# =========================
# OTP HELPERS
# =========================

def generate_otp() -> str:
    """Generate a secure 6-digit OTP."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    """Hash OTP before storing it in the database."""
    return hashlib.sha256(
        otp.encode("utf-8")
    ).hexdigest()


# =========================
# SEND OTP
# =========================

def send_login_otp(db: Session, email: str):
    """
    Generate and send an OTP to an existing active user.
    """

    user = repository.get_user_by_email(
        db,
        email
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )
    # OTP resend protection
    last_otp = repository.get_last_otp(
        db,
        email
    )

    if last_otp:
        seconds_since_last_otp = (
            datetime.utcnow() - last_otp.created_at
        ).total_seconds()

        if seconds_since_last_otp < 60:
            remaining_seconds = int(
                60 - seconds_since_last_otp
            )

            raise HTTPException(
                status_code=429,
                detail=(
                    f"Please wait {remaining_seconds} "
                    "seconds before requesting another OTP"
                )
            )
    # Invalidate previous OTPs
    repository.invalidate_previous_otps(
        db,
        email
    )

    # Generate new OTP
    otp = generate_otp()

    # Hash OTP before storing
    otp_hash = hash_otp(otp)

    # OTP expiration
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.OTP_EXPIRE_MINUTES
    )

    # Store OTP
    repository.create_otp(
        db=db,
        email=email,
        otp_hash=otp_hash,
        expires_at=expires_at
    )

    # Send OTP through email service
    send_otp_email(
        recipient_email=email,
        otp=otp
    )

    return {
        "message": "OTP sent successfully"
    }


# =========================
# VERIFY OTP
# =========================

def verify_login_otp(
    db: Session,
    email: str,
    otp: str
):
    user = repository.get_user_by_email(
        db,
        email
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    # Get latest unused OTP
    otp_record = repository.get_latest_otp(
        db,
        email
    )

    if not otp_record:
        raise HTTPException(
            status_code=400,
            detail="OTP not found or already used"
        )

    # Check expiration
    if datetime.utcnow() > otp_record.expires_at:

        repository.mark_otp_as_used(
            db,
            otp_record
        )

        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # Check maximum attempts
    if otp_record.attempts >= 5:

        repository.mark_otp_as_used(
            db,
            otp_record
        )

        raise HTTPException(
            status_code=400,
            detail="Too many incorrect attempts"
        )

    # Verify OTP
    if hash_otp(otp) != otp_record.otp_hash:
    
        repository.increment_otp_attempts(
            db,
            otp_record
        )

        if otp_record.attempts >= 5:
            repository.mark_otp_as_used(
                db,
                otp_record
            )

            raise HTTPException(
                status_code=400,
                detail="Too many incorrect attempts. Please request a new OTP."
            )

        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # OTP is valid
    repository.mark_otp_as_used(
        db,
        otp_record
    )

    # Mark user as verified
    user.is_verified = True

    db.commit()
    db.refresh(user)

    # Create session
    session_id = secrets.token_urlsafe(32)

    session_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    repository.create_session(
        db=db,
        user_id=user.id,
        session_id=session_id,
        expires_at=session_expires_at
    )

    # JWT payload
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "session_id": session_id,
        "exp": session_expires_at
    }

    # Generate JWT
    access_token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================
# LOGOUT
# =========================

def logout(
    db: Session,
    session_id: str
):
    session = repository.get_session(
        db,
        session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    repository.invalidate_session(
        db,
        session
    )

    return {
        "message": "Logged out successfully"
    }


# =========================
# LOGOUT ALL DEVICES
# =========================

def logout_all_devices(
    db: Session,
    user_id: int
):
    repository.invalidate_all_user_sessions(
        db,
        user_id
    )

    return {
        "message": "Logged out from all devices successfully"
    }