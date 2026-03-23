from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine
from routers import auth_router, ticket_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ticket Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(ticket_router.router)

@app.get("/")
def root():
    return {"message": "Ticket Management API is running on PostgreSQL!"}