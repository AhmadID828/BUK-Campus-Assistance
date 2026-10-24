import json
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event, EventRSVP
from app.models.notification import Notification
from app.models.planner import Course, StudyPlan, StudyTopic
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.utils.notifications import create_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)


def _sync_activity_notifications(db: Session, user: User) -> None:
    today = date.today()
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == user.id, StudyPlan.is_active.is_(True))
        .order_by(StudyPlan.created_at.desc())
        .first()
    )
    if plan:
        try:
            plan_items = json.loads(plan.plan_data or "[]")
        except (TypeError, json.JSONDecodeError):
            logger.exception("Invalid study plan data for user %s", user.id)
            plan_items = []

        topic_ids = [
            item.get("topic_id")
            for item in plan_items
            if isinstance(item, dict) and item.get("topic_id") is not None
        ]
        topics = (
            db.query(StudyTopic)
            .join(Course)
            .filter(StudyTopic.id.in_(topic_ids), Course.user_id == user.id)
            .all()
            if topic_ids
            else []
        )
        topics_by_id = {topic.id: topic for topic in topics}
        for item in plan_items:
            if not isinstance(item, dict):
                continue
            try:
                scheduled_date = date.fromisoformat(str(item.get("date", "")))
            except ValueError:
                logger.warning(
                    "Skipping invalid scheduled date in study plan %s for user %s",
                    plan.id,
                    user.id,
                )
                continue
            topic = topics_by_id.get(item.get("topic_id"))
            if scheduled_date >= today or topic is None or topic.is_completed:
                continue
            create_notification(
                db,
                user_id=user.id,
                kind="planner_overdue",
                title="Study task is overdue",
                message=(
                    f"{topic.title} was scheduled for {scheduled_date.isoformat()} "
                    "and was not marked complete by its due date."
                ),
                dedupe_key=f"planner-overdue:{plan.id}:{topic.id}:{scheduled_date.isoformat()}",
            )

    tomorrow = today + timedelta(days=1)
    rsvps = (
        db.query(EventRSVP, Event)
        .join(Event, Event.id == EventRSVP.event_id)
        .filter(
            EventRSVP.user_id == user.id,
            EventRSVP.status == "going",
            Event.event_date >= today,
            Event.event_date <= tomorrow,
            Event.is_active.is_(True),
        )
        .all()
    )
    for rsvp, event in rsvps:
        create_notification(
            db,
            user_id=user.id,
            kind="event_reminder",
            title=(
                "Event is today"
                if event.event_date == today
                else "Event reminder for tomorrow"
            ),
            message=f"You marked that you’re going to {event.title} on {event.event_date.isoformat()}.",
            dedupe_key=f"event-reminder:{event.id}:{event.event_date.isoformat()}",
        )


@router.get("/")
def get_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _sync_activity_notifications(db, user)
    db.commit()
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(50)
        .all()
    )
    unread_count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read_at.is_(None),
    ).count()
    return {
        "notifications": [
            {
                "id": item.id,
                "kind": item.kind,
                "title": item.title,
                "message": item.message,
                "created_at": item.created_at,
                "read_at": item.read_at,
            }
            for item in notifications
        ],
        "unread_count": unread_count,
    }


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unread = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read_at.is_(None),
    ).all()
    read_at = datetime.now(timezone.utc)
    for notification in unread:
        notification.read_at = read_at
    db.commit()
    return {"message": "Notifications marked as read", "updated": len(unread)}
