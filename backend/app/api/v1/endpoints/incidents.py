from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime

from app.models import (
    Incident, IncidentCreate, IncidentUpdatePayload, 
    IncidentStatusUpdate, PyObjectId, 
    IncidentUpdate as IncidentMessageUpdateModel, # Renamed to avoid conflict
    User, Organization, UserRoleEnum, Service, IncidentStatusEnum
)
from app.database import get_database
from app.auth_utils import get_current_user_token_payload, TokenPayload
from app.websocket_manager import manager

router = APIRouter()

@router.post("/", response_model=Incident, status_code=status.HTTP_201_CREATED)
async def create_incident(
    incident_in: IncidentCreate,
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
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Validate organization and permissions
    organization_doc = db.organizations.find_one({"_id": incident_in.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {incident_in.organization_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to create incidents for this organization.")

    # 3. Validate affected services
    if incident_in.affected_services:
        for service_id in incident_in.affected_services:
            service_doc = db.services.find_one({"_id": service_id})
            if not service_doc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Affected service with id {service_id} not found.")
            service = Service(**service_doc)
            if service.organization_id != incident_in.organization_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Affected service {service_id} does not belong to organization {incident_in.organization_id}.")

    # 4. Prepare incident data
    incident_dict = incident_in.model_dump()
    incident_dict["created_at"] = datetime.utcnow()
    incident_dict["updated_at"] = datetime.utcnow()
    incident_dict["updates"] = []

    if incident_in.initial_update_message:
        initial_update = IncidentMessageUpdateModel(message=incident_in.initial_update_message, timestamp=datetime.utcnow())
        incident_dict["updates"].append(initial_update.model_dump(exclude_none=True))
    
    # 5. Insert incident into database
    try:
        result = db.incidents.insert_one(incident_dict)
        created_incident_doc = db.incidents.find_one({"_id": result.inserted_id})
        if created_incident_doc:
            created_incident = Incident(**created_incident_doc)
            await manager.broadcast_json({
                "event_type": "incident_created",
                "data": created_incident.model_dump(mode='json')
            })
            return created_incident
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve incident after creation.")
    except Exception as e:
        # Log the exception e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while creating the incident: {e}")

@router.get("/", response_model=List[Incident])
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
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Validate organization and user membership
    organization_doc = db.organizations.find_one({"_id": organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {organization_id} not found.")
    organization = Organization(**organization_doc)

    is_member = any(member.user_id == requesting_user_internal_id for member in organization.members)
    if not is_member and organization.owner_id != requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to view incidents for this organization.")

    # 3. Fetch incidents for the organization
    query = {"organization_id": organization_id}
    incidents_cursor = db.incidents.find(query).sort("created_at", -1) # Sort by most recent
    incidents = []
    for incident_doc in incidents_cursor:
        incidents.append(Incident(**incident_doc))
    return incidents

@router.get("/{incident_id}", response_model=Incident)
async def get_incident(incident_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific incident by its ID.
    - Requesting user must be a member of the organization that owns the incident.
    """
    # 1. Fetch the incident
    incident_doc = db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # 2. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 3. Validate organization and user membership
    organization_doc = db.organizations.find_one({"_id": incident.organization_id})
    if not organization_doc:
        # This case should ideally not happen if data integrity is maintained
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Owning organization with id {incident.organization_id} for incident {incident_id} not found.")
    organization = Organization(**organization_doc)

    is_member = any(member.user_id == requesting_user_internal_id for member in organization.members)
    if not is_member and organization.owner_id != requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to view this incident.")

    return incident

@router.post("/{incident_id}/updates", response_model=Incident)
async def add_incident_update(
    incident_id: PyObjectId,
    update_in: IncidentUpdatePayload,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Add an update message to an existing incident.
    - Requesting user must be an admin or owner of the organization that owns the incident.
    """
    # 1. Fetch the incident
    incident_doc = db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # 2. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = db.organizations.find_one({"_id": incident.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Owning organization with id {incident.organization_id} for incident {incident_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to add updates to this incident.")

    # 4. Create and add the update message
    update_message = IncidentMessageUpdateModel(message=update_in.message, timestamp=datetime.utcnow(), posted_by_id=requesting_user_internal_id)
    
    result = db.incidents.update_one(
        {"_id": incident_id},
        {
            "$push": {"updates": update_message.model_dump(exclude_none=True)},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    if result.matched_count == 0:
        # This should ideally not happen if the initial find_one succeeded
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found during update operation.")
    
    updated_incident_doc = db.incidents.find_one({"_id": incident_id})
    if updated_incident_doc:
        updated_incident = Incident(**updated_incident_doc)
        await manager.broadcast_json({
            "event_type": "incident_update_added",
            "data": updated_incident.model_dump(mode='json')
        })
        return updated_incident
    # This should ideally not happen if the update was successful
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve incident after adding update.")

@router.patch("/{incident_id}/status", response_model=Incident)
async def update_incident_status(
    incident_id: PyObjectId,
    status_in: IncidentStatusUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update the status of an existing incident.
    - Requesting user must be an admin or owner of the organization that owns the incident.
    - Adds an automatic update message for the status change.
    """
    # 1. Fetch the incident
    incident_doc = db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # 2. Get requesting user's internal ID and name (for the update message)
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user = User(**requesting_user_doc)
    requesting_user_internal_id = requesting_user.id
    requesting_user_name = requesting_user.name or requesting_user.email # Fallback to email if name is not set

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = db.organizations.find_one({"_id": incident.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Owning organization with id {incident.organization_id} for incident {incident_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update the status of this incident.")

    # 4. Prepare update data and automatic message
    current_time = datetime.utcnow()
    update_fields = {"status": status_in.status.value, "updated_at": current_time}
    if status_in.status == IncidentStatusEnum.RESOLVED:
        update_fields["resolved_at"] = current_time
    
    status_change_message = f"Incident status changed to '{status_in.status.value}' by {requesting_user_name}."
    auto_update_message = IncidentMessageUpdateModel(
        message=status_change_message, 
        timestamp=current_time, 
        posted_by_id=requesting_user_internal_id
    )

    # 5. Perform the update
    result = db.incidents.update_one(
        {"_id": incident_id},
        {
            "$set": update_fields,
            "$push": {"updates": auto_update_message.model_dump(exclude_none=True)}
        }
    )

    if result.matched_count == 0:
        # Should not happen if initial find_one succeeded
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found during status update.")
    
    updated_incident_doc_after_status_change = db.incidents.find_one({"_id": incident_id})
    if updated_incident_doc_after_status_change:
        updated_incident = Incident(**updated_incident_doc_after_status_change)
        await manager.broadcast_json({
            "event_type": "incident_status_updated",
            "data": updated_incident.model_dump(mode='json')
        })
        return updated_incident
    
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve incident after status update.")

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(incident_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete an incident by its ID.
    - Requesting user must be an admin or owner of the organization that owns the incident.
    """
    # 1. Fetch the incident to check ownership and organization
    incident_doc = db.incidents.find_one({"_id": incident_id})
    if not incident_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} not found")
    incident = Incident(**incident_doc)

    # 2. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = db.organizations.find_one({"_id": incident.organization_id})
    if not organization_doc:
        # This case should ideally not happen if data integrity is maintained
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Owning organization with id {incident.organization_id} for incident {incident_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to delete this incident.")

    # 4. Delete the incident
    result = db.incidents.delete_one({"_id": incident_id})
    if result.deleted_count == 0:
        # This case implies the incident was deleted between the find_one and delete_one calls, or another issue occurred.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident with id {incident_id} could not be deleted or was already deleted.")
    
    await manager.broadcast_json({
        "event_type": "incident_deleted",
        "data": {"incident_id": str(incident_id), "organization_id": str(incident.organization_id)}
    })
    # No content to return for a 204 response
    return
