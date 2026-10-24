from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db # type: ignore
from app.models.user import User
from app.models.planner import StudyPlan, StudyTopic, Course
from app.utils.dependencies import CHIEF_ADMIN_EMAIL, get_current_admin, get_super_admin
from app.utils.email import send_approval_email, send_email
from app.utils.auth import hash_password, password_validation_errors
from app.models.study_material import StudyMaterial # type: ignore
from app.models.quiz import Quiz, QuizAttempt
from app.models.event import Event
from app.utils.notifications import create_notification
from app.schemas.user import AdminCreate, AdminStudentUpdate
from sqlalchemy import func
from datetime import date

import json
import logging

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

# ========== SEND REMINDERS TO ALL STUDENTS ==========
@router.post("/send-reminders-all")
async def send_reminders_to_all_students(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    students = db.query(User).filter(
        User.role == "student",
        User.is_active.is_(True),
        User.is_approved.is_(True),
    ).all()
    today = date.today()
    sent_count = 0
    failed = []

    for student in students:
        try:
            plan = (
                db.query(StudyPlan)
                .filter(
                    StudyPlan.user_id == student.id,
                    StudyPlan.is_active.is_(True),
                )
                .order_by(StudyPlan.created_at.desc())
                .first()
            )

            tasks_html = "<p>No tasks scheduled for today.</p>"

            if plan:
                try:
                    plan_data = json.loads(plan.plan_data or "[]") # type: ignore
                except (TypeError, json.JSONDecodeError):
                    plan_data = []

                today_tasks = [
                    task for task in plan_data
                    if task.get("date") == str(today)
                ]

                if today_tasks:
                    tasks_html = "<ul>"
                    for task in today_tasks:
                        tasks_html += (
                            f"<li><b>{task.get('topic', 'Untitled')}</b> "
                            f"({task.get('course', '')})</li>"
                        )
                    tasks_html += "</ul>"

            email_body = f"""
            <h2>BUK Campus Assistant System - Daily Reminder</h2>
            <p>Hello {student.full_name},</p>
            <p>Here is your study plan for <b>{today}</b>:</p>
            {tasks_html}
            <p>Stay focused!</p>
            <p>— BUK Campus Assistant System Team</p>
            """

            await send_email(
                recipient=student.email, # type: ignore
                subject=f"Daily Study Reminder - {today}",
                body=email_body,
            )
            sent_count += 1

        except Exception as error:
            failed.append(
                {
                    "email": student.email,
                    "error": str(error),
                }
            )

    return {
        "message": "Bulk reminder process completed",
        "sent": sent_count,
        "failed": failed
    }

# ========== VIEW ALL STUDENTS ==========
@router.get("/students")
async def get_all_students(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    students = db.query(User).filter(User.role == "student").all()
    return {
        "total": len(students),
        "can_edit_student_details": (admin.email or "").strip().lower() == CHIEF_ADMIN_EMAIL,
        "students": [
            {
                "id": s.id,
                "full_name": s.full_name,
                "email": s.email,
                "registration_number": s.registration_number,
                "faculty": s.faculty,
                "department": s.department,
                "level": s.level,
                "is_approved": s.is_approved is True,
                "is_active": s.is_active is not False,
                "created_at": s.created_at,
            } for s in students
        ]
    }


@router.put("/students/{user_id}")
async def update_student_details(
    user_id: int,
    payload: AdminStudentUpdate,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    email = str(payload.email).strip().lower()
    duplicate = db.query(User).filter(
        func.lower(User.email) == email,
        User.id != student.id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That email address is already in use")

    registration_number = (payload.registration_number or "").strip() or None
    if registration_number and db.query(User).filter(
        User.registration_number == registration_number,
        User.id != student.id,
    ).first():
        raise HTTPException(status_code=409, detail="That registration number is already in use")

    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Student name cannot be empty")

    student.full_name = full_name
    student.email = email
    student.registration_number = registration_number
    student.faculty = (payload.faculty or "").strip() or None
    student.department = (payload.department or "").strip() or None
    student.level = payload.level
    db.commit()
    db.refresh(student)
    return {
        "message": "Student details updated successfully",
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "registration_number": student.registration_number,
            "faculty": student.faculty,
            "department": student.department,
            "level": student.level,
        },
    }

# ========== MAKE A USER ADMIN ==========
@router.put("/make-admin/{user_id}")
async def make_user_admin(
    user_id: int,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = "admin" # type: ignore
    db.commit()

    return {"message": f"{user.full_name} is now an admin"}


@router.post("/admins", status_code=201)
async def create_admin_account(
    payload: AdminCreate,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    password_errors = password_validation_errors(payload.password)
    if password_errors:
        raise HTTPException(
            status_code=400,
            detail="Password must contain " + ", ".join(password_errors),
        )

    email = str(payload.email).strip().lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    new_admin = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        registration_number=None,
        faculty=None,
        department=None,
        level=None,
        role="admin",
        is_active=True,
        is_approved=True,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return {
        "message": f"Administrator account created for {new_admin.email}",
        "admin": {
            "id": new_admin.id,
            "full_name": new_admin.full_name,
            "email": new_admin.email,
            "role": new_admin.role,
        },
    }


@router.get("/admins")
async def list_admin_accounts(
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    admins = db.query(User).filter(User.role == "admin").order_by(User.id).all()
    return {
        "admins": [
            {
                "id": account.id,
                "full_name": account.full_name,
                "email": account.email,
                "is_active": account.is_active is not False,
            }
            for account in admins
        ]
    }


@router.delete("/admins/{user_id}")
async def remove_admin_account(
    user_id: int,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    account = db.query(User).filter(
        User.id == user_id,
        User.role == "admin",
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Administrator not found")

    if (account.email or "").strip().lower() == CHIEF_ADMIN_EMAIL:
        raise HTTPException(
            status_code=400,
            detail="The chief administrator account cannot be removed",
        )

    account.is_active = False
    db.commit()
    return {
        "message": "Administrator access removed. The account and its records were retained."
    }


@router.post("/admins/{user_id}/reactivate")
async def reactivate_admin_account(
    user_id: int,
    admin: User = Depends(get_super_admin),
    db: Session = Depends(get_db),
):
    account = db.query(User).filter(
        User.id == user_id,
        User.role == "admin",
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Administrator not found")

    if (account.email or "").strip().lower() == CHIEF_ADMIN_EMAIL:
        raise HTTPException(
            status_code=400,
            detail="The chief administrator account is already protected",
        )

    account.is_active = True
    db.commit()
    return {"message": "Administrator account reactivated."}


# ========== SYSTEM STATISTICS ==========
@router.get("/statistics")
async def get_system_statistics(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
    ,scope: str = Query("full", pattern="^(full|dashboard)$")
):
    total_students = db.query(User).filter(User.role == "student").count()
    approved_students = db.query(User).filter(
        User.role == "student", User.is_approved.is_(True)
    ).count()
    pending_approvals = total_students - approved_students
    total_admins = db.query(User).filter(User.role == "admin").count()
    total_events = db.query(Event).count()
    total_quizzes = db.query(Quiz).count()
    total_attempts = db.query(QuizAttempt).count()
    total_materials = db.query(StudyMaterial).count() if scope == "full" else 0
    total_courses = db.query(Course).count() if scope == "full" else 0
    total_topics = db.query(StudyTopic).count() if scope == "full" else 0
    completed_topics = db.query(StudyTopic).filter(StudyTopic.is_completed == True).count() if scope == "full" else 0

    # Average quiz score
    avg_score = db.query(func.avg(QuizAttempt.score)).filter(
        QuizAttempt.submitted_at.is_not(None)
    ).scalar()
    average_score = round(float(avg_score), 2) if avg_score else 0

    return {
        "totalStudents": total_students,
        "approvedStudents": approved_students,
        "pendingApprovals": pending_approvals,
        "totalEvents": total_events,
        "totalMaterials": total_materials,
        "averageQuizScore": average_score,
        "users": {
            "total_students": total_students,
            "total_admins": total_admins,
            "total_users": total_students + total_admins
        },
        "content": {
            "total_materials": total_materials,
            "total_quizzes": total_quizzes,
            "total_quiz_attempts": total_attempts
        },
        "planner": {
            "total_courses": total_courses,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "pending_topics": total_topics - completed_topics
        },
        "performance": {
            "average_quiz_score": average_score
        }
    }

# ========== DELETE A STUDENT ==========
@router.delete("/students/{user_id}")
async def delete_student(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Prevent deleting yourself
    if student.id == admin.id: #type:ignore
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    # Delete dependent records before the student-owned parent records.
    db.query(QuizAttempt).filter(QuizAttempt.user_id == student.id).delete()
    quiz_ids = [
        quiz_id
        for (quiz_id,) in db.query(Quiz.id)
        .filter(Quiz.owner_id == student.id)
        .all()
    ]
    if quiz_ids:
        db.query(QuizAttempt).filter(QuizAttempt.quiz_id.in_(quiz_ids)).delete(
            synchronize_session=False
        )
        db.query(Quiz).filter(Quiz.id.in_(quiz_ids)).delete(
            synchronize_session=False
        )
    db.query(StudyMaterial).filter(StudyMaterial.owner_id == student.id).delete()
    db.query(StudyPlan).filter(StudyPlan.user_id == student.id).delete()
    course_ids = [
        course_id
        for (course_id,) in db.query(Course.id)
        .filter(Course.user_id == student.id)
        .all()
    ]
    if course_ids:
        db.query(StudyTopic).filter(
            StudyTopic.course_id.in_(course_ids)
        ).delete(synchronize_session=False)
        db.query(Course).filter(Course.id.in_(course_ids)).delete(
            synchronize_session=False
        )

    # Finally delete the student
    db.delete(student)
    db.commit()

    return {
        "message": f"Student '{student.full_name}' has been deleted successfully"
    }

# ========== APPROVE A STUDENT ==========
@router.put("/students/{user_id}/approve")
async def approve_student(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.is_approved = True #type: ignore
    create_notification(
        db,
        user_id=student.id,
        kind="account_approved",
        title="Account approved",
        message="Your BUK Campus Assistant account has been approved.",
        dedupe_key=f"account-approved:{student.id}",
    )
    db.commit()

    email_sent = True
    try:
        await send_approval_email(
            recipient=student.email, # type: ignore
            full_name=student.full_name,
        )
    except Exception:
        email_sent = False
        logger.exception("Student approved but notification email failed for user %s", student.id)

    return {
        "message": (
            f"Student '{student.full_name}' has been approved"
            if email_sent
            else f"Student '{student.full_name}' has been approved, but the notification email could not be sent"
        ),
        "is_approved": True,
        "email_sent": email_sent,
    }


# ========== DEACTIVATE A STUDENT ==========
@router.put("/students/{user_id}/deactivate")
async def deactivate_student(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.id == admin.id:  # type: ignore
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself")

    student.is_active = False #type: ignore
    db.commit()

    return {
        "message": f"Student '{student.full_name}' has been deactivated",
        "is_active": False
    }

# ========== ACTIVATE A STUDENT ==========
@router.put("/students/{user_id}/activate")
async def activate_student(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == user_id, User.role == "student").first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.is_active = True #type: ignore
    db.commit()

    return {
        "message": f"Student '{student.full_name}' has been activated",
        "is_active": True
    }

# ========== GET PENDING APPROVALS ==========
@router.get("/students/pending")
async def get_pending_students(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    pending = db.query(User).filter(
        User.role == "student",
        User.is_approved == False
    ).all()

    return {
        "total_pending": len(pending),
        "students": [
            {
                "id": s.id,
                "full_name": s.full_name,
                "email": s.email,
                "registration_number": s.registration_number,
                "faculty": s.faculty,
                "department": s.department,
                "level": s.level,
                "is_approved": s.is_approved is True,
                "is_active": s.is_active is not False,
                "created_at": s.created_at
            } for s in pending
        ]
    }

@router.delete("/students/{user_id}/reject")
async def reject_student(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(
        User.id == user_id,
        User.role == "student",
        User.is_approved == False
    ).first()

    if not student:
        raise HTTPException(
            status_code=404, 
            detail="Pending student not found or already approved"
        )

    # Delete the pending student
    db.delete(student)
    db.commit()

    return {
        "message": f"Student '{student.full_name}' has been rejected and removed"
    }
