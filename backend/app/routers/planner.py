from datetime import date, timedelta
import json
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.ai.rag_service import rag_service
from app.database import get_db # type: ignore
from app.models.planner import Course, StudyTopic, StudyPlan
from app.models.user import User
from app.models.quiz import Quiz, QuizAttempt
from app.models.study_material import StudyMaterial
from app.utils.dependencies import require_approved_user
from app.utils.email import send_email



router = APIRouter(prefix="/planner", tags=["Adaptive Study Planner"])
logger = logging.getLogger(__name__)


def adaptive_priority(priority: int | None, quiz_score: float | None) -> int:
    base_priority = priority or 2
    if quiz_score is None:
        return base_priority
    if quiz_score < 50:
        return 1
    if quiz_score < 65:
        return min(base_priority, 2)
    if quiz_score >= 85:
        return min(base_priority + 1, 3)
    return base_priority


def build_plan_items(
    topics: list[StudyTopic],
    start_date: date,
    quiz_scores: dict[int, float] | None = None,
) -> list[dict]:
    quiz_scores = quiz_scores or {}
    grouped_topics: dict[int | None, list[StudyTopic]] = {}
    for topic in topics:
        grouped_topics.setdefault(topic.course_id, []).append(topic)

    placements = []
    for course_topics in grouped_topics.values():
        course_topics.sort(
            key=lambda topic: (
                adaptive_priority(
                    topic.priority,
                    quiz_scores.get(topic.material_id)
                    if topic.material_id is not None
                    else None,
                ),
                quiz_scores.get(topic.material_id, 100)
                if topic.material_id is not None
                else 100,
                (topic.title or "").casefold(),
                topic.id or 0,
            )
        )
        exam_date = course_topics[0].course.exam_date if course_topics[0].course else None
        deadline = exam_date if exam_date and exam_date >= start_date else None
        days_until_exam = (deadline - start_date).days if deadline else 0

        for topic_index, topic in enumerate(course_topics):
            day_offset = (
                min(
                    days_until_exam,
                    ((topic_index + 1) * (days_until_exam + 1) // len(course_topics)) - 1,
                )
                if deadline
                else 0
            )
            placements.append(
                {
                    "topic": topic,
                    "preferred_date": start_date + timedelta(days=max(day_offset, 0)),
                    "deadline": deadline,
                    "hours": max(float(topic.estimated_hours or 2), 0.5),
                    "planning_priority": adaptive_priority(
                        topic.priority,
                        quiz_scores.get(topic.material_id)
                        if topic.material_id is not None
                        else None,
                    ),
                }
            )

    placements.sort(
        key=lambda placement: (
            placement["preferred_date"],
            placement["deadline"] or date.max,
            placement["planning_priority"],
            quiz_scores.get(placement["topic"].material_id, 100)
            if placement["topic"].material_id is not None
            else 100,
            (placement["topic"].title or "").casefold(),
            placement["topic"].id or 0,
        )
    )

    scheduled_hours: dict[date, float] = {}
    items = []
    for placement in placements:
        topic = placement["topic"]
        study_hours = placement["hours"]
        proposed_date = placement["preferred_date"]
        deadline = placement["deadline"]

        if study_hours > 6:
            while scheduled_hours.get(proposed_date, 0) > 0:
                if deadline and proposed_date >= deadline:
                    break
                proposed_date += timedelta(days=1)
        else:
            while scheduled_hours.get(proposed_date, 0) + study_hours > 6:
                if deadline and proposed_date >= deadline:
                    break
                proposed_date += timedelta(days=1)

        scheduled_hours[proposed_date] = scheduled_hours.get(proposed_date, 0) + study_hours
        items.append(
            {
                "topic_id": topic.id,
                "material_id": topic.material_id,
                "date": str(proposed_date),
                "course": topic.course.course_code if topic.course else "General",
                "topic": topic.title,
                "hours": study_hours,
                "priority": topic.priority,
                "planning_priority": placement["planning_priority"],
                "quiz_score": (
                    quiz_scores[topic.material_id]
                    if topic.material_id in quiz_scores
                    else None
                ),
                "workload_exceeded": scheduled_hours[proposed_date] > 6,
            }
        )

    for item in items:
        item["day_total_hours"] = scheduled_hours[date.fromisoformat(item["date"])]
    return items


def get_latest_quiz_scores(db: Session, user_id: int) -> dict[int, float]:
    attempts = (
        db.query(QuizAttempt, Quiz)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.is_completed == 1,
            QuizAttempt.score.is_not(None),
            Quiz.material_id.is_not(None),
        )
        .order_by(
            func.coalesce(QuizAttempt.submitted_at, QuizAttempt.created_at).desc(),
            QuizAttempt.id.desc(),
        )
        .all()
    )
    latest_scores: dict[int, float] = {}
    for attempt, quiz in attempts:
        if quiz.material_id is not None and attempt.score is not None:
            latest_scores.setdefault(quiz.material_id, float(attempt.score))
    return latest_scores


