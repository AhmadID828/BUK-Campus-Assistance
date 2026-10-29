import asyncio
import json
import tempfile
import unittest
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi import BackgroundTasks, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.ai.llm_service import (
    LLMService,
    _post_json,
    clean_chat_response,
    generate_answer,
    get_embedding,
    semantic_embeddings_enabled,
)
from app.ai.campus_qa import answer_campus_question, is_campus_intent
from app.ai.rag_service import RAGService
from app.models.auth_rate_limit import AuthRateLimit
from app.models.campus_location import CampusLocation
from app.models.emergency_contact import EmergencyContact
from app.models.event import Event
from app.models.faq import FAQ
from app.models.notification import Notification
from app.models.study_material import StudyMaterial
from app.models.user import User
from app.routers import admin, auth, chat, emergency, events, faqs, materials, planner, quiz
from app.schemas.user import AdminCreate, AdminStudentUpdate, UserCreate, UserLogin
from app.config import validate_jwt_secrets
from app.utils.auth import password_validation_errors
from app.utils.dependencies import get_current_user, get_super_admin
from app.utils.email import send_approval_email, send_email
from app.utils.rate_limit import enforce_rate_limit, make_rate_limit_key


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows
        self.conditions = ()

    def filter(self, *conditions):
        self.conditions = conditions
        return self

    def order_by(self, *expressions):
        return self

    def first(self):
        for row in self.rows:
            if all(
                getattr(row, condition.left.name)
                == getattr(condition.right, "value", True)
                for condition in self.conditions
            ):
                return row
        return None

    def all(self):
        return [
            row
            for row in self.rows
            if all(
                getattr(row, condition.left.name)
                == getattr(condition.right, "value", True)
                for condition in self.conditions
            )
        ]


class FakeQuizDB:
    def __init__(self, material):
        self.material = material
        self.saved = []

    def query(self, model):
        return FakeQuery([self.material] if model is StudyMaterial else [])

    def add(self, row):
        self.saved.append(row)

    def commit(self):
        pass

    def refresh(self, row):
        row.id = 27


class FakeEmergencyDB:
    def __init__(self, students):
        self.students = students

    def query(self, model):
        return FakeQuery(self.students if model is User else [])


class FakeFAQDB:
    def __init__(self, faqs):
        self.faqs = faqs

    def query(self, model):
        return FakeQuery(self.faqs)


class FakeCampusQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *conditions):
        return self

    def order_by(self, *expressions):
        return self

    def limit(self, count):
        return self

    def all(self):
        return self.rows


class FakeCampusDB:
    def __init__(self, rows_by_model=None):
        self.rows_by_model = rows_by_model or {}

    def query(self, model):
        return FakeCampusQuery(self.rows_by_model.get(model, []))


class FakePlannerQuery:
    def __init__(self, row):
        self.row = row

    def filter(self, *conditions):
        return self

    def first(self):
        return self.row


class FakePlannerDB:
    def __init__(self, course):
        self.course = course
        self.saved = []

    def query(self, model):
        return FakePlannerQuery(self.course if model is planner.Course else None)

    def add(self, row):
        self.saved.append(row)

    def commit(self):
        pass

    def refresh(self, row):
        row.id = 31


class PasswordStrengthTests(unittest.TestCase):
    def test_password_policy_rejects_weak_passwords(self):
        errors = password_validation_errors("Aa1!abc")

        self.assertEqual(errors, ["at least 8 characters"])

    def test_password_policy_accepts_strong_password(self):
        self.assertEqual(password_validation_errors("StrongPass123!"), [])

    def test_password_policy_accepts_eight_character_password(self):
        self.assertEqual(password_validation_errors("Aa1!abcd"), [])

    def test_password_policy_rejects_password_over_bcrypt_byte_limit(self):
        errors = password_validation_errors("Aa1!" + "é" * 35)

        self.assertIn("no more than 72 UTF-8 bytes", errors)

    def test_registration_rejects_weak_password_before_database_access(self):
        user_data = UserCreate(
            full_name="Student Name",
            email="student@example.com",
            password="weak",
            registration_number="BUK/2026/001",
            faculty="Computing",
            department="Computer Science",
            level=100,
        )

        with self.assertRaises(HTTPException) as raised:
            auth.register(user_data, db=None) #type:ignore[arg-type]

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("at least 8 characters", raised.exception.detail)


class JwtSecretConfigurationTests(unittest.TestCase):
    def test_accepts_distinct_secrets_with_at_least_32_bytes(self):
        secret_key = "a" * 32
        refresh_secret_key = "b" * 32

        self.assertEqual(
            validate_jwt_secrets(secret_key, refresh_secret_key),
            (secret_key, refresh_secret_key),
        )

    def test_rejects_missing_or_short_secrets(self):
        for secret_key, refresh_secret_key in (
            (None, "b" * 32),
            ("a" * 32, None),
            ("short", "b" * 32),
            ("a" * 32, "short"),
        ):
            with self.subTest(secret_key=secret_key, refresh_secret_key=refresh_secret_key):
                with self.assertRaisesRegex(RuntimeError, "at least 32 bytes"):
                    validate_jwt_secrets(secret_key, refresh_secret_key)

    def test_rejects_reusing_the_same_secret(self):
        secret = "a" * 32

        with self.assertRaisesRegex(RuntimeError, "must be different"):
            validate_jwt_secrets(secret, secret)


class ChatResponseFormattingTests(unittest.TestCase):
    def test_html_like_line_breaks_are_rendered_as_plain_text(self):
        self.assertEqual(
            clean_chat_response("First point<br>Second point</br>"),
            "First point\nSecond point",
        )

    def test_markup_and_entities_are_cleaned_without_losing_text(self):
        self.assertEqual(
            clean_chat_response("<p>Use &lt; and &gt; carefully.</p><p>Next</p>"),
            "Use < and > carefully.\n\nNext",
        )


class ProfileUpdateTests(unittest.TestCase):
    def test_profile_update_changes_only_the_level(self):
        account = SimpleNamespace(
            id=1,
            email="student@example.com",
            level=300,
            role="student",
        )

        class ProfileDB:
            def commit(self):
                pass

            def refresh(self, row):
                pass

        response = auth.update_profile(
            auth.ProfileUpdate(level=400),
            current_user=account,
            db=ProfileDB(),  # type: ignore[arg-type]
        )

        self.assertEqual(response["user"].level, 400)
        self.assertEqual(response["user"].email, "student@example.com")

    def test_profile_update_rejects_levels_outside_the_supported_choices(self):
        with self.assertRaises(ValidationError):
            auth.ProfileUpdate(level=650)


class AccountEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_resend_email_uses_https_api_and_configured_sender(self):
        response = httpx.Response(
            200,
            json={"id": "email-id"},
            request=httpx.Request("POST", "https://api.resend.com/emails"),
        )
        client = MagicMock()
        client.post = AsyncMock(return_value=response)
        client_context = MagicMock()
        client_context.__aenter__ = AsyncMock(return_value=client)
        client_context.__aexit__ = AsyncMock(return_value=None)

        with patch.dict(
            "os.environ",
            {
                "EMAIL_PROVIDER": "resend",
                "RESEND_API_KEY": "test-api-key",
                "RESEND_FROM_EMAIL": "BUK Assistant <noreply@example.test>",
            },
            clear=True,
        ), patch("app.utils.email.httpx.AsyncClient", return_value=client_context) as client_factory:
            await send_email(
                "student@example.test",
                "Reset your password",
                "<p>Reset link</p>",
            )

        client_factory.assert_called_once()
        self.assertEqual(client.post.call_args.args[0], "https://api.resend.com/emails")
        self.assertEqual(
            client.post.call_args.kwargs["headers"]["Authorization"],
            "Bearer test-api-key",
        )
        self.assertEqual(
            client.post.call_args.kwargs["json"],
            {
                "from": "BUK Assistant <noreply@example.test>",
                "to": ["student@example.test"],
                "subject": "Reset your password",
                "html": "<p>Reset link</p>",
            },
        )

    async def test_resend_rejection_surfaces_provider_error_without_credentials(self):
        response = httpx.Response(
            403,
            json={"message": "Sender domain is not verified"},
            request=httpx.Request("POST", "https://api.resend.com/emails"),
        )
        client = MagicMock()
        client.post = AsyncMock(return_value=response)
        client_context = MagicMock()
        client_context.__aenter__ = AsyncMock(return_value=client)
        client_context.__aexit__ = AsyncMock(return_value=None)

        with patch.dict(
            "os.environ",
            {
                "EMAIL_PROVIDER": "resend",
                "RESEND_API_KEY": "test-api-key",
                "RESEND_FROM_EMAIL": "noreply@example.test",
            },
            clear=True,
        ), patch("app.utils.email.httpx.AsyncClient", return_value=client_context), patch(
            "app.utils.email.fast_mail", None
        ):
            with self.assertRaisesRegex(RuntimeError, "Sender domain is not verified"):
                await send_email(
                    "student@example.test",
                    "Reset your password",
                    "<p>Reset link</p>",
                )

    async def test_resend_failure_falls_back_to_configured_gmail(self):
        response = httpx.Response(
            403,
            json={"message": "Sender domain is not verified"},
            request=httpx.Request("POST", "https://api.resend.com/emails"),
        )
        client = MagicMock()
        client.post = AsyncMock(return_value=response)
        client_context = MagicMock()
        client_context.__aenter__ = AsyncMock(return_value=client)
        client_context.__aexit__ = AsyncMock(return_value=None)
        smtp_client = MagicMock()
        smtp_client.send_message = AsyncMock()

        with patch.dict(
            "os.environ",
            {
                "EMAIL_PROVIDER": "resend",
                "RESEND_API_KEY": "test-api-key",
                "RESEND_FROM_EMAIL": "noreply@example.test",
            },
            clear=True,
        ), patch("app.utils.email.httpx.AsyncClient", return_value=client_context), patch(
            "app.utils.email.fast_mail", smtp_client
        ):
            await send_email(
                "student@example.test",
                "Reset your password",
                "<p>Reset link</p>",
            )

        smtp_client.send_message.assert_awaited_once()

    async def test_reset_email_retries_once_after_smtp_connection_timeout(self):
        with patch(
            "app.routers.auth.send_reset_email",
            new_callable=AsyncMock,
            side_effect=[
                RuntimeError("Timed out connecting to smtp.gmail.com on port 587"),
                None,
            ],
        ) as send_email, patch("app.routers.auth.asyncio.sleep", new_callable=AsyncMock):
            await auth.send_reset_email_in_background(
                "student@example.test",
                "https://study.example.test/reset-password?token=opaque",
            )

        self.assertEqual(send_email.await_count, 2)

    def test_admin_student_update_accepts_supported_level(self):
        payload = AdminStudentUpdate(
            full_name="Student Name",
            email="student@example.com",
            level=300,
        )

        self.assertEqual(payload.level, 300)

    def test_admin_student_update_rejects_unsupported_level(self):
        with self.assertRaises(ValidationError):
            AdminStudentUpdate(
                full_name="Student Name",
                email="student@example.com",
                level=350,
            )

    def test_login_finds_existing_admin_email_without_case_sensitivity(self):
        account = SimpleNamespace(
            id=1,
            full_name="Chief Administrator",
            email="Admin@buk.edu.ng",
            password_hash="stored-hash",
            registration_number=None,
            faculty=None,
            role="admin",
            is_approved=True,
            is_active=True,
            department=None,
            level=None,
        )

        class LoginQuery:
            condition = None

            def filter(self, condition):
                self.condition = condition
                return self

            def first(self):
                return account

        query = LoginQuery()
        db = SimpleNamespace(query=lambda model: query)
        credentials = UserLogin(email="admin@buk.edu.ng", password="ValidPass123!")

        with patch("app.routers.auth.enforce_rate_limit"), patch(
            "app.routers.auth.clear_rate_limit"
        ), patch("app.routers.auth.verify_password", return_value=True), patch(
            "app.routers.auth.create_access_token", return_value="access"
        ), patch("app.routers.auth.create_refresh_token", return_value="refresh"):
            response = auth.login(
                SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
                credentials,
                db,
            ) # type: ignore[arg-type]

        self.assertIn("lower(users.email)", str(query.condition).lower())
        self.assertEqual(response["user"]["email"], "Admin@buk.edu.ng")
        self.assertEqual(response["user"]["role"], "admin")
        self.assertNotIn("password_setup_required", response)

    def test_temporary_admin_login_returns_only_password_setup_token(self):
        account = SimpleNamespace(
            id=22,
            full_name="Additional Admin",
            email="new.admin@example.com",
            password_hash="temporary-hash",
            role="admin",
            is_approved=True,
            is_active=True,
            must_change_password=True,
            registration_number=None,
            faculty=None,
            department=None,
            level=None,
        )

        class LoginQuery:
            def filter(self, condition):
                return self

            def first(self):
                return account

        credentials = UserLogin(email=account.email, password="Temporary!123")
        with patch("app.routers.auth.enforce_rate_limit"), patch(
            "app.routers.auth.clear_rate_limit"
        ), patch("app.routers.auth.verify_password", return_value=True), patch(
            "app.routers.auth.jwt.encode", return_value="setup-token"
        ), patch("app.routers.auth.create_access_token") as create_access, patch(
            "app.routers.auth.create_refresh_token"
        ) as create_refresh:
            response = auth.login(
                SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
                credentials,
                SimpleNamespace(query=lambda model: LoginQuery()),
            )  # type: ignore[arg-type]

        self.assertTrue(response["password_setup_required"])
        self.assertEqual(response["password_setup_token"], "setup-token")
        self.assertNotIn("access_token", response)
        self.assertNotIn("refresh_token", response)
        create_access.assert_not_called()
        create_refresh.assert_not_called()

    def test_temporary_admin_password_setup_token_expires_after_24_hours(self):
        account = SimpleNamespace(
            id=22,
            full_name="Additional Admin",
            email="new.admin@example.com",
            password_hash="temporary-hash",
            role="admin",
            is_approved=True,
            is_active=True,
            must_change_password=True,
            registration_number=None,
            faculty=None,
            department=None,
            level=None,
        )

        class LoginQuery:
            def filter(self, condition):
                return self

            def first(self):
                return account

        encoded_payload = {}
        now = datetime.utcnow()

        def capture_token(payload, secret, algorithm):
            encoded_payload.update(payload)
            return "setup-token"

        credentials = UserLogin(email=account.email, password="Temporary!123")
        with patch("app.routers.auth.enforce_rate_limit"), patch(
            "app.routers.auth.clear_rate_limit"
        ), patch("app.routers.auth.verify_password", return_value=True), patch(
            "app.routers.auth.datetime"
        ) as mocked_datetime, patch(
            "app.routers.auth.jwt.encode", side_effect=capture_token
        ):
            mocked_datetime.utcnow.return_value = now
            auth.login(
                SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
                credentials,
                SimpleNamespace(query=lambda model: LoginQuery()),
            )  # type: ignore[arg-type]

        self.assertEqual(encoded_payload["type"], "admin_password_setup")
        self.assertEqual(encoded_payload["exp"], now + timedelta(hours=24))

    def test_temporary_admin_can_set_a_new_password_once(self):
        account = SimpleNamespace(
            email="new.admin@example.com",
            role="admin",
            is_active=True,
            must_change_password=True,
            password_hash="temporary-hash",
        )

        class SetupQuery:
            def filter(self, condition):
                return self

            def first(self):
                return account

        class SetupDB:
            def query(self, model):
                return SetupQuery()

            def commit(self):
                self.committed = True

        db = SetupDB()
        request = auth.InitialAdminPasswordChangeRequest(
            setup_token="valid-setup-token",
            password="SecureAdmin!456",
        )
        with patch(
            "app.routers.auth.jwt.decode",
            return_value={
                "sub": account.email,
                "type": "admin_password_setup",
            },
        ), patch("app.routers.auth.verify_password", return_value=False), patch(
            "app.routers.auth.hash_password", return_value="new-password-hash"
        ):
            result = auth.complete_admin_password_setup(request, db)  # type: ignore[arg-type]

        self.assertFalse(account.must_change_password)
        self.assertEqual(account.password_hash, "new-password-hash")
        self.assertTrue(db.committed)
        self.assertIn("Sign in", result["message"])

    def test_admin_password_setup_token_cannot_be_reused(self):
        account = SimpleNamespace(
            email="new.admin@example.com",
            role="admin",
            is_active=True,
            must_change_password=False,
            password_hash="new-password-hash",
        )

        class SetupQuery:
            def filter(self, condition):
                return self

            def first(self):
                return account

        request = auth.InitialAdminPasswordChangeRequest(
            setup_token="replayed-setup-token",
            password="SecureAdmin!456",
        )
        with patch(
            "app.routers.auth.jwt.decode",
            return_value={
                "sub": account.email,
                "type": "admin_password_setup",
            },
        ):
            with self.assertRaises(HTTPException) as raised:
                auth.complete_admin_password_setup(
                    request,
                    SimpleNamespace(query=lambda model: SetupQuery()),  # type: ignore[arg-type]
                )

        self.assertEqual(raised.exception.status_code, 400)

    def test_only_designated_system_admin_can_manage_admins(self):
        approved_admin = SimpleNamespace(email="Admin@buk.edu.ng", role="admin")
        self.assertIs(get_super_admin(approved_admin), approved_admin)

        with self.assertRaises(HTTPException) as raised:
            get_super_admin(SimpleNamespace(email="other-admin@example.com", role="admin"))

        self.assertEqual(raised.exception.status_code, 403)

    async def test_system_admin_can_create_another_admin(self):
        created = []

        class AdminQuery:
            def filter(self, *conditions):
                return self

            def first(self):
                return None

        class AdminDB:
            def query(self, model):
                return AdminQuery()

            def add(self, user):
                created.append(user)

            def commit(self):
                pass

            def refresh(self, user):
                user.id = 22

        system_admin = SimpleNamespace(email="admin@buk.edu.ng", role="admin")
        payload = AdminCreate(
            full_name="Additional Admin",
            email="New.Admin@example.com",
            password="StrongPass123!",
        )

        with patch("app.routers.admin.hash_password", return_value="hashed-password"):
            result = await admin.create_admin_account(payload, system_admin, AdminDB())

        self.assertEqual(result["admin"]["email"], "new.admin@example.com")
        self.assertEqual(created[0].role, "admin")
        self.assertTrue(created[0].is_approved)
        self.assertTrue(created[0].is_active)
        self.assertTrue(created[0].must_change_password)

    async def test_admin_registration_rejects_case_variant_duplicate_email(self):
        existing_admin = SimpleNamespace(email="Admin@buk.edu.ng")

        class ExistingAdminQuery:
            def filter(self, condition):
                self.condition = condition
                return self

            def first(self):
                return existing_admin

        query = ExistingAdminQuery()
        db = SimpleNamespace(query=lambda model: query)
        payload = AdminCreate(
            full_name="Duplicate Chief Admin",
            email="ADMIN@buk.edu.ng",
            password="StrongPass123!",
        )

        with self.assertRaises(HTTPException) as raised:
            await admin.create_admin_account(
                payload,
                SimpleNamespace(email="admin@buk.edu.ng", role="admin"),
                db, # type: ignore[arg-type]
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("lower(users.email)", str(query.condition).lower())

    async def test_system_admin_can_remove_and_reactivate_an_admin(self):
        additional_admin = SimpleNamespace(
            id=22,
            full_name="Additional Admin",
            email="additional@example.test",
            role="admin",
            is_active=True,
        )
        query = FakeQuery([additional_admin])
        commits = []
        db = SimpleNamespace(
            query=lambda model: query,
            commit=lambda: commits.append(True),
        )
        chief_admin = SimpleNamespace(email="admin@buk.edu.ng", role="admin")

        result = await admin.remove_admin_account(22, chief_admin, db) # type: ignore[arg-type]

        self.assertFalse(additional_admin.is_active)
        self.assertEqual(len(commits), 1)
        self.assertIn("records were retained", result["message"])

        await admin.reactivate_admin_account(22, chief_admin, db) # type: ignore[arg-type]

        self.assertTrue(additional_admin.is_active)
        self.assertEqual(len(commits), 2)

    async def test_chief_admin_cannot_remove_own_account(self):
        chief_admin = SimpleNamespace(
            id=1,
            email="Admin@buk.edu.ng",
            role="admin",
            is_active=True,
        )
        query = FakeQuery([chief_admin])
        db = SimpleNamespace(query=lambda model: query, commit=lambda: None)

        with self.assertRaises(HTTPException) as raised:
            await admin.remove_admin_account(1, chief_admin, db) # type: ignore[arg-type]

        self.assertEqual(raised.exception.status_code, 400)
        self.assertTrue(chief_admin.is_active)

    def test_deactivated_account_is_rejected_even_with_existing_token(self):
        inactive_user = SimpleNamespace(
            email="removed-admin@example.test",
            is_active=False,
        )
        db = SimpleNamespace(query=lambda model: FakeQuery([inactive_user]))

        with patch(
            "app.utils.dependencies.jwt.decode",
            return_value={"sub": inactive_user.email},
        ):
            with self.assertRaises(HTTPException) as raised:
                get_current_user("Bearer token", db) # type: ignore[arg-type]

        self.assertEqual(raised.exception.status_code, 403)

    async def test_approval_email_uses_deployed_frontend_url(self):
        with patch.dict("os.environ", {"FRONTEND_URL": "https://study.example.test/"}), patch(
            "app.utils.email.send_email", new_callable=AsyncMock
        ) as send_email, patch("app.routers.auth.enforce_rate_limit"):
            await send_approval_email("student@example.test", "Student Name")

        self.assertIn("https://study.example.test/login", send_email.call_args.kwargs["body"])

    async def test_approve_student_reports_notification_delivery(self):
        student = SimpleNamespace(
            id=12,
            role="student",
            is_approved=False,
            email="student@example.test",
            full_name="Student Name",
        )
        query = SimpleNamespace(
            filter=lambda *conditions: SimpleNamespace(first=lambda: student)
        )
        notification_query = SimpleNamespace(
            filter=lambda *conditions: SimpleNamespace(first=lambda: None)
        )
        added_notifications = []
        background_tasks = []

        class TestBackgroundTasks:
            def add_task(self, function, **kwargs):
                background_tasks.append((function, kwargs))

        db = SimpleNamespace(
            query=lambda model: query if model is User else notification_query,
            add=added_notifications.append,
            commit=lambda: None,
        )

        with patch("app.routers.admin.send_approval_email", new_callable=AsyncMock) as send:
            result = await admin.approve_student(
                user_id=12,
                background_tasks=TestBackgroundTasks(), #type:ignore
                admin=SimpleNamespace(id=1), #type:ignore
                db=db, #type:ignore
            )

            send.assert_not_awaited()
            self.assertEqual(len(background_tasks), 1)
            task, task_kwargs = background_tasks[0]
            await task(**task_kwargs)
            send.assert_awaited_once_with(
                recipient="student@example.test",
                full_name="Student Name",
            )
        self.assertTrue(student.is_approved)
        self.assertTrue(result["is_approved"])
        self.assertEqual(len(added_notifications), 1)
        self.assertIsInstance(added_notifications[0], Notification)
        self.assertEqual(added_notifications[0].kind, "account_approved")

    async def test_forgot_password_uses_deployed_frontend_url(self):
        user = SimpleNamespace(email="student@example.test")

        class ResetQuery:
            condition = None

            def filter(self, condition):
                self.condition = condition
                return self

            def first(self):
                return user

        query = ResetQuery()
        db = SimpleNamespace(query=lambda model: query)

        with patch(
            "app.routers.auth.get_frontend_url",
            return_value="https://study.example.test",
        ), patch(
            "app.routers.auth.send_reset_email", new_callable=AsyncMock
        ) as send_email, patch("app.routers.auth.enforce_rate_limit"):
            background_tasks = BackgroundTasks()
            result = await auth.forgot_password(
                auth.ForgotPasswordRequest(email="student@example.com"),
                background_tasks=background_tasks,
                http_request=SimpleNamespace(client=None),
                db=db, #type:ignore
            )
            send_email.assert_not_awaited()
            await background_tasks()

        self.assertIn("lower(users.email)", str(query.condition).lower())
        self.assertIn("https://study.example.test/reset-password?token=", send_email.call_args.args[1])
        self.assertIn("will arrive shortly", result["message"])


class CampusFAQChatTests(unittest.TestCase):
    def test_mixed_chat_recognizes_campus_faq_intent(self):
        self.assertTrue(is_campus_intent("How do I register?"))
        self.assertFalse(is_campus_intent("Explain recursion"))

    def test_material_search_excerpt_removes_postgres_highlight_tags(self):
        excerpt = chat._clean_search_excerpt(
            "<b>Installing</b> <b>illegal</b> software",
            "unused fallback",
        )

        self.assertEqual(excerpt, "Installing illegal software")

    def test_material_search_weights_use_postgres_char_literals(self):
        compiled = str(
            chat._weighted_material_search_vector().compile(
                dialect=postgresql.dialect()
            )
        )

        self.assertIn("""'A'::"char" """.strip(), compiled)
        self.assertIn("""'B'::"char" """.strip(), compiled)
        self.assertIn("""'C'::"char" """.strip(), compiled)
        self.assertNotIn("setweight_1", compiled)
        self.assertNotIn("setweight_2", compiled)
        self.assertNotIn("setweight_3", compiled)

    def test_campus_question_returns_published_faq_answer_directly(self):
        faq = SimpleNamespace(
            id=6,
            question="How do I register?",
            answer="Submit the registration form and await approval.",
            category="registration",
            is_active=True,
        )
        answer, sources = answer_campus_question(
            FakeCampusDB({FAQ: [faq]}), #type:ignore
            "How do I register?",
            provider="groq",
        )

        self.assertEqual(answer, faq.answer)
        self.assertEqual(sources, [{
            "type": "faq",
            "id": 6,
            "question": faq.question,
        }])

    def test_campus_events_come_from_active_upcoming_event_records(self):
        event = SimpleNamespace(
            id=4,
            title="Engineering Career Fair",
            event_date=date(2026, 11, 12),
            start_time="10:00",
            end_time="14:00",
            location="New Lecture Theatre",
            description="Meet employers and alumni.",
            category="Career",
            organizer="Faculty of Engineering",
            is_active=True,
        )

        answer, sources = answer_campus_question(
            FakeCampusDB({Event: [event]}), #type:ignore
            "What upcoming events are there?",
        )

        self.assertIn("Engineering Career Fair", answer)
        self.assertIn("Date: 2026-11-12", answer)
        self.assertIn("New Lecture Theatre", answer)
        self.assertEqual(sources, [{"type": "event", "id": 4, "title": event.title}])

    def test_campus_location_answer_uses_location_records(self):
        location = SimpleNamespace(
            id=3,
            name="Main Library",
            category="Library",
            description="The central campus library.",
            latitude=12.0,
            longitude=8.5,
        )
        answer, sources = answer_campus_question(
            FakeCampusDB({CampusLocation: [location]}), #type:ignore
            "Where is the Main Library?",
        )

        self.assertIn("The central campus library.", answer)
        self.assertIn("Coordinates: 12.0, 8.5", answer)
        self.assertEqual(sources, [{"type": "location", "id": 3, "name": location.name}])

    def test_campus_emergency_answer_uses_contact_records(self):
        contact = SimpleNamespace(
            id=8,
            name="Campus Security",
            category="Security",
            phone="08001234567",
            alternative_phone="08007654321",
            location="Main Gate",
            description="",
        )
        answer, sources = answer_campus_question(
            FakeCampusDB({EmergencyContact: [contact]}), #type:ignore
            "What is the emergency contact?",
        )

        self.assertIn("08001234567", answer)
        self.assertIn("Main Gate", answer)
        self.assertEqual(sources[0]["type"], "emergency_contact")
        self.assertEqual(sources[0]["id"], 8)

    def test_unmatched_campus_question_does_not_call_an_llm(self):
        answer, sources = answer_campus_question(
            FakeCampusDB(), "Who won the match?"
        )

        self.assertIn("couldn't find", answer)
        self.assertEqual(sources, [])


class PlannerTopicTests(unittest.IsolatedAsyncioTestCase):
    def test_plan_generation_without_pending_topics_does_not_replace_active_plan(self):
        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.order_by.return_value.all.return_value = []

        with self.assertRaises(HTTPException) as raised:
            planner.create_study_plan(
                db,
                SimpleNamespace(id=4),  # type: ignore[arg-type]
                title_prefix="Study Plan",
            )

        self.assertEqual(raised.exception.status_code, 400)
        db.query.assert_called_once_with(planner.StudyTopic)
        db.commit.assert_not_called()

    def test_plan_places_topics_before_their_course_exam(self):
        course = SimpleNamespace(exam_date=date(2026, 10, 24), course_code="CS201")
        topics = [
            SimpleNamespace(
                id=index,
                course_id=2,
                material_id=20 + index,
                course=course,
                title=f"Lecture {index}",
                estimated_hours=2,
                priority=2,
            )
            for index in range(1, 4)
        ]

        items = planner.build_plan_items(topics, date(2026, 10, 22))

        self.assertEqual(
            [item["date"] for item in items],
            ["2026-10-22", "2026-10-23", "2026-10-24"],
        )

    def test_plan_limits_combined_daily_study_time_to_six_hours(self):
        courses = [
            SimpleNamespace(exam_date=None, course_code=f"CS{index}")
            for index in range(3)
        ]
        topics = [
            SimpleNamespace(
                id=index,
                course_id=index,
                material_id=None,
                course=courses[index - 1],
                title=f"Topic {index}",
                estimated_hours=3,
                priority=2,
            )
            for index in range(1, 4)
        ]

        items = planner.build_plan_items(topics, date(2026, 10, 22))

        hours_by_date = {}
        for item in items:
            hours_by_date[item["date"]] = hours_by_date.get(item["date"], 0) + item["hours"]
        self.assertLessEqual(max(hours_by_date.values()), 6)

    def test_plan_schedules_weaker_quiz_materials_first_within_priority(self):
        course = SimpleNamespace(exam_date=None, course_code="CS201")
        topics = [
            SimpleNamespace(
                id=1,
                course_id=1,
                material_id=101,
                course=course,
                title="Strong quiz result",
                estimated_hours=4,
                priority=2,
            ),
            SimpleNamespace(
                id=2,
                course_id=1,
                material_id=102,
                course=course,
                title="Weak quiz result",
                estimated_hours=4,
                priority=2,
            ),
        ]

        items = planner.build_plan_items(
            topics,
            date(2026, 10, 22),
            quiz_scores={101: 90, 102: 35},
        )

        by_material = {item["material_id"]: item for item in items}
        self.assertLess(
            by_material[102]["date"],
            by_material[101]["date"],
        )
        self.assertEqual(by_material[102]["quiz_score"], 35)
        self.assertEqual(by_material[101]["quiz_score"], 90)
        self.assertEqual(by_material[102]["planning_priority"], 1)
        self.assertEqual(by_material[101]["planning_priority"], 3)

    def test_plan_schedules_long_topics_without_exceeding_the_deadline_loop(self):
        courses = [
            SimpleNamespace(exam_date=None, course_code="CS301"),
            SimpleNamespace(exam_date=None, course_code="CS302"),
        ]
        topics = [
            SimpleNamespace(
                id=1,
                course_id=1,
                material_id=None,
                course=courses[0],
                title="Long topic",
                estimated_hours=12,
                priority=1,
            ),
            SimpleNamespace(
                id=2,
                course_id=2,
                material_id=None,
                course=courses[1],
                title="Short topic",
                estimated_hours=2,
                priority=2,
            ),
        ]

        items = planner.build_plan_items(topics, date(2026, 10, 22))

        self.assertEqual([item["hours"] for item in items], [12, 2])
        self.assertNotEqual(items[0]["date"], items[1]["date"])

    async def test_add_topic_saves_priority_and_estimated_time(self):
        course = SimpleNamespace(id=2, user_id=4)
        db = FakePlannerDB(course)

        result = await planner.add_study_topic(
            course_id=2,
            payload={"title": "Recursion", "priority": 1, "estimated_hours": 3},
            user=SimpleNamespace(id=4), #type:ignore
            db=db, #type:ignore
        )

        self.assertEqual(result["topic_id"], 31)
        self.assertEqual(db.saved[0].title, "Recursion")
        self.assertEqual(db.saved[0].priority, 1)
        self.assertEqual(db.saved[0].estimated_hours, 3)

    async def test_delete_course_removes_topics_and_uploaded_materials(self):
        course = SimpleNamespace(
            id=12,
            course_code="CSC301",
        )
        materials = [
            SimpleNamespace(id=20, file_path="missing-upload-20.pdf"),
            SimpleNamespace(id=21, file_path="missing-upload-21.pdf"),
        ]
        plan = SimpleNamespace(
            plan_data=json.dumps([
                {"topic_id": 5, "date": "2026-10-24"},
                {"topic_id": 99, "date": "2026-10-25"},
            ]),
            start_date=None,
            end_date=None,
            is_active=True,
        )
        course_query = MagicMock()
        course_query.filter.return_value.first.return_value = course
        plan_query = MagicMock()
        plan_query.filter.return_value.all.return_value = [plan]
        topic_query = MagicMock()
        material_query = MagicMock()
        material_query.filter.return_value.all.return_value = materials
        material_query.filter.return_value.first.return_value = None
        topic_query.filter.return_value.all.return_value = [
            SimpleNamespace(id=5),
            SimpleNamespace(id=6),
        ]
        db = MagicMock()
        db.query.side_effect = lambda model: {
            planner.Course: course_query,
            planner.StudyPlan: plan_query,
            planner.StudyTopic: topic_query,
            StudyMaterial: material_query,
            StudyMaterial.id: material_query,
        }[model]

        with (
            patch("app.routers.planner.rag_service.delete_material"),
            patch("app.routers.planner.os.path.exists", return_value=False),
        ):
            result = await planner.delete_course(
                course_id=12,
                user=SimpleNamespace(id=4),  # type: ignore[arg-type]
                db=db,  # type: ignore[arg-type]
            )

        self.assertFalse(plan.is_active)
        self.assertEqual(
            json.loads(plan.plan_data),
            [{"topic_id": 99, "date": "2026-10-25"}],
        )
        topic_query.filter.return_value.delete.assert_called_once_with(
            synchronize_session=False
        )
        self.assertEqual(db.delete.call_count, 3)
        self.assertEqual(result["deleted_material_count"], 2)
        self.assertIn("materials were deleted", result["message"])

    async def test_add_topic_rejects_out_of_range_study_time(self):
        course = SimpleNamespace(id=2, user_id=4)
        with self.assertRaises(HTTPException) as raised:
            await planner.add_study_topic(
                course_id=2,
                payload={"title": "Recursion", "estimated_hours": 20},
                user=SimpleNamespace(id=4), #type:ignore
                db=FakePlannerDB(course), #type:ignore
            )

        self.assertEqual(raised.exception.status_code, 400)


class AISourceAndRagTests(unittest.TestCase):
    def test_provider_http_errors_include_safe_error_details(self):
        response = SimpleNamespace(
            status_code=401,
            reason_phrase="Unauthorized",
            json=lambda: {"error": {"message": "Invalid API key"}},
        )
        request = httpx.Request("POST", "https://api.example.test")
        status_error = httpx.HTTPStatusError(
            "Unauthorized",
            request=request,
            response=httpx.Response(401, request=request),
        )
        response.raise_for_status = lambda: (_ for _ in ()).throw(status_error)

        with patch("app.ai.llm_service.httpx.post", return_value=response):
            with self.assertRaisesRegex(RuntimeError, "HTTP 401.*Invalid API key"):
                _post_json("https://api.example.test", {})

    def test_search_with_sources_returns_source_title_and_excerpt(self):
        document = SimpleNamespace(
            metadata={"title": "Software Engineering", "subject": "SWE401"},
            page_content="Software engineering applies systematic methods to software.",
        )
        service = RAGService()
        service.get_user_vectorstore = lambda user_id: SimpleNamespace(  # type: ignore[method-assign]
            similarity_search=lambda query, k: [document]
        )

        context, sources = service.search_with_sources(9, "define software engineering", k=1)

        self.assertIn("Software Engineering (SWE401)", context)
        self.assertEqual(sources, [{
            "type": "study_material",
            "title": "Software Engineering",
            "subject": "SWE401",
            "excerpt": document.page_content,
        }])

    def test_search_failure_does_not_appear_as_retrieved_source(self):
        service = RAGService()
        service.get_user_vectorstore = lambda user_id: SimpleNamespace( # type: ignore[method-assign]
            similarity_search=lambda query, k: (_ for _ in ()).throw(
                RuntimeError("embedding model unavailable")
            )
        )

        with self.assertLogs("app.ai.rag_service", level="WARNING"):
            context, sources = service.search_with_sources(9, "plagiarism", k=1)

        self.assertEqual(context, "No semantic study-material matches are available.")
        self.assertEqual(sources, [])

    def test_groq_search_skips_semantic_index_for_full_text_fallback(self):
        service = RAGService()
        with (
            patch.dict("os.environ", {"LLM_PROVIDER": "groq"}, clear=False),
            patch.object(service, "get_user_vectorstore") as get_vectorstore,
        ):
            context, sources = service.search_with_sources(9, "plagiarism", k=1)

        get_vectorstore.assert_not_called()
        self.assertEqual(context, "No semantic study-material matches are available.")
        self.assertEqual(sources, [])

    def test_groq_uses_full_text_fallback_without_embedding_request(self):
        with (
            patch.dict("os.environ", {"LLM_PROVIDER": "groq"}, clear=False),
            patch("app.ai.llm_service._post_json") as post_json,
        ):
            with self.assertRaisesRegex(RuntimeError, "disabled for Groq"):
                get_embedding("plagiarism")

        post_json.assert_not_called()
        with patch.dict("os.environ", {"LLM_PROVIDER": "groq"}, clear=False):
            self.assertFalse(semantic_embeddings_enabled())

    def test_ollama_embedding_uses_nomic_model(self):
        with (
            patch.dict("os.environ", {"LLM_PROVIDER": "ollama"}, clear=False),
            patch("app.ai.llm_service.OLLAMA_EMBED_MODEL", "nomic-embed-text"),
            patch(
                "app.ai.llm_service._post_json",
                return_value={"embedding": [0.1, 0.2, 0.3]},
            ) as post_json,
        ):
            result = get_embedding("plagiarism")

        self.assertEqual(result, [0.1, 0.2, 0.3])
        self.assertEqual(post_json.call_args.args[1]["model"], "nomic-embed-text")
        self.assertTrue(semantic_embeddings_enabled())

    def test_user_vectorstores_are_separated(self):
        service = RAGService()
        created = []

        def fake_chroma(**kwargs):
            created.append(kwargs)
            return kwargs

        with tempfile.TemporaryDirectory() as directory:
            with patch("app.ai.rag_service.CHROMA_PATH", Path(directory)), patch(
                "app.ai.rag_service.Chroma", side_effect=fake_chroma
            ):
                service.get_user_vectorstore(11)
                service.get_user_vectorstore(12)

        self.assertNotEqual(
            created[0]["persist_directory"],
            created[1]["persist_directory"],
        )
        self.assertNotEqual(created[0]["collection_name"], created[1]["collection_name"])


class ChatTests(unittest.TestCase):
    def test_groq_retries_quiz_json_without_constrained_json_mode(self):
        first_response = httpx.Response(
            400,
            json={"error": {"message": "Failed to generate JSON. Please adjust your prompt."}},
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )
        retry_response = httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"content": '{"questions": []}'},
                        "finish_reason": "stop",
                    }
                ]
            },
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )

        with (
            patch("app.ai.llm_service.GROQ_API_KEY", "test-key"),
            patch(
                "app.ai.llm_service.httpx.post",
                side_effect=[first_response, retry_response],
            ) as post,
        ):
            response = generate_answer(
                "Return a JSON quiz.",
                provider="groq",
                response_format="json",
            )

        self.assertEqual(response, '{"questions": []}')
        self.assertEqual(post.call_count, 2)
        retry_payload = post.call_args.kwargs["json"]
        self.assertNotIn("response_format", retry_payload)
        self.assertIn("syntactically valid JSON only", retry_payload["messages"][0]["content"])

    def test_groq_completion_hides_reasoning_and_reserves_answer_tokens(self):
        with (
            patch("app.ai.llm_service.GROQ_API_KEY", "test-key"),
            patch(
                "app.ai.llm_service._post_json",
                return_value={
                    "choices": [
                        {
                            "message": {"content": "Software engineering is the systematic design and development of software."},
                            "finish_reason": "stop",
                        }
                    ]
                },
            ) as post_json,
        ):
            answer = generate_answer("What is software engineering?", provider="groq", max_tokens=128)

        self.assertIn("systematic design", answer)
        payload = post_json.call_args.args[1]
        self.assertEqual(payload["max_completion_tokens"], 512)
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(payload["reasoning_effort"], "low")
        self.assertEqual(payload["reasoning_format"], "hidden")

    def test_groq_empty_completion_reports_finish_reason(self):
        with (
            patch("app.ai.llm_service.GROQ_API_KEY", "test-key"),
            patch(
                "app.ai.llm_service._post_json",
                return_value={
                    "choices": [{"message": {"content": ""}, "finish_reason": "length"}]
                },
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "finish reason: length"):
                generate_answer("Question", provider="groq")

    def test_ollama_completion_extracts_labeled_final_answer(self):
        with patch(
            "app.ai.llm_service._post_json",
            return_value={"response": "<think>internal reasoning</think>Final Answer: concise response"},
        ):
            answer = generate_answer("Question", provider="ollama")

        self.assertEqual(answer, "concise response")

    def test_academic_chat_answers_briefly_without_material_matches(self):
        with (
            patch.object(chat.rag_service, "search_with_sources", return_value=("No relevant study materials found.", [])),
            patch.object(chat.llm_service, "get_response", return_value="Brief answer.") as generate,
        ):
            answer, sources = chat.answer_academic_question(
                SimpleNamespace(id=3, email="student@example.test"),
                "What is the exam date?",
                "groq",
                None,
            )

        self.assertEqual(answer, "Brief answer.")
        self.assertEqual(sources, [])
        generate.assert_called_once()
        prompt = generate.call_args.kwargs["message"]
        self.assertIn("general knowledge", prompt)
        self.assertIn("answer the student's actual question directly", prompt)
        self.assertIn("Do not refuse", prompt)
        self.assertNotIn("clearly say the answer is not covered", prompt)
        self.assertIn("No relevant uploaded study-material context was found.", prompt)
        self.assertEqual(generate.call_args.kwargs["max_tokens"], 128)

    def test_academic_chat_uses_more_relevant_material_context(self):
        sources = [{"type": "study_material", "title": "Algorithms"}]
        with (
            patch.object(chat.rag_service, "search_with_sources", return_value=("Relevant context", sources)) as search,
            patch.object(chat.llm_service, "get_response", return_value="Answer") as generate,
        ):
            answer, returned_sources = chat.answer_academic_question(
                SimpleNamespace(id=3, email="student@example.test"),
                "Explain the topic",
                "groq",
                None,
            )

        self.assertEqual(answer, "Answer")
        self.assertEqual(returned_sources, sources)
        self.assertEqual(search.call_args.kwargs["k"], 3)
        self.assertIn("Relevant context", generate.call_args.kwargs["message"])
        self.assertIn("no more than 2 short sentences", generate.call_args.kwargs["message"])
        self.assertEqual(generate.call_args.kwargs["max_tokens"], 128)

    def test_academic_chat_uses_full_text_fallback_when_vector_index_is_unavailable(self):
        fake_db = SimpleNamespace()
        with (
            patch.object(
                chat.rag_service,
                "search_with_sources",
                return_value=(
                    "AI indexing is unavailable.",
                    [{"type": "study_material", "title": "AI indexing unavailable"}],
                ),
            ),
            patch.object(
                chat,
                "func",
            ) as sqlalchemy_func,
            patch.object(chat, "StudyMaterial") as study_material,
            patch.object(chat.llm_service, "get_response", return_value="Answer") as generate,
        ):
            ts_query = object()
            rank = object()
            excerpt = "A graph is a set of vertices and edges."
            sqlalchemy_func.plainto_tsquery.return_value = ts_query
            sqlalchemy_func.ts_rank.return_value = rank
            sqlalchemy_func.ts_headline.return_value = excerpt
            study_material.search_vector.op.return_value = object()
            material = SimpleNamespace(
                title="Algorithms",
                subject="CSC301",
                content="A graph is a set of vertices and edges.",
            )
            query = MagicMock()
            query.filter.return_value = query
            query.order_by.return_value = query
            query.limit.return_value = query
            query.all.return_value = [(material, 1.0, excerpt)]
            fake_db.query = MagicMock(return_value=query)

            answer, sources = chat.answer_academic_question(
                SimpleNamespace(id=3, email="student@example.test"),
                "What is a graph?",
                "groq",
                None,
                db=fake_db,  # type: ignore[arg-type]
            )

        self.assertEqual(answer, "Answer")
        self.assertEqual(sources[0]["title"], "Algorithms")
        self.assertIn("A graph is a set of vertices and edges.", generate.call_args.kwargs["message"])
        self.assertEqual(sources[0]["subject"], "CSC301")

    def test_chat_completion_allows_the_requested_answer_length(self):
        service = LLMService()
        with patch(
            "app.ai.llm_service.generate_answer",
            return_value='{"answer":"A useful answer."}',
        ) as generate:
            answer = service.get_response("student", "Question", provider="groq")

        self.assertEqual(answer, "A useful answer.")
        self.assertEqual(generate.call_args.kwargs["max_tokens"], 256)
        self.assertNotIn("response_format", generate.call_args.kwargs)
        self.assertIn("follow the request's scope and style", generate.call_args.args[0])
        self.assertNotIn("use only the supplied study-material context", generate.call_args.args[0])

    def test_chat_completion_accepts_plain_text_response(self):
        service = LLMService()
        with patch(
            "app.ai.llm_service.generate_answer",
            return_value="Not found in the uploaded materials.",
        ) as generate:
            answer = service.get_response(
                "student",
                "Question",
                provider="groq",
                max_tokens=128,
            )

        self.assertEqual(answer, "Not found in the uploaded materials.")
        self.assertEqual(generate.call_args.kwargs["max_tokens"], 128)
        self.assertNotIn("response_format", generate.call_args.kwargs)


class FAQTests(unittest.IsolatedAsyncioTestCase):
    async def test_active_faqs_can_be_listed_without_a_user(self):
        faq = SimpleNamespace(
            id=1,
            question="Where is the library?",
            answer="Check the campus map.",
            category="navigation",
            related_location_id=None,
            is_active=True,
        )

        result = await faqs.list_faqs(db=FakeFAQDB([faq])) #type:ignore

        self.assertEqual(result["faqs"][0]["question"], faq.question)
        route = next(route for route in faqs.router.routes if route.path == "/faqs/")
        self.assertEqual(
            [dependency.name for dependency in route.dependant.dependencies],
            ["db"],
        )


class QuizTests(unittest.IsolatedAsyncioTestCase):
    async def test_completed_quizzes_are_hidden_but_attempt_history_is_preserved(self):
        completed_quiz = SimpleNamespace(
            id=1,
            title="Completed quiz",
            subject="CSC301",
            questions=[{}, {}],
            time_limit=120,
            created_at=None,
        )
        new_quiz = SimpleNamespace(
            id=2,
            title="New quiz",
            subject="CSC301",
            questions=[{}],
            time_limit=120,
            created_at=None,
        )
        completed_attempt = SimpleNamespace(
            quiz_id=1,
            user_id=4,
            is_completed=1,
            started_at=None,
            submitted_at=None,
            id=11,
        )
        quiz_query = MagicMock()
        quiz_query.filter.return_value.order_by.return_value.all.return_value = [
            completed_quiz,
            new_quiz,
        ]
        attempt_query = MagicMock()
        attempt_query.filter.return_value.order_by.return_value.all.return_value = [
            completed_attempt,
        ]
        db = MagicMock()
        db.query.side_effect = lambda model: {
            quiz.Quiz: quiz_query,
            quiz.QuizAttempt: attempt_query,
        }[model]

        response = await quiz.get_my_quizzes(
            user=SimpleNamespace(id=4),  # type: ignore[arg-type]
            db=db,  # type: ignore[arg-type]
        )

        self.assertEqual([item["quiz_id"] for item in response["quizzes"]], [2])
        self.assertEqual(completed_attempt.id, 11)

    def test_parse_generated_quiz_accepts_json_fenced_response(self):
        questions = [
            {
                "question": "What does an algorithm define?",
                "options": {
                    "A": "A sequence of steps",
                    "B": "A database",
                    "C": "A programming language",
                    "D": "A computer",
                },
                "correct_answer": "A",
                "explanation": "Algorithms describe ordered problem-solving steps.",
            }
        ]

        result = quiz.parse_generated_quiz(
            f"```json\n{json.dumps({'questions': questions})}\n```",
            expected_count=1,
        )

        self.assertEqual(result, questions)

    def test_parse_generated_quiz_rejects_incomplete_questions(self):
        with self.assertRaises(ValueError):
            quiz.parse_generated_quiz(
                json.dumps({"questions": [{"question": "Missing options"}]}),
                expected_count=1,
            )

    async def test_generate_quiz_saves_questions_for_material_owner(self):
        material = SimpleNamespace(
            id=5,
            owner_id=3,
            title="Algorithms",
            subject="CS201",
            content="Algorithms solve computational problems.",
        )
        questions = [
            {
                "question": f"Question {index}?",
                "options": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
                "correct_answer": "A",
                "explanation": "The notes state this.",
            }
            for index in range(3)
        ]
        db = FakeQuizDB(material)

        with patch(
            "app.routers.quiz.asyncio.to_thread",
            new=AsyncMock(return_value=json.dumps({"questions": questions})),
        ):
            result = await quiz.generate_quiz(
                material_id=5,
                user=SimpleNamespace(id=3), #type:ignore
                num_questions=3,
                provider="groq",
                db=db, #type:ignore
            )

        self.assertEqual(result["quiz_id"], 27)
        self.assertEqual(result["num_questions"], 3)
        self.assertEqual(db.saved[0].owner_id, 3)
        self.assertEqual(db.saved[0].questions, questions)

    async def test_generate_quiz_rejects_another_users_material(self):
        material = SimpleNamespace(
            id=5,
            owner_id=3,
            title="Algorithms",
            subject="CS201",
            content="Algorithms solve computational problems.",
        )
        with patch(
            "app.routers.quiz.asyncio.to_thread",
            new=AsyncMock(),
        ) as generate:
            with self.assertRaises(HTTPException) as raised:
                await quiz.generate_quiz(
                    material_id=5,
                    user=SimpleNamespace(id=4), #type:ignore
                    num_questions=3,
                    provider="groq",
                    db=FakeQuizDB(material), #type:ignore
                )

        self.assertEqual(raised.exception.status_code, 404)
        generate.assert_not_awaited()

    async def test_summarize_material_uses_selected_groq_provider(self):
        material = SimpleNamespace(
            id=5,
            owner_id=3,
            title="Algorithms",
            subject="CS201",
            content="Algorithms solve computational problems.",
        )

        with patch(
            "app.routers.materials.asyncio.to_thread",
            new=AsyncMock(return_value='{"summary":"Algorithms solve problems step by step."}'),
        ) as generate:
            result = await materials.summarize_material(
                material_id=5,
                provider="groq",
                user=SimpleNamespace(id=3), #type:ignore
                db=FakeQuizDB(material), #type:ignore
            )

        self.assertEqual(result["summary"], "Algorithms solve problems step by step.")
        self.assertEqual(generate.await_args.kwargs["provider"], "groq") #type:ignore
        self.assertEqual(generate.await_args.kwargs["timeout"], 120.0) #type:ignore
        self.assertNotIn("response_format", generate.await_args.kwargs) #type:ignore

    async def test_summarize_material_accepts_plain_text_ai_response(self):
        material = SimpleNamespace(
            id=5,
            owner_id=3,
            title="Algorithms",
            subject="CS201",
            content="Algorithms solve computational problems.",
        )

        with patch(
            "app.routers.materials.asyncio.to_thread",
            new=AsyncMock(return_value="Algorithms solve problems using ordered steps."),
        ) as generate:
            result = await materials.summarize_material(
                material_id=5,
                provider="groq",
                user=SimpleNamespace(id=3), #type:ignore
                db=FakeQuizDB(material), #type:ignore
            )

        self.assertEqual(result["summary"], "Algorithms solve problems using ordered steps.")
        self.assertNotIn("response_format", generate.await_args.kwargs) #type:ignore
        self.assertEqual(generate.await_args.args[2], 260) #type:ignore

    async def test_summarize_material_rejects_unknown_provider(self):
        material = SimpleNamespace(
            id=5,
            owner_id=3,
            title="Algorithms",
            subject="CS201",
            content="Algorithms solve computational problems.",
        )

        with self.assertRaises(HTTPException) as raised:
            await materials.summarize_material(
                material_id=5,
                provider="unknown",
                user=SimpleNamespace(id=3), #type:ignore
                db=FakeQuizDB(material), #type:ignore
            )

        self.assertEqual(raised.exception.status_code, 400)

    def test_scoring_handles_correct_incorrect_and_blank_answers(self):
        questions = [
            {"question": "Q1", "options": {}, "correct_answer": "A"},
            {"question": "Q2", "options": {}, "correct_answer": "B"},
            {"question": "Q3", "options": {}, "correct_answer": "C"},
        ]

        correct, score, review = quiz.score_quiz_answers(
            questions,
            {"0": "a", "1": "D"},
        )

        self.assertEqual(correct, 1)
        self.assertEqual(score, 33.33)
        self.assertEqual([item["is_correct"] for item in review], [True, False, False])


class UploadIndexingTests(unittest.TestCase):
    def _course_query(self):
        return SimpleNamespace(
            filter=lambda *conditions: SimpleNamespace(
                first=lambda: SimpleNamespace(
                    id=11,
                    course_code="CS201",
                    course_title="Computer Science",
                )
            )
        )

    def test_upload_response_surfaces_rag_indexing_failure(self):
        course = SimpleNamespace(
            id=11,
            course_code="CS201",
            course_title="Computer Science",
        )

        class FakeDB:
            def query(self, model):
                return SimpleNamespace(filter=lambda *conditions: SimpleNamespace(first=lambda: course))

            def add(self, material):
                self.material = material

            def commit(self):
                pass

            def refresh(self, material):
                material.id = 44

        with tempfile.TemporaryDirectory() as directory:
            upload_file = UploadFile(
                filename="lecture.pdf",
                file=BytesIO(b"sample pdf bytes"),
            )
            db = FakeDB()
            with (
                patch.object(materials, "UPLOAD_DIR", directory),
                patch.object(materials, "extract_text_from_file", return_value="Lecture text"),
                patch.object(materials, "semantic_embeddings_enabled", return_value=True),
                patch.object(materials.rag_service, "add_material", side_effect=RuntimeError("index unavailable")),
                patch.object(materials, "update_search_vector"),
                self.assertLogs("app.routers.materials", level="ERROR"),
            ):
                result = materials.upload_material(
                    file=upload_file,
                    title="Lecture",
                    course_id=11,
                    user=SimpleNamespace(id=2, full_name="Student"), #type:ignore
                    db=db, #type:ignore
                )

        self.assertFalse(result["rag_indexed"])
        self.assertTrue(result["full_text_indexed"])
        self.assertIn("full-text search", result["indexing_warning"])
        self.assertEqual(db.material.course_id, 11)
        self.assertEqual(db.material.subject, "CS201")
        self.assertEqual(result["course_code"], "CS201")

    def test_groq_upload_skips_semantic_index_and_keeps_full_text_search(self):
        course = SimpleNamespace(
            id=11,
            course_code="CS201",
            course_title="Computer Science",
        )

        class FakeDB:
            def query(self, model):
                return SimpleNamespace(filter=lambda *conditions: SimpleNamespace(first=lambda: course))

            def add(self, material):
                self.material = material

            def commit(self):
                pass

            def refresh(self, material):
                material.id = 44

        with tempfile.TemporaryDirectory() as directory:
            upload_file = UploadFile(
                filename="lecture.pdf",
                file=BytesIO(b"sample pdf bytes"),
            )
            db = FakeDB()
            with (
                patch.object(materials, "UPLOAD_DIR", directory),
                patch.object(materials, "extract_text_from_file", return_value="Lecture text"),
                patch.object(materials, "semantic_embeddings_enabled", return_value=False),
                patch.object(materials.rag_service, "add_material") as add_material,
                patch.object(materials, "update_search_vector"),
            ):
                result = materials.upload_material(
                    file=upload_file,
                    title="Lecture",
                    course_id=11,
                    user=SimpleNamespace(id=2, full_name="Student"), # type:ignore
                    db=db, # type:ignore
                )

        add_material.assert_not_called()
        self.assertFalse(result["rag_indexed"])
        self.assertTrue(result["full_text_indexed"])
        self.assertIn("disabled for Groq", result["indexing_warning"])

    def test_upload_accepts_files_at_five_megabytes(self):
        course = SimpleNamespace(
            id=11,
            course_code="CS201",
            course_title="Computer Science",
        )

        class FakeDB:
            def query(self, model):
                return SimpleNamespace(
                    filter=lambda *conditions: SimpleNamespace(first=lambda: course)
                )

            def add(self, material):
                self.material = material

            def commit(self):
                pass

            def refresh(self, material):
                material.id = 44

        with tempfile.TemporaryDirectory() as directory:
            upload_file = UploadFile(
                filename="large-lecture.pdf",
                file=BytesIO(b"x" * materials.MAX_UPLOAD_SIZE),
            )
            db = FakeDB()
            with (
                patch.object(materials, "UPLOAD_DIR", directory),
                patch.object(materials, "extract_text_from_file", return_value="Lecture text"),
                patch.object(materials, "semantic_embeddings_enabled", return_value=False),
                patch.object(materials, "update_search_vector"),
            ):
                result = materials.upload_material(
                    file=upload_file,
                    title="Large lecture",
                    course_id=11,
                    user=SimpleNamespace(id=2, full_name="Student"), # type: ignore
                    db=db, # type: ignore
                )

        self.assertEqual(result["material_id"], 44)
        self.assertTrue(result["full_text_indexed"])

    def test_upload_rejects_files_larger_than_five_megabytes(self):
        class FakeDB:
            def query(self, model):
                return UploadIndexingTests()._course_query()

            def add(self, material):
                self.fail("Oversized uploads must not be persisted")

        with tempfile.TemporaryDirectory() as directory:
            upload_file = UploadFile(
                filename="large.pdf",
                file=BytesIO(b"x" * (materials.MAX_UPLOAD_SIZE + 1)),
            )
            with patch.object(materials, "UPLOAD_DIR", directory):
                with self.assertRaises(HTTPException) as raised:
                    materials.upload_material(
                        file=upload_file,
                        title="Large document",
                        course_id=11,
                        user=SimpleNamespace(id=2, full_name="Student"), # type: ignore
                        db=FakeDB(), # type: ignore
                    )
                self.assertEqual(list(Path(directory).iterdir()), [])

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.detail, "Material file must be 5 MB or smaller.")


