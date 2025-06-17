import smtplib
import ssl
import certifi
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import EmailStr
from typing import List

from app.config import settings
from app.domain import Service, Incident, IncidentUpdate


def send_email_sync(subject: str, recipient: EmailStr, body: str):
    """Synchronous function to send an email using smtplib. Re-raises exceptions."""
    msg = MIMEMultipart()
    msg['From'] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg['To'] = recipient
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'html'))

    try:
        # Create a secure SSL context
        # Create a secure SSL context that uses the certifi certificate bundle
        context = ssl.create_default_context(cafile=certifi.where())
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls(context=context)  # Secure the connection using the context
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(settings.MAIL_FROM, recipient, text)
        server.quit()
        print(f"Email sent successfully to {recipient}")
    except Exception as e:
        print(f"Failed to send email to {recipient}. Error: {e}")
        raise e


# --- HTML Body Creation Functions ---
def create_service_update_email_body(service: Service, old_status: str) -> str:
    """Creates an HTML email body for a service status update."""
    return f"""
    <html><body><h2>Service Status Update</h2><p>The status of the service '<strong>{service.name}</strong>' has changed.</p><p><strong>Previous Status:</strong> {old_status}</p><p><strong>New Status:</strong> {service.status.value}</p><p>Thank you for staying updated.</p></body></html>
    """

def create_incident_update_email_body(incident: Incident, update: IncidentUpdate) -> str:
    """Creates an HTML email body for an incident update."""
    return f"""
    <html><body><h2>Incident Update: {incident.title}</h2><p>A new update has been posted for an incident affecting services.</p><p><strong>Status:</strong> {incident.status.value}</p><p><strong>Severity:</strong> {incident.severity.value}</p><hr><p><strong>Latest Update:</strong></p><p>{update.message}</p><p><em>Posted at: {update.timestamp.strftime('%Y-%m-%d %H:%M:%S')} UTC</em></p></body></html>
    """

def create_new_incident_email_body(incident: Incident) -> str:
    """Creates an HTML email body for a new incident."""
    return f"""
    <html><body><h2>New Incident Reported: {incident.title}</h2><p>We are investigating a new incident.</p><p><strong>Status:</strong> {incident.status.value}</p><p><strong>Severity:</strong> {incident.severity.value}</p><p><strong>Initial Update:</strong></p><p>{incident.updates[0].message if incident.updates else 'No initial message provided.'}</p><p>We will provide more information as it becomes available.</p></body></html>
    """

def create_subscription_confirmation_email_body(organization_name: str) -> str:
    """Creates an HTML email body for subscription confirmation."""
    return f"""
    <html><body><h2>Subscription Confirmed</h2><p>You have successfully subscribed to updates for <strong>{organization_name}</strong>.</p><p>You will be notified about any new incidents or service status changes.</p><p>Thank you!</p></body></html>
    """

# --- High-Level Email Sending Functions ---
def send_service_status_update_email(recipients: List[EmailStr], service: Service, old_status: str):
    """Sends a formatted email to subscribers about a service status change."""
    subject = f"Status Update for {service.name}"
    body = create_service_update_email_body(service, old_status)
    for recipient in recipients:
        try:
            send_email_sync(subject, recipient, body)
        except Exception as e:
            print(f"Skipping failed email to {recipient}: {e}") # Don't crash the whole loop

def send_incident_update_email(recipients: List[EmailStr], incident: Incident, update: IncidentUpdate):
    """Sends a formatted email to subscribers about an incident update."""
    subject = f"[UPDATE] Incident: {incident.title}"
    body = create_incident_update_email_body(incident, update)
    for recipient in recipients:
        try:
            send_email_sync(subject, recipient, body)
        except Exception as e:
            print(f"Skipping failed email to {recipient}: {e}")

def send_new_incident_email(recipients: List[EmailStr], incident: Incident):
    """Sends a formatted email to subscribers about a new incident."""
    subject = f"[INVESTIGATING] New Incident: {incident.title}"
    body = create_new_incident_email_body(incident)
    for recipient in recipients:
        try:
            send_email_sync(subject, recipient, body)
        except Exception as e:
            print(f"Skipping failed email to {recipient}: {e}")

def send_subscription_confirmation_email(recipient: EmailStr, organization_name: str):
    """Sends a formatted email to confirm a new subscription. Re-raises exceptions."""
    subject = "Subscription Confirmation"
    body = create_subscription_confirmation_email_body(organization_name)
    send_email_sync(subject, recipient, body) # Let exception propagate up

