from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.utils.auth import (
    hash_password,
    password_validation_errors,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    SECRET_KEY,
    ALGORITHM,
)
from app.utils.dependencies import get_current_user
from app.utils.email import (
    get_frontend_url,
    is_local_reset_mode,
    send_reset_email,
)
from datetime import datetime, timedelta
import logging
from jose import jwt, JWTError

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


class ProfileUpdate(BaseModel):
    level: int = Field(ge=100, le=600, multiple_of=100)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    email = str(request.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    response_data = {
        "message": "If an account exists for that email, a password reset link has been sent."
    }

    if user:
        reset_token = jwt.encode(
            {
                "sub": user.email,
                "type": "password_reset",
                "exp": datetime.utcnow() + timedelta(minutes=30),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        reset_link = (
            f"{get_frontend_url()}/reset-password?token={reset_token}"
        )
        if is_local_reset_mode(
            http_request.client.host if http_request.client else None
        ):
            response_data["message"] = (
                "Local development reset link created. Open the link below "
                "to choose a new password."
            )
            response_data["development_reset_link"] = reset_link
        else:
            try:
                await send_reset_email(user.email, reset_link)
            except Exception:
                logger.exception("Failed to send password reset email")

    return response_data


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    password_errors = password_validation_errors(request.password)
    if password_errors:
        raise HTTPException(
            status_code=400,
            detail="Password must contain " + ", ".join(password_errors),
        )

    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset link")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset link")

    user.password_hash = hash_password(request.password)
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    password_errors = password_validation_errors(user_data.password)
    if password_errors:
        raise HTTPException(
            status_code=400,
            detail="Password must contain " + ", ".join(password_errors),
        )

    email = user_data.email.strip().lower()
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_registration_number = db.query(User).filter(User.registration_number == user_data.registration_number).first()
    if existing_registration_number:
        raise HTTPException(status_code=400, detail="Registration number already exists")

    hashed_password = hash_password(user_data.password)

    new_user = User(
        full_name=user_data.full_name,
        email=email,
        password_hash=hashed_password,
        registration_number=user_data.registration_number,
        faculty=user_data.faculty,
        department=user_data.department,
        level=user_data.level,
        role="student",
        is_approved=False,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    email = user_data.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

# Pending users are allowed to login

    # Treat legacy rows with a NULL activity flag as active. Only an explicit
    # False value means an administrator deactivated the account.
    if user.is_active is False: # type: ignore
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Contact admin.",
        )

    # Create JWT token
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(
        data={"sub": user.email, "role": user.role}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "registration_number": user.registration_number,
            "faculty": user.faculty,
            "role": user.role,
            "is_approved": user.is_approved,
            "is_active": user.is_active,
            "department": user.department,
            "level": user.level,
        },
    }


@router.post("/refresh")
def refresh_token(payload: dict):
    token = payload.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Refresh token required")

    data = verify_refresh_token(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    email = data.get("sub")
    new_access_token = create_access_token(
        data={"sub": email, "role": data.get("role")}
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile")
def update_profile(
    profile: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.level = profile.level
    db.commit()
    db.refresh(current_user)
    return {"user": current_user}