class EventRsvpStatisticsTests(unittest.TestCase):
    def test_admin_statistics_group_counts_and_names_by_event(self):
        rows = [
            (
                SimpleNamespace(id=1, event_id=8, status="going"),
                SimpleNamespace(id=3, full_name="Ada Student", email="ada@example.test", registration_number="A1"),
            ),
            (
                SimpleNamespace(id=2, event_id=8, status="maybe"),
                SimpleNamespace(id=4, full_name="Ben Student", email="ben@example.test", registration_number="B2"),
            ),
            (
                SimpleNamespace(id=3, event_id=8, status="going"),
                SimpleNamespace(id=5, full_name="Cy Student", email="cy@example.test", registration_number="C3"),
            ),
        ]

        class FakeQuery:
            def join(self, *args):
                return self

            def order_by(self, *args):
                return self

            def all(self):
                return rows

        class FakeDB:
            def query(self, *args):
                return FakeQuery()

        result = asyncio.run(
            events.get_rsvp_statistics(
                admin=SimpleNamespace(role="admin"), # type: ignore
                db=FakeDB(), # type: ignore
            )
        )

        self.assertEqual(
            result["events"][8]["counts"],
            {"going": 2, "maybe": 1, "not_going": 0},
        )
        self.assertEqual(
            [item["user"]["full_name"] for item in result["events"][8]["rsvps"]],
            ["Ada Student", "Ben Student", "Cy Student"],
        )


class EmergencyBroadcastTests(unittest.IsolatedAsyncioTestCase):
    async def test_broadcast_sends_only_to_active_students(self):
        students = [
            SimpleNamespace(id=1, role="student", is_active=True, email="active@example.test"),
            SimpleNamespace(id=2, role="student", is_active=False, email="inactive@example.test"),
            SimpleNamespace(id=3, role="admin", is_active=True, email="admin@example.test"),
        ]
        send_email = AsyncMock()

        with patch.object(emergency, "send_email", send_email):
            result = await emergency.broadcast_emergency_alert(
                payload={"title": "Safety alert", "message": "Use the east gate."},
                admin=SimpleNamespace(id=99), #type:ignore
                db=FakeEmergencyDB(students), #type:ignore
            )

        self.assertEqual(result["sent"], 1)
        self.assertEqual(result["failed"], [])
        send_email.assert_awaited_once()
        self.assertEqual(send_email.await_args.kwargs["recipient"], "active@example.test") #type:ignore


if __name__ == "__main__":
    unittest.main()
