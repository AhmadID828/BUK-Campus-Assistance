import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from app.database import get_db #type: ignore
from app.models.quiz import Quiz, QuizAttempt
from app.models.planner import StudyTopic, Course
from app.models.study_material import StudyMaterial #type: ignore
from app.models.user import User
from app.ai.llm_service import OLLAMA_QUIZ_MODEL, generate_answer
from app.utils.dependencies import require_approved_user
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
import json
import logging

load_dotenv()

router = APIRouter(prefix="/quiz", tags=["Quiz Generation"])
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

TIME_LIMITS = {
    3: 2 * 60,
    5: 4 * 60,
    10: 8 * 60,
    20: 15 * 60,
    30: 25 * 60,
    50: 35 * 60,
}


def get_time_limit(question_count: int) -> int:
    supported_count = min(TIME_LIMITS, key=lambda count: abs(count - question_count))
    return TIME_LIMITS[supported_count]


def score_quiz_answers(
    questions: list[dict],
    student_answers: dict,
) -> tuple[int, float, list[dict]]:
    correct = 0
    review = []
    for index, question in enumerate(questions):
        selected_answer = student_answers.get(str(index))
        correct_answer = question.get("correct_answer", "")
        is_correct = bool(
            selected_answer
            and correct_answer
            and selected_answer.upper() == correct_answer.upper()
        )
        correct += int(is_correct)
        review.append({
            "question": question.get("question", ""),
            "options": question.get("options", {}),
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "explanation": question.get("explanation", ""),
        })

    total = len(questions)
    score = round((correct / total) * 100, 2) if total else 0.0
    return correct, score, review


def parse_generated_quiz(response: str, expected_count: int) -> list[dict]:
    cleaned_response = response.strip()
    if cleaned_response.startswith("```"):
        cleaned_response = cleaned_response.split("\n", 1)[-1]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3].strip()

    decoder = json.JSONDecoder()
    parsed_quiz = None
    for start in (cleaned_response.find("{"), cleaned_response.find("[")):
        if start < 0:
            continue
        try:
            parsed_quiz, _ = decoder.raw_decode(cleaned_response[start:])
            break
        except json.JSONDecodeError:
            continue

    if isinstance(parsed_quiz, dict):
        questions = parsed_quiz.get("questions")
    else:
        questions = parsed_quiz

    if not isinstance(questions, list) or len(questions) != expected_count:
        raise ValueError("Generated quiz did not contain the requested number of questions")

    for question in questions:
        if not isinstance(question, dict):
            raise ValueError("Generated quiz contains an invalid question")
        options = question.get("options")
        if (
            not isinstance(question.get("question"), str)
            or not question["question"].strip()
            or not isinstance(options, dict)
            or set(options) != {"A", "B", "C", "D"}
            or not all(isinstance(option, str) and option.strip() for option in options.values())
            or question.get("correct_answer") not in {"A", "B", "C", "D"}
            or not isinstance(question.get("explanation"), str)
        ):
            raise ValueError("Generated quiz contains invalid question fields")

    return questions


@router.post("/generate/{material_id}")
async def generate_quiz(
    material_id: int,
    user: User = Depends(require_approved_user),
    num_questions: int = 3,
    provider: str | None = None,
    db: Session = Depends(get_db),
):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.owner_id == user.id,
    ).first()

    if not material:
        raise HTTPException(
            status_code=404,
            detail="Study material not found",
        )

    quiz_provider = (provider or os.getenv("QUIZ_PROVIDER", "groq")).strip().lower()
    if quiz_provider not in {"ollama", "groq"}:
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    max_questions = 50
    num_questions = max(1, min(num_questions, max_questions))
    notes = (material.content or "").strip()[:8000]
    
    prompt = f"""Create exactly {num_questions} undergraduate multiple-choice questions from these notes.
Return ONLY valid JSON. Do not use Markdown, code fences, introductions, or conclusions.
Return an object with a "questions" array containing exactly {num_questions} items. Each item must contain:
"question", "options" (an object with exactly A, B, C, D), "correct_answer" (A/B/C/D),
and an explanation of no more than 12 words. Use only facts in the notes and avoid repeating concepts.
Title: {material.title}
Subject: {material.subject}
Notes:
{notes}"""

    try:
        # Quiz generation is isolated from chat so it can use a faster dedicated provider.
        ai_response = await asyncio.to_thread(
            generate_answer,
            prompt,
            600 + (num_questions * 180),
            model=OLLAMA_QUIZ_MODEL if quiz_provider == "ollama" else None,
            timeout=300.0 if quiz_provider == "ollama" else 120.0,
            response_format="json",
            provider=quiz_provider,
        )
    except Exception as exc:
        logger.exception(
            "Quiz generation failed for material %s using %s",
            material_id,
            quiz_provider,
        )
        raise HTTPException(
            status_code=504 if "timed out" in str(exc).lower() else 502,
            detail=str(exc),
        ) from exc

    try:
        quiz = parse_generated_quiz(ai_response, num_questions)
    except (ValueError, json.JSONDecodeError):
        logger.exception(
            "AI provider returned an invalid quiz for material %s using %s",
            material_id,
            quiz_provider,
        )
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an invalid quiz format. Please try again.",
        ) from None

    saved_quiz = Quiz(
        title=material.title,
        subject=material.subject,
        material_id=material.id,
        owner_id=user.id,
        questions=quiz,
        time_limit=get_time_limit(len(quiz)),
    )
    db.add(saved_quiz)
    db.commit()
    db.refresh(saved_quiz)

    return {
        "quiz_id": saved_quiz.id,
        "material_id": material.id,
        "title": material.title,
        "subject": material.subject,
        "num_questions": len(quiz),
        "quiz": quiz,
        "time_limit": saved_quiz.time_limit,
    }

