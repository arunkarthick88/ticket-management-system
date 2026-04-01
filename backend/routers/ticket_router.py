from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
import asyncio
import models, schemas, auth
from database import get_db, SessionLocal
from websocket_manager import manager

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# --- Helper Function for Audit Trails ---
def log_activity(db: Session, ticket_id: int, user_id: int, action: str):
    activity = models.TicketActivity(ticket_id=ticket_id, user_id=user_id, action=action)
    db.add(activity)

# --- PHASE 4: Background Task for Auto-Escalation ---
async def escalate_ticket_task(ticket_id: int):
    """Waits 48 hours, then checks if the ticket is still Open. If so, escalates to High."""
    # NOTE: To test this quickly, change (48 * 3600) to just 60 (for 60 seconds)!
    await asyncio.sleep(48 * 3600) 
    
    # We need a fresh database session because this runs in the background long after the API request finishes
    db = SessionLocal()
    try:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        if ticket and ticket.status == "Open":
            ticket.priority = "High"
            
            log_activity(db, ticket.id, ticket.created_by, "System auto-escalated priority to High")
            
            notif = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Your ticket '{ticket.title}' was auto-escalated to High priority.")
            db.add(notif)
            db.commit()
            
            # Fire real-time alert!
            await manager.send_personal_message("Ticket auto-escalated to High!", ticket.created_by)
    finally:
        db.close()

# --- PHASE 1 & 4: END-USER ACTIONS ---

@router.post("/", response_model=schemas.TicketResponse)
async def create_ticket(ticket: schemas.TicketCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "user":
        raise HTTPException(status_code=403, detail="Only standard users can create tickets")
        
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    duplicate = db.query(models.Ticket).filter(
        models.Ticket.created_by == current_user.id,
        func.lower(models.Ticket.title) == ticket.title.lower(),
        models.Ticket.created_at >= time_threshold
    ).first()
    
    if duplicate:
        raise HTTPException(status_code=400, detail="A similar ticket was recently submitted.")

    new_ticket = models.Ticket(**ticket.dict(), created_by=current_user.id)
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    log_activity(db, new_ticket.id, current_user.id, "Ticket created")
    db.commit()

    # 1. Start the 48-hour countdown timer in the background
    background_tasks.add_task(escalate_ticket_task, new_ticket.id)
    
    # 2. Send real-time confirmation to the user who created it
    await manager.send_personal_message("New ticket created successfully!", current_user.id)
    
    # 3. Alert all Admins that a new ticket just arrived AND save to database!
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        # Save persistent notification to PostgreSQL
        admin_notif = models.Notification(
            user_id=admin.id, 
            ticket_id=new_ticket.id, 
            message=f"New ticket submitted: {ticket.title}"
        )
        db.add(admin_notif)
        # Send the live WebSocket popup
        await manager.send_personal_message(f"New ticket submitted: {ticket.title}", admin.id)
        
    db.commit() # Commit all the new notifications to the database
    
    return new_ticket

@router.get("/my", response_model=List[schemas.TicketResponse])
def get_my_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Ticket).filter(models.Ticket.created_by == current_user.id).all()

@router.get("/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.created_by != current_user.id and current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized")
    return ticket


# --- PHASE 2, 3, & 4: ADMIN & SUPPORT ACTIONS ---

@router.patch("/{ticket_id}/assign", response_model=schemas.TicketResponse)
async def assign_ticket(ticket_id: int, assign_data: schemas.TicketAssign, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign tickets")
    
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.assigned_to = assign_data.assigned_to
    
    assigned_user = db.query(models.User).filter(models.User.id == assign_data.assigned_to).first()
    target_name = assigned_user.name if assigned_user else f"User ID {assign_data.assigned_to}"
    
    log_activity(db, ticket.id, current_user.id, f"Assigned to {target_name}")
    
    notif = models.Notification(user_id=assign_data.assigned_to, ticket_id=ticket.id, message=f"You have been assigned to ticket: {ticket.title}")
    db.add(notif)
    db.commit()
    db.refresh(ticket)
    
    # Send real-time alert to the Support Staff member!
    await manager.send_personal_message(f"You were assigned a new ticket!", assign_data.assigned_to)
    
    return ticket

@router.patch("/{ticket_id}/status", response_model=schemas.TicketResponse)
async def update_ticket_status(ticket_id: int, status_data: schemas.TicketStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update official status")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    old_status = ticket.status
    ticket.status = status_data.status
    
    new_notification = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Your ticket '{ticket.title}' status was updated from {old_status} to: {ticket.status}")
    db.add(new_notification)
    
    log_activity(db, ticket.id, current_user.id, f"Status changed to {ticket.status}")
    db.commit()
    db.refresh(ticket)
    
    # Send real-time alert to the End User!
    await manager.send_personal_message(f"Your ticket status changed to {ticket.status}", ticket.created_by)
    
    return ticket

@router.patch("/{ticket_id}/priority", response_model=schemas.TicketResponse)
async def update_ticket_priority(ticket_id: int, priority_data: schemas.TicketPriorityUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update priority")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    old_priority = ticket.priority
    ticket.priority = priority_data.priority
    
    new_notification = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Your ticket '{ticket.title}' priority was updated from {old_priority} to: {ticket.priority}")
    db.add(new_notification)
    
    log_activity(db, ticket.id, current_user.id, f"Priority changed to {ticket.priority}")
    db.commit()
    db.refresh(ticket)
    
    # Send real-time alert to the End User!
    await manager.send_personal_message(f"Your ticket priority changed to {ticket.priority}", ticket.created_by)
    
    return ticket

@router.post("/{ticket_id}/updates", response_model=schemas.TicketUpdateResponse)
def add_ticket_update(ticket_id: int, update_data: schemas.TicketUpdateCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role not in ["admin", "support"]:
        raise HTTPException(status_code=403, detail="Only admin and support can add updates")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
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
        
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == "support" and ticket.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(models.TicketUpdate).filter(models.TicketUpdate.ticket_id == ticket_id).order_by(models.TicketUpdate.created_at.desc()).all()

# --- PHASE 4 NEW FEATURES ---

@router.post("/{ticket_id}/reopen", response_model=schemas.TicketResponse)
async def reopen_ticket(ticket_id: int, reopen_data: schemas.TicketReopen, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the original creator can reopen this ticket")
        
    if ticket.status != "Closed":
        raise HTTPException(status_code=400, detail="Only closed tickets can be reopened")
        
    ticket.status = "Open"
    
    log_activity(db, ticket.id, current_user.id, f"Ticket reopened. Reason: {reopen_data.reason}")
    db.commit()
    db.refresh(ticket)
    
    # Alert the admin/support that a ticket came back from the dead AND save to DB!
    if ticket.assigned_to:
        # Save persistent notification to PostgreSQL
        reopen_notif = models.Notification(
            user_id=ticket.assigned_to, 
            ticket_id=ticket.id, 
            message=f"Ticket '{ticket.title}' was reopened by the user!"
        )
        db.add(reopen_notif)
        db.commit()
        
        # Send the live WebSocket popup
        await manager.send_personal_message(f"Ticket '{ticket.title}' was reopened by the user!", ticket.assigned_to)
        
    return ticket

@router.get("/{ticket_id}/activity", response_model=List[schemas.TicketActivityResponse])
def get_ticket_activity(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(models.TicketActivity).filter(models.TicketActivity.ticket_id == ticket_id).order_by(models.TicketActivity.created_at.desc()).all()