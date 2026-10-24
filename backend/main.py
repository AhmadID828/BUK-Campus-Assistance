
import os
import logging

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.models.base import Base
from app.ai.llm_service import llm_service

# Import all models so tables are created
from app.models.user import User
from app.models.study_material import StudyMaterial
from app.models.quiz import Quiz, QuizAttempt
from app.models.planner import Course, StudyTopic, StudyPlan
from app.models.event import Event, EventRSVP
from app.models.campus_location import CampusLocation
from app.models.emergency_contact import EmergencyContact
from app.models.chat import ChatMessage, ChatSession
from app.models.faq import FAQ
from app.models.notification import Notification

# Routers
from app.routers.auth import router as auth_router
from app.routers.chat import router as chat_router
from app.routers.materials import router as materials_router
from app.routers.quiz import router as quiz_router
from app.routers.planner import router as planner_router
from app.routers.admin import router as admin_router
from app.routers.campus import router as campus_router
from app.routers.events import router as events_router
from app.routers.emergency import router as emergency_router
from app.routers.faqs import router as faqs_router, admin_router as admin_faqs_router
from app.routers.notifications import router as notifications_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="BUK Campus Assistant System",
    description="AI-powered study and campus assistance system for Bayero University Kano students",
    version="1.0.0",
)


class ChatRequest(BaseModel):
    message: str


allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(events_router)
app.include_router(chat_router)
app.include_router(materials_router)
app.include_router(quiz_router)
app.include_router(planner_router)
app.include_router(campus_router)
app.include_router(emergency_router)
app.include_router(faqs_router)
app.include_router(admin_faqs_router)
app.include_router(notifications_router)


@app.get("/")
async def root():
    return {
        "message": "BUK Campus Assistant System API is running successfully!",
        "status": "healthy" if app.state.db_ready else "degraded",
        "database": {
            "ok": app.state.db_ready,
            "detail": (
                "Database tables are available."
                if app.state.db_ready
                else "Database initialization failed; database-backed features may be unavailable."
            ),
        },
    }


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        app.state.db_ready = False
        logger.warning("Database health check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database is unavailable")
    app.state.db_ready = True
    return {"status": "healthy"}


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    prompt = payload.message.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Message is required")
    try:
        response = llm_service.get_response("default_user", prompt)
    except (httpx.HTTPError, RuntimeError) as exc:
        logger.exception("Chat generation failed")
        raise HTTPException(
            status_code=502,
            detail="The AI service is unavailable. Please try again.",
        ) from exc
    return {"response": response}


# Create missing tables without preventing the service from starting if the database is unavailable.
try:
    Base.metadata.create_all(bind=engine)
    app.state.db_ready = True
    logger.info("Database tables created successfully.")
except SQLAlchemyError:
    app.state.db_ready = False
    logger.exception("Database initialization failed; starting in degraded mode.")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
