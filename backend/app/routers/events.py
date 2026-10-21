from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db #type: ignore
from app.models.event import Event
from app.models.user import User
from jose import jwt, JWTError
from datetime import date
import shutil
from app.models.event import EventRSVP
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/events", tags=["Events & Announcements"])

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]) #type: ignore
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_admin(user: User = Depends(get_current_user)):
    if user.role != "admin": #type: ignore
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ========== GET ALL EVENTS (Students) ==========
@router.get("/")
async def get_events(
    category: str = None, #type: ignore
    upcoming_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(Event).filter(Event.is_active == True)

    if upcoming_only:
        query = query.filter(Event.event_date >= date.today())

    if category:
        query = query.filter(Event.category.ilike(f"%{category}%"))

    events = query.order_by(Event.event_date.asc()).all()

    return {
        "total": len(events),
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "category": e.category,
                "location": e.location,
                "event_date": str(e.event_date),
                "start_time": e.start_time,
                "end_time": e.end_time,
                "organizer": e.organizer,
                "organizer": e.organizer,
                "is_featured": e.is_featured
            }
            for e in events
        ]
    }

# ========== RSVP STATISTICS (Admin) ==========
@router.get("/admin/rsvp-statistics")
async def get_rsvp_statistics(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(EventRSVP, User)
        .join(User, User.id == EventRSVP.user_id)
        .order_by(EventRSVP.created_at.desc())
        .all()
    )

    statistics = {}
    for rsvp, user in rows:
        event_id = rsvp.event_id
        if event_id not in statistics:
            statistics[event_id] = {
                "counts": {"going": 0, "maybe": 0, "not_going": 0},
                "rsvps": [],
            }

        if rsvp.status in statistics[event_id]["counts"]:
            statistics[event_id]["counts"][rsvp.status] += 1
        statistics[event_id]["rsvps"].append({
            "id": rsvp.id,
            "status": rsvp.status,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "registration_number": user.registration_number,
            },
        })

    return {"events": statistics}

# ========== UPDATE EVENT (Admin) ==========
@router.put("/{event_id}")
async def update_event(
    event_id: int,
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.title = payload.get("title", event.title)
    event.description = payload.get("description", event.description)
    event.category = payload.get("category", event.category)
    event.location = payload.get("location", event.location)
    event.event_date = payload.get("event_date", event.event_date)
    event.start_time = payload.get("start_time", event.start_time)
    event.end_time = payload.get("end_time", event.end_time)
    event.organizer = payload.get("organizer", event.organizer)
    event.is_featured = payload.get("is_featured", event.is_featured)

    db.commit()
    db.refresh(event)

    return {"message": "Event updated successfully"}

# ========== DELETE EVENT (Admin) ==========
@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return {"message": "Event deleted successfully"}



UPLOAD_DIR = "uploads/events"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ========== CREATE EVENT WITH OPTIONAL IMAGE ==========
@router.post("/")
async def create_event(
    title: str = Form(...),
    event_date: date = Form(...),
    description: str = Form(None),
    category: str = Form("General"),
    location: str = Form(None),
    start_time: str = Form(None),
    end_time: str = Form(None),
    organizer: str = Form(None),
    is_featured: bool = Form(False),
    image: UploadFile = File(None),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    image_url = None

    if image and image.filename:
        file_path = os.path.join(UPLOAD_DIR, image.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = file_path

    event = Event(
        title=title,
        description=description,
        category=category,
        location=location,
        event_date=event_date,
        start_time=start_time,
        end_time=end_time,
        organizer=organizer,
        image_url=image_url,
        is_featured=is_featured
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return {"message": "Event created successfully", "event_id": event.id}

# ========== RSVP TO EVENT ==========
@router.post("/{event_id}/rsvp")
async def rsvp_to_event(
    event_id: int,
    payload: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id, Event.is_active == True).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    status = payload.get("status", "going")
    if status not in ["going", "maybe", "not_going"]:
        raise HTTPException(status_code=400, detail="Invalid RSVP status")

    existing = db.query(EventRSVP).filter(
        EventRSVP.event_id == event_id,
        EventRSVP.user_id == user.id
    ).first()

    if existing:
        existing.status = status
    else:
        rsvp = EventRSVP(event_id=event_id, user_id=user.id, status=status)
        db.add(rsvp)

    db.commit()

    return {"message": f"RSVP updated to '{status}'"}


@router.get("/{event_id}/my-rsvp")
async def get_my_rsvp(
    event_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rsvp = db.query(EventRSVP).filter(
        EventRSVP.event_id == event_id,
        EventRSVP.user_id == user.id,
    ).first()
    return {"status": rsvp.status if rsvp else None}


@router.get("/{event_id}/rsvps")
async def get_event_rsvps(
    event_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rows = (
        db.query(EventRSVP, User)
        .join(User, User.id == EventRSVP.user_id)
        .filter(EventRSVP.event_id == event_id)
        .order_by(EventRSVP.created_at.desc())
        .all()
    )
    counts = {"going": 0, "maybe": 0, "not_going": 0}
    responses = []
    for rsvp, user in rows:
        if rsvp.status in counts:
            counts[rsvp.status] += 1
        responses.append({
            "id": rsvp.id,
            "status": rsvp.status,
            "created_at": rsvp.created_at,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "registration_number": user.registration_number,
            },
        })
    return {"event_id": event_id, "counts": counts, "total": len(responses), "rsvps": responses}
