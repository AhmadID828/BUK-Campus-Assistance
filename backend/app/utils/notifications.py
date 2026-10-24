from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    kind: str,
    title: str,
    message: str,
    dedupe_key: str,
) -> Notification:
    existing = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.dedupe_key == dedupe_key,
    ).first()
    if existing:
        return existing

    notification = Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        message=message,
        dedupe_key=dedupe_key,
    )
    db.add(notification)
    return notification