def create_study_plan(db: Session, user: User, *, title_prefix: str) -> dict:
    topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.is_completed.is_(False))
        .order_by(StudyTopic.priority, StudyTopic.id)
        .all()
    )
    if not topics:
        raise HTTPException(
            status_code=400,
            detail="Add at least one incomplete study topic before generating a plan",
        )

    quiz_scores = get_latest_quiz_scores(db, user.id)
    today = date.today()
    plan_items = build_plan_items(topics, today, quiz_scores)
    end_date = max(
        (date.fromisoformat(item["date"]) for item in plan_items),
        default=today,
    )

    study_plan = StudyPlan(
        user_id=user.id,
        title=f"{title_prefix} - {today}",
        start_date=today,
        end_date=end_date,
        plan_data=json.dumps(plan_items),
        is_active=True,
    )
    db.add(study_plan)
    for old_plan in db.query(StudyPlan).filter(
        StudyPlan.user_id == user.id,
        StudyPlan.is_active.is_(True),
    ).all():
        old_plan.is_active = False
    db.commit()
    db.refresh(study_plan)

    return {
        "message": (
            "Study plan regenerated successfully"
            if title_prefix.startswith("Regenerated")
            else "Adaptive study plan generated successfully"
        ),
        "plan_id": study_plan.id,
        "total_topics": len(plan_items),
        "plan": plan_items,
    }


