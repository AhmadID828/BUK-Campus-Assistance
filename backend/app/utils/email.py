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


async def send_email(recipient: str, subject: str, body: str) -> None:
    message = MessageSchema(
        subject=subject,
        recipients=[recipient], #type:ignore
        body=body,
        subtype=MessageType.html,
    )
    await fast_mail.send_message(message)

async def send_reset_email(recipient: str, reset_link: str):
    message = MessageSchema(
        subject="Reset Your BUK Assistant Password",
        recipients=[recipient], #type:ignore
        body=f"""
        <p>You requested a password reset.</p>
        <p><a href="{reset_link}">Click here to reset your password</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
        """,
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    await fm.send_message(message)



