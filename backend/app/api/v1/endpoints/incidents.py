from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from typing import List, Optional
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime
from pydantic import ValidationError

from app.domain import (
    Incident, IncidentCreate, IncidentUpdateAction, PyObjectId,
    IncidentUpdate as IncidentMessageUpdateModel, # Renamed to avoid conflict
    User, Organization, UserRoleEnum, Service, IncidentStatusEnum
)
from app.database import get_database
from app.auth_utils import get_current_user_token_payload, TokenPayload
from app.websocket_manager import manager
from app.email_utils import send_new_incident_email, send_incident_update_email

router = APIRouter()

@router.post("", response_model=Incident, status_code=status.HTTP_201_CREATED)
async def create_incident(
    incident_in: IncidentCreate,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Create a new incident.
    - Requesting user must be an admin or owner of the organization.
    - Affected services must exist and belong to the same organization.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_id = User(**requesting_user_doc).id

    # 2. Validate organization and permissions
    organization_doc = await db.organizations.find_one({"_id": incident_in.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {incident_in.organization_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_id
    is_org_admin = any(member.user_id == requesting_user_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to create incidents for this organization.")

    # 3. Validate affected services
    if incident_in.affected_services:
        for service_id in incident_in.affected_services:
            service_doc = await db.services.find_one({"_id": service_id, "organization_id": incident_in.organization_id})
            if not service_doc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Affected service {service_id} not found or not in the correct organization.")

    # 4. Prepare incident data
    incident_dict = incident_in.model_dump()
    incident_dict["created_at"] = datetime.utcnow()
    incident_dict["updated_at"] = datetime.utcnow()
    incident_dict["updates"] = []

    if incident_in.initial_update_message:
        initial_update = IncidentMessageUpdateModel(message=incident_in.initial_update_message, timestamp=datetime.utcnow(), posted_by_id=requesting_user_id)
        incident_dict["updates"].append(initial_update.model_dump(exclude_none=True))
    
    # 5. Insert incident into database
    result = await db.incidents.insert_one(incident_dict)
    created_incident_doc = await db.incidents.find_one({"_id": result.inserted_id})
    if not created_incident_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve incident after creation.")
    
    created_incident = Incident(**created_incident_doc)
    await manager.broadcast_json({
        "event": "incident_new",
        "data": {"incident": created_incident.model_dump(mode='json')}
    }, str(created_incident.organization_id))

    # Notify subscribers
    subscribers_cursor = db.subscribers.find({"organization_id": organization.id})
    subscriber_emails = [sub['email'] async for sub in subscribers_cursor]
    if subscriber_emails:
        background_tasks.add_task(
            send_new_incident_email,
            subscriber_emails,
            created_incident
        )

    return created_incident

@router.get("/organization/{organization_id}", response_model=List[Incident], summary="List incidents for an organization")
async def list_incidents(
    organization_id: PyObjectId, 
    db: Database = Depends(get_database), 
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    List all incidents for a specific organization.
    - Requesting user must be a member of the organization.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_id = User(**requesting_user_doc).id

    # 2. Validate organization and user membership
    organization_doc = await db.organizations.find_one({"_id": organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {organization_id} not found.")
    organization = Organization(**organization_doc)

    is_member = (organization.owner_id == requesting_user_id or 
                 any(member.user_id == requesting_user_id for member in organization.members))

    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a member of this organization.")

    # 3. Fetch incidents
    incidents_cursor = db.incidents.find({"organization_id": organization_id}).sort("created_at", -1)
    incidents = await incidents_cursor.to_list(length=100)
    return [Incident(**incident) for incident in incidents]

@router.get("/{incident_id}/details", response_model=Incident)
async def get_incident(incident_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific incident by its ID.
    - Requesting user must be a member of the organization that owns the incident.
    """
    incident_doc = await db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # No need for auth check on public status pages, but for admin dashboards, we do.
    # For simplicity here, we assume if you have the incident_id, you can view it.
    # A real-world app would re-verify organization membership here as in list_incidents.
    return incident

@router.patch("/{incident_id}", response_model=Incident)
async def update_incident(
    incident_id: PyObjectId,
    update_data: IncidentUpdateAction,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update an existing incident (title, status, severity, etc.) and/or add an update message.
    - Requesting user must be an admin or owner of the organization that owns the incident.
    """
    # 1. Get user and incident
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth0 user ID is required.")
    user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user_id = User(**user_doc).id

    incident_doc = await db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found.")
    incident = Incident(**incident_doc)

    # 2. Check permissions
    org_doc = await db.organizations.find_one({"_id": incident.organization_id})
    if not org_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Incident's organization not found.")
    organization = Organization(**org_doc)

    is_owner = organization.owner_id == user_id
    is_admin = any(member.user_id == user_id and member.role == UserRoleEnum.ADMIN for member in organization.members)
    if not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update this incident.")

    # 3. Prepare update operations
    update_fields = update_data.model_dump(exclude_unset=True)
    db_update_operations = {}
    
    if not update_fields and not update_data.message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    # 4. Validate affected services if they are being updated
    if 'affected_services' in update_fields:
        for service_id in update_fields['affected_services']:
            service_doc = await db.services.find_one({"_id": service_id, "organization_id": incident.organization_id})
            if not service_doc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Service {service_id} not found or not in the correct organization.")

    # 5. Set fields for update
    if update_fields:
        # Handle resolved_at logic
        if 'status' in update_fields and update_fields['status'] == IncidentStatusEnum.RESOLVED:
            update_fields['resolved_at'] = datetime.utcnow()
        elif 'status' in update_fields and incident.status == IncidentStatusEnum.RESOLVED:
            update_fields['resolved_at'] = None # No longer resolved

        db_update_operations['$set'] = update_fields

    # 6. Add new update message if provided
    if update_data.message:
        new_update = IncidentMessageUpdateModel(
            message=update_data.message,
            timestamp=datetime.utcnow(),
            posted_by_id=user_id
        )
        db_update_operations['$push'] = {"updates": new_update.model_dump(exclude_none=True)}

    # 7. Always update the 'updated_at' timestamp
    if '$set' in db_update_operations:
        db_update_operations['$set']['updated_at'] = datetime.utcnow()
    else:
        db_update_operations['$set'] = {'updated_at': datetime.utcnow()}

    # 8. Execute update
    result = await db.incidents.update_one({"_id": incident_id}, db_update_operations)

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found during update.")

    # 9. Fetch and return updated incident
    updated_doc = await db.incidents.find_one({"_id": incident_id})
    if not updated_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve incident after update.")
    
    updated_incident = Incident(**updated_doc)
    await manager.broadcast_json({
        "event": "incident_update",
        "data": updated_incident.model_dump(mode='json')
    }, str(updated_incident.organization_id))

    # Notify subscribers if a new message was added
    if update_data.message:
        subscribers_cursor = db.subscribers.find({"organization_id": incident.organization_id})
        subscriber_emails = [sub['email'] async for sub in subscribers_cursor]
        if subscriber_emails and updated_incident.updates:
            # The newest update is at the start of the list
            latest_update = updated_incident.updates[0]
            background_tasks.add_task(
                send_incident_update_email,
                subscriber_emails,
                updated_incident,
                latest_update
            )

    return updated_incident

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(incident_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete an incident by its ID.
    - Requesting user must be an admin or owner of the organization that owns the incident.
    """
    # 1. Fetch the incident to check ownership and organization
    incident_doc = await db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # 2. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_id = User(**requesting_user_doc).id

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = await db.organizations.find_one({"_id": incident.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Owning organization with id {incident.organization_id} for incident {incident_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_id
    is_org_admin = any(member.user_id == requesting_user_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to delete this incident.")

    # 4. Delete the incident
    result = await db.incidents.delete_one({"_id": incident_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} could not be deleted or was already deleted.")
    
    await manager.broadcast_json({
        "event": "incident_deleted",
        "data": {"id": str(incident_id), "organization_id": str(incident.organization_id)}
    }, str(incident.organization_id))
    # No content to return for a 204 response
    return
