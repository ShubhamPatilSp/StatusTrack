from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.domain import Subscriber, SubscriberCreate

router = APIRouter()

@router.post("/", response_model=Subscriber, status_code=status.HTTP_201_CREATED)
async def subscribe_to_notifications(
    subscriber_data: SubscriberCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Subscribes a user to receive email notifications for a specific organization's status page.

    - **email**: The email address to subscribe.
    - **organization_id**: The ID of the organization to subscribe to.
    """
    # Check if the organization exists
    organization = await db.organizations.find_one({"_id": subscriber_data.organization_id})
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found."
        )

    # Atomically handle subscription to prevent race conditions
    new_subscriber = Subscriber(**subscriber_data.model_dump())
    
    try:
        await db.subscribers.insert_one(new_subscriber.model_dump(by_alias=True))
    except DuplicateKeyError:
        # This error is expected if the email is already subscribed.
        # A unique compound index on (email, organization_id) must exist in the database.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already subscribed to this organization's updates.",
        )
    
    return new_subscriber
