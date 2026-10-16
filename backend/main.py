
from app.models.base import Base
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.database import engine, Base
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

# Routers
from app.routers.auth import router as auth_router
from app.routers.chat import router as chat_router
from app.routers.materials import router as materials_router
from app.routers.quiz import router as quiz_router
from app.routers.planner import router as planner_router
from app.routers.admin import router as admin_router
from app.routers.campus import router as campus_router
from app.routers.events import router as events_router
from app.routers.emergency import router as emergency_router # type: ignore
from app.routers.faqs import router as faqs_router, admin_router as admin_faqs_router

load_dotenv()

app = FastAPI(
    title="BUK Campus Assistance",
    description="AI-Powered Study and Campus Assistant for Bayero University Kano Students",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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


@app.get("/")
async def root():
    return {
        "message": "EduAI Backend is running successfully!",
        "status": "healthy",
    }


@app.post("/api/chat")
async def chat(message: dict):
    prompt = message.get("message", "")
    if not prompt:
        return {"error": "Message is required"}
    response = llm_service.get_response("default_user", prompt)
    return {"response": response}


# Create tables on startup (development)
Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
