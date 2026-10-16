from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.faq import FAQ
from app.models.user import User
from app.utils.dependencies import get_current_admin

router = APIRouter(prefix="/faqs", tags=["FAQs"])
admin_router = APIRouter(prefix="/admin/faqs", tags=["Admin FAQs"])


@router.get("/")
async def list_faqs(
    db: Session = Depends(get_db),
):
    return {"faqs": [
        {
            "id": faq.id, "question": faq.question, "answer": faq.answer,
            "category": faq.category, "related_location_id": faq.related_location_id,
        }
        for faq in db.query(FAQ).filter(FAQ.is_active.is_(True)).order_by(FAQ.id.desc()).all()
    ]}


@admin_router.get("/")
async def admin_list_faqs(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return {"faqs": [
        {
            "id": faq.id, "question": faq.question, "answer": faq.answer,
            "category": faq.category, "related_location_id": faq.related_location_id,
            "is_active": faq.is_active,
        }
        for faq in db.query(FAQ).order_by(FAQ.id.desc()).all()
    ]}


@admin_router.post("/")
async def create_faq(payload: dict, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    question = str(payload.get("question", "")).strip()
    answer = str(payload.get("answer", "")).strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and answer are required")
    faq = FAQ(
        question=question,
        answer=answer,
        category=str(payload.get("category") or "general").strip(),
        related_location_id=payload.get("related_location_id"),
        is_active=bool(payload.get("is_active", True)),
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return {"message": "FAQ created successfully", "faq_id": faq.id}


@admin_router.put("/{faq_id}")
async def update_faq(faq_id: int, payload: dict, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for field in ("question", "answer", "category", "related_location_id", "is_active"):
        if field in payload:
            setattr(faq, field, payload[field])
    db.commit()
    return {"message": "FAQ updated successfully"}


@admin_router.delete("/{faq_id}")
async def delete_faq(faq_id: int, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(faq)
    db.commit()
    return {"message": "FAQ deleted successfully"}
