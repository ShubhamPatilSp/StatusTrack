from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from bson import ObjectId

from app.database import get_database
from app.domain import Metric, MetricCreate, MetricDataPoint, PyObjectId, User
from app.auth_utils import get_current_active_db_user

router = APIRouter()

@router.post(
    "/",
    response_model=Metric,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new metric data point",
    description="Allows authorized users to submit a new data point for a specific service metric.",
)
async def create_metric_data_point(
    metric_in: MetricCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_db_user), # Secure this endpoint
):
    """
    Create a new metric data point.

    - **service_id**: The ID of the service this metric belongs to.
    - **value**: The metric value.
    """
    # In a real application, you'd verify if the user has permission
    # to post metrics for this service_id's organization.
    # This is a simplified example.
    
    metric_doc = metric_in.model_dump()
    
    new_metric = await db.metrics.insert_one(metric_doc)
    
    created_metric = await db.metrics.find_one({"_id": new_metric.inserted_id})
    
    if created_metric is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create and retrieve the metric data point.",
        )
        
    return Metric(**created_metric)


@router.get(
    "/{service_id}",
    response_model=List[MetricDataPoint],
    summary="Get metric data for a service",
    description="Retrieves historical metric data for a given service, ordered by timestamp.",
)
async def get_metric_data_for_service(
    service_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Get all metric data points for a specific service.

    - **service_id**: The ID of the service to retrieve metrics for.
    """
    metrics_cursor = db.metrics.find(
        {"service_id": ObjectId(service_id)}
    ).sort("timestamp", 1) # Sort by timestamp ascending
    
    metrics = await metrics_cursor.to_list(length=1000) # Adjust length as needed
    
    # We only want to return timestamp and value for the graphs
    return [MetricDataPoint(timestamp=m["timestamp"], value=m["value"]) for m in metrics]