# ========== COURSE AND MATERIAL SOURCES ==========
@router.get("/courses")
async def get_courses(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    courses = db.query(Course).filter(Course.user_id == user.id).order_by(Course.course_code).all()

    return {
        "courses": [
            {
                "id": course.id,
                "course_code": course.course_code,
                "course_title": course.course_title,
                "exam_date": str(course.exam_date) if course.exam_date else None,
                "topics": [
                    {
                        "id": topic.id,
                        "material_id": topic.material_id,
                        "title": topic.title,
                        "is_completed": bool(topic.is_completed),
                        "priority": topic.priority,
                        "estimated_hours": topic.estimated_hours,
                    }
                    for topic in course.topics
                ],
                "total_topics": len(course.topics),
                "completed_topics": sum(
                    1 for topic in course.topics if topic.is_completed
                ),
            }
            for course in courses
        ]
    }


@router.post("/courses")
async def add_course(
    payload: dict,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    course_code = str(payload.get("course_code") or "").strip().upper()
    course_title = str(payload.get("course_title") or "").strip()
    if not course_code or not course_title:
        raise HTTPException(status_code=400, detail="Course code and title are required")
    if len(course_code) > 32 or len(course_title) > 200:
        raise HTTPException(status_code=400, detail="Course code or title is too long")
    if db.query(Course).filter(
        Course.user_id == user.id,
        func.lower(Course.course_code) == course_code.lower(),
    ).first():
        raise HTTPException(status_code=409, detail="This course is already registered")

    exam_date = payload.get("exam_date") or None
    if exam_date:
        try:
            exam_date = date.fromisoformat(str(exam_date))
        except ValueError:
            raise HTTPException(status_code=400, detail="Exam date must be a valid date") from None

    course = Course(
        user_id=user.id,
        course_code=course_code,
        course_title=course_title,
        credit_units=payload.get("credit_units", 3),
        exam_date=exam_date,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    return {"message": "Course added successfully", "course_id": course.id}


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    materials = db.query(StudyMaterial).filter(
        StudyMaterial.course_id == course.id,
        StudyMaterial.owner_id == user.id,
    ).all()
    material_ids = [material.id for material in materials]
    material_paths = [material.file_path for material in materials if material.file_path]
    topics_query = db.query(StudyTopic)
    if material_ids:
        topics_query = topics_query.filter(
            or_(
                StudyTopic.course_id == course.id,
                StudyTopic.material_id.in_(material_ids),
            )
        )
    else:
        topics_query = topics_query.filter(StudyTopic.course_id == course.id)
    topics = topics_query.all()
    topic_ids = [topic.id for topic in topics]
    for plan in db.query(StudyPlan).filter(
        StudyPlan.user_id == user.id,
        StudyPlan.is_active.is_(True),
    ).all():
        plan_items = json.loads(plan.plan_data or "[]")
        plan_items = [
            item for item in plan_items
            if item.get("topic_id") not in topic_ids
        ]
        if plan_items:
            plan.plan_data = json.dumps(plan_items)
            plan.start_date = min(
                date.fromisoformat(item["date"]) for item in plan_items
            )
            plan.end_date = max(
                date.fromisoformat(item["date"]) for item in plan_items
            )
        else:
            plan.is_active = False

    if topic_ids:
        db.query(StudyTopic).filter(StudyTopic.id.in_(topic_ids)).delete(
            synchronize_session=False
        )
    for material in materials:
        db.delete(material)
    db.delete(course)
    db.commit()

    for material_id in material_ids:
        try:
            rag_service.delete_material(user.id, material_id)
        except Exception:
            logger.exception(
                "RAG cleanup failed for material %s during course deletion",
                material_id,
            )
    for file_path in material_paths:
        try:
            still_referenced = db.query(StudyMaterial.id).filter(
                StudyMaterial.file_path == file_path
            ).first()
            if not still_referenced and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            logger.exception(
                "Uploaded file cleanup failed during course deletion: %s",
                file_path,
            )

    return {
        "message": "Course and its uploaded materials were deleted.",
        "course_id": course_id,
        "deleted_material_count": len(material_ids),
    }


@router.post("/materials/{material_id}/import")
async def import_material(
    material_id: int,
    payload: dict | None = None,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.owner_id == user.id,
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found")

    requested_course_id = (payload or {}).get("course_id")
    if requested_course_id is not None:
        try:
            requested_course_id = int(requested_course_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Course selection is invalid") from None
    course_id = material.course_id or requested_course_id
    if not course_id:
        raise HTTPException(status_code=400, detail="Upload this material under a registered course first")
    if material.course_id and requested_course_id and requested_course_id != material.course_id:
        raise HTTPException(status_code=400, detail="Material belongs to a different course")

    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing_topic = db.query(StudyTopic).filter(
        StudyTopic.course_id == course.id,
        (StudyTopic.material_id == material.id)
        if material.course_id
        else (StudyTopic.title == material.title),
    ).first()
    if existing_topic:
        return {"message": "Material is already in this course", "topic_id": existing_topic.id}

    try:
        priority = int((payload or {}).get("priority", 2))
        estimated_hours = float((payload or {}).get("estimated_hours", 2))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Priority and study time must be valid numbers") from None
    if priority not in {1, 2, 3}:
        raise HTTPException(status_code=400, detail="Priority must be 1, 2 or 3")
    if not 0.5 <= estimated_hours <= 12:
        raise HTTPException(status_code=400, detail="Study time must be between 0.5 and 12 hours")

    material.course_id = course.id
    material.subject = course.course_code
    topic = StudyTopic(
        course_id=course.id,
        material_id=material.id,
        title=material.title,
        description=f"Uploaded material for {course.course_code}",
        priority=priority,
        estimated_hours=estimated_hours,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)

    return {"message": "Material added to course", "topic_id": topic.id}


@router.post("/courses/{course_id}/topics")
async def add_study_topic(
    course_id: int,
    payload: dict,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Topic title is required")
    if len(title) > 200:
        raise HTTPException(status_code=400, detail="Topic title must be 200 characters or fewer")

    existing_topic = db.query(StudyTopic).filter(
        StudyTopic.course_id == course.id,
        StudyTopic.title == title,
    ).first()
    if existing_topic:
        return {
            "message": "Topic already exists in this course",
            "topic_id": existing_topic.id,
        }

    try:
        priority = int(payload.get("priority", 2))
        estimated_hours = float(payload.get("estimated_hours", 2))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Priority and estimated hours must be valid numbers",
        ) from None
    if priority not in {1, 2, 3}:
        raise HTTPException(status_code=400, detail="Priority must be 1, 2 or 3")
    if not 0.5 <= estimated_hours <= 12:
        raise HTTPException(
            status_code=400,
            detail="Estimated study time must be between 0.5 and 12 hours",
        )

    topic = StudyTopic(
        course_id=course.id,
        title=title,
        description=str(payload.get("description") or "").strip() or None,
        priority=priority,
        estimated_hours=estimated_hours,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return {"message": "Study topic added successfully", "topic_id": topic.id}


@router.put("/topics/{topic_id}")
async def update_study_topic(
    topic_id: int,
    payload: dict,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    topic = (
        db.query(StudyTopic)
        .join(Course)
        .filter(StudyTopic.id == topic_id, Course.user_id == user.id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if "priority" in payload:
        try:
            priority = int(payload["priority"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Priority must be 1, 2 or 3") from None
        if priority not in {1, 2, 3}:
            raise HTTPException(status_code=400, detail="Priority must be 1, 2 or 3")
        topic.priority = priority

    if "estimated_hours" in payload:
        try:
            estimated_hours = float(payload["estimated_hours"])
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Estimated study time must be between 0.5 and 12 hours",
            ) from None
        if not 0.5 <= estimated_hours <= 12:
            raise HTTPException(
                status_code=400,
                detail="Estimated study time must be between 0.5 and 12 hours",
            )
        topic.estimated_hours = estimated_hours

    db.commit()
    return {"message": "Study topic updated successfully"}

# ========== GENERATE ADAPTIVE PLAN ==========
@router.post("/generate")
async def generate_study_plan(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
): 
    return create_study_plan(db, user, title_prefix="Study Plan")

# ========== GET ACTIVE PLAN ==========
@router.get("/active")
async def get_active_plan(user: User = Depends(require_approved_user), db: Session = Depends(get_db)):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user.id, StudyPlan.is_active == True)
        .order_by(StudyPlan.created_at.desc())
        .first()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="No active study plan found")

    plan_items = json.loads(plan.plan_data) # type: ignore
    topic_ids = [item.get("topic_id") for item in plan_items if item.get("topic_id")]
    topics = db.query(StudyTopic).filter(StudyTopic.id.in_(topic_ids)).all() if topic_ids else []
    topic_by_id = {topic.id: topic for topic in topics}
    plan_items = [
        {
            **item,
            "completed": topic_by_id[item.get("topic_id")].is_completed,
        }
        for item in plan_items
        if item.get("topic_id") in topic_by_id
    ]

    return {
        "plan_id": plan.id,
        "title": plan.title,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "plan": plan_items
    }


@router.delete("/active")
async def delete_active_plan(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user.id, StudyPlan.is_active.is_(True))
        .order_by(StudyPlan.created_at.desc())
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="No active study plan found")

    plan.is_active = False
    db.commit()
    return {"message": "Active study plan deleted"}


@router.put("/topics/{topic_id}/priority")
async def update_topic_priority(
    topic_id: int,
    priority: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    topic = (
        db.query(StudyTopic)
        .join(Course)
        .filter(StudyTopic.id == topic_id, Course.user_id == user.id)
        .first()
    )

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if priority not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Priority must be 1, 2 or 3")

    topic.priority = priority #type:ignore
    db.commit()

    return {"message": "Priority updated successfully", "new_priority": priority}

@router.put("/topics/{topic_id}/complete")
async def mark_topic_completed(
    topic_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    topic = (
        db.query(StudyTopic)
        .join(Course)
        .filter(
            StudyTopic.id == topic_id,
            Course.user_id == user.id
        )
        .first()
    )

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    topic.is_completed = True #type:ignore
    db.commit()

    return {
        "message": "Topic marked as completed",
        "topic_id": topic.id,
        "title": topic.title
    }


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: int,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    topic = (
        db.query(StudyTopic)
        .join(Course)
        .filter(StudyTopic.id == topic_id, Course.user_id == user.id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db.delete(topic)
    db.commit()
    return {"message": "Study topic removed from planner", "topic_id": topic_id}

@router.get("/reminders/today")
async def get_today_reminders(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Get active plan
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user.id, StudyPlan.is_active == True)
        .order_by(StudyPlan.created_at.desc())
        .first()
    )

    if not plan:
        return {
            "date": str(today),
            "message": "No active study plan found",
            "tasks": []
        }

    plan_data = json.loads(plan.plan_data) #type:ignore

    # Filter tasks for today
    today_tasks = [task for task in plan_data if task.get("date") == str(today)]

    # Also get high priority incomplete topics
    weak_topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(
            Course.user_id == user.id,
            StudyTopic.is_completed == False,
            StudyTopic.priority == 1
        )
        .limit(5)
        .all()
    )

    weak_list = [
        {
            "topic": t.title,
            "course": t.course.course_code if t.course else "General",
            "priority": "High",
            "reason": "Weak performance detected"
        }
        for t in weak_topics
    ]

    return {
        "date": str(today),
        "planned_tasks": today_tasks,
        "weak_topics_reminder": weak_list,
        "total_tasks": len(today_tasks) + len(weak_list)
    }

@router.post("/schedule-quizzes")
async def schedule_quizzes(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Get high priority incomplete topics
    weak_topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(
            Course.user_id == user.id,
            StudyTopic.is_completed == False,
            StudyTopic.priority <= 2
        )
        .order_by(StudyTopic.priority)
        .limit(7)
        .all()
    )

    schedule = []
    current_date = today

    for topic in weak_topics:
        schedule.append({
            "date": str(current_date),
            "topic": topic.title,
            "course": topic.course.course_code if topic.course else "General",
            "suggested_action": "Take a quiz on this topic",
            "priority": topic.priority
        })
        current_date += timedelta(days=1)

    return {
        "message": "Automated quiz schedule generated",
        "total_suggested_quizzes": len(schedule),
        "schedule": schedule
    }

@router.get("/progress")
async def get_progress_data(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):

    # Total topics
    total_topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id)
        .count()
    )

    completed_topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.is_completed == True)
        .count()
    )

    # Quiz performance
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user.id, QuizAttempt.is_completed == 1)
        .all()
    )

    average_score = 0
    if attempts:
        average_score = round(sum([a.score for a in attempts if a.score])  / len(attempts), 2)#type:ignore

    # Priority distribution
    high_priority = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.priority == 1, StudyTopic.is_completed == False)
        .count()
    )

    medium_priority = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.priority == 2, StudyTopic.is_completed == False)
        .count()
    )

    low_priority = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.priority == 3, StudyTopic.is_completed == False)
        .count()
    )

    completion_rate = round((completed_topics / total_topics) * 100, 1) if total_topics > 0 else 0

    return {
        "total_topics": total_topics,
        "completed_topics": completed_topics,
        "pending_topics": total_topics - completed_topics,
        "completion_rate": completion_rate,
        "average_quiz_score": average_score,
        "priority_distribution": {
            "high": high_priority,
            "medium": medium_priority,
            "low": low_priority
        },
        "chart_data": {
            "labels": ["Completed", "Pending"],
            "values": [completed_topics, total_topics - completed_topics]
        }
    }

