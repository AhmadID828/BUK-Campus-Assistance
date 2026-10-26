from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import JWT_SECRET_KEY
from app.database import get_db
from app.models.campus_location import CampusLocation
from app.models.user import User

router = APIRouter(prefix="/campus", tags=["Campus Locations"])

SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = "HS256"


def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user: #type: ignore
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except JWTError as error:
        raise HTTPException(status_code=401, detail="Invalid token") from error


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":#type: ignore
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/locations")
def get_locations(
    category: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(CampusLocation).filter(CampusLocation.is_active.is_(True))

    if category:
        query = query.filter(CampusLocation.category.ilike(f"%{category}%"))

    locations = query.order_by(CampusLocation.name).all()

    return {
        "total": len(locations),
        "locations": [
            {
                "id": location.id,
                "name": location.name,
                "category": location.category,
                "description": location.description,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "image_url": location.image_url,
            }
            for location in locations
        ],
    }


@router.post("/locations")
def add_location(
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    required_fields = ("name", "category", "latitude", "longitude")
    missing_field = next(
        (field for field in required_fields if payload.get(field) is None),
        None,
    )
    if missing_field:
        raise HTTPException(status_code=400, detail=f"{missing_field} is required")

    location = CampusLocation(
        name=payload["name"],
        category=payload["category"],
        description=payload.get("description"),
        latitude=payload["latitude"],
        longitude=payload["longitude"],
        image_url=payload.get("image_url"),
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    return {
        "message": "Location added successfully",
        "location_id": location.id,
    }


@router.put("/locations/{location_id}")
def update_location(
    location_id: int,
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    location = db.query(CampusLocation).filter(
        CampusLocation.id == location_id
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    required_fields = ("name", "category", "latitude", "longitude")
    missing_field = next(
        (field for field in required_fields if payload.get(field) in (None, "")),
        None,
    )
    if missing_field:
        raise HTTPException(status_code=400, detail=f"{missing_field} is required")

    try:
        location.name = str(payload["name"]).strip()
        location.category = str(payload["category"]).strip()
        location.description = payload.get("description")
        location.latitude = float(payload["latitude"])
        location.longitude = float(payload["longitude"])
        location.image_url = payload.get("image_url")
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be valid numbers",
        ) from error

    db.commit()
    db.refresh(location)
    return {"message": "Location updated successfully", "location_id": location.id}


@router.delete("/locations/{location_id}")
def delete_location(
    location_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    location = (
        db.query(CampusLocation)
        .filter(CampusLocation.id == location_id)
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    db.delete(location)
    db.commit()

    return {"message": "Location deleted successfully"}