# ====================== START QUIZ ======================
@router.post("/start/{quiz_id}")
async def start_quiz(
    quiz_id: int,
    user: User = Depends(require_approved_user) ,  # Only approved users
    db: Session = Depends(get_db)
):

    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.owner_id == user.id,
        ).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    existing_attempt = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == user.id,
            QuizAttempt.is_completed == 0,
        )
        .order_by(QuizAttempt.started_at.desc())
        .first()
    )
    if existing_attempt:
        elapsed = (datetime.now(timezone.utc) - existing_attempt.started_at).total_seconds()
        if elapsed <= quiz.time_limit:
            return {
                "attempt_id": existing_attempt.id,
                "quiz_id": quiz.id,
                "title": quiz.title,
                "time_limit": quiz.time_limit,
                "questions": quiz.questions,
                "message": "Quiz resumed successfully",
            }
        existing_attempt.is_completed = 1
        existing_attempt.submitted_at = datetime.now(timezone.utc)
        db.commit()

    # Create a new attempt only when there is no valid attempt to resume.
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        total_questions=len(quiz.questions) if quiz.questions else 0, # type: ignore
        is_completed=0
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "quiz_id": quiz.id,
        "title": quiz.title,
        "time_limit": quiz.time_limit,          # in seconds
        "started_at": attempt.started_at,
        "questions": quiz.questions,            # send questions to frontend
        "message": "Quiz started successfully"
    }

# ====================== GET REMAINING TIME ======================
@router.get("/remaining-time/{attempt_id}")
async def get_remaining_time(
    attempt_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):

    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.id == attempt_id,
        QuizAttempt.user_id == user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.is_completed: # type: ignore
        return {
            "remaining_seconds": 0,
            "is_expired": True,
            "message": "Quiz already completed"
        }

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
    elapsed = (datetime.now(timezone.utc) - attempt.started_at).total_seconds()
    remaining = quiz.time_limit - elapsed # type: ignore

    if remaining <= 0:
        attempt.is_completed = 1
        attempt.submitted_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "attempt_id": attempt.id,
        "remaining_seconds": max(0, int(remaining)),
        "is_expired": remaining <= 0,
        "time_limit": quiz.time_limit # type: ignore
    }

