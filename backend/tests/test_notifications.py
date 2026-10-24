import json
import unittest
from datetime import date, timedelta
from types import SimpleNamespace

from app.models.event import Event, EventRSVP
from app.models.notification import Notification
from app.models.planner import Course, StudyPlan, StudyTopic
from app.models.quiz import Quiz, QuizAttempt
from app.models.study_material import StudyMaterial
from app.routers.notifications import _sync_activity_notifications


class FakeQuery:
    def __init__(self, rows, filter_rows=False):
        self.rows = rows
        self.conditions = ()
        self.filter_rows = filter_rows

    def filter(self, *conditions):
        self.conditions = conditions
        return self

    def join(self, *_args):
        return self

    def order_by(self, *_args):
        return self

    def first(self):
        return next(iter(self.all()), None)

    def all(self):
        if not self.filter_rows:
            return self.rows
        return [
            row
            for row in self.rows
            if all(
                getattr(row, condition.left.name, None)
                == getattr(condition.right, "value", None)
                for condition in self.conditions
            )
        ]


class FakeNotificationDB:
    def __init__(self, plan, topics, event_rsvps):
        self.plan = plan
        self.topics = topics
        self.event_rsvps = event_rsvps
        self.notifications = []

    def query(self, *models):
        if models == (StudyPlan,):
            return FakeQuery([self.plan])
        if models == (StudyTopic,):
            return FakeQuery(self.topics)
        if models == (EventRSVP, Event):
            going_rsvps = [
                pair for pair in self.event_rsvps if pair[0].status == "going"
            ]
            return FakeQuery(going_rsvps)
        if models == (Notification,):
            return FakeQuery(self.notifications, filter_rows=True)
        raise AssertionError(f"Unexpected notification query: {models}")

    def add(self, notification):
        notification.id = len(self.notifications) + 1
        self.notifications.append(notification)


class ActivityNotificationTests(unittest.TestCase):
    def test_sync_creates_overdue_and_going_event_reminders_once(self):
        today = date.today()
        user = SimpleNamespace(id=5)
        plan = SimpleNamespace(
            id=12,
            plan_data=json.dumps([{
                "topic_id": 21,
                "date": (today - timedelta(days=1)).isoformat(),
            }]),
        )
        topic = SimpleNamespace(id=21, title="Algorithms", is_completed=False)
        going_event = SimpleNamespace(
            id=31,
            title="Campus seminar",
            event_date=today + timedelta(days=1),
            is_active=True,
        )
        maybe_event = SimpleNamespace(
            id=32,
            title="Optional workshop",
            event_date=today + timedelta(days=1),
            is_active=True,
        )
        event_rsvps = [
            (
                SimpleNamespace(user_id=user.id, status="going", event_id=going_event.id),
                going_event,
            ),
            (
                SimpleNamespace(user_id=user.id, status="maybe", event_id=maybe_event.id),
                maybe_event,
            ),
        ]
        db = FakeNotificationDB(plan, [topic], event_rsvps)

        _sync_activity_notifications(db, user) # type: ignore[arg-type]
        _sync_activity_notifications(db, user) # type: ignore[arg-type]

        self.assertEqual(
            {notice.kind for notice in db.notifications},
            {"planner_overdue", "event_reminder"},
        )
        self.assertEqual(len(db.notifications), 2)


if __name__ == "__main__":
    unittest.main()
