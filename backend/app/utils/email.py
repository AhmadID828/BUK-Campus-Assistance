import html
import ipaddress
import os
from urllib.parse import urlsplit
from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType # type: ignore

load_dotenv()

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_CONFIGURED = all((MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM))

fast_mail = None
if MAIL_CONFIGURED:
    conf = ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME, #type:ignore
        MAIL_PASSWORD=MAIL_PASSWORD, #type:ignore
        MAIL_FROM=MAIL_FROM, #type:ignore
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
    if fast_mail is None:
        raise RuntimeError(
            "Email is not configured. Set MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM."
        )

    message = MessageSchema(
        subject=subject,
        recipients=[recipient], #type:ignore
        body=body,
        subtype=MessageType.html,
    )
    await fast_mail.send_message(message)

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