# ====================== SUBMIT QUIZ ======================
@router.post("/submit/{attempt_id}")
async def submit_quiz(
    attempt_id: int,
    payload: dict,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):

    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.id == attempt_id,
        QuizAttempt.user_id == user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.is_completed: # type: ignore
        raise HTTPException(status_code=400, detail="Quiz already submitted")

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()

    # Check if time has expired
    elapsed = (datetime.now(timezone.utc) - attempt.started_at).total_seconds()
    if elapsed > quiz.time_limit + 10:  # type: ignore # 10 seconds grace period
        raise HTTPException(status_code=400, detail="Time is up. Quiz has expired.")

    student_answers = payload.get("answers", {})  # Example: {"0": "B", "1": "A"}

    questions = quiz.questions or []  # type: ignore[union-attr]
    correct, score, review = score_quiz_answers(questions, student_answers)
    total = len(questions)

    # Update attempt
    attempt.score = score # type: ignore
    attempt.answers = student_answers
    attempt.submitted_at = datetime.now(timezone.utc) # type: ignore
    attempt.is_completed = 1 # type: ignore
    db.commit()

        # ========== Adaptive Priority Adjustment ==========
    try:
        # Only adjust if score is available
        if score is not None and quiz.subject: # type: ignore
            # Find topics that match the quiz subject
 # filepath: c:\Users\Lenovo\Desktop\Final year Project\BUK-EduAI-Study-Assistant\backend\app\routers\quiz.py
            related_topics = (
                db.query(StudyTopic)
                .join(Course)
                .filter(
                    Course.user_id == user.id,
                    StudyTopic.is_completed.is_(False),
                    (
                        Course.course_title.ilike(f"%{quiz.subject}%") # type: ignore
                        | Course.course_code.ilike(f"%{quiz.subject}%") # type: ignore
                        | StudyTopic.title.ilike(f"%{quiz.subject}%") # type: ignore
                    ),
                )
                .all()
            )

            for topic in related_topics:
                if score < 50:
                    # Poor performance → increase priority (make it more urgent)
                    topic.priority = 1   # type: ignore #High priority(weak performance)
                elif score < 70:
                    # Average → medium priority
                    topic.priority = 2 # type: ignore
                else:
                    # Good performance → lower priority
                    topic.priority = min(topic.priority + 1, 3) # type: ignore
                    # If score >= 70 we leave priority as is

            db.commit()
    except Exception as e:
        # Don't break the quiz submission if planner adjustment fails
        print(f"Adaptive priority error: {e}")

    return {
        "attempt_id": attempt.id,
        "score": score,
        "correct": correct,
        "total_questions": total,
        "review": review,
        "message": "Quiz submitted successfully"
    }



@router.get("/attempts")
async def get_my_attempts(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):

    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )

    results = []
    for attempt in attempts:
        quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
        results.append({
            "attempt_id": attempt.id,
            "quiz_id": attempt.quiz_id,
            "quiz_title": quiz.title if quiz else "Unknown",
            "subject": quiz.subject if quiz else None,
            "score": attempt.score,
            "total_questions": attempt.total_questions,
            "is_completed": bool(attempt.is_completed),
            "started_at": attempt.started_at,
            "submitted_at": attempt.submitted_at
        })

    return {
        "total_attempts": len(results),
        "attempts": results
    }

@router.get("/attempts/{attempt_id}")
async def get_attempt_detail(
    attempt_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.id == attempt_id,
        QuizAttempt.user_id == user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()

    return {
        "attempt_id": attempt.id,
        "quiz_title": quiz.title if quiz else None,
        "subject": quiz.subject if quiz else None,
        "score": attempt.score,
        "total_questions": attempt.total_questions,
        "answers": attempt.answers,
        "questions": quiz.questions if quiz else [],
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "is_completed": bool(attempt.is_completed)
    }


@router.get("/quizzes")
async def get_my_quizzes(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    """List saved quizzes and whether the user can still take or resume them."""
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.owner_id == user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    quiz_ids = [quiz.id for quiz in quizzes]
    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.quiz_id.in_(quiz_ids),
            QuizAttempt.user_id == user.id,
        )
        .order_by(QuizAttempt.created_at.desc())
        .all()
        if quiz_ids
        else []
    )
    attempts_by_quiz: dict[int, list[QuizAttempt]] = {}
    for attempt in attempts:
        attempts_by_quiz.setdefault(attempt.quiz_id, []).append(attempt)  # type: ignore[arg-type]

    results = []

    for quiz in quizzes:
        quiz_attempts = attempts_by_quiz.get(quiz.id, [])  # type: ignore[arg-type]
        active_attempt = next(
            (attempt for attempt in quiz_attempts if not attempt.is_completed),
            None,
        )
        if active_attempt:
            elapsed = (now - active_attempt.started_at).total_seconds()
            if elapsed > quiz.time_limit:
                active_attempt.is_completed = 1
                active_attempt.submitted_at = now
                active_attempt = None

        if any(attempt.is_completed for attempt in quiz_attempts):
            continue

        results.append({
            "quiz_id": quiz.id,
            "title": quiz.title,
            "subject": quiz.subject,
            "total_questions": len(quiz.questions or []),
            "time_limit": quiz.time_limit,
            "created_at": quiz.created_at,
            "attempt_id": active_attempt.id if active_attempt else None,
            "is_available": bool(active_attempt or not quiz_attempts),
        })

    db.commit()
    return {"quizzes": results}

    
