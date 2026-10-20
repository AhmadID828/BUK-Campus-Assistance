import html
import os
from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType # type: ignore

load_dotenv()

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")

if not all((MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM)):
    raise RuntimeError(
        "MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM must be configured in .env"
    )

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


async def send_email(recipient: str, subject: str, body: str) -> None:
    message = MessageSchema(
        subject=subject,
        recipients=[recipient], #type:ignore
        body=body,
        subtype=MessageType.html,
    )
    await fast_mail.send_message(message)

async def send_reset_email(recipient: str, reset_link: str):
    safe_reset_link = html.escape(reset_link, quote=True)
    message = MessageSchema(
        subject="Reset Your BUK Assistant Password",
        recipients=[recipient], #type:ignore
        body=f"""
        <p>You requested a password reset.</p>
        <p><a href="{safe_reset_link}">Click here to reset your password</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
        """,
        subtype=MessageType.html,
    )
    await fast_mail.send_message(message)


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
