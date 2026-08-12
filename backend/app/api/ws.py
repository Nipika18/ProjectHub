from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models import User
from backend.app.core.websockets import manager

router = APIRouter(prefix="/api/ws", tags=["websockets"])

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for real-time notifications.
    Authenticates using a JWT token passed as a query parameter.
    """
    # 1. Authenticate the token manually (since we can't use standard headers easily)
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            await websocket.close(code=1008) # Policy Violation
            return
    except JWTError:
        await websocket.close(code=1008)
        return
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        await websocket.close(code=1008)
        return

    # 2. Connect to the manager
    await manager.connect(websocket, user.id)
    
    try:
        # Keep the connection open and listen for client messages (if any)
        while True:
            data = await websocket.receive_text()
            # For now, we only push FROM server TO client.
            # But we must await receive_text() to keep the connection alive
            # and detect when the client closes the browser tab.
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
