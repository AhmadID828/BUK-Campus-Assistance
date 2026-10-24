import html
import ipaddress
import logging
import os
from urllib.parse import urlsplit
from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType # type: ignore
import httpx

load_dotenv()

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_FROM_GMAIL = os.getenv("MAIL_FROM_GMAIL", MAIL_USERNAME)
MAIL_CONFIGURED = all((MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_GMAIL))
RESEND_API_URL = "https://api.resend.com/emails"
logger = logging.getLogger(__name__)

fast_mail = None
if MAIL_CONFIGURED:
    conf = ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME, #type:ignore
        MAIL_PASSWORD=MAIL_PASSWORD, #type:ignore
        MAIL_FROM=MAIL_FROM_GMAIL, #type:ignore
        MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )
    fast_mail = FastMail(conf)


def get_frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")


def is_local_reset_mode(client_host: str | None) -> bool:
    if (
        os.getenv("APP_ENV", "").strip().lower() != "development"
        or os.getenv("RESET_EMAIL_MODE", "smtp").strip().lower() != "console"
        or not client_host
    ):
        return False

    try:
        if not ipaddress.ip_address(client_host).is_loopback:
            return False
    except ValueError:
        return False

    frontend_host = urlsplit(get_frontend_url()).hostname
    return frontend_host in {"localhost", "127.0.0.1", "::1"}


async def send_email(recipient: str, subject: str, body: str) -> None:
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_sender = (
        os.getenv("RESEND_FROM_EMAIL", "").strip()
        or MAIL_FROM
        or ""
    ).strip()

    if provider not in {"", "resend", "smtp"}:
        raise RuntimeError(f"Unsupported email provider: {provider}")

    use_resend = provider == "resend" or (not provider and bool(resend_api_key))
    resend_error: Exception | None = None
    if use_resend:
        try:
            if not resend_api_key:
                raise RuntimeError("RESEND_API_KEY is not configured.")
            if not resend_sender:
                raise RuntimeError(
                    "Set RESEND_FROM_EMAIL or MAIL_FROM to a verified Resend sender."
                )

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=5.0)
            ) as client:
                response = await client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": resend_sender,
                        "to": [recipient],
                        "subject": subject,
                        "html": body,
                    },
                )
            if response.is_error:
                try:
                    error_data = response.json()
                except ValueError:
                    error_data = {}
                detail = error_data.get("message") if isinstance(error_data, dict) else None
                if not isinstance(detail, str) or not detail.strip():
                    detail = response.text.strip() or response.reason_phrase
                raise RuntimeError(
                    f"Resend rejected the email (HTTP {response.status_code}): "
                    f"{detail[:300]}"
                )
            return
        except (httpx.RequestError, RuntimeError) as exc:
            resend_error = exc
            logger.warning(
                "Resend email delivery failed; attempting configured Gmail fallback: %s",
                exc,
            )

    if fast_mail is None:
        if resend_error:
            raise RuntimeError(
                "Resend delivery failed and Gmail fallback is not configured. "
                f"Resend error: {resend_error}"
            ) from resend_error
        raise RuntimeError(
            "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL "
            "(or MAIL_FROM), or configure MAIL_USERNAME and MAIL_PASSWORD for Gmail fallback."
        )

    message = MessageSchema(
        subject=subject,
        recipients=[recipient], #type:ignore
        body=body,
        subtype=MessageType.html,
    )
    try:
        await fast_mail.send_message(message)
    except Exception as exc:
        if resend_error:
            raise RuntimeError(
                "Resend delivery failed and Gmail fallback also failed. "
                f"Resend error: {resend_error}; Gmail error: {exc}"
            ) from exc
        raise

async def send_reset_email(recipient: str, reset_link: str):
    safe_reset_link = html.escape(reset_link, quote=True)
    await send_email(
        recipient=recipient,
        subject="Reset Your BUK Assistant Password",
        body=f"""
        <p>You requested a password reset.</p>
        <p><a href="{safe_reset_link}">Click here to reset your password</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
        """,
    )


async def send_approval_email(recipient: str, full_name: str) -> None:
    safe_name = html.escape(full_name)
    login_link = html.escape(f"{get_frontend_url()}/login", quote=True)
    await send_email(
        recipient=recipient,
        subject="Your BUK Campus Assistant System Account Has Been Approved!",
        body=f"""
        <h2>Congratulations {safe_name}!</h2>
        <p>Your account has been approved by the administrator.</p>
        <p>You now have full access to all features.</p>
        <p><a href="{login_link}">Login Now</a></p>
        """,
    )
