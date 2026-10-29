import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, literal_column
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session

from app.ai.campus_qa import answer_campus_question, is_campus_intent
from app.ai.llm_service import GROQ_MODEL, OLLAMA_MODEL, llm_service
from app.ai.rag_service import rag_service
from app.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.study_material import StudyMaterial
from app.models.user import User
from app.schemas.user import ChatMessageCreate
from app.utils.dependencies import require_approved_user

router = APIRouter(prefix="/chat", tags=["AI Chatbot"])
logger = logging.getLogger(__name__)


def _clean_search_excerpt(excerpt: object, fallback: object) -> str:
    text = str(excerpt or fallback or "").strip()
    return re.sub(r"</?b>", "", text, flags=re.IGNORECASE)


def _weighted_material_search_vector():
    return (
        func.setweight(
            func.to_tsvector(
                "english",
                func.coalesce(StudyMaterial.title, ""),
            ),
            literal_column("'A'::\"char\""),
        )
        .op("||")(
            func.setweight(
                func.to_tsvector(
                    "english",
                    func.coalesce(StudyMaterial.subject, ""),
                ),
                literal_column("'B'::\"char\""),
            )
        )
        .op("||")(
            func.setweight(
                func.to_tsvector(
                    "english",
                    func.coalesce(StudyMaterial.content, ""),
                ),
                literal_column("'C'::\"char\""),
            )
        )
    )


@router.get("/sessions")
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_user),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "sessions": [
            {
                "id": session.id,
                "title": session.title or "New conversation",
                "session_type": session.session_type,
                "created_at": session.created_at,
                "message_count": len(session.messages),
            }
            for session in sessions
        ]
    }


@router.get("/sessions/{session_id}")
def get_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_user),
):
    session = (
        db.query(ChatSession)
        .options(joinedload(ChatSession.messages))
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {
        "id": session.id,
        "title": session.title or "Conversation",
        "session_type": session.session_type,
        "messages": [
            {
                "role": message.role,
                "content": message.content,
                "sources": message.sources,
            }
            for message in sorted(session.messages, key=lambda item: item.created_at)
        ],
    }


def answer_academic_question(
    user: User,
    question: str,
    provider: str,
    model: str | None,
    db: Session | None = None,
) -> tuple[str, list[dict]]:
    context, sources = rag_service.search_with_sources(
        user.id,  # type: ignore[arg-type]
        question,
        k=3,
    )  # type: ignore[arg-type]
    if db is not None and db.get_bind().dialect.name == "postgresql":
        ts_query = func.plainto_tsquery("english", question)
        search_vector = _weighted_material_search_vector()
        rank = func.ts_rank(search_vector, ts_query)
        headline = func.ts_headline(
            "english",
            StudyMaterial.content,
            ts_query,
            "MaxWords=80, MinWords=25",
        )
        rows = (
            db.query(StudyMaterial.id, StudyMaterial.title, StudyMaterial.subject, StudyMaterial.content, rank, headline)
            .filter(
                StudyMaterial.owner_id == user.id,
                search_vector.op("@@")(ts_query),
            )
            .order_by(rank.desc(), StudyMaterial.id.desc())
            .limit(3)
            .all()
        )
        if rows:
            context_parts = [context] if sources else []
            existing_sources = {
                (source.get("title"), source.get("subject"))
                for source in sources
            }
            for material_id, material_title, material_subject, material_content, _, excerpt in rows:
                del material_id
                title = material_title or "Untitled material"
                subject = material_subject or ""
                if (title, subject) in existing_sources:
                    continue
                label = f"{title} ({subject})" if subject else title
                excerpt_text = _clean_search_excerpt(excerpt, material_content)
                context_parts.append(f"From: {label}\n{excerpt_text}")
                sources.append(
                    {
                        "type": "study_material",
                        "title": title,
                        "subject": subject,
                        "excerpt": excerpt_text[:320],
                    }
                )
                existing_sources.add((title, subject))
            if context_parts:
                context = "\n\n".join(context_parts)

    prompt = f"""You are the BUK Campus Assistant System, a helpful academic assistant for Bayero University Kano students.
First use the uploaded study-material context below to answer the question.
    If the context does not contain the answer, answer the student's actual question directly using your general knowledge.
    Do not refuse, give a canned "not found" reply, or add a disclaimer just because the materials do not cover it.
Keep every answer brief: no more than 2 short sentences or 50 words.
Do not invent specific BUK policies, dates, or facts.

Study-material context:
{context if sources else "No relevant uploaded study-material context was found."}

Student question:
{question}
"""
    answer = llm_service.get_response(
        user_id=user.email, # type: ignore
        message=prompt,
        provider=provider,
        model=model,
        max_tokens=128,
    )  # type: ignore[arg-type]
    return answer, sources


@router.post("/ask")
def unified_ask(
    message: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_user),
):
    content = message.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message is required")

    session_type = message.session_type.lower()
    if session_type not in {"mixed", "academic", "campus"}:
        raise HTTPException(status_code=400, detail="Invalid session type")
    provider = message.provider.strip().lower()
    if provider not in {"ollama", "groq"}:
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    allowed_models = {
        "ollama": {OLLAMA_MODEL},
        "groq": {GROQ_MODEL},
    }
    model = message.model.strip() if message.model else None
    if model and model not in allowed_models[provider]:
        raise HTTPException(status_code=400, detail="Invalid AI model")

    if message.session_id:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.id == message.session_id,
                ChatSession.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(
            user_id=current_user.id,
            session_type=session_type,
            title=content[:80],
        )
        db.add(session)
        db.flush()

    db.add(
        ChatMessage(
            session_id=session.id,
            role="user",
            content=content,
        )
    )

    try:
        if session_type in {"campus", "mixed"}:
            campus_answer, campus_sources = answer_campus_question(
                db,
                content,
                provider,
                model,
            )
            if (
                session_type == "campus"
                or campus_sources
                or is_campus_intent(content)
            ):
                answer, sources = campus_answer, campus_sources
            else:
                answer, sources = answer_academic_question(
                    current_user,
                    content,
                    provider,
                    model,
                    db=db,
                )
        else:
            answer, sources = answer_academic_question(
                current_user,
                content,
                provider,
                model,
                db=db,
            )
    except Exception as exc:
        db.rollback()
        logger.exception(
            "AI chat request failed for user %s using %s",
            current_user.id,
            provider,
        )
        raise HTTPException(
            status_code=504 if "timed out" in str(exc).lower() else 502,
            detail=f"{provider.title()} AI service failed: {exc}",
        ) from exc

    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=sources,
        )
    )
    db.commit()

    return {
        "session_id": session.id,
        "answer": answer,
        "sources": sources,
    }
