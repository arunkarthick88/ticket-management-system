from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import time

# --- REQUIREMENT 2: CACHE IMPORTS ---
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import models
from database import engine
from routers import auth_router, ticket_router, admin_router, support_router, notification_router
from websocket_manager import manager
from logger import logger 

models.Base.metadata.create_all(bind=engine)

# Phase 4: Rate Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

# Updated Title and Version for Phase 2
app = FastAPI(title="Advanced Ticket Management API", version="2.0.0")

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

# --- REQUIREMENT 9: Request Logging Middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Process the request
    response = await call_next(request)
    
    process_time = time.time() - start_time
    # Logs the HTTP method, path, status code, and execution time
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - {process_time:.4f}s")
    
    return response

# --- REQUIREMENT 2: Initialize Caching on Startup ---
@app.on_event("startup")
async def startup():
    # We use InMemoryBackend for dev. For production, swap this with RedisBackend!
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")

# --- REQUIREMENT 8: API Versioning & Router Inclusion ---
# Note: ticket_router now handles its own /api/v1 prefix to support global Tags route
app.include_router(ticket_router.router) 

# Other routers still use the prefix here
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(support_router.router, prefix="/api/v1")
app.include_router(notification_router.router, prefix="/api/v1")

# --- REQUIREMENT 10: Standardized API Response ---
@app.get("/")
def root():
    return {
        "status": "success", 
        "message": "Ticket Management API V2 is running with Caching, Bulk Actions, and Soft Deletes!", 
        "data": None
    }

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