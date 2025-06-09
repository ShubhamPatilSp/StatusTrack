from fastapi import FastAPI
from contextlib import asynccontextmanager
from .database import connect_to_mongo, close_mongo_connection, get_database # Updated import
from .config import settings # Import settings to ensure .env is loaded
from app.api.v1.api import api_router_v1 # Import the v1 API router
from app.auth_utils import preload_jwks_on_startup # Import for Auth0 JWKS preloading

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Attempting to connect to MongoDB at: {settings.MONGODB_URL} / DB: {settings.MONGODB_DB_NAME}")
    connect_to_mongo()
    # You can try to get the database instance here to ensure connection
    try:
        db = get_database()
        # Example: list collection names to verify
        print(f"Available collections: {db.list_collection_names()}")
    except Exception as e:
        print(f"Error during initial database connection verification: {e}")

    # Preload Auth0 JWKS keys
    await preload_jwks_on_startup()
    yield
    # Shutdown
    close_mongo_connection()

app = FastAPI(
    title="Status Page API",
    description="API for managing services, incidents, and their statuses.",
    version="0.1.0",
    lifespan=lifespan # Add lifespan manager
)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Status Page API"}

@app.get("/health")
async def health_check():
    # Potentially add a DB health check here too
    db_status = "disconnected"
    try:
        get_database().command('ping') # Ping DB
        db_status = "connected"
    except Exception:
        db_status = "error_connecting"
    return {"status": "ok", "database_status": db_status}

# Include the v1 API router
app.include_router(api_router_v1, prefix="/api/v1")