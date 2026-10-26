import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.auth_rate_limit import AuthRateLimit
from app.utils.rate_limit import enforce_rate_limit, make_rate_limit_key


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        AuthRateLimit.__table__.create(self.engine)
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_keys_are_deterministic_and_do_not_expose_identity(self):
        key = make_rate_limit_key("login", "127.0.0.1:student@example.test")

        self.assertEqual(
            key,
            make_rate_limit_key("login", "127.0.0.1:student@example.test"),
        )
        self.assertNotIn("student", key)
        self.assertNotIn("@", key)
        self.assertNotEqual(
            key,
            make_rate_limit_key("login", "127.0.0.2:student@example.test"),
        )

    def test_rejects_requests_after_limit_and_sets_retry_after(self):
        key = make_rate_limit_key("login", "127.0.0.1:student@example.test")

        enforce_rate_limit(self.session, key, limit=2, window_seconds=60)
        enforce_rate_limit(self.session, key, limit=2, window_seconds=60)

        with self.assertRaises(HTTPException) as raised:
            enforce_rate_limit(self.session, key, limit=2, window_seconds=60)

        self.assertEqual(raised.exception.status_code, 429)
        self.assertIn("Retry-After", raised.exception.headers)

    def test_allows_requests_after_window_expires(self):
        key = make_rate_limit_key("forgot-password", "127.0.0.1:student@example.test")
        enforce_rate_limit(self.session, key, limit=1, window_seconds=60)

        expired_at = datetime.now(timezone.utc) - timedelta(seconds=61)
        self.session.execute(
            text(
                """
                UPDATE auth_rate_limits
                SET window_started_at = :expired_at, updated_at = :now
                WHERE bucket_key = :bucket_key
                """
            ),
            {
                "expired_at": expired_at,
                "now": datetime.now(timezone.utc),
                "bucket_key": key,
            },
        )
        self.session.commit()

        enforce_rate_limit(self.session, key, limit=1, window_seconds=60)


if __name__ == "__main__":
    unittest.main()
