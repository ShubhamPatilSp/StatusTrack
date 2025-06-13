from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List

from app.config import settings
from app.domain import Service, Incident, IncidentUpdate

# Use the centralized settings object from config.py
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

f = FastMail(conf)

async def send_email(subject: str, recipients: List[EmailStr], body: str):
    """Base function to send an email."""
    message = MessageSchema(
        subject=subject,
        recipients=recipients,
        body=body,
        subtype=MessageType.html
    )
    await fm.send_message(message)

def create_service_update_email_body(service: Service, old_status: str) -> str:
    """Creates an HTML email body for a service status update."""
    return f"""
    <html>
    <body>
        <h2>Service Status Update</h2>
        <p>The status of the service '<strong>{service.name}</strong>' has changed.</p>
        <p><strong>Previous Status:</strong> {old_status}</p>
        <p><strong>New Status:</strong> {service.status.value}</p>
        <p>Thank you for staying updated.</p>
    </body>
    </html>
    """

def create_incident_update_email_body(incident: Incident, update: IncidentUpdate) -> str:
    """Creates an HTML email body for an incident update."""
    return f"""
    <html>
    <body>
        <h2>Incident Update: {incident.title}</h2>
        <p>A new update has been posted for an incident affecting services.</p>
        <p><strong>Status:</strong> {incident.status.value}</p>
        <p><strong>Severity:</strong> {incident.severity.value}</p>
        <hr>
        <p><strong>Latest Update:</strong></p>
        <p>{update.message}</p>
        <p><em>Posted at: {update.timestamp.strftime('%Y-%m-%d %H:%M:%S')} UTC</em></p>
    </body>
    </html>
    """

def create_new_incident_email_body(incident: Incident) -> str:
    """Creates an HTML email body for a new incident."""
    return f"""
    <html>
    <body>
        <h2>New Incident Reported: {incident.title}</h2>
        <p>We are investigating a new incident.</p>
        <p><strong>Status:</strong> {incident.status.value}</p>
        <p><strong>Severity:</strong> {incident.severity.value}</p>
        <p><strong>Initial Update:</strong></p>
        <p>{incident.updates[0].message if incident.updates else 'No initial message provided.'}</p>
        <p>We will provide more information as it becomes available.</p>
    </body>
    </html>
    """

async def send_service_status_update_email(recipients: List[EmailStr], service: Service, old_status: str):
    """Sends a formatted email to subscribers about a service status change."""
    subject = f"Status Update for {service.name}"
    body = create_service_update_email_body(service, old_status)
    await send_email(subject, recipients, body)

async def send_incident_update_email(recipients: List[EmailStr], incident: Incident, update: IncidentUpdate):
    """Sends a formatted email to subscribers about an incident update."""
    subject = f"[UPDATE] Incident: {incident.title}"
    body = create_incident_update_email_body(incident, update)
    await send_email(subject, recipients, body)

async def send_new_incident_email(recipients: List[EmailStr], incident: Incident):
    """Sends a formatted email to subscribers about a new incident."""
    subject = f"[INVESTIGATING] New Incident: {incident.title}"
    body = create_new_incident_email_body(incident)
    await send_email(subject, recipients, body)