@router.post("/regenerate")
async def regenerate_study_plan(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    return create_study_plan(db, user, title_prefix="Regenerated Plan")


@router.post("/send-daily-reminder")
async def send_daily_reminder(
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Get today's tasks
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user.id, StudyPlan.is_active == True)
        .order_by(StudyPlan.created_at.desc())
        .first()
    )

    tasks_html = "<p>No tasks scheduled for today.</p>"

    if plan:
        plan_data = json.loads(plan.plan_data) #type:ignore
        today_tasks = [t for t in plan_data if t.get("date") == str(today)]

        if today_tasks:
            tasks_html = "<ul>"
            for task in today_tasks:
                tasks_html += f"<li><b>{task['topic']}</b> ({task['course']}) - {task['hours']} hours</li>"
            tasks_html += "</ul>"

    # Weak topics
    weak_topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(
            Course.user_id == user.id,
            StudyTopic.is_completed == False,
            StudyTopic.priority == 1
        )
        .limit(3)
        .all()
    )

    weak_html = ""
    if weak_topics:
        weak_html = "<h3>Weak Topics (High Priority)</h3><ul>"
        for t in weak_topics:
            weak_html += f"<li>{t.title}</li>"
        weak_html += "</ul>"

    email_body = f"""
    <h2>BUK Campus Assistant System - Daily Study Reminder</h2>
    <p>Hello {user.full_name},</p>
    <p>Here is your study plan for <b>{today}</b>:</p>
    {tasks_html}
    {weak_html}
    <br>
    <p>Stay consistent. You’ve got this!</p>
    <p>— BUK Campus Assistant System</p>
    """

    try:
        await send_email(
            subject=f"Your Study Reminder for {today}",
            recipient=user.email, # type: ignore
            body=email_body,
        )
        return {"message": "Daily reminder email sent successfully"}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {error}",
        )
