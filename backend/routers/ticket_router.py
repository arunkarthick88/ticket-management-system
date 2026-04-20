from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import shutil
from datetime import datetime
import models, schemas, auth
from database import get_db

from utils.response import success_response, error_response
from services.ticket_service import ticket_service
from repositories.ticket_repo import ticket_repo
from fastapi_cache import FastAPICache
from websocket_manager import manager

router = APIRouter(prefix="/api/v1", tags=["Tickets"])

async def clear_dashboard_cache():
    await FastAPICache.clear(namespace="fastapi-cache")

class AssignData(BaseModel):
    assigned_to: int

class PriorityData(BaseModel):
    priority: str

# --- PHASE 5: WORKFLOW ENGINE STATE MACHINE ---
ALLOWED_TRANSITIONS = {
    "Open": ["In Progress"],
    "In Progress": ["Resolved"],
    "Resolved": ["Closed", "Reopened"],
    "Closed": ["Reopened"],
    "Reopened": ["In Progress"]
}

def can_user_change_status(user_role: str, new_status: str) -> bool:
    """Checks if a specific role is allowed to transition to the new status."""
    if user_role == "admin": 
        return True
    if user_role == "support" and new_status in ["In Progress", "Resolved", "Reopened", "Closed"]: 
        return True
    if user_role == "user" and new_status == "Reopened": 
        return True
    return False

# ========================================
# TICKETS CRUD
# ========================================

