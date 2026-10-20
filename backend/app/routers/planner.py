from datetime import date, timedelta
from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db # type: ignore
from app.models.planner import Course, StudyTopic, StudyPlan
from app.models.user import User
from app.models.quiz import Quiz, QuizAttempt
from app.models.study_material import StudyMaterial
from app.utils.dependencies import require_approved_user
from app.utils.email import send_email



router = APIRouter(prefix="/planner", tags=["Adaptive Study Planner"])


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
                "topics": [
                    {
                        "id": topic.id,
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
    course = Course(
        user_id=user.id,
        course_code=payload.get("course_code"),
        course_title=payload.get("course_title"),
        credit_units=payload.get("credit_units", 3),
        exam_date=payload.get("exam_date"),
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    return {"message": "Course added successfully", "course_id": course.id}

@router.post("/materials/{material_id}/import")
async def import_material(
    material_id: int,
    payload: dict,
    user: User = Depends(require_approved_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(
        Course.id == payload.get("course_id"),
        Course.user_id == user.id,
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.owner_id == user.id,
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found")

    existing_topic = db.query(StudyTopic).filter(
        StudyTopic.course_id == course.id,
        StudyTopic.title == material.title,
    ).first()
    if existing_topic:
        return {"message": "Material is already in this course", "topic_id": existing_topic.id}

    topic = StudyTopic(
        course_id=course.id,
        title=material.title,
        description=f"Imported from {material.subject or 'uploaded study material'}",
        priority=2,
        estimated_hours=2.0,
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

    materials = db.query(StudyMaterial).filter(
        StudyMaterial.owner_id == user.id
    ).all()

    # Use completed quiz results to move weak material earlier in the plan.
    quiz_scores = {}
    attempts = (
        db.query(QuizAttempt, Quiz)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .filter(
            QuizAttempt.user_id == user.id,
            QuizAttempt.is_completed == 1,
            QuizAttempt.score.is_not(None),
        )
        .all()
    )
    for attempt, quiz in attempts:
        if quiz.material_id is not None:
            quiz_scores.setdefault(quiz.material_id, []).append(float(attempt.score or 0))
    quiz_averages = {
        material_id: sum(scores) / len(scores)
        for material_id, scores in quiz_scores.items()
    }

    topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(Course.user_id == user.id, StudyTopic.is_completed == False)
        .order_by(StudyTopic.priority)
        .all()
    )

    if not topics:
        raise HTTPException(
            status_code=400,
            detail="Upload study materials or add topics before generating a plan",
        )

    for old_plan in db.query(StudyPlan).filter(
        StudyPlan.user_id == user.id,
        StudyPlan.is_active.is_(True),
    ).all():
        old_plan.is_active = False

    material_ids_by_title = {material.title: material.id for material in materials}
    for topic in topics:
        material_id = material_ids_by_title.get(topic.title)
        score = quiz_averages.get(material_id) if material_id else None
        if score is not None:
            topic.priority = 1 if score < 60 else 2 if score < 80 else 3
            topic.estimated_hours = 3.0 if score < 60 else 2.0

    # Simple adaptive logic
    today = date.today()
    plan = []
    current_date = today

    for topic in topics:
        # Higher priority topics get scheduled earlier
        hours = topic.estimated_hours
        plan.append({
            "topic_id": topic.id,
            "date": str(current_date),
            "course": topic.course.course_code if topic.course else "General",
            "topic": topic.title,
            "hours": hours,
            "priority": topic.priority
        })
        current_date += timedelta(days=1)

    # Save the plan
    study_plan = StudyPlan(
        user_id=user.id,
        title=f"Study Plan - {today}",
        start_date=today,
        end_date=current_date,
        plan_data=json.dumps(plan),
        is_active=True
    )
    db.add(study_plan)
    db.commit()
    db.refresh(study_plan)

    return {
        "message": "Adaptive study plan generated successfully",
        "plan_id": study_plan.id,
        "total_topics": len(plan),
        "plan": plan
    }

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
    # Deactivate old plans
    old_plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == user.id,
        StudyPlan.is_active == True
    ).all()

    for plan in old_plans:
        plan.is_active = False #type:ignore
    db.commit()

    # Get remaining incomplete topics (ordered by priority)
    topics = (
        db.query(StudyTopic)
        .join(Course)
        .filter(
            Course.user_id == user.id,
            StudyTopic.is_completed == False
        )
        .order_by(StudyTopic.priority)
        .all()
    )

    if not topics:
        raise HTTPException(status_code=400, detail="No pending topics left to schedule")

    today = date.today()
    plan = []
    current_date = today

    for topic in topics:
        plan.append({
            "topic_id": topic.id,
            "date": str(current_date),
            "course": topic.course.course_code if topic.course else "General",
            "topic": topic.title,
            "hours": topic.estimated_hours,
            "priority": topic.priority
        })
        current_date += timedelta(days=1)

    new_plan = StudyPlan(
        user_id=user.id,
        title=f"Regenerated Plan - {today}",
        start_date=today,
        end_date=current_date,
        plan_data=json.dumps(plan),
        is_active=True
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    return {
        "message": "Study plan regenerated successfully",
        "plan_id": new_plan.id,
        "total_topics": len(plan),
        "plan": plan
    }


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
