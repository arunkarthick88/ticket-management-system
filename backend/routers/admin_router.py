from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
import io
import csv
import models, schemas, auth
from database import get_db

# --- PHASE 2: Standardized Responses & Caching ---
from utils.response import success_response, error_response
from fastapi_cache.decorator import cache

router = APIRouter(prefix="/admin", tags=["Admin Workflow"])

@router.get("/tickets", response_model=schemas.APIResponse)
def get_all_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Phase 2: Exclude soft-deleted tickets from default view
    tickets = db.query(models.Ticket).filter(models.Ticket.is_deleted == False).order_by(models.Ticket.created_at.desc()).all()
    ticket_data = [schemas.TicketResponse.from_orm(t) for t in tickets]
    
    return success_response(data=ticket_data, message="All active tickets retrieved")

@router.get("/support-users", response_model=schemas.APIResponse)
def get_support_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    users = db.query(models.User).filter(models.User.role.in_(["support", "admin"])).all()
    user_data = [schemas.UserResponse.from_orm(u) for u in users]
    
    return success_response(data=user_data, message="Support staff retrieved")

@router.get("/tickets/search", response_model=schemas.APIResponse)
def get_all_tickets_paginated(
    page: int = 1, limit: int = 10, status: Optional[str] = None,
    priority: Optional[str] = None, search: Optional[str] = None,
    assigned_to: Optional[int] = None, tag: Optional[str] = None, 
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Phase 2: Ignore soft-deleted tickets
    query = db.query(models.Ticket).filter(models.Ticket.is_deleted == False)

    # Standard Filters
    if status: query = query.filter(models.Ticket.status == status)
    if priority: query = query.filter(models.Ticket.priority == priority)
    if assigned_to: query = query.filter(models.Ticket.assigned_to == assigned_to)
    
    # --- REQUIREMENT 4: Tag Filtering ---
    if tag:
        query = query.filter(models.Ticket.tags.any(models.Tag.name == tag))
        
    # --- REQUIREMENT 1: ADVANCED FULL-TEXT SEARCH (HYBRID) ---
    if search:
        search_term_ilike = f"%{search}%"
        
        # 1. Create a search vector combining title and description
        search_vector = func.to_tsvector('english', func.coalesce(models.Ticket.title, '') + ' ' + func.coalesce(models.Ticket.description, ''))
        
        # 2. Parse the user's search string
        search_query = func.plainto_tsquery('english', search)
        
        # 3. Filter using BOTH Full-Text Search OR Partial ILIKE
        query = query.filter(
            or_(
                search_vector.op('@@')(search_query),
                models.Ticket.title.ilike(search_term_ilike),
                models.Ticket.description.ilike(search_term_ilike)
            )
        )
        
        # 4. Calculate the relevance rank
        rank = func.ts_rank(search_vector, search_query)
        
        # 5. Order by highest rank (most relevant) first
        query = query.order_by(rank.desc())
    else:
        # Default sorting if no search term is provided
        query = query.order_by(models.Ticket.created_at.desc())

    total_records = query.count()
    total_pages = (total_records + limit - 1) // limit
    offset = (page - 1) * limit
    
    # Apply pagination AFTER sorting
    tickets = query.offset(offset).limit(limit).all()

    ticket_data = [schemas.TicketResponse.from_orm(t) for t in tickets]

    return success_response(
        data={
            "data": ticket_data, 
            "meta": {
                "current_page": page, 
                "limit": limit, 
                "total_records": total_records, 
                "total_pages": total_pages
            }
        },
        message="Search completed"
    )

@router.get("/analytics", response_model=schemas.APIResponse)
@cache(expire=60)
def get_dashboard_analytics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    status_counts = db.query(models.Ticket.status, func.count(models.Ticket.id)).filter(models.Ticket.is_deleted == False).group_by(models.Ticket.status).all()
    priority_counts = db.query(models.Ticket.priority, func.count(models.Ticket.id)).filter(models.Ticket.is_deleted == False).group_by(models.Ticket.priority).all()
    
    active_users = db.query(models.Ticket.created_by, func.count(models.Ticket.id).label('total'))\
                     .filter(models.Ticket.is_deleted == False)\
                     .group_by(models.Ticket.created_by).order_by(func.count(models.Ticket.id).desc()).limit(5).all()

    return success_response(data={
        "status_distribution": dict(status_counts),
        "priority_distribution": dict(priority_counts),
        "active_users": [{"user_id": u[0], "ticket_count": u[1]} for u in active_users]
    }, message="Analytics retrieved")

@router.get("/sla-summary", response_model=schemas.APIResponse)
@cache(expire=60)
def get_sla_summary(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    active_query = db.query(models.Ticket).filter(models.Ticket.is_deleted == False)
    breached_count = active_query.filter(models.Ticket.sla_status == "breached").count()
    at_risk_count = active_query.filter(models.Ticket.sla_status == "at_risk").count()

    total_resolved = active_query.filter(models.Ticket.status.in_(["Resolved", "Closed"])).count()
    completed_on_time = active_query.filter(models.Ticket.sla_status == "completed").count()

    compliance_percentage = 0.0
    if total_resolved > 0:
        compliance_percentage = round((completed_on_time / total_resolved) * 100, 2)

    return success_response(data={
        "breached_count": breached_count,
        "at_risk_count": at_risk_count,
        "compliance_percentage": compliance_percentage
    }, message="SLA metrics retrieved")

@router.get("/export-csv")
def export_tickets_csv(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tickets = db.query(models.Ticket).filter(models.Ticket.is_deleted == False).order_by(models.Ticket.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ticket ID", "Title", "Category", "Status", "Priority", "Created At", "Assigned To ID", "Due At", "SLA Status", "Resolved At"])
    
    for t in tickets:
        writer.writerow([t.id, t.title, t.category, t.status, t.priority, t.created_at, t.assigned_to, t.due_at, t.sla_status, t.resolved_at])
        
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=it_helpdesk_tickets.csv"})

# --- PHASE 2: BULK ACTIONS ---

@router.post("/tickets/bulk-status", response_model=schemas.APIResponse)
def bulk_update_status(payload: schemas.BulkStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role not in ["admin", "support"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.query(models.Ticket).filter(models.Ticket.id.in_(payload.ticket_ids)).update(
        {"status": payload.status}, synchronize_session=False
    )
    db.commit()
    return success_response(message=f"Successfully updated status for {len(payload.ticket_ids)} tickets")

@router.post("/tickets/bulk-assign", response_model=schemas.APIResponse)
def bulk_assign(payload: schemas.BulkAssignUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role not in ["admin", "support"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.query(models.Ticket).filter(models.Ticket.id.in_(payload.ticket_ids)).update(
        {"assigned_to": payload.assigned_to}, synchronize_session=False
    )
    db.commit()
    return success_response(message=f"Successfully assigned {len(payload.ticket_ids)} tickets")

@router.post("/tickets/bulk-delete", response_model=schemas.APIResponse)
def bulk_delete(payload: schemas.BulkTicketAction, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can bulk delete")
        
    # Phase 2: Soft delete logic
    db.query(models.Ticket).filter(models.Ticket.id.in_(payload.ticket_ids)).update(
        {"is_deleted": True, "deleted_at": datetime.utcnow()}, synchronize_session=False
    )
    db.commit()
    return success_response(message=f"Successfully moved {len(payload.ticket_ids)} tickets to trash")

# --- PHASE 2: SAVED FILTERS ---

@router.post("/saved-filters", response_model=schemas.APIResponse)
def create_saved_filter(filter_data: schemas.SavedFilterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    new_filter = models.SavedFilter(
        user_id=current_user.id,
        name=filter_data.name,
        filter_criteria=filter_data.filter_criteria
    )
    db.add(new_filter)
    db.commit()
    db.refresh(new_filter)
    
    return success_response(data=schemas.SavedFilterResponse.from_orm(new_filter), message="Filter saved successfully")

@router.get("/saved-filters", response_model=schemas.APIResponse)
def get_saved_filters(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    filters = db.query(models.SavedFilter).filter(models.SavedFilter.user_id == current_user.id).order_by(models.SavedFilter.created_at.desc()).all()
    filter_data = [schemas.SavedFilterResponse.from_orm(f) for f in filters]
    
    return success_response(data=filter_data, message="Saved filters retrieved")

# --- PHASE 2: TRASH CAN (SOFT DELETE & RESTORE) ---

@router.get("/tickets/trash", response_model=schemas.APIResponse)
def get_trashed_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    trashed = db.query(models.Ticket).filter(models.Ticket.is_deleted == True).order_by(models.Ticket.deleted_at.desc()).all()
    ticket_data = [schemas.TicketResponse.from_orm(t) for t in trashed]
    
    return success_response(data=ticket_data, message="Trash can retrieved")

@router.post("/tickets/{ticket_id}/restore", response_model=schemas.APIResponse)
def restore_ticket(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id, models.Ticket.is_deleted == True).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Trashed ticket not found")
        
    ticket.is_deleted = False
    ticket.deleted_at = None
    db.commit()
    
    return success_response(message=f"Ticket #{ticket_id} restored successfully")