from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from socketio import AsyncServer, ASGIApp
from typing import Optional

from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.api.v1.api import api_router
from app.socketio_manager import manager

# Create FastAPI app first
app = FastAPI(
    title="StatusTrack API",
    description="API for StatusTrack, a modern status page system.",
    version="1.0.0"
)

# Create Socket.IO server
sio = AsyncServer(async_mode='asgi', cors_allowed_origins=[])  # Allow all origins for development

# Wrap the FastAPI app with Socket.IO middleware
socket_app = ASGIApp(sio, app)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allows your Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("Starting up and connecting to MongoDB...")
    await connect_to_mongo()

    # Create unique index for subscribers to prevent duplicates
    try:
        db = get_database()
        await db.subscribers.create_index(
            [("email", 1), ("organization_id", 1)],
            name="email_org_unique_idx",
            unique=True
        )
        print("Successfully created/ensured unique index on subscribers collection.")
    except Exception as e:
        print(f"An error occurred while creating unique index for subscribers: {e}")

    # Initialize Socket.IO connection handling
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

    # Add Socket.IO methods to manager
    manager.sio = sio

    async def emit_service_updated(data: dict, organization_id: str):
        await sio.emit('service_updated', data, room=organization_id)

    async def emit_incident_updated(data: dict, organization_id: str):
        await sio.emit('incident_updated', data, room=organization_id)

    # Add these methods to manager
    manager.emit_service_updated = emit_service_updated
    manager.emit_incident_updated = emit_incident_updated

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down and closing MongoDB connection...")
    await close_mongo_connection()

# Include the API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/", tags=["Root"], summary="Root endpoint to check API status")
async def read_root():
    return {"message": "Welcome to the StatusTrack API!"}