@router.post("/tickets", response_model=schemas.APIResponse)
async def create_ticket(
    ticket: schemas.TicketCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        new_ticket = ticket_service.create_ticket(db, ticket, current_user)
        background_tasks.add_task(clear_dashboard_cache)
        return success_response(data=schemas.TicketResponse.from_orm(new_ticket), message="Ticket created successfully!")
    except Exception as e:
        return error_response(message=str(e))

@router.get("/tickets/my", response_model=schemas.APIResponse)
def get_my_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    tickets = db.query(models.Ticket).filter(
        models.Ticket.created_by == current_user.id,
        models.Ticket.is_deleted == False
    ).order_by(models.Ticket.created_at.desc()).all()
    ticket_data = [schemas.TicketResponse.from_orm(t) for t in tickets]
    return success_response(data=ticket_data, message="Tickets retrieved successfully")

@router.get("/tickets/{ticket_id}", response_model=schemas.APIResponse)
def get_ticket_by_id(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = ticket_repo.get_by_id(db, ticket_id)
    if not ticket or ticket.is_deleted:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.created_by != current_user.id and current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
    return success_response(data=schemas.TicketResponse.from_orm(ticket), message="Ticket found")

@router.delete("/tickets/{ticket_id}", response_model=schemas.APIResponse)
def soft_delete_ticket(ticket_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        ticket_service.soft_delete_ticket(db, ticket_id, current_user)
        background_tasks.add_task(clear_dashboard_cache)
        return success_response(data=None, message=f"Ticket #{ticket_id} moved to trash.")
    except HTTPException as e:
        raise e

# ========================================
# PHASE 3 & 5: ASSIGNMENTS, STATUS, & WORKFLOW
# ========================================

@router.patch("/tickets/{ticket_id}/assign", response_model=schemas.APIResponse)
async def assign_ticket(ticket_id: int, payload: AssignData, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")
    
    ticket.assigned_to = payload.assigned_to
    
    if payload.assigned_to:
        notif = models.Notification(user_id=payload.assigned_to, ticket_id=ticket.id, message=f"You were assigned to Ticket #{ticket.id}", is_read=False)
        db.add(notif)
        notif_creator = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Ticket #{ticket.id} was assigned to an agent.", is_read=False)
        db.add(notif_creator)
        
    db.commit()
    background_tasks.add_task(clear_dashboard_cache)
    
    if payload.assigned_to:
        await manager.send_personal_message("update", payload.assigned_to)
    await manager.send_personal_message("update", ticket.created_by)
        
    return success_response(message="Ticket assigned successfully")


# --- NEW: Get Allowed Statuses for UI ---
@router.get("/tickets/{ticket_id}/allowed-statuses", response_model=schemas.APIResponse)
def get_allowed_statuses(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")
    
    valid_transitions = ALLOWED_TRANSITIONS.get(ticket.status, [])
    allowed = [s for s in valid_transitions if can_user_change_status(current_user.role, s)]
    
    return success_response(data={"current_status": ticket.status, "allowed_next_statuses": allowed})


# --- NEW: Get Status History ---
@router.get("/tickets/{ticket_id}/status-history", response_model=schemas.APIResponse)
def get_status_history(ticket_id: int, db: Session = Depends(get_db)):
    history = db.query(models.TicketStatusHistory).filter(models.TicketStatusHistory.ticket_id == ticket_id).order_by(models.TicketStatusHistory.created_at.desc()).all()
    data = [schemas.StatusHistoryResponse.from_orm(h) for h in history]
    return success_response(data=data, message="History retrieved")


# --- UPDATED: Advanced Workflow Status Update ---
@router.patch("/tickets/{ticket_id}/status", response_model=schemas.APIResponse)
async def update_status(ticket_id: int, payload: schemas.StatusUpdateWithReason, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")
    
    old_status = ticket.status
    new_status = payload.status

    # Validate transition
    if new_status not in ALLOWED_TRANSITIONS.get(old_status, []) and current_user.role != "admin":
        raise HTTPException(400, f"Invalid transition from {old_status} to {new_status}")
    if not can_user_change_status(current_user.role, new_status):
        raise HTTPException(403, "Role not authorized for this transition")

    # Update Ticket
    ticket.status = new_status
    ticket.last_status_changed_at = datetime.utcnow()
    if new_status == "Resolved": ticket.resolved_at = datetime.utcnow()
    if new_status == "Closed": ticket.closed_at = datetime.utcnow()

    # Log History
    history = models.TicketStatusHistory(
        ticket_id=ticket.id, old_status=old_status, new_status=new_status,
        changed_by=current_user.id, reason=payload.reason
    )
    db.add(history)

    # Notifications
    if ticket.created_by != current_user.id:
        notif = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Ticket #{ticket.id} status changed to {payload.status}", is_read=False)
        db.add(notif)
        
    db.commit()

    if ticket.created_by != current_user.id:
        await manager.send_personal_message("update", ticket.created_by)
        
    background_tasks.add_task(clear_dashboard_cache)
    return success_response(message="Status updated via workflow")


# --- NEW: Strict Reopen Endpoint ---
@router.patch("/tickets/{ticket_id}/reopen", response_model=schemas.APIResponse)
async def reopen_ticket(ticket_id: int, payload: schemas.ReopenTicketData, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")

    if ticket.status not in ["Resolved", "Closed"]:
        raise HTTPException(400, "Only Resolved or Closed tickets can be reopened")

    old_status = ticket.status
    ticket.status = "Reopened"
    ticket.reopened_at = datetime.utcnow()
    ticket.reopen_reason = payload.reason
    ticket.last_status_changed_at = datetime.utcnow()

    history = models.TicketStatusHistory(
        ticket_id=ticket.id, old_status=old_status, new_status="Reopened",
        changed_by=current_user.id, reason=payload.reason
    )
    db.add(history)

    # Alert the assigned agent if a user reopens it
    if ticket.assigned_to and current_user.role == "user":
        notif = models.Notification(user_id=ticket.assigned_to, ticket_id=ticket.id, message=f"Ticket #{ticket.id} was reopened by the user.", is_read=False)
        db.add(notif)

    db.commit()

    if ticket.assigned_to and current_user.role == "user":
        await manager.send_personal_message("update", ticket.assigned_to)

    background_tasks.add_task(clear_dashboard_cache)
    return success_response(message="Ticket successfully reopened")


@router.patch("/tickets/{ticket_id}/priority", response_model=schemas.APIResponse)
async def update_priority(ticket_id: int, payload: PriorityData, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")
    
    ticket.priority = payload.priority
    
    if ticket.created_by != current_user.id:
        notif = models.Notification(user_id=ticket.created_by, ticket_id=ticket.id, message=f"Ticket #{ticket.id} priority upgraded to {payload.priority}", is_read=False)
        db.add(notif)
        db.commit()
        await manager.send_personal_message("update", ticket.created_by)
    else:
        db.commit()
        
    background_tasks.add_task(clear_dashboard_cache)
    return success_response(message="Priority updated")

# ========================================
# ATTACHMENTS, ACTIVITY & TAGS
# ========================================

@router.post("/tickets/{ticket_id}/attachments", response_model=schemas.APIResponse)
async def upload_attachment(ticket_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket: raise HTTPException(404, "Ticket not found")

    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        new_attachment = models.TicketAttachment(ticket_id=ticket_id, uploader_id=current_user.id, file_name=file.filename, file_path=file_path)
        db.add(new_attachment)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Attachment log error: {e}") 

    return success_response(message="File uploaded successfully")

@router.get("/tickets/{ticket_id}/attachments", response_model=schemas.APIResponse)
def get_attachments(ticket_id: int, db: Session = Depends(get_db)):
    try:
        attachments = db.query(models.TicketAttachment).filter(models.TicketAttachment.ticket_id == ticket_id).all()
        data = [{"id": a.id, "file_name": a.file_name, "file_path": a.file_path, "created_at": a.created_at} for a in attachments]
        return success_response(data=data, message="Attachments retrieved")
    except:
        return success_response(data=[], message="No attachments found")

@router.get("/tickets/{ticket_id}/activity", response_model=schemas.APIResponse)
def get_activity(ticket_id: int, db: Session = Depends(get_db)):
    try:
        activities = db.query(models.TicketActivity).filter(models.TicketActivity.ticket_id == ticket_id).order_by(models.TicketActivity.created_at.desc()).all()
        data = [{"id": a.id, "action": a.action, "created_at": a.created_at} for a in activities]
        return success_response(data=data, message="Activity retrieved")
    except:
        return success_response(data=[], message="No activity found")

@router.get("/tickets/{ticket_id}/updates", response_model=schemas.APIResponse)
def get_updates(ticket_id: int, db: Session = Depends(get_db)):
    try:
        updates = db.query(models.TicketUpdate).filter(models.TicketUpdate.ticket_id == ticket_id).all()
        data = [{"id": u.id, "message": u.message, "created_at": u.created_at} for u in updates]
        return success_response(data=data, message="Updates retrieved")
    except:
        return success_response(data=[], message="No updates found")

@router.get("/tags", response_model=schemas.APIResponse)
def get_all_tags(db: Session = Depends(get_db)):
    tags = db.query(models.Tag).all()
    tag_data = [schemas.TagResponse.from_orm(t) for t in tags]
    return success_response(data=tag_data, message="Tags retrieved successfully")

@router.post("/tags", response_model=schemas.APIResponse)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role not in ["admin", "support"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    existing_tag = db.query(models.Tag).filter(models.Tag.name == tag.name).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    new_tag = models.Tag(name=tag.name, color=tag.color)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return success_response(data=schemas.TagResponse.from_orm(new_tag), message="Tag created successfully")