from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime

from app.models import Organization, OrganizationCreate, OrganizationUpdate, PyObjectId, OrganizationMember, UserRoleEnum, User, OrganizationMemberAdd, OrganizationMemberRoleUpdate
from app.database import get_database
from app.auth_utils import get_current_user_token_payload, TokenPayload

router = APIRouter()

# In a real application, many of these operations would be protected and 
# would require checking user's permissions (e.g., if they are an owner or admin of the organization).
# For now, we'll keep it simple.

@router.post("/", response_model=Organization, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Create a new organization.
    The user creating the organization will be set as its owner.
    """
    org_dict = org_in.model_dump()
    org_dict["created_at"] = datetime.utcnow()
    org_dict["updated_at"] = datetime.utcnow()

    # Find or create the user based on Auth0 token
    if not payload.sub or not payload.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) and email are required from token.")

    user_doc = await db.users.find_one({"auth0_id": payload.sub})
    current_user_id: PyObjectId

    if user_doc:
        current_user_id = User(**user_doc).id
        # Optionally update user's name/picture if they've changed in Auth0
        update_data = {}
        if payload.name and user_doc.get("name") != payload.name:
            update_data["name"] = payload.name
        if payload.picture and user_doc.get("picture") != payload.picture:
            update_data["picture"] = payload.picture
        if payload.email and user_doc.get("email") != payload.email: # Email might change in some scenarios
            update_data["email"] = payload.email # Ensure email uniqueness is handled by DB index
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await db.users.update_one({"_id": current_user_id}, {"$set": update_data})
    else:
        new_user_data = {
            "auth0_id": payload.sub,
            "email": payload.email,
            "name": payload.name,
            "picture": payload.picture,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        try:
            user_to_create = User(**new_user_data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user data from token: {e}")
        
        insert_result = await db.users.insert_one(user_to_create.model_dump(by_alias=True, exclude_none=True))
        current_user_id = insert_result.inserted_id

    org_dict["owner_id"] = current_user_id
    owner_member = OrganizationMember(user_id=current_user_id, role=UserRoleEnum.ADMIN)
    org_dict["members"] = [owner_member.model_dump(exclude_none=True)]

    new_org_insert_result = await db.organizations.insert_one(org_dict)
    created_org_doc = await db.organizations.find_one({"_id": new_org_insert_result.inserted_id})

    if created_org_doc:
        return Organization(**created_org_doc)
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create organization.")

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
    organizations_docs = await cursor.to_list(length=100) # Consume cursor asynchronously
    return [Organization(**doc) for doc in organizations_docs]

@router.get("/{org_id}", response_model=Organization)
async def get_organization(org_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific organization by its ID.
    """
    organization = await db.organizations.find_one({"_id": org_id})
    if organization:
        return Organization(**organization)
    raise HTTPException(status_code=404, detail=f"Organization with id {org_id} not found")

@router.put("/{org_id}", response_model=Organization)
async def update_organization(
    org_id: PyObjectId,
    org_in: OrganizationUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update an existing organization's details.
    """
    update_data = org_in.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    update_data['updated_at'] = datetime.utcnow()

    update_result = await db.organizations.update_one(
        {"_id": org_id}, {"$set": update_data}
    )

    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Organization {org_id} not found")

    updated_org = await db.organizations.find_one({"_id": org_id})
    if not updated_org:
        raise HTTPException(status_code=404, detail=f"Organization {org_id} not found after update.")

    return Organization(**updated_org)

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(org_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete an organization by its ID.
    """
    delete_result = await db.organizations.delete_one({"_id": org_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Organization {org_id} not found")


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
