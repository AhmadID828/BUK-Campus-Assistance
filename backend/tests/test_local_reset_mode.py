import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from jose import jwt

from app.routers.auth import ForgotPasswordRequest, forgot_password
from app.utils.email import is_local_reset_mode


class FakeDatabase:
    def __init__(self, user):
        self.user = user

    def query(self, _model):
        return self

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.user


class LocalResetModeTests(unittest.TestCase):
    def test_allows_loopback_only_in_explicit_local_console_mode(self):
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "RESET_EMAIL_MODE": "console",
                "FRONTEND_URL": "http://localhost:5173",
            },
            clear=False,
        ):
            self.assertTrue(is_local_reset_mode("127.0.0.1"))
            self.assertTrue(is_local_reset_mode("::1"))
            self.assertFalse(is_local_reset_mode("192.168.1.10"))
            self.assertFalse(is_local_reset_mode(None))

    def test_disables_local_link_for_production_or_nonlocal_frontend(self):
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "RESET_EMAIL_MODE": "console",
                "FRONTEND_URL": "http://localhost:5173",
            },
            clear=False,
        ):
            self.assertFalse(is_local_reset_mode("127.0.0.1"))

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "RESET_EMAIL_MODE": "console",
                "FRONTEND_URL": "https://example.com",
            },
            clear=False,
        ):
            self.assertFalse(is_local_reset_mode("127.0.0.1"))

    def test_requires_console_mode(self):
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "RESET_EMAIL_MODE": "smtp",
                "FRONTEND_URL": "http://localhost:5173",
            },
            clear=False,
        ):
            self.assertFalse(is_local_reset_mode("127.0.0.1"))

    def test_forgot_password_returns_link_for_existing_local_account(self):
        secret = "local-test-secret"
        user = SimpleNamespace(email="student@example.com")
        request = SimpleNamespace(
            client=SimpleNamespace(host="127.0.0.1"),
        )

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "RESET_EMAIL_MODE": "console",
                "FRONTEND_URL": "http://localhost:5173",
            },
            clear=False,
        ), patch("app.routers.auth.SECRET_KEY", secret):
            result = asyncio.run(
                forgot_password(
                    ForgotPasswordRequest(email="student@example.com"),
                    request,
                    FakeDatabase(user),
                )
            )

        self.assertIn("development_reset_link", result)
        self.assertTrue(
            result["development_reset_link"].startswith(
                "http://localhost:5173/reset-password?token="
            )
        )
        token = result["development_reset_link"].split("token=", 1)[1]
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        self.assertEqual(payload["sub"], user.email)
        self.assertEqual(payload["type"], "password_reset")

    def test_forgot_password_does_not_return_link_for_unknown_local_account(self):
        request = SimpleNamespace(
            client=SimpleNamespace(host="127.0.0.1"),
        )
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "RESET_EMAIL_MODE": "console",
                "FRONTEND_URL": "http://localhost:5173",
            },
            clear=False,
        ):
            result = asyncio.run(
                forgot_password(
                    ForgotPasswordRequest(email="unknown@example.com"),
                    request,
                    FakeDatabase(None),
                )
            )

        self.assertNotIn("development_reset_link", result)


if __name__ == "__main__":
    unittest.main()
