from typing import List, Dict, Any
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_personal_json(self, data: Dict[str, Any], websocket: WebSocket):
        await websocket.send_json(data)

    async def broadcast_text(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                # Handle potential errors, e.g., client disconnected abruptly
                print(f"Error sending text to a websocket: {e}")
                # Optionally remove the connection if send fails repeatedly
                # self.disconnect(connection) # Be careful with modifying list while iterating
                pass

    async def broadcast_json(self, data: Dict[str, Any]):
        # Convert ObjectId to str for JSON serialization if necessary
        # This might be better handled by a custom JSON encoder in a real app
        # or by ensuring data passed here is already serialized properly.
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                print(f"Error sending JSON to a websocket: {e}")
                # Optionally remove the connection
                pass

# Global instance of ConnectionManager
manager = ConnectionManager()
