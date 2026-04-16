from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- PHASE 2: TAG SCHEMAS ---
class TagBase(BaseModel):
    name: str
    color: Optional[str] = "blue"

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int
    class Config:
        from_attributes = True

# --- PHASE 2: SAVED FILTER SCHEMAS ---
class SavedFilterCreate(BaseModel):
    name: str
    filter_criteria: Dict[str, Any]

class SavedFilterResponse(BaseModel):
    id: int
    user_id: int
    name: str
    filter_criteria: Dict[str, Any]
    created_at: datetime
    class Config:
        from_attributes = True

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
    tag_ids: Optional[List[int]] = [] # New: Allow assigning tags on creation

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
    
    # SLA ENGINE FIELDS
    due_at: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    sla_status: Optional[str] = "on_track"
    breached_at: Optional[datetime] = None

    # PHASE 2 FIELDS
    is_deleted: bool = False
    tags: List[TagResponse] = [] # New: Automatically bundle tags with the ticket
    
    class Config:
        from_attributes = True

# --- ADMIN & SUPPORT SCHEMAS ---
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

# --- NOTIFICATION SCHEMAS ---
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    ticket_id: Optional[int] = None
    message: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    unread_count: int

# --- AUDIT TRAIL & ENHANCEMENT SCHEMAS ---
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

# --- ATTACHMENT SCHEMAS ---
class TicketAttachmentResponse(BaseModel):
    id: int
    ticket_id: int
    uploader_id: int
    file_name: str
    content_type: str
    uploaded_at: datetime
    class Config:
        from_attributes = True

# --- SLA DASHBOARD SCHEMAS ---
class SLASummaryResponse(BaseModel):
    breached_count: int
    at_risk_count: int
    compliance_percentage: float

# --- PHASE 2: BULK ACTION SCHEMAS ---
class BulkTicketAction(BaseModel):
    ticket_ids: List[int]

class BulkStatusUpdate(BulkTicketAction):
    status: str

class BulkAssignUpdate(BulkTicketAction):
    assigned_to: int

# --- PHASE 2: GENERIC API RESPONSE WRAPPER ---
# This matches the standard format requested: { status, message, data }
class APIResponse(BaseModel):
    status: str
    message: str
    data: Optional[Any] = None