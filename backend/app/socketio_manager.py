from fastapi import FastAPI
from socketio import AsyncServer, ASGIApp
from typing import Optional
from .websocket_manager import manager

async def init_socketio(app: FastAPI) -> None:
    """Initialize Socket.IO server and attach it to FastAPI app."""
    sio = AsyncServer(async_mode='asgi', cors_allowed_origins=[])  # Allow all origins for development
    
    @sio.event
    async def connect(sid, environ, auth):
        print(f"Client connected: {sid}")
        
    @sio.event
    async def disconnect(sid):
        print(f"Client disconnected: {sid}")
        
    # Wrap the FastAPI app with Socket.IO middleware
    socket_app = ASGIApp(sio, app)
    
    # Update FastAPI app with Socket.IO middleware
    app.add_middleware(
        type(socket_app),
        app=socket_app
    )
    
    # Add Socket.IO methods to manager
    manager.sio = sio
    
    # Add methods to emit events
    async def emit_service_updated(data: dict, organization_id: str):
        await sio.emit('service_updated', data, room=organization_id)
    
    async def emit_incident_updated(data: dict, organization_id: str):
        await sio.emit('incident_updated', data, room=organization_id)
    
    # Add these methods to manager
    manager.emit_service_updated = emit_service_updated
    manager.emit_incident_updated = emit_incident_updated
    
    print("Socket.IO initialized successfully")
