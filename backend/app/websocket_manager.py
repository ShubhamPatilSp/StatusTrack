from typing import Dict, Any

class ConnectionManager:
    def __init__(self):
        self.sio = None  # Will be set during startup

    async def emit_service_updated(self, data: Dict[str, Any], organization_id: str):
        """Emit service update event to connected clients."""
        if self.sio:
            await self.sio.emit('service_updated', data, room=organization_id)

    async def emit_incident_updated(self, data: Dict[str, Any], organization_id: str):
        """Emit incident update event to connected clients."""
        if self.sio:
            await self.sio.emit('incident_updated', data, room=organization_id)

    async def broadcast_json(self, payload: Dict[str, Any], organization_id: str):
        """Broadcast a generic JSON payload to a specific organization room."""
        if self.sio:
            event = payload.get("event")
            data = payload.get("data")
            if event and data:
                await self.sio.emit(event, data, room=organization_id)

# Global instance of ConnectionManager
manager = ConnectionManager()
