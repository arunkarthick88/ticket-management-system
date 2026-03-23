from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TicketCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: Optional[str] = "Medium"

class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    status: str
    priority: str
    created_by: int
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True