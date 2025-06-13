from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime

from app.domain import Team, TeamCreate, TeamUpdate, PyObjectId, TeamMember, UserRoleEnum, User, Organization, TeamMemberAdd, TeamMemberRoleUpdate
from app.database import get_database
from app.auth_utils import get_current_user_token_payload, TokenPayload

router = APIRouter()

# Similar to organizations, many operations here would be permission-checked in a real app.

@router.post("/", response_model=Team, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_in: TeamCreate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Create a new team within an organization.
    """
    team_dict = team_in.model_dump()
    team_dict["created_at"] = datetime.utcnow()
    team_dict["updated_at"] = datetime.utcnow()

    # TODO: Verify that the organization_id provided in team_in.organization_id exists 
    # and that the current user is a member (perhaps admin/owner) of that organization.
    # This would typically involve another database query to check Organization.members.
    # For now, we'll skip this complex permission check.

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
        if payload.email and user_doc.get("email") != payload.email:
            update_data["email"] = payload.email
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
        if not current_user_id:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user record for team membership.")

    # Add the creator as the first admin member of the team
    initial_member = TeamMember(user_id=current_user_id, role=UserRoleEnum.ADMIN)
    team_dict["members"] = [initial_member.model_dump(exclude_none=True)]

    result = await db.teams.insert_one(team_dict)
    created_team_doc = await db.teams.find_one({"_id": result.inserted_id})
    if created_team_doc:
        return Team(**created_team_doc)
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create team")

@router.get("/", response_model=List[Team])
async def list_teams(
    organization_id: Optional[PyObjectId] = None, # Filter teams by organization
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    List all teams, optionally filtered by organization_id.
    """
    query = {}
    if organization_id:
        query["organization_id"] = organization_id
    
    teams = []
    cursor = db.teams.find(query).sort("name", 1)
    teams = await cursor.to_list(length=100)
    return [Team(**team_doc) for team_doc in teams]

@router.get("/{team_id}", response_model=Team)
async def get_team(team_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Retrieve a specific team by its ID.
    """
    team_doc = await db.teams.find_one({"_id": team_id})
    if team_doc:
        return Team(**team_doc)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")

@router.put("/{team_id}", response_model=Team)
async def update_team(
    team_id: PyObjectId,
    team_in: TeamUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update an existing team's details (e.g., name, description).
    """
    team_update_data = team_in.model_dump(exclude_unset=True)
    if not team_update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    team_update_data["updated_at"] = datetime.utcnow()

    update_result = await db.teams.update_one(
        {"_id": team_id},
        {"$set": team_update_data}
    )
    if update_result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")
    
    updated_team_doc = await db.teams.find_one({"_id": team_id})
    if updated_team_doc:
        return Team(**updated_team_doc)
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated team")

@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: PyObjectId, db: Database = Depends(get_database), payload: TokenPayload = Depends(get_current_user_token_payload)):
    """
    Delete a team by its ID.
    """
    # TODO: Consider implications for team members or resources associated with the team.
    delete_result = await db.teams.delete_one({"_id": team_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")
    return

@router.post("/{team_id}/members", response_model=Team, status_code=status.HTTP_200_OK)
async def add_team_member(
    team_id: PyObjectId,
    member_data: TeamMemberAdd,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Add a new member to an existing team.
    - Requesting user must be an admin of the team OR an admin/owner of the parent organization.
    - User to be added must be a member of the parent organization.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the team
    team_doc = await db.teams.find_one({"_id": team_id})
    if not team_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")
    team = Team(**team_doc)

    # 3. Retrieve the parent organization for permission checks
    organization_doc = await db.organizations.find_one({"_id": team.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Parent organization with id {team.organization_id} not found for team {team_id}")
    organization = Organization(**organization_doc)

    # 4. Permission Check for requesting user
    is_org_owner_or_admin = (organization.owner_id == requesting_user_internal_id or 
                             any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in organization.members))
    is_team_admin = any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in team.members)

    if not (is_org_owner_or_admin or is_team_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to add members to this team.")

    # 5. Validate the user to be added
    user_to_add_doc = await db.users.find_one({"_id": member_data.user_id})
    if not user_to_add_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {member_data.user_id} to be added not found.")

    # Check if user to be added is part of the parent organization
    is_user_in_org = (organization.owner_id == member_data.user_id or 
                        any(m.user_id == member_data.user_id for m in organization.members))
    if not is_user_in_org:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User {member_data.user_id} is not a member of the parent organization {organization.id}.")

    # Check if user is already a member of this team
    if any(m.user_id == member_data.user_id for m in team.members):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"User {member_data.user_id} is already a member of this team.")

    # 6. Add the member
    new_team_member = TeamMember(user_id=member_data.user_id, role=member_data.role)
    update_result = await db.teams.update_one(
        {"_id": team_id},
        {"$push": {"members": new_team_member.model_dump(exclude_none=True)}, "$set": {"updated_at": datetime.utcnow()}}
    )

    if update_result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add member to team.")

    updated_team_doc = await db.teams.find_one({"_id": team_id})
    if not updated_team_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve team after adding member.")
        
    return Team(**updated_team_doc)


@router.delete("/{team_id}/members/{user_id_to_remove}", response_model=Team, status_code=status.HTTP_200_OK)
async def remove_team_member(
    team_id: PyObjectId,
    user_id_to_remove: PyObjectId,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Remove a member from a team.
    - Requesting user must be an admin of the team OR an admin/owner of the parent organization.
    - Admins cannot remove themselves if they are the only admin in the team.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the team
    team_doc = await db.teams.find_one({"_id": team_id})
    if not team_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")
    team = Team(**team_doc)

    # 3. Retrieve the parent organization for permission checks
    organization_doc = await db.organizations.find_one({"_id": team.organization_id})
    if not organization_doc:
        # This should ideally not happen if data integrity is maintained
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parent organization for team {team_id} not found.")
    organization = Organization(**organization_doc)

    # 4. Permission Check for requesting user
    is_org_owner_or_admin = (organization.owner_id == requesting_user_internal_id or 
                             any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in organization.members))
    is_team_admin_requesting = any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in team.members)

    if not (is_org_owner_or_admin or is_team_admin_requesting):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to remove members from this team.")

    # 5. Validate the user to be removed
    member_to_remove_info = next((m for m in team.members if m.user_id == user_id_to_remove), None)
    if not member_to_remove_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {user_id_to_remove} is not a member of this team.")

    # Prevent removing oneself if they are the only admin
    if user_id_to_remove == requesting_user_internal_id and member_to_remove_info.role == UserRoleEnum.ADMIN:
        num_admins_in_team = sum(1 for m in team.members if m.role == UserRoleEnum.ADMIN)
        if num_admins_in_team <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the only admin from the team. Assign another admin first or delete the team.")
    
    # Org admins/owners can remove any team member (except the last team admin if that admin is themselves and they are not org admin/owner)
    # Team admins can remove other members, but not other admins unless they are also org admin/owner.
    if not is_org_owner_or_admin and is_team_admin_requesting and member_to_remove_info.role == UserRoleEnum.ADMIN and user_id_to_remove != requesting_user_internal_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team admins cannot remove other team admins. This requires organization level admin rights.")

    # 6. Perform Removal using $pull
    update_result = await db.teams.update_one(
        {"_id": team_id},
        {
            "$pull": {"members": {"user_id": user_id_to_remove}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    if update_result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to remove member. Member might not have been found or no change made.")

    updated_team_doc = await db.teams.find_one({"_id": team_id})
    if not updated_team_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve team after removing member.")
        
    return Team(**updated_team_doc)


@router.patch("/{team_id}/members/{user_id_to_update}/role", response_model=Team, status_code=status.HTTP_200_OK)
async def update_team_member_role(
    team_id: PyObjectId,
    user_id_to_update: PyObjectId,
    role_data: TeamMemberRoleUpdate,
    db: Database = Depends(get_database),
    payload: TokenPayload = Depends(get_current_user_token_payload)
):
    """
    Update the role of a member in a team.
    - Requesting user must be an admin of the team OR an admin/owner of the parent organization.
    - Team admins cannot change their own role unless they are also org admin/owner.
    - Cannot assign 'owner' role via this endpoint.
    """
    # 1. Get requesting user's internal ID
    if not payload.sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth0 user ID (sub) is required from token.")
    requesting_user_doc = await db.users.find_one({"auth0_id": payload.sub})
    if not requesting_user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requesting user not found in database.")
    requesting_user_internal_id = User(**requesting_user_doc).id

    # 2. Retrieve the team
    team_doc = await db.teams.find_one({"_id": team_id})
    if not team_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team with id {team_id} not found")
    team = Team(**team_doc)

    # 3. Retrieve the parent organization for permission checks
    organization_doc = await db.organizations.find_one({"_id": team.organization_id})
    if not organization_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parent organization for team {team_id} not found.")
    organization = Organization(**organization_doc)

    # 4. Permission Check for requesting user
    is_org_owner_or_admin = (organization.owner_id == requesting_user_internal_id or 
                             any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in organization.members))
    is_team_admin_requesting = any(m.user_id == requesting_user_internal_id and m.role == UserRoleEnum.ADMIN for m in team.members)

    if not (is_org_owner_or_admin or is_team_admin_requesting):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have permission to update member roles in this team.")

    # 5. Validations
    if role_data.role == UserRoleEnum.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign 'owner' role at the team level. Ownership is an organization concept.")

    # Find the member to update and their current role
    member_to_update_current_role = None
    member_to_update_index = -1
    for i, member in enumerate(team.members):
        if member.user_id == user_id_to_update:
            member_to_update_index = i
            member_to_update_current_role = member.role
            break
    
    if member_to_update_index == -1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {user_id_to_update} is not a member of this team.")

    # Permission logic for role changes:
    # Org admin/owner can change anyone's role in the team.
    # Team admin (who is not org admin/owner) can change roles of 'member' or 'viewer'.
    # Team admin (who is not org admin/owner) cannot change their own role or another admin's role.
    if not is_org_owner_or_admin:
        if user_id_to_update == requesting_user_internal_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team admins cannot change their own role. This requires organization level admin rights.")
        if member_to_update_current_role == UserRoleEnum.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team admins cannot change the role of other team admins. This requires organization level admin rights.")

    # 6. Perform Update
    update_field_path = f"members.{member_to_update_index}.role"
    update_result = await db.teams.update_one(
        {"_id": team_id, "members.user_id": user_id_to_update},
        {
            "$set": {update_field_path: role_data.role.value, "updated_at": datetime.utcnow()}
        }
    )

    if update_result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member to update not found, or update failed.")

    updated_team_doc = await db.teams.find_one({"_id": team_id})
    if not updated_team_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve team after updating member role.")
        
    return Team(**updated_team_doc)


# TODO: Add endpoints for managing team members (add, remove, update role)
# e.g., POST /teams/{team_id}/members
# e.g., DELETE /teams/{team_id}/members/{user_id}
# e.g., PATCH /teams/{team_id}/members/{user_id}
