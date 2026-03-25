from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# --- PHASE 1: END-USER ACTIONS ---

@router.post("/", response_model=schemas.TicketResponse)
def create_ticket(ticket: schemas.TicketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "user":
        raise HTTPException(status_code=403, detail="Only standard users can create tickets in Phase 1")
        
    new_ticket = models.Ticket(**ticket.dict(), created_by=current_user.id)
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket

@router.get("/my", response_model=List[schemas.TicketResponse])
def get_my_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    tickets = db.query(models.Ticket).filter(models.Ticket.created_by == current_user.id).all()
    return tickets

@router.get("/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Security Rule: Users can only view their own tickets
    if ticket.created_by != current_user.id and current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
        
    return ticket


# --- PHASE 2: ADMIN & SUPPORT ACTIONS ---

@router.patch("/{ticket_id}/assign", response_model=schemas.TicketResponse)
def assign_ticket(ticket_id: int, assign_data: schemas.TicketAssign, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign tickets")
    
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.assigned_to = assign_data.assigned_to
    db.commit()
    db.refresh(ticket)
    return ticket

@router.patch("/{ticket_id}/status", response_model=schemas.TicketResponse)
def update_ticket_status(ticket_id: int, status_data: schemas.TicketStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update official status")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = status_data.status
    db.commit()
    db.refresh(ticket)
    return ticket

@router.patch("/{ticket_id}/priority", response_model=schemas.TicketResponse)
def update_ticket_priority(ticket_id: int, priority_data: schemas.TicketPriorityUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update priority")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.priority = priority_data.priority
    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/{ticket_id}/updates", response_model=schemas.TicketUpdateResponse)
def add_ticket_update(ticket_id: int, update_data: schemas.TicketUpdateCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role not in ["admin", "support"]:
        raise HTTPException(status_code=403, detail="Only admin and support can add updates")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Support users can only add updates to tickets specifically assigned to them
    if current_user.role == "support" and ticket.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this ticket")
        
    new_update = models.TicketUpdate(**update_data.dict(), ticket_id=ticket_id, support_user_id=current_user.id)
    db.add(new_update)
    db.commit()
    db.refresh(new_update)
    return new_update

@router.get("/{ticket_id}/updates", response_model=List[schemas.TicketUpdateResponse])
def get_ticket_updates(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Security Rule: Isolate views based on roles so users only see what they are allowed to see
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these updates")
    if current_user.role == "support" and ticket.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these updates")
        
    updates = db.query(models.TicketUpdate).filter(models.TicketUpdate.ticket_id == ticket_id).order_by(models.TicketUpdate.created_at.desc()).all()
    return updates