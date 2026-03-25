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
    category = Column(String(100))
    status = Column(String(50), default="Open") # Open, In Progress, Resolved, Closed
    priority = Column(String(50), default="Medium") # Low, Medium, High, Urgent
    
    created_by = Column(Integer, ForeignKey("users.id"))
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship linking back to the user who created it
    creator = relationship("User", foreign_keys=[created_by], back_populates="tickets_created")


class TicketUpdate(Base):
    __tablename__ = "ticket_updates"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    support_user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    update_type = Column(String(50), default="Feedback")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships linking the update to the specific ticket and the support user who made it
    ticket = relationship("Ticket")
    support_user = relationship("User", foreign_keys=[support_user_id])