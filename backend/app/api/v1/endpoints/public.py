from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase as Database
from datetime import datetime, timedelta, date
from typing import List
from pydantic import BaseModel, ConfigDict
import traceback

from app.database import get_database
from app.domain import PyObjectId, Organization, Service, Incident, Subscriber, ServiceStatusEnum, ServiceStatusHistory
from app.email_utils import send_email
from pydantic import EmailStr

router = APIRouter()

class PublicStatusPayload(BaseModel):
    organization: Organization
    services: List[Service]
    incidents: List[Incident]

class PublicStatusData(BaseModel):
    organization: Organization
    services: List[Service]
    incidents: List[Incident]

class SubscriptionRequest(BaseModel):
    email: EmailStr


class DailyUptimeStatus(BaseModel):
    date: date
    status: ServiceStatusEnum


class ServiceUptime(BaseModel):
    overall_uptime_percentage: float
    daily_statuses: List[DailyUptimeStatus]

    model_config = ConfigDict(
        json_encoders={
            date: lambda v: v.isoformat(),
        }
    )

@router.get("/{slug}/status", 
            response_model=PublicStatusPayload,
            summary="Get Public Status Page Data",
            description="Fetches all necessary data for a public status page, including organization details, services, and active incidents.")
async def get_public_status_page(
    slug: str,
    db: Database = Depends(get_database),
):
    """
    Provides the data for a public-facing status page.
    """
    # Fetch the organization document by slug
    org_doc = await db.organizations.find_one({"slug": slug})
    if not org_doc:
        raise HTTPException(status_code=404, detail="Organization not found")
    organization = Organization.model_validate(org_doc)

    # Create a query for the given organization ID
    org_id_query = {"organization_id": organization.id}

    # Fetch all services for the organization
    services_cursor = db.services.find(org_id_query)
    services = [Service.model_validate(doc) async for doc in services_cursor]

    # Fetch all non-resolved incidents for the organization, sorted by creation date
    active_incidents_query = {
        **org_id_query,
        "status": {"$ne": "Resolved"}
    }
    incidents_cursor = db.incidents.find(active_incidents_query).sort("created_at", -1)
    incidents = [Incident.model_validate(doc) async for doc in incidents_cursor]

    return PublicStatusPayload(organization=organization, services=services, incidents=incidents)

@router.post("/{slug}/subscribe", status_code=201, summary="Subscribe to status updates")
async def subscribe_to_updates(
    slug: str,
    request: SubscriptionRequest,
    db: Database = Depends(get_database)
):
    try:
        org_doc = await db.organizations.find_one({"slug": slug})
        if not org_doc:
            raise HTTPException(status_code=404, detail="Organization not found")
        organization = Organization(**org_doc)

        # Check if already subscribed
        existing_subscriber = await db.subscribers.find_one({
            "email": request.email,
            "organization_id": organization.id
        })
        if existing_subscriber:
            return {"message": "You are already subscribed to updates for this organization."}

        subscriber = Subscriber(email=request.email, organization_id=organization.id)
        await db.subscribers.insert_one(subscriber.model_dump(by_alias=True))

        try:
            await send_email(
                subject="Subscription Confirmation",
                recipient_to=request.email,
                body=f"You have successfully subscribed to updates for {organization.name}."
            )
        except Exception as email_error:
            print(f"CRITICAL: Failed to send subscription confirmation email to {request.email}. Error: {email_error}")
            return {"message": "Subscription successful, but confirmation email could not be sent."}

        return {"message": "You have been successfully subscribed. Please check your email for confirmation."}
    except Exception as e:
        print(f"--- Unhandled Exception in subscribe_to_updates ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred while processing your subscription.")

@router.post("/{slug}/unsubscribe", status_code=200, summary="Unsubscribe from updates")
async def unsubscribe_from_updates(
    slug: str,
    request: SubscriptionRequest,
    db: Database = Depends(get_database)
):
    org_doc = await db.organizations.find_one({"slug": slug})
    if not org_doc:
        # Don't raise a 404, to avoid revealing organization existence
        return {"message": "Your request has been processed."}
    organization = Organization(**org_doc)

    await db.subscribers.delete_many({
        "email": request.email,
        "organization_id": organization.id
    })

    # Avoid confirming if an email address was ever in the system
    return {"message": "Your request has been processed."}

@router.get("/{slug}/services/{service_id}/uptime",
            summary="Get Service Uptime Data")
