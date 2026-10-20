from fastapi import HTTPException, Depends, Header
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from app.database import get_db
from app.models.user import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
default_chief_admin_email = (
    "aidsfaz@gmail.com" if os.getenv("RENDER", "").lower() == "true" else "admin@buk.edu.ng"
)
CHIEF_ADMIN_EMAIL = os.getenv(
    "CHIEF_ADMIN_EMAIL", default_chief_admin_email
).strip().lower()


def get_current_user(
    authorization: str = Header(None), db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]) # type: ignore
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.is_active is False:
            raise HTTPException(
                status_code=403,
                detail="Your account has been deactivated. Contact admin.",
            )
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_admin(user: User = Depends(get_current_user)):
    if user.role != "admin": # type: ignore
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_super_admin(user: User = Depends(get_current_admin)) -> User:
    if (user.email or "").strip().lower() != CHIEF_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Only the system administrator can manage administrator accounts")
    return user


def require_approved_user(user: User = Depends(get_current_user)):
    if user.role == "student" and not user.is_approved: # type: ignore
        raise HTTPException(
            status_code=403,
            detail="Your account is pending approval. You can browse the system but cannot use services yet.",
        )
    return user
