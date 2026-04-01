from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- USER SCHEMAS ---

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


# --- TICKET SCHEMAS ---

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


# --- PHASE 2: ADMIN & SUPPORT SCHEMAS ---

class TicketUpdateCreate(BaseModel):
    message: str
    update_type: Optional[str] = "Feedback"

class TicketUpdateResponse(BaseModel):
    id: int
    ticket_id: int
    support_user_id: int
    message: str
    update_type: str
    created_at: datetime
    class Config:
        from_attributes = True

class TicketAssign(BaseModel):
    assigned_to: int

class TicketStatusUpdate(BaseModel):
    status: str

class TicketPriorityUpdate(BaseModel):
    priority: str


# --- PHASE 3: NOTIFICATION SCHEMAS ---

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    ticket_id: int
    message: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    unread_count: int


# --- PHASE 4: AUDIT TRAIL & ENHANCEMENT SCHEMAS ---

class TicketActivityResponse(BaseModel):
    id: int
    ticket_id: int
    user_id: int
    action: str
    created_at: datetime
    class Config:
        from_attributes = True

class TicketReopen(BaseModel):
    reason: str