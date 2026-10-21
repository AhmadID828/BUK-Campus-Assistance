import base64
import asyncio
import json
import logging
import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.llm_service import GROQ_MODEL, OLLAMA_MODEL, generate_answer
from app.ai.rag_service import rag_service
from app.database import get_db # type: ignore
from app.models.study_material import StudyMaterial # type: ignore
from app.models.user import User
from app.utils.dependencies import require_approved_user
from app.utils.file_extractor import (
    extract_text_from_file,
    update_search_vector,
)

router = APIRouter(prefix="/materials", tags=["Study Materials"])

UPLOAD_DIR = "uploads"
MAX_UPLOAD_SIZE = 2 * 1024 * 1024
os.makedirs(UPLOAD_DIR, exist_ok=True)
logger = logging.getLogger(__name__)


def encode_cursor(material_id: int) -> str:
    return base64.urlsafe_b64encode(str(material_id).encode()).decode()


def decode_cursor(cursor: str) -> int:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        return int(decoded)
    except (ValueError, TypeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid cursor")


@router.post("/upload")
def upload_material(
    file: UploadFile = File(...),
    title: str = Form("Untitled Material"),
    subject: str = Form("General"),
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    allowed_extensions = {".pdf", ".docx", ".pptx"}
    filename = file.filename or "uploaded_file"
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOCX and PPTX files are allowed",
        )

    safe_filename = f"{user.id}_{os.path.basename(filename)}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    uploaded_size = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := file.file.read(64 * 1024):
                uploaded_size += len(chunk)
                if uploaded_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Material file must be 2 MB or smaller.",
                    )
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise

    extracted_text = extract_text_from_file(file_path)

    if not extracted_text or "Error extracting" in extracted_text:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail="Failed to extract text from the file",
        )

    material = StudyMaterial(
        title=title,
        content=extracted_text[:8000],
        file_path=file_path,
        subject=subject,
        owner_id=user.id,
    )

    db.add(material)
    db.commit()
    db.refresh(material)

    rag_indexed = True
    try:
        rag_service.add_material(
            user_id=user.id, # type: ignore
            material_id=material.id, # type: ignore
            title=material.title, # type: ignore
            content=extracted_text,
            subject=material.subject or "", # type: ignore
        )
    except Exception:
        rag_indexed = False
        logger.exception(
            "RAG indexing failed for uploaded material %s owned by user %s",
            material.id,
            user.id,
        )

    update_search_vector(db, material.id) # type: ignore

    return {
        "message": "File uploaded successfully",
        "material_id": material.id,
        "title": material.title,
        "subject": material.subject,
        "owner": user.full_name,
        "rag_indexed": rag_indexed,
        "indexing_warning": (
            None
            if rag_indexed
            else (
                "The file was uploaded, but AI search indexing failed. "
                "It may not be used as context for study-chat answers."
            )
        ),
    }


@router.post("/summarize/{material_id}")
async def summarize_material(
    material_id: int,
    provider: str | None = Query(None),
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    material = (
        db.query(StudyMaterial)
        .filter(
            StudyMaterial.id == material_id,
            StudyMaterial.owner_id == user.id,
        )
        .first()
    )

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    prompt = f"""
You are a helpful study assistant for Bayero University Kano students.
Summarize the following lecture notes clearly and simply.
Focus on the main ideas, key points, and important concepts.
Return the summary as plain text, without JSON or Markdown.
Keep it concise and below 150 words.

Title: {material.title}
Subject: {material.subject}

Notes:
{material.content[:8000]}
"""

    summary_provider = (provider or os.getenv("LLM_PROVIDER", "ollama")).strip().lower()
    if summary_provider not in {"ollama", "groq"}:
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    summary_model = OLLAMA_MODEL if summary_provider == "ollama" else GROQ_MODEL

    try:
        summary = await asyncio.to_thread(
            generate_answer,
            prompt,
            260,
            provider=summary_provider,
            model=summary_model,
            timeout=120.0 if summary_provider == "groq" else 180.0,
        )
    except Exception as exc:
        logger.exception(
            "Summary generation failed for material %s using %s",
            material_id,
            summary_provider,
        )
        raise HTTPException(
            status_code=504 if "timed out" in str(exc).lower() else 502,
            detail=str(exc) or "The selected AI provider could not generate a summary.",
        ) from exc

    summary_text = summary.strip()
    try:
        summary_payload = json.loads(summary_text)
    except json.JSONDecodeError:
        summary_payload = None

    if isinstance(summary_payload, dict):
        summary_value = summary_payload.get("summary")
        if isinstance(summary_value, str):
            summary_text = summary_value.strip()
        else:
            summary_text = ""
    elif summary_text.startswith("```"):
        summary_text = summary_text.split("\n", 1)[-1]
        if summary_text.endswith("```"):
            summary_text = summary_text[:-3].strip()

    if not summary_text:
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an empty summary. Please try again.",
        )

    return {
        "material_id": material.id,
        "title": material.title,
        "summary": summary_text.strip(),
    }


@router.get("/")
async def get_materials(
    cursor: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    search: str | None = Query(None),
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    query = db.query(StudyMaterial).filter(
        StudyMaterial.owner_id == user.id
    )

    if search:
        terms = " & ".join(search.strip().split())
        ts_query = func.to_tsquery("english", terms)
        rank = func.ts_rank(
            StudyMaterial.search_vector,
            ts_query,
        ).label("rank")

        query = (
            query.add_columns(rank)
            .filter(StudyMaterial.search_vector.op("@@")(ts_query))
            .order_by(rank.desc(), StudyMaterial.id.desc())
        )
    else:
        query = query.order_by(StudyMaterial.id.desc())

    if cursor:
        query = query.filter(
            StudyMaterial.id < decode_cursor(cursor)
        )

    rows = query.limit(limit + 1).all()
    has_next = len(rows) > limit
    rows = rows[:limit]

    items = []
    for row in rows:
        material = row[0] if search else row
        items.append(
            {
                "id": material.id,
                "title": material.title,
                "subject": material.subject,
                "file_path": material.file_path,
                "rank": float(row[1]) if search else None,
            }
        )

    next_cursor = None
    if has_next and rows:
        last_material = rows[-1][0] if search else rows[-1]
        next_cursor = encode_cursor(last_material.id) # type: ignore

    return {
        "materials": items,
        "next_cursor": next_cursor,
        "has_next": has_next,
        "limit": limit,
        "search": search,
    }


@router.delete("/{material_id}")
async def delete_material(
    material_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.owner_id == user.id,
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if material.file_path and os.path.exists(material.file_path):
        os.remove(material.file_path)
    try:
        rag_service.delete_material(user.id, material.id)
    except Exception as error:
        print(f"RAG cleanup failed for material {material.id}: {error}")

    db.delete(material)
    db.commit()
    return {"message": "Material deleted successfully", "material_id": material_id}
