from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(255))
    role = Column(String(20), default="user") # user, admin, support
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship linking back to the tickets this user created
    tickets_created = relationship("Ticket", foreign_keys="[Ticket.created_by]", back_populates="creator")


class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200))
    description = Column(Text)
    category = Column(String(100), index=True) # Optimized
    status = Column(String(50), default="Open", index=True) # Optimized
    priority = Column(String(50), default="Medium", index=True) # Optimized
    
    created_by = Column(Integer, ForeignKey("users.id"), index=True) # Optimized
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True) # Optimized
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True) # Optimized
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- NEW SLA ENGINE FIELDS ---
    due_at = Column(DateTime, nullable=True)
    first_response_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    sla_status = Column(String(50), default="on_track") # on_track, at_risk, breached, completed
    breached_at = Column(DateTime, nullable=True)

    # Relationship linking back to the user who created it
    creator = relationship("User", foreign_keys=[created_by], back_populates="tickets_created")


class TicketUpdate(Base):
    __tablename__ = "ticket_updates"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True) # Optimized
    support_user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    update_type = Column(String(50), default="Feedback")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships linking the update to the specific ticket and the support user who made it
    ticket = relationship("Ticket")
    support_user = relationship("User", foreign_keys=[support_user_id])


# --- PHASE 3: NOTIFICATION MODEL ---
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True) # Optimized
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    message = Column(Text)
    is_read = Column(Boolean, default=False, index=True) # Optimized
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships linking the notification to the user and the specific ticket
    user = relationship("User", foreign_keys=[user_id])
    ticket = relationship("Ticket", foreign_keys=[ticket_id])

# --- PHASE 4: AUDIT TRAIL MODEL ---
class TicketActivity(Base):
    __tablename__ = "ticket_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # User who performed the action
    action = Column(String(255)) # Example: "Ticket created by User"
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    user = relationship("User", foreign_keys=[user_id])

# --- PHASE 5: FILE ATTACHMENT MODEL ---
class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String(255))
    file_path = Column(String(500)) # Local path where the file is stored
    content_type = Column(String(100))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    uploader = relationship("User", foreign_keys=[uploader_id])