from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import models
from database import engine
from routers import auth_router, ticket_router, admin_router, support_router, notification_router
from websocket_manager import manager  # <--- NEW IMPORT

models.Base.metadata.create_all(bind=engine)

# Phase 4: Rate Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(title="Ticket Management API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router)
app.include_router(ticket_router.router)
app.include_router(admin_router.router)
app.include_router(support_router.router)
app.include_router(notification_router.router)

@app.get("/")
def root():
    return {"message": "Ticket Management API is running with Rate Limiting and WebSockets!"}

# --- PHASE 4: WEBSOCKET ENDPOINT ---
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # We keep the connection open and listen for client pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)