import re
import random
from fastapi import APIRouter, HTTPException, Depends, status, Response
from typing import List, Optional
from datetime import datetime
from slugify import slugify
from pymongo.database import Database
from pymongo import ReturnDocument
from bson import ObjectId
from datetime import datetime

from app.domain import Organization, OrganizationCreate, OrganizationUpdate, PyObjectId, OrganizationMember, UserRoleEnum, User, OrganizationMemberAdd, OrganizationMemberRoleUpdate, OrganizationWithPopulatedMembers, PopulatedMember, Service, Incident, IncidentStatusEnum
from app.database import get_database
from app.auth_utils import get_current_active_db_user, get_current_user_token_payload, TokenPayload

router = APIRouter()

# In a real application, many of these operations would be protected and 
# would require checking user's permissions (e.g., if they are an owner or admin of the organization).
# For now, we'll keep it simple.

@router.post("/", response_model=Organization, status_code=status.HTTP_201_CREATED)
async def create_organization(
    organization_in: OrganizationCreate,
    db: Database = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    """
    Create a new organization.
    The user creating the organization will be automatically assigned as its owner.
    """
    slug = slugify(organization_in.name)
    
    # Check if an organization with the same slug already exists
    if await db.organizations.find_one({"slug": slug}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An organization with the name '{organization_in.name}' already exists."
        )

    # Create the organization document
    new_organization_data = organization_in.model_dump()
    new_organization_data['slug'] = slug
    new_organization_data['owner_id'] = current_user.id
    now = datetime.utcnow()
    new_organization_data['created_at'] = now
    new_organization_data['updated_at'] = now

    # Add the creator as the first member with the 'owner' role
    owner_as_member = OrganizationMember(
        user_id=current_user.id,
        role=UserRoleEnum.OWNER,
        added_at=now
    )
    new_organization_data['members'] = [owner_as_member.model_dump()]

    # Insert the new organization into the database
    result = await db.organizations.insert_one(new_organization_data)
    
    # Retrieve the newly created organization to return it
    created_organization = await db.organizations.find_one({"_id": result.inserted_id})
    
    if not created_organization:
        raise HTTPException(status_code=500, detail="Failed to create organization.")

    return Organization.model_validate(created_organization)

@router.get("/", response_model=List[Organization])
async def list_organizations(
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    List all organizations the current user is a member of.
    """
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")

    user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not user_doc:
        return []
    
    user_internal_id = User(**user_doc).id

    cursor = db.organizations.find({"members.user_id": user_internal_id})
    organizations_docs = await cursor.to_list(length=100)
    
    updated_orgs = []
    for doc in organizations_docs:
        if "slug" not in doc or not doc["slug"]:
            # Generate and backfill slug for old records
            base_slug = re.sub(r'[^a-z0-9]+', '-', doc['name'].lower()).strip('-')
            slug = base_slug
            counter = 1
            # Ensure slug is unique
            while await db.organizations.find_one({"slug": slug, "_id": {"$ne": doc["_id"]}}):
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            await db.organizations.update_one(
                {"_id": doc["_id"]},
                {"$set": {"slug": slug, "updated_at": datetime.utcnow()}}
            )
            doc["slug"] = slug # Update the doc in memory for the response
        
        updated_orgs.append(Organization(**doc))

    return updated_orgs

@router.get("/{org_id}", response_model=OrganizationWithPopulatedMembers, summary="Get organization with full member details")
async def get_organization(org_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific organization by its ID, with full details for each member.
    """
    # 1. Permission check: Ensure user is a member of the org
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found.")
    requesting_user_id = User(**requesting_user_doc).id

    organization_doc = await db.organizations.find_one({
        "_id": org_id,
        "members.user_id": requesting_user_id
    })

    if not organization_doc:
        raise HTTPException(status_code=404, detail=f"Organization not found or user is not a member.")
    
    # 2. Populate member details
    member_ids = [member['user_id'] for member in organization_doc.get('members', [])]
    
    if member_ids:
        users_cursor = db.users.find({"_id": {"$in": member_ids}})
        users_list = await users_cursor.to_list(length=len(member_ids))
        users_map = {user['_id']: user for user in users_list}

        populated_members = []
        for member in organization_doc.get('members', []):
            user_details = users_map.get(member['user_id'])
            if user_details:
                populated_members.append(PopulatedMember(
                    id=str(user_details['_id']),
                    name=user_details.get('name'),
                    email=user_details.get('email'),
                    picture=user_details.get('picture'),
                    role=member['role']
                ))
        organization_doc['members'] = populated_members

    return organization_doc

@router.get("/public/{organization_slug}")
async def get_public_organization_status(organization_slug: str, db: Database = Depends(get_database)):
    """
    Retrieve public status information for an organization, including its services and active incidents.
    This endpoint is public and does not require authentication.
    """
    organization_doc = await db.organizations.find_one({"slug": organization_slug})
    if not organization_doc:
        raise HTTPException(status_code=404, detail="Organization not found")
    organization = Organization(**organization_doc)

    services_cursor = db.services.find({"organization_id": organization.id})
    services = [Service(**s) async for s in services_cursor]

    # Fetch active incidents (not resolved)
    incidents_cursor = db.incidents.find({
        "organization_id": organization.id,
        "status": {"$ne": IncidentStatusEnum.RESOLVED}
    }).sort("created_at", -1) # Sort by most recent
    incidents = [Incident(**i) async for i in incidents_cursor]

    return {
        "organization": organization,
        "services": services,
        "incidents": incidents
    }

@router.put("/{org_id}", response_model=Organization)
async def update_organization(
    org_id: PyObjectId,
    org_in: OrganizationUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    # Functionality disabled by user request.
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Updating organizations is disabled.")

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: PyObjectId,
    db: Database = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    # Functionality disabled by user request.
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Deleting organizations is disabled.")

@router.post("/{org_id}/members", response_model=Organization, status_code=status.HTTP_201_CREATED)
async def add_organization_member(
    org_id: PyObjectId,
    member_data: OrganizationMemberAdd,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Add a new member to an existing organization.
    """
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required.")
    
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    organization_doc = await db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization {org_id} not found")
    organization = Organization(**organization_doc)

    # Permission Check
    if not any(m.user_id == requesting_user_internal_id and m.role in [UserRoleEnum.ADMIN, UserRoleEnum.OWNER] for m in organization.members):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to add members.")

    user_to_add_doc = await db.users.find_one({"email": member_data.email})
    if not user_to_add_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with email {member_data.email} not found.")
    user_to_add = User(**user_to_add_doc)

    if any(member.user_id == user_to_add.id for member in organization.members):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member.")

    new_member = OrganizationMember(user_id=user_to_add.id, role=member_data.role)
    
    await db.organizations.update_one(
        {"_id": org_id},
        {
            "$push": {"members": new_member.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    return await get_organization(org_id, db, payload)


@router.delete("/{org_id}/members/{user_id_to_remove}", response_model=Organization)
async def remove_organization_member(
    org_id: PyObjectId,
    user_id_to_remove: PyObjectId,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Remove a member from an organization.
    """
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID required.")
    
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    organization_doc = await db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization {org_id} not found")
    organization = Organization(**organization_doc)

    # Permission Check
    is_owner = organization.owner_id == requesting_user_internal_id
    is_admin = any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in organization.members)
    if not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to remove members.")

    if user_id_to_remove == organization.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the organization owner.")

    if not is_owner and user_id_to_remove == requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins cannot remove themselves.")

    update_result = await db.organizations.update_one(
        {"_id": org_id},
        {"$pull": {"members": {"user_id": user_id_to_remove}}}
    )

    if update_result.modified_count == 0:
        raise HTTPException(status_code=404, detail=f"Member {user_id_to_remove} not found.")

    return await get_organization(org_id, db, payload)


@router.patch("/{org_id}/members/{user_id_to_update}", response_model=Organization)
async def update_organization_member_role(
    org_id: PyObjectId,
    user_id_to_update: PyObjectId,
    role_data: OrganizationMemberRoleUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update a member's role in an organization.
    """
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID required.")
    
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    organization_doc = await db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization {org_id} not found")
    organization = Organization(**organization_doc)

    # Permission Check
    is_owner = organization.owner_id == requesting_user_internal_id
    is_admin = any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in organization.members)
    if not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update roles.")

    if role_data.role == UserRoleEnum.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign 'owner' role.")

    if user_id_to_update == organization.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change the owner's role.")

    if not is_owner and user_id_to_update == requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot change their own role.")

    update_result = await db.organizations.update_one(
        {"_id": org_id, "members.user_id": user_id_to_update},
        {"$set": {"members.$.role": role_data.role.value, "updated_at": datetime.utcnow()}}
    )

    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found or update failed.")

    return await get_organization(org_id, db, payload)


# TODO: Add endpoints for managing organization members (add, remove, update role)
# e.g., POST /organizations/{org_id}/members
# e.g., DELETE /organizations/{org_id}/members/{user_id}