async def get_service_uptime(
    slug: str,
    service_id: str,
    db: Database = Depends(get_database)
):
    try:
        service_obj_id = PyObjectId(service_id)

        org_doc = await db.organizations.find_one({"slug": slug})
        if not org_doc:
            raise HTTPException(status_code=404, detail="Organization not found")

        service_doc = await db.services.find_one({"_id": service_obj_id, "organization_id": org_doc["_id"]})
        if not service_doc:
            raise HTTPException(status_code=404, detail="Service not found in this organization")

        # Uptime calculation logic
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=90)

        history_cursor = db.service_status_history.find({
            "service_id": service_obj_id,
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }).sort("timestamp", 1)
        history = await history_cursor.to_list(length=None)

        initial_status_doc = await db.service_status_history.find({
            "service_id": service_obj_id,
            "timestamp": {"$lt": start_date}
        }).sort("timestamp", -1).limit(1).to_list(length=1)

        events = []
        if initial_status_doc:
            events.append(initial_status_doc[0])
        events.extend(history)

        if not events:
            # If no history, use the current service status for the whole period
            current_service_status = service_doc.get('status', ServiceStatusEnum.OPERATIONAL)
            events.append({"service_id": service_obj_id, "status": current_service_status, "timestamp": start_date})
        
        # Add an end event to calculate duration until now
        last_event_status = events[-1]['status']
        events.append({"service_id": service_obj_id, "status": last_event_status, "timestamp": end_date})

        # Uptime calculation
        up_duration = timedelta(0)
        total_duration = timedelta(0)
        up_states = {ServiceStatusEnum.OPERATIONAL, ServiceStatusEnum.DEGRADED_PERFORMANCE}
        excluded_states = {ServiceStatusEnum.MAINTENANCE}

        for i in range(len(events) - 1):
            start_event = events[i]
            end_event = events[i+1]
            duration = end_event['timestamp'] - start_event['timestamp']
            
            try:
                status = ServiceStatusEnum(start_event.get('status'))
            except (ValueError, TypeError):
                status = ServiceStatusEnum.OPERATIONAL
        
            if status not in excluded_states:
                total_duration += duration
                if status in up_states:
                    up_duration += duration

        if total_duration.total_seconds() > 0:
            overall_uptime_percentage = (up_duration.total_seconds() / total_duration.total_seconds()) * 100
        else:
            service = Service(**service_doc)
            overall_uptime_percentage = 100.0 if service.status in up_states else 0.0

        # Daily status summary
        severity_map = {
            ServiceStatusEnum.MAJOR_OUTAGE: 5,
            ServiceStatusEnum.PARTIAL_OUTAGE: 4,
            ServiceStatusEnum.MINOR_OUTAGE: 3,
            ServiceStatusEnum.DEGRADED_PERFORMANCE: 2,
            ServiceStatusEnum.MAINTENANCE: 1,
            ServiceStatusEnum.OPERATIONAL: 0,
        }

        day_map = {}
        initial_status_for_daily = ServiceStatusEnum(events[0]['status']) if events else ServiceStatusEnum.OPERATIONAL

        for i in range(90):
            current_date = (end_date - timedelta(days=i)).date()
            day_map[current_date] = {"severity": severity_map.get(initial_status_for_daily, 0), "status": initial_status_for_daily}
    
        sorted_events = sorted(events, key=lambda x: x['timestamp'])
        event_idx = 0
        for day_start in [start_date + timedelta(n) for n in range(90)]:
            day_end = day_start + timedelta(days=1)
            day_worst_status = ServiceStatusEnum.OPERATIONAL
            day_worst_severity = 0

            for event in sorted_events:
                if event['timestamp'] < day_end:
                    try:
                        event_status = ServiceStatusEnum(event['status'])
                    except (ValueError, TypeError):
                        event_status = ServiceStatusEnum.OPERATIONAL
                    
                    event_severity = severity_map.get(event_status, 0)
                    if event_severity > day_worst_severity:
                        day_worst_severity = event_severity
                        day_worst_status = event_status
            day_map[day_start.date()] = {"status": day_worst_status}

        daily_statuses_list = sorted([
            DailyUptimeStatus(date=d, status=s['status']) for d, s in day_map.items()
        ], key=lambda x: x.date)

        uptime_data = ServiceUptime(
            overall_uptime_percentage=round(overall_uptime_percentage, 4),
            daily_statuses=daily_statuses_list
        )

        json_compatible_data = uptime_data.model_dump(mode='json')
        return JSONResponse(content=json_compatible_data)

    except Exception as e:
        print(f"--- Unhandled Exception in get_service_uptime for service {service_id} ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")
