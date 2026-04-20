from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# --- PHASE 2: NEW ASSOCIATION TABLE FOR TAGS ---
# This allows Many-to-Many relationships between Tickets and Tags
ticket_tags = Table(
    "ticket_tags",
    Base.metadata,
    Column("ticket_id", Integer, ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(255))
    role = Column(String(20), default="user") # user, admin, support
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tickets_created = relationship("Ticket", foreign_keys="[Ticket.created_by]", back_populates="creator")
    saved_filters = relationship("SavedFilter", back_populates="user", cascade="all, delete-orphan")


class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200))
    description = Column(Text)
    category = Column(String(100), index=True)
    status = Column(String(50), default="Open", index=True)
    priority = Column(String(50), default="Medium", index=True)
    
    created_by = Column(Integer, ForeignKey("users.id"), index=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- PHASE 1: SLA ENGINE FIELDS ---
    due_at = Column(DateTime, nullable=True)
    first_response_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    sla_status = Column(String(50), default="on_track") 
    breached_at = Column(DateTime, nullable=True)

    # --- PHASE 2: SOFT DELETE FIELDS ---
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)

    # --- PHASE 5: WORKFLOW ENGINE FIELDS ---
    closed_at = Column(DateTime, nullable=True)
    reopened_at = Column(DateTime, nullable=True)
    reopen_reason = Column(Text, nullable=True)
    last_status_changed_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by], back_populates="tickets_created")
    
    # --- PHASE 2: TAGS RELATIONSHIP ---
    tags = relationship("Tag", secondary=ticket_tags, back_populates="tickets")


class TicketUpdate(Base):
    __tablename__ = "ticket_updates"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    support_user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    update_type = Column(String(50), default="Feedback")
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    support_user = relationship("User", foreign_keys=[support_user_id])


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    message = Column(Text)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    ticket = relationship("Ticket", foreign_keys=[ticket_id])


class TicketActivity(Base):
    __tablename__ = "ticket_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id")) 
    action = Column(String(255)) 
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    user = relationship("User", foreign_keys=[user_id])


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String(255))
    file_path = Column(String(500)) 
    content_type = Column(String(100))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    uploader = relationship("User", foreign_keys=[uploader_id])


# --- PHASE 2: NEW TAG MODEL ---
class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True)
    color = Column(String(20), default="blue") # e.g., for frontend styling
    
    tickets = relationship("Ticket", secondary=ticket_tags, back_populates="tags")


# --- PHASE 2: NEW SAVED FILTERS MODEL ---
class SavedFilter(Base):
    __tablename__ = "saved_filters"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String(100))
    filter_criteria = Column(JSON) # Stores a JSON object like {"status": "Open", "priority": "High"}
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_filters")


# --- PHASE 5: WORKFLOW STATUS HISTORY MODEL ---
class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    old_status = Column(String(50))
    new_status = Column(String(50))
    changed_by = Column(Integer, ForeignKey("users.id"))
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    user = relationship("User", foreign_keys=[changed_by])