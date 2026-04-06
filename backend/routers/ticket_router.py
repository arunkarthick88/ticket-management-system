from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
import asyncio
import os
import uuid
import aiofiles
import models, schemas, auth
import email_service  # <-- PHASE 5: EMAIL SERVICE IMPORTED
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
    await asyncio.sleep(48 * 3600) 
    
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
        admin_notif = models.Notification(
            user_id=admin.id, 
            ticket_id=new_ticket.id, 
            message=f"New ticket submitted: {ticket.title}"
        )
        db.add(admin_notif)
        await manager.send_personal_message(f"New ticket submitted: {ticket.title}", admin.id)
        
    db.commit() 
    
    return new_ticket

@router.get("/my", response_model=List[schemas.TicketResponse])
def get_my_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Ticket).filter(models.Ticket.created_by == current_user.id).order_by(models.Ticket.created_at.desc()).all()

@router.get("/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.created_by != current_user.id and current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized")
    return ticket


# --- PHASE 2, 3, 4, & 5: ADMIN & SUPPORT ACTIONS ---

@router.patch("/{ticket_id}/assign", response_model=schemas.TicketResponse)
async def assign_ticket(ticket_id: int, assign_data: schemas.TicketAssign, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    
    await manager.send_personal_message(f"You were assigned a new ticket!", assign_data.assigned_to)
    
    # PHASE 5: Send Email
    if assigned_user and assigned_user.email:
        email_body = f"<h3>Hello {assigned_user.name},</h3><p>You have been assigned to a new ticket: <strong>{ticket.title}</strong>.</p><p>Please log in to your dashboard to view the details.</p>"
        background_tasks.add_task(email_service.send_email_async, assigned_user.email, f"New Ticket Assigned: {ticket.title}", email_body)
    
    return ticket

@router.patch("/{ticket_id}/status", response_model=schemas.TicketResponse)
async def update_ticket_status(ticket_id: int, status_data: schemas.TicketStatusUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    
    await manager.send_personal_message(f"Your ticket status changed to {ticket.status}", ticket.created_by)
    
    # PHASE 5: Send Email
    creator = db.query(models.User).filter(models.User.id == ticket.created_by).first()
    if creator and creator.email:
        email_body = f"<h3>Hello {creator.name},</h3><p>The status of your ticket (<strong>{ticket.title}</strong>) has been updated to: <strong>{ticket.status}</strong>.</p>"
        background_tasks.add_task(email_service.send_email_async, creator.email, f"Ticket Status Updated: {ticket.title}", email_body)
    
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

# --- PHASE 4 & 5 NEW FEATURES ---

@router.post("/{ticket_id}/reopen", response_model=schemas.TicketResponse)
async def reopen_ticket(ticket_id: int, reopen_data: schemas.TicketReopen, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    
    if ticket.assigned_to:
        reopen_notif = models.Notification(
            user_id=ticket.assigned_to, 
            ticket_id=ticket.id, 
            message=f"Ticket '{ticket.title}' was reopened by the user!"
        )
        db.add(reopen_notif)
        db.commit()
        
        await manager.send_personal_message(f"Ticket '{ticket.title}' was reopened by the user!", ticket.assigned_to)
        
        # PHASE 5: Send Email Alert
        assigned_user = db.query(models.User).filter(models.User.id == ticket.assigned_to).first()
        if assigned_user and assigned_user.email:
            email_body = f"<h3>Attention {assigned_user.name},</h3><p>The ticket <strong>{ticket.title}</strong> has been reopened by the user.</p><p><strong>Reason provided:</strong> {reopen_data.reason}</p>"
            background_tasks.add_task(email_service.send_email_async, assigned_user.email, f"Ticket Reopened: {ticket.title}", email_body)
        
    return ticket

@router.get("/{ticket_id}/activity", response_model=List[schemas.TicketActivityResponse])
def get_ticket_activity(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(models.TicketActivity).filter(models.TicketActivity.ticket_id == ticket_id).order_by(models.TicketActivity.created_at.desc()).all()


# --- PHASE 5: FILE UPLOADS ---

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True) # Ensure the directory exists

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"]

@router.post("/{ticket_id}/attachments", response_model=schemas.TicketAttachmentResponse)
async def upload_attachment(
    ticket_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 1. Validate File Type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files are allowed.")
        
    # 2. Validate File Size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 5MB limit.")
    await file.seek(0) # Reset cursor
    
    # 3. Generate a safe, unique filename and save locally
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(file_content)
        
    # 4. Save to Database
    new_attachment = models.TicketAttachment(
        ticket_id=ticket_id,
        uploader_id=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        content_type=file.content_type
    )
    db.add(new_attachment)
    
    # Log Activity
    log_activity(db, ticket_id, current_user.id, f"Uploaded attachment: {file.filename}")
    db.commit()
    db.refresh(new_attachment)
    
    return new_attachment

@router.get("/{ticket_id}/attachments", response_model=List[schemas.TicketAttachmentResponse])
def get_ticket_attachments(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Standard users can only view their own attachments
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these attachments")

    attachments = db.query(models.TicketAttachment).filter(models.TicketAttachment.ticket_id == ticket_id).all()
    return attachments

@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    attachment = db.query(models.TicketAttachment).filter(models.TicketAttachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == attachment.ticket_id).first()
    
    # Standard users can only download their own attachments
    if current_user.role == "user" and ticket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to download this attachment")

    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File physically missing from server")

    return FileResponse(path=attachment.file_path, filename=attachment.file_name, media_type=attachment.content_type)