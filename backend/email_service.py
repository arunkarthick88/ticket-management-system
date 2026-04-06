from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

# --- PHASE 5: EMAIL CONFIGURATION ---

conf = ConnectionConfig(
    MAIL_USERNAME="arunkarthickvetrivel08@gmail.com",
    MAIL_PASSWORD="mgjkecbxdyukdkel",             # Spaces removed for successful authentication
    MAIL_FROM="arunkarthick@thestackly.com",      # The email your users will see it coming from
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fast_mail = FastMail(conf)

async def send_email_async(email_to: EmailStr, subject: str, body: str):
    """
    Sends an HTML email asynchronously in the background.
    """
    message = MessageSchema(
        subject=subject,
        recipients=[email_to],
        body=body,
        subtype=MessageType.html
    )
    try:
        await fast_mail.send_message(message)
        print(f"✅ Email successfully sent to {email_to}")
    except Exception as e:
        print(f"❌ Failed to send email to {email_to}: {e}")