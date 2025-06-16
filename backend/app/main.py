from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from socketio import AsyncServer, ASGIApp
from typing import Optional

from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.api.v1.api import api_router
from app.socketio_manager import manager

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("Starting up and connecting to MongoDB...")
    await connect_to_mongo()
    try:
        db = get_database()
        if db is not None:
            subscribers_collection = db.get_collection("subscribers")
            if subscribers_collection is not None:
                await subscribers_collection.create_index(
                    [("email", 1), ("organization_id", 1)],
                    name="email_org_unique_idx",
                    unique=True
                )
                print("Successfully created/ensured unique index on subscribers collection.")
            else:
                print("Subscribers collection not found in database.")
        else:
            print("Database connection not available for index creation.")
    except Exception as e:
        print(f"An error occurred while creating unique index for subscribers: {e}")
    
    # Initialize Socket.IO and its event handlers
    manager.sio = sio
    register_socketio_handlers(sio)

    yield

    # Shutdown logic
    print("Shutting down and closing MongoDB connection...")
    try:
        await close_mongo_connection()
    except Exception as e:
        print(f"Error during MongoDB shutdown: {e}")

# Create FastAPI app instance with the lifespan manager
fastapi_app = FastAPI(
    title="StatusTrack API",
    description="API for StatusTrack, a modern status page system.",
    version="1.0.0",
    lifespan=lifespan
)

# Create Socket.IO server
sio = AsyncServer(async_mode='asgi', cors_allowed_origins="*")

# Wrap the FastAPI app with Socket.IO middleware
app = ASGIApp(sio, fastapi_app)

# CORS Middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://status-track.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def register_socketio_handlers(sio: AsyncServer):
    @sio.event
    async def connect(sid, environ, auth):
        print(f"Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        print(f"Client disconnected: {sid}")

    @sio.event
    def join_room(sid, data):
        room = data.get('room')
        if room:
            sio.enter_room(sid, room)
            print(f"Client {sid} joined room: {room}")

# Include the API router
fastapi_app.include_router(api_router, prefix="/api/v1")

@fastapi_app.get("/", tags=["Root"], summary="Root endpoint to check API status")
async def read_root():
    return {"message": "Welcome to the StatusTrack API!"}
