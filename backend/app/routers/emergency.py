from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.emergency_contact import EmergencyContact
from app.utils.dependencies import get_current_admin
from app.utils.email import send_email

router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.get("/contacts")
def get_emergency_contacts(db: Session = Depends(get_db)):
    contacts = (
        db.query(EmergencyContact)
        .filter(EmergencyContact.is_active == True)
        .all()
    )
    return contacts


@router.post("/contacts")
def create_emergency_contact(
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contact = EmergencyContact(
        name=payload.get("name"),
        category=payload.get("category"),
        phone=payload.get("phone"),
        alternative_phone=payload.get("alternative_phone"),
        email=payload.get("email"),
        location=payload.get("location"),
        description=payload.get("description"),
        is_active=True,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

# ========== UPDATE CONTACT ==========
@router.put("/contacts/{contact_id}")
async def update_emergency_contact(
    contact_id: int,
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contact = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.name = payload.get("name", contact.name)
    contact.category = payload.get("category", contact.category)
    contact.phone = payload.get("phone", contact.phone)
    contact.alternative_phone = payload.get("alternative_phone", contact.alternative_phone)
    contact.email = payload.get("email", contact.email)
    contact.location = payload.get("location", contact.location)
    contact.description = payload.get("description", contact.description)

    db.commit()
    db.refresh(contact)
    return {"message": "Contact updated successfully"}


@router.delete("/contacts/{contact_id}")
def delete_emergency_contact(
    contact_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contact = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.is_active = False # type: ignore
    db.commit()
    return {"message": "Contact deactivated"}

# ========== BROADCAST EMERGENCY ALERT ==========
@router.post("/broadcast")
async def broadcast_emergency_alert(
    payload: dict,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    title = payload.get("title")
    message = payload.get("message")

    if not title or not message:
        raise HTTPException(status_code=400, detail="Title and message are required")

    students = (
        db.query(User)
        .filter(User.role == "student", User.is_active == True)
        .all()
    )

    sent = 0
    failed = []

    for student in students:
        try:
            email_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🚨 EMERGENCY ALERT</h1>
              </div>
              <div style="padding: 20px; background-color: #fef2f2; border: 1px solid #fecaca;">
                <h2 style="color: #991b1b;">{title}</h2>
                <p style="color: #7f1d1d; font-size: 16px; line-height: 1.6;">{message}</p>
                <hr style="border-color: #fecaca; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 14px;">
                  This is an official alert from <strong>BUK Campus Assistance</strong>.
                </p>
              </div>
            </div>
            """
            await send_email(
                subject=f"🚨 EMERGENCY: {title}",
                recipient=student.email, # type: ignore
                body=email_body,
            )
            sent += 1
        except Exception as e:
            failed.append({"email": student.email, "error": str(e)})

    return {
        "message": f"Emergency alert sent to {sent} students",
        "sent": sent,
        "failed": failed,
    }
