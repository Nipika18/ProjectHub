import json
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSocket connections
        # A user might have multiple tabs open, hence the List
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"[WebSocket] User {user_id} connected. Active tabs: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                print(f"[WebSocket] User {user_id} disconnected.")
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a JSON message to a specific user across all their open tabs."""
        if user_id in self.active_connections:
            text_data = json.dumps(message)
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    print(f"[WebSocket] Failed to send to a tab for user {user_id}: {e}")
                    # The disconnect method usually handles cleanup, but just in case:
                    pass

    async def broadcast(self, message: dict):
        """Send a JSON message to everyone (useful for system-wide alerts)."""
        text_data = json.dumps(message)
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_text(text_data)
                except Exception:
                    pass

# Global Singleton Manager
manager = ConnectionManager()
