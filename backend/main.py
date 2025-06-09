import os
import os
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional # Dict, Any might not be needed directly now
# Pydantic BaseModel and Field might be implicitly used via app.models
import pymongo # Keep for mongo client setup if not fully abstracted
from pymongo import ReturnDocument
from bson import ObjectId # For ObjectId validation if needed directly
from bson.errors import InvalidId

from auth_utils import get_current_user_token_payload
from dotenv import load_dotenv

# Import from app modules
from app.database import get_database, connect_to_mongo, close_mongo_connection # Import connection handlers
from app.models import (
    Service, 
    ServiceCreate, 
    ServiceUpdate, 
    ServiceStatusEnum # PyObjectId is also in app.models but might not be directly used here
)

load_dotenv()

# Application instance
app = FastAPI(
    title="Status Page API",
    description="API for managing services, incidents, and their statuses.",
    version="0.1.0",
)

# Define allowed origins (your frontend URL)
origins = [
    "http://localhost:3000",  # Your Next.js frontend
    # You can add other origins here if needed, e.g., your deployed frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specific origins
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"],    # Allows all standard methods (GET, POST, PUT, DELETE, OPTIONS, etc.)
    allow_headers=["*"],    # Allows all headers
)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Status Page API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Placeholder for future endpoints
# /services
# /incidents
# /status
# /ws (WebSocket)

# --- MongoDB Setup ---
MONGODB_URL = os.getenv("MONGODB_URL")
# Uses the database name from .env, defaulting to "status_page_dev"
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "status_page_dev") 

if not MONGODB_URL:
    raise EnvironmentError("MONGODB_URL must be set in the environment variables or .env file.")

# Database instance, will be initialized on startup
db_instance = None 
services_collection = None

@app.on_event("startup")
async def startup_db_client():
    global db_instance, services_collection
    connect_to_mongo()
    db_instance = get_database() # Get the database instance
    # The collection name 'status_page_dev' was confirmed from user's MongoDB setup.
    # TODO: Verify 'services' is your actual MongoDB collection name for service documents.
    # If your collection is named differently, please update the string below.
    services_collection = db_instance["services"]
    print(f"MongoDB started and collection 'services' (from db '{db_instance.name}') initialized.")

@app.on_event("shutdown")
async def shutdown_db_client():
    close_mongo_connection()
    print("MongoDB connection closed.") 

# --- Services Router ---
services_router = APIRouter(
    prefix="/services",
    tags=["services"],
    # dependencies=[Depends(get_current_user_token_payload)] # Apply to all routes in this router
)


@services_router.get("/", response_model=List[Service]) # Service from app.models
async def read_services(token_payload: dict = Depends(get_current_user_token_payload)):
    """
    Retrieve a list of all services from MongoDB.
    This endpoint is protected and requires a valid Auth0 JWT.
    """
    services = []
    print(f"Reading from services_collection: {services_collection.name} in database: {services_collection.database.name}")
    service_cursor = services_collection.find()
    for i, service_doc in enumerate(service_cursor):
        try:
            print(f"Processing document {i}: {service_doc}")
            # Ensure _id is present and correctly aliased by Pydantic model
            if "_id" not in service_doc:
                print(f"Warning: Document {i} is missing '_id': {service_doc}")
                # Decide how to handle: skip, raise, or attempt processing
                # continue # Example: skip this document
            
            service_instance = Service(**service_doc) # Service from app.models
            services.append(service_instance)
        except Exception as e:
            print(f"Critical Error: Failed to process document {i}: {service_doc}")
            print(f"Pydantic validation/instantiation error for Service model: {e}")
            # Depending on the desired behavior, you might want to:
            # 1. Continue to the next document (as done here)
            # 2. Raise an HTTPException to stop processing and return a 500 error immediately
            #    raise HTTPException(status_code=500, detail=f"Error processing service data for doc {i}: {e}")
            # 3. Add the raw document or a placeholder to a list of errors
            continue
    
    if not services and services_collection.count_documents({}) > 0:
        print("Warning: No services were successfully parsed, but documents exist in the collection. Check Pydantic errors above.")
    elif services_collection.count_documents({}) == 0:
        print("No documents found in the services collection.")
    else:
        print(f"Successfully parsed {len(services)} services.")
        
    return services


@services_router.post("/", response_model=Service, status_code=201) # Service and ServiceCreate from app.models
async def create_service(
    service_data: ServiceCreate,
    token_payload: dict = Depends(get_current_user_token_payload)
):
    """
    Create a new service and store it in MongoDB.
    This endpoint is protected and requires a valid Auth0 JWT.
    """
    service_dict = service_data.model_dump()

    # Temporary: Assign a placeholder organization_id if not provided
    # TODO: Implement proper organization_id handling (e.g., from user context or frontend selection)
    if service_dict.get("organization_id") is None:
        placeholder_org_id = ObjectId("666666666666666666666666") # Example placeholder
        print(f"WARNING: 'organization_id' not provided in create_service request. Using placeholder: {placeholder_org_id}")
        service_dict["organization_id"] = placeholder_org_id
    elif not service_dict.get("organization_id"):
        # Catch if it's an empty string or other falsy value that's not a valid ObjectId yet
        # This might occur if frontend sends it as empty instead of omitting
        placeholder_org_id = ObjectId("666666666666666666666666") # Example placeholder
        print(f"WARNING: 'organization_id' was falsy in create_service request. Using placeholder: {placeholder_org_id}")
        service_dict["organization_id"] = placeholder_org_id

    try:
        print(f"Attempting to insert service: {service_dict}")
        insert_result = services_collection.insert_one(service_dict)
        created_service_doc = services_collection.find_one({"_id": insert_result.inserted_id})
        if created_service_doc:
            return Service(**created_service_doc) # Service from app.models
        else:
            # This case should ideally not happen if insert_one was successful
            raise HTTPException(status_code=500, detail="Failed to retrieve created service.")
    except Exception as e:
        # Log the exception e here if you have logging setup
        raise HTTPException(status_code=500, detail=f"Failed to create service in database: {str(e)}")


@services_router.put("/{service_id}", response_model=Service) # Service and ServiceUpdate from app.models
async def update_service(
    service_id: str,
    update_data: ServiceUpdate,
    token_payload: dict = Depends(get_current_user_token_payload)
):
    """
    Update an existing service in MongoDB by its ID.
    This endpoint is protected and requires a valid Auth0 JWT.
    """
    try:
        object_id = ObjectId(service_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"Invalid service ID format: {service_id}")

    updated_service_doc = services_collection.find_one_and_update(
        {"_id": object_id},
        {"$set": update_data.model_dump(exclude_unset=True)}, # Use update_data here
        return_document=ReturnDocument.AFTER
    )

    if updated_service_doc:
        return Service(**updated_service_doc) # Service from app.models
    else:
        raise HTTPException(status_code=404, detail=f"Service with ID {service_id} not found")


@services_router.delete("/{service_id}", status_code=204)
async def delete_service(
    service_id: str,
    token_payload: dict = Depends(get_current_user_token_payload)
):
    """
    Delete a service from MongoDB by its ID.
    Returns 204 No Content on successful deletion.
    This endpoint is protected and requires a valid Auth0 JWT.
    """
    try:
        object_id = ObjectId(service_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"Invalid service ID format: {service_id}")

    delete_result = services_collection.delete_one({"_id": object_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Service with ID {service_id} not found")
    
    # No content to return, FastAPI handles the 204 status code
    return


# Include the services router in the main app
app.include_router(services_router, prefix="/api/v1")

