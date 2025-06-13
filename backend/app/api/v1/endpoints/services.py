from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.domain import (
    Service,
    ServiceCreate,
    ServiceUpdate,
    PyObjectId,
    User,
    Organization,
    ServiceStatusEnum,
    ServiceStatusHistory
)
from app.database import get_database
from app.auth_utils import get_current_active_db_user
from app.websocket_manager import manager
from app.email_utils import send_service_status_update_email


router = APIRouter()

async def get_organization_if_member(org_id: PyObjectId, user: User, db: AsyncIOMotorDatabase) -> Organization:
    """
    Hardened function to get an organization if the user is a member or owner.
    Catches all exceptions to prevent server crashes and returns appropriate HTTP errors.
    """
    try:
        organizations_collection = db["organizations"]
        
        if not user.id:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Current user has no valid ID.")

        org_doc = await organizations_collection.find_one(
            {"_id": org_id, "$or": [{"owner_id": user.id}, {"members.user_id": user.id}]}
        )
        
        if not org_doc:
            if await organizations_collection.count_documents({"_id": org_id}, limit=1) == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization with ID {org_id} not found.")
            else:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"User not authorized for organization ID {org_id}.")

        return Organization(**org_doc)

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred while verifying organization membership: {str(e)}"
        )

@router.post("", response_model=Service, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_data: ServiceCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        await get_organization_if_member(service_data.organization_id, current_user, db)

        new_service_dict = service_data.model_dump()
        current_time = datetime.now(timezone.utc)
        new_service_dict["created_at"] = current_time
        new_service_dict["updated_at"] = current_time

        # Create initial status history
        initial_history = ServiceStatusHistory(
            new_status=new_service_dict.get('status', ServiceStatusEnum.OPERATIONAL),
            timestamp=current_time
        )
        new_service_dict['status_history'] = [initial_history.model_dump(by_alias=True)]

        services_collection = db["services"]
        result = await services_collection.insert_one(new_service_dict)
        created_service_doc = await services_collection.find_one({"_id": result.inserted_id})

        if created_service_doc:
            created_service = Service(**created_service_doc)
            await manager.broadcast_json({
                "event": "service_created",
                "data": created_service.model_dump(by_alias=True, mode='json')
            }, str(created_service.organization_id))
            
            return created_service
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create service.")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during service creation: {e}")

@router.get("", response_model=List[Service])
async def list_services(
    organization_id: Optional[PyObjectId] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status_filter: Optional[ServiceStatusEnum] = Query(None, alias="status"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        services_collection = db["services"]
        query = {}

        if organization_id:
            # Ensure the user is a member of the organization they are querying for.
            await get_organization_if_member(organization_id, current_user, db)
            query["organization_id"] = organization_id
        else:
            # If no organization_id is provided, find all organizations the user is a member of.
            user_orgs_cursor = db["organizations"].find(
                {"members.user_id": current_user.id},
                {"_id": 1}
            )
            user_org_ids = [org["_id"] for org in await user_orgs_cursor.to_list(length=None)]
            
            if not user_org_ids:
                return []  # Return empty list if user is not in any organizations
            
            query["organization_id"] = {"$in": user_org_ids}

        if status_filter:
            query["status"] = status_filter.value

        services_docs = await services_collection.find(query).sort("name", 1).skip(skip).limit(limit).to_list(length=limit)
        
        # Pydantic will handle the serialization of the list of Service objects
        return [Service(**doc) for doc in services_docs]

    except HTTPException as e:
        # Re-raise HTTPException to let FastAPI handle it
        raise e
    except Exception as e:
        # Catch any other unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred while listing services: {e}"
        )

@router.get("/{service_id}", response_model=Service)
async def get_service(
    service_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        services_collection = db["services"]
        service_doc = await services_collection.find_one({"_id": service_id})
        if not service_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with ID {service_id} not found.")
        
        org_id = service_doc.get("organization_id")
        if not org_id:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Service {service_id} has no organization_id.")

        await get_organization_if_member(org_id, current_user, db)
        
        return Service(**service_doc)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while fetching service {service_id}: {e}")

@router.patch("/{service_id}", response_model=Service)
async def update_service(
    service_id: PyObjectId,
    service_update: ServiceUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        services_collection = db["services"]
        
        existing_service_doc = await services_collection.find_one({"_id": service_id})
        if not existing_service_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with ID {service_id} not found.")

        existing_service = Service(**existing_service_doc)

        await get_organization_if_member(existing_service.organization_id, current_user, db)
        
        update_data = service_update.model_dump(exclude_unset=True)

        if not update_data:
            return existing_service

        mongo_update = {"$set": {}}
        
        if 'status' in update_data and update_data['status'] != existing_service.status:
            history_entry = ServiceStatusHistory(
                old_status=existing_service.status,
                new_status=update_data['status'],
                timestamp=datetime.now(timezone.utc)
            )
            mongo_update["$push"] = {"status_history": history_entry.model_dump(by_alias=True)}

            # Fetch subscribers and queue email notifications
            subscribers_cursor = db.subscribers.find({"organization_id": existing_service.organization_id})
            subscribers = await subscribers_cursor.to_list(length=None)
            
            if subscribers:
                recipient_emails = [s["email"] for s in subscribers]
                background_tasks.add_task(
                    send_service_status_update_email,
                    recipient_emails,
                    existing_service,
                    existing_service.status.value
                )
        
        for field, value in update_data.items():
            mongo_update["$set"][field] = value

        mongo_update["$set"]['updated_at'] = datetime.now(timezone.utc)
        
        await services_collection.update_one(
            {"_id": service_id},
            mongo_update
        )
        
        final_service_doc = await services_collection.find_one({"_id": service_id})
        if not final_service_doc:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found after update.")
        final_service = Service(**final_service_doc)

        await manager.broadcast_json({"event": "service_updated", "data": final_service.model_dump(mode='json')}, str(final_service.organization_id))
        
        return final_service

    except HTTPException as e:
        raise e
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Data validation error during update: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during service update: {e}")

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        services_collection = db["services"]
        
        service_to_delete = await services_collection.find_one({"_id": service_id})
        if not service_to_delete:
            return

        org_id = service_to_delete.get("organization_id")
        if not org_id:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Service {service_id} has no organization_id, cannot delete.")

        await get_organization_if_member(org_id, current_user, db)

        delete_result = await services_collection.delete_one({"_id": service_id})
        if delete_result.deleted_count == 0:
            return

        await manager.broadcast_json({"event": "service_deleted", "data": {"id": str(service_id), "organization_id": str(org_id)}}, str(org_id))

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during service deletion: {e}")
