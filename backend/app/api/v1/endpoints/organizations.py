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

    user_doc = db.users.find_one({"auth0_id": payload.sub})
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
            db.users.update_one({"_id": current_user_id}, {"$set": update_data})
    else:
        new_user_data = {
            "auth0_id": payload.sub,
            "email": payload.email,
            "name": payload.name,
            "picture": payload.picture,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        # Validate with Pydantic model before insertion (optional, but good practice)
        try:
            user_to_create = User(**new_user_data) # This will use default_factory for id if not provided
        except Exception as e: # Catch Pydantic validation error
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user data from token: {e}")
        
        # MongoDB will create _id automatically. We need to insert then fetch to get the PyObjectId id.
        # Or, if User model default_factory for id is PyObjectId(), it's generated before insert.
        # Let's assume User model handles id creation correctly upon instantiation.
        # If User model's id is `Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")`
        # then user_to_create.id will be populated.
        
        # Correct way to insert and get ID:
        # Ensure the User model doesn't try to alias 'id' to '_id' on creation if we are not providing '_id'
        # The User model has: id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
        # This means when we do User(**new_user_data), user_to_create.id is already a PyObjectId.
        # We need to ensure the dict passed to insert_one uses '_id' if 'id' is the Pydantic field name.
        # user_to_create.model_dump(by_alias=True) is safer.

        insert_result = db.users.insert_one(user_to_create.model_dump(by_alias=True, exclude_none=True))
        current_user_id = insert_result.inserted_id # This is already an ObjectId/PyObjectId
        if not current_user_id:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user record.")

    org_dict["owner_id"] = current_user_id
    owner_member = OrganizationMember(user_id=current_user_id, role=UserRoleEnum.ADMIN)
    # We no longer need to set auth0_sub here if the link is primarily via User.auth0_id
    # However, if OrganizationMember.auth0_sub is still in the model, Pydantic might expect it or handle its absence.
    # For clarity, let's ensure the model_dump for OrganizationMember doesn't include a None auth0_sub if it's not set.
    # The OrganizationMember model has `auth0_sub: Optional[str] = None`
    org_dict["members"] = [owner_member.model_dump(exclude_none=True)]

    result = db.organizations.insert_one(org_dict)
    created_org_doc = db.organizations.find_one({"_id": result.inserted_id})
    if created_org_doc:
        return Organization(**created_org_doc)
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create organization")

@router.get("/", response_model=List[Organization])
async def list_organizations(
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    List all organizations. 
    In a real app, this might be restricted or filtered based on user membership.
    """
    orgs = []
    # TODO: Filter organizations based on user's membership if auth is implemented
    for org_doc in db.organizations.find().sort("name", 1):
        orgs.append(Organization(**org_doc))
    return orgs

@router.get("/{org_id}", response_model=Organization)
async def get_organization(org_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific organization by its ID.
    """
    org_doc = db.organizations.find_one({"_id": org_id})
    if org_doc:
        return Organization(**org_doc)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")

@router.put("/{org_id}", response_model=Organization)
async def update_organization(
    org_id: PyObjectId,
    org_in: OrganizationUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update an existing organization's details (e.g., name).
    """
    org_update_data = org_in.model_dump(exclude_unset=True)
    if not org_update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    org_update_data["updated_at"] = datetime.utcnow()

    result = db.organizations.update_one(
        {"_id": org_id},
        {"$set": org_update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")
    
    updated_org_doc = db.organizations.find_one({"_id": org_id})
    if updated_org_doc:
        return Organization(**updated_org_doc)
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated organization")

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(org_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete an organization by its ID.
    Consider implications: what happens to teams, services, incidents under this org?
    """
    # TODO: Add cascading delete logic or checks for dependent entities if necessary.
    # For example, prevent deletion if there are active services or unresolved incidents.
    result = db.organizations.delete_one({"_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")
    return

@router.post("/{org_id}/members", response_model=Organization, status_code=status.HTTP_200_OK)
async def add_organization_member(
    org_id: PyObjectId,
    member_data: OrganizationMemberAdd,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Add a new member to an existing organization.
    The requesting user must be an admin or owner of the organization.
    """
    # 1. Get the requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        # This case should ideally be rare if user is authenticated and has interacted before
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the organization
    organization_doc = db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")
    
    organization = Organization(**organization_doc)

    # 3. Permission Check: Is the requesting user an admin or owner of this organization?
    is_authorized_to_add_members = False
    if organization.owner_id == requesting_user_internal_id:
        is_authorized_to_add_members = True
    else:
        for member in organization.members:
            if member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN:
                is_authorized_to_add_members = True
                break
    
    if not is_authorized_to_add_members:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to add members to this organization.")

    # 4. Validate the user to be added
    user_to_add_doc = db.users.find_one({"_id": member_data.user_id})
    if not user_to_add_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {member_data.user_id} to be added not found.")

    # Check if user is already a member
    for member in organization.members:
        if member.user_id == member_data.user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"User {member_data.user_id} is already a member of this organization.")

    # 5. Add the member
    new_member = OrganizationMember(user_id=member_data.user_id, role=member_data.role)
    
    update_result = db.organizations.update_one(
        {"_id": org_id},
        {"$push": {"members": new_member.model_dump(exclude_none=True)}, "$set": {"updated_at": datetime.utcnow()}}
    )

    if update_result.modified_count == 0:
        # This could happen if the org_id was valid but update failed for some other reason.
        # Given the checks, $push should normally result in modified_count = 1.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add member to organization. No changes made.")

    updated_org_doc = db.organizations.find_one({"_id": org_id})
    if not updated_org_doc:
        # This would be unexpected if the update reported success
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve organization after adding member.")
        
    return Organization(**updated_org_doc)


@router.delete("/{org_id}/members/{user_id_to_remove}", response_model=Organization, status_code=status.HTTP_200_OK)
async def remove_organization_member(
    org_id: PyObjectId,
    user_id_to_remove: PyObjectId,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Remove a member from an organization.
    - The requesting user must be an admin or owner of the organization.
    - The organization owner cannot be removed via this endpoint.
    - An admin cannot remove themselves via this endpoint (should be a 'leave' action).
    """
    # 1. Get the requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the organization
    organization_doc = db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")
    organization = Organization(**organization_doc)

    # 3. Permission Check for the requesting user
    is_authorized_to_remove_members = False
    if organization.owner_id == requesting_user_internal_id:
        is_authorized_to_remove_members = True
    else:
        for member in organization.members:
            if member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN:
                is_authorized_to_remove_members = True
                break
    
    if not is_authorized_to_remove_members:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to remove members from this organization.")

    # 4. Validate the user to be removed
    if user_id_to_remove == organization.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization owner cannot be removed via this endpoint.")

    if user_id_to_remove == requesting_user_internal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins/Owners cannot remove themselves using this endpoint. Consider a 'leave organization' action.")

    # Check if the user_id_to_remove is actually a member
    member_to_remove_exists = any(member.user_id == user_id_to_remove for member in organization.members)
    if not member_to_remove_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {user_id_to_remove} is not a member of this organization.")

    # 5. Perform Removal using $pull
    update_result = db.organizations.update_one(
        {"_id": org_id},
        {
            "$pull": {"members": {"user_id": user_id_to_remove}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    if update_result.modified_count == 0:
        # This could happen if the user was not found by the $pull criteria (already handled by check above) or other issues.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to remove member. Member might not have been found or no change made.")

    updated_org_doc = db.organizations.find_one({"_id": org_id})
    if not updated_org_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve organization after removing member.")
        
    return Organization(**updated_org_doc)


@router.patch("/{org_id}/members/{user_id_to_update}/role", response_model=Organization, status_code=status.HTTP_200_OK)
async def update_organization_member_role(
    org_id: PyObjectId,
    user_id_to_update: PyObjectId,
    role_data: OrganizationMemberRoleUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update the role of a member in an organization.
    - Requesting user must be an admin or owner.
    - Cannot change the role of the organization owner.
    - Admins cannot change their own role unless they are the owner.
    - New role cannot be 'owner'.
    """
    # 1. Get the requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    
    requesting_user_doc = db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the organization
    organization_doc = db.organizations.find_one({"_id": org_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with id {org_id} not found")
    organization = Organization(**organization_doc)

    # 3. Permission Check for the requesting user
    is_requesting_user_owner = organization.owner_id == requesting_user_internal_id
    is_requesting_user_admin = False
    if not is_requesting_user_owner:
        for member in organization.members:
            if member.user_id == requesting_user_internal_id and member.role == UserRoleEnum.ADMIN:
                is_requesting_user_admin = True
                break
    
    if not (is_requesting_user_owner or is_requesting_user_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update member roles in this organization.")

    # 4. Validations
    if role_data.role == UserRoleEnum.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign 'owner' role. Ownership is managed separately.")

    if user_id_to_update == organization.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change the role of the organization owner.")

    if not is_requesting_user_owner and user_id_to_update == requesting_user_internal_id:
        # An admin (who is not the owner) trying to change their own role
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot change their own role. This must be done by the owner.")

    # Find the member to update
    member_to_update_index = -1
    for i, member in enumerate(organization.members):
        if member.user_id == user_id_to_update:
            member_to_update_index = i
            break
    
    if member_to_update_index == -1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {user_id_to_update} is not a member of this organization.")

    # 5. Perform Update
    update_field = f"members.{member_to_update_index}.role"
    update_result = db.organizations.update_one(
        {"_id": org_id, "members.user_id": user_id_to_update},
        {
            "$set": {update_field: role_data.role.value, "updated_at": datetime.utcnow()}
        }
    )

    if update_result.matched_count == 0: # Check matched_count because modified_count can be 0 if role is the same
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member to update not found, or update failed.")

    updated_org_doc = db.organizations.find_one({"_id": org_id})
    if not updated_org_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve organization after updating member role.")
        
    return Organization(**updated_org_doc)


# TODO: Add endpoints for managing organization members (add, remove, update role)
# e.g., POST /organizations/{org_id}/members
# e.g., DELETE /organizations/{org_id}/members/{user_id}
# e.g., PATCH /organizations/{org_id}/members/{user_id}
