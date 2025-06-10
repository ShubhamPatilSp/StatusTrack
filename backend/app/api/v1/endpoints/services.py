from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import ValidationError
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.models import (
    Service,
    ServiceCreate,
    ServiceUpdate,
    PyObjectId,
    User,
    Organization,
    ServiceStatusEnum
)
from app.database import get_database
from app.auth_utils import get_current_active_db_user
from app.websocket_manager import manager

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

@router.post("/", response_model=Service, status_code=status.HTTP_201_CREATED)
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

        services_collection = db["services"]
        result = await services_collection.insert_one(new_service_dict)
        created_service_doc = await services_collection.find_one({"_id": result.inserted_id})

        if created_service_doc:
            created_service = Service(**created_service_doc)
            await manager.broadcast_json({"type": "service_created", "service": created_service.model_dump(by_alias=True)})
            return created_service
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create service.")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during service creation: {e}")

@router.get("/", response_model=List[Service])
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
        organizations_collection = db["organizations"]
        query = {}

        if organization_id:
            await get_organization_if_member(organization_id, current_user, db)
            query["organization_id"] = organization_id
        else:
            user_org_ids = []
            org_cursor = organizations_collection.find(
                {"$or": [{"owner_id": current_user.id}, {"members.user_id": current_user.id}]},
                {"_id": 1}
            )
            async for org_doc in org_cursor:
                user_org_ids.append(org_doc["_id"])
            
            if not user_org_ids:
                return [] 
            query["organization_id"] = {"$in": user_org_ids}

        if status_filter:
            query["status"] = status_filter.value

        services = []
        cursor = services_collection.find(query).sort("name", 1).skip(skip).limit(limit)
        async for service_doc in cursor:
            services.append(Service(**service_doc))
        return services
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while listing services: {e}")

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

@router.put("/{service_id}", response_model=Service)
async def update_service(
    service_id: PyObjectId,
    service_update: ServiceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user)
):
    try:
        services_collection = db["services"]
        
        existing_service_doc = await services_collection.find_one({"_id": service_id})
        if not existing_service_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service with ID {service_id} not found.")

        org_id_from_db = existing_service_doc.get("organization_id")
        if not org_id_from_db:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Data for service ID {service_id} is corrupt: missing 'organization_id'.")
        
        await get_organization_if_member(org_id_from_db, current_user, db)
        
        existing_service_model = Service(**existing_service_doc)
        update_data = service_update.model_dump(exclude_unset=True)
        
        update_data['updated_at'] = datetime.now(timezone.utc)

        updated_service_model = existing_service_model.model_copy(update=update_data)
        
        new_service_data_for_db = updated_service_model.model_dump(by_alias=True)
        await services_collection.replace_one({"_id": service_id}, new_service_data_for_db)
        
        await manager.broadcast_json({"type": "service_updated", "service": new_service_data_for_db})
        
        return updated_service_model

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

        await manager.broadcast_json({"type": "service_deleted", "service_id": str(service_id)})
        return

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during service deletion: {e}")
