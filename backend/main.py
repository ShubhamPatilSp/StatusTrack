from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database import connect_to_mongo, close_mongo_connection
from app.api.v1.api import api_router_v1

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="Status Page API",
    description="API for a status page application, managing services, incidents, and user authentication.",
    version="1.0.0"
)

# Add startup and shutdown event handlers
app.add_event_handler("startup", connect_to_mongo)
app.add_event_handler("shutdown", close_mongo_connection)


# CORS (Cross-Origin Resource Sharing) middleware
# Allows the frontend to communicate with the backend
origins = [
    "http://localhost:3000",  # Next.js frontend
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the main v1 API router
app.include_router(api_router_v1, prefix="/api/v1")

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the Status Page API"}
