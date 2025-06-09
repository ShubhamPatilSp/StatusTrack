from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime

from app.models import Service, ServiceCreate, ServiceUpdate, PyObjectId, User, Organization, UserRoleEnum
from app.database import get_database
from app.auth_utils import get_current_user_token_payload, TokenPayload
from app.websocket_manager import manager

router = APIRouter()

@router.post("/", response_model=Service, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_in: ServiceCreate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Create a new service.
    - Requesting user must be an admin or owner of the organization.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        # This case should ideally be handled by a find_or_create_user_from_token utility
        # For now, assume user exists if token is valid and they've interacted before.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database. Please ensure the user is registered.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Validate organization and permissions
    organization_doc = db.organizations.find_one({"_id": service_in.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {service_in.organization_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to create services for this organization.")

    # 3. Prepare service data
    service_dict = service_in.model_dump()
    service_dict["created_at"] = datetime.utcnow()
    service_dict["updated_at"] = datetime.utcnow()
    # Ensure organization_id is correctly passed (it's already in service_in)

    # 4. Insert service into database
    try:
        result = db.services.insert_one(service_dict)
        created_service_doc = db.services.find_one({"_id": result.inserted_id})
        if created_service_doc:
            created_service = Service(**created_service_doc)
            await manager.broadcast_json({
                "event_type": "service_created", 
                "data": created_service.model_dump(mode='json')
            })
            return created_service
        # This path should ideally not be reached if insert was successful
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve service after creation.")
    except Exception as e:
        # Log the exception e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while creating the service: {e}")

@router.get("/", response_model=List[Service])
async def list_services(
    organization_id: PyObjectId,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Retrieve a list of services for a specific organization.
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to view services for this organization.")

    # 3. Fetch services for the organization
    # Add pagination in a real application
    services_cursor = db.services.find({"organization_id": organization_id})
    services = []
    for service_doc in services_cursor:
        services.append(Service(**service_doc))
    return services

@router.get("/{service_id}", response_model=Service)
async def get_service(service_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific service by its ID.
    - Requesting user must be a member of the organization that owns the service.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the service
    service_doc = db.services.find_one({"_id": service_id})
    if not service_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with id {service_id} not found")
    service = Service(**service_doc)

    # 3. Validate organization and user membership
    organization_doc = db.organizations.find_one({"_id": service.organization_id})
    if not organization_doc:
        # This indicates data inconsistency if a service exists without a valid parent organization
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parent organization for service {service_id} not found.")
    organization = Organization(**organization_doc)

    is_member = any(member.user_id == requesting_user_internal_id for member in organization.members)
    if not is_member and organization.owner_id != requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to view this service.")

    return service

@router.put("/{service_id}", response_model=Service)
async def update_service(
    service_id: PyObjectId, 
    service_in: ServiceUpdate, 
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update an existing service.
    - Requesting user must be an admin or owner of the organization that owns the service.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the service to check its organization_id for permission validation
    existing_service_doc = db.services.find_one({"_id": service_id})
    if not existing_service_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with id {service_id} not found")
    existing_service = Service(**existing_service_doc)

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = db.organizations.find_one({"_id": existing_service.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parent organization for service {service_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update this service.")

    # 4. Prepare update data
    service_update_data = service_in.model_dump(exclude_unset=True)
    if not service_update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    service_update_data["updated_at"] = datetime.utcnow()

    # 5. Perform update
    result = db.services.update_one(
        {"_id": service_id},
        {"$set": service_update_data}
    )
    # The previous check for matched_count == 0 is implicitly covered by existing_service_doc check above.
    # If existing_service_doc was found, matched_count should be 1 unless the item was deleted between find and update.

    updated_service_doc = db.services.find_one({"_id": service_id})
    if updated_service_doc:
        updated_service = Service(**updated_service_doc)
        await manager.broadcast_json({
            "event_type": "service_updated",
            "data": updated_service.model_dump(mode='json')
        })
        return updated_service
    
    # This case implies the service was deleted between the find and the final find_one, or another issue occurred.
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated service after update.")

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(service_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete a service by its ID.
    - Requesting user must be an admin or owner of the organization that owns the service.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the service to check its organization_id for permission validation
    existing_service_doc = db.services.find_one({"_id": service_id})
    if not existing_service_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with id {service_id} not found")
    existing_service = Service(**existing_service_doc)

    # 3. Validate organization and user permissions (admin/owner)
    organization_doc = db.organizations.find_one({"_id": existing_service.organization_id})
    if not organization_doc:
        # This indicates data inconsistency
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parent organization for service {service_id} not found.")
    organization = Organization(**organization_doc)

    is_org_owner = organization.owner_id == requesting_user_internal_id
    is_org_admin = any(member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN for member in organization.members)

    if not (is_org_owner or is_org_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to delete this service.")

    # 4. Perform deletion
    result = db.services.delete_one({"_id": service_id})
    if result.deleted_count == 0:
        # This implies the service was already deleted or another issue occurred.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with id {service_id} not found or could not be deleted.")

    await manager.broadcast_json({
        "event_type": "service_deleted",
        "data": {"service_id": str(service_id), "organization_id": str(existing_service.organization_id)}
    })

    # Return 204 No Content on successful deletion
    return
