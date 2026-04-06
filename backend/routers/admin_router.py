from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
import io
import csv
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin Workflow"])

# --- PHASE 2: BASE ADMIN ENDPOINTS ---

@router.get("/tickets", response_model=List[schemas.TicketResponse])
def get_all_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.Ticket).order_by(models.Ticket.created_at.desc()).all()

@router.get("/support-users", response_model=List[schemas.UserResponse])
def get_support_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    # Admins need to see both 'support' and other 'admin' users to assign tickets
    return db.query(models.User).filter(models.User.role.in_(["support", "admin"])).all()


# --- PHASE 5: ADVANCED ADMIN FEATURES (Pagination, Search, Analytics) ---

@router.get("/tickets/search")
def get_all_tickets_paginated(
    page: int = 1,
    limit: int = 10,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    assigned_to: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(models.Ticket)

    # Apply Filters from URL parameters
    if status:
        query = query.filter(models.Ticket.status == status)
    if priority:
        query = query.filter(models.Ticket.priority == priority)
    if assigned_to:
        query = query.filter(models.Ticket.assigned_to == assigned_to)
        
    # Apply Keyword Search (Looks in Title OR Description)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.Ticket.title.ilike(search_term),
                models.Ticket.description.ilike(search_term)
            )
        )

    # Calculate Pagination math
    total_records = query.count()
    total_pages = (total_records + limit - 1) // limit
    offset = (page - 1) * limit

    # Execute with Limit and Offset so we only pull 10 (or whatever the limit is) from the DB
    tickets = query.order_by(models.Ticket.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "data": tickets,
        "meta": {
            "current_page": page,
            "limit": limit,
            "total_records": total_records,
            "total_pages": total_pages
        }
    }

@router.get("/analytics")
def get_dashboard_analytics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Status Distribution (Count of Open, Closed, etc.)
    status_counts = db.query(models.Ticket.status, func.count(models.Ticket.id)).group_by(models.Ticket.status).all()
    
    # Priority Distribution (Count of Low, High, etc.)
    priority_counts = db.query(models.Ticket.priority, func.count(models.Ticket.id)).group_by(models.Ticket.priority).all()
    
    # Most Active Users (Top 5 users who submitted the most tickets)
    active_users = db.query(models.Ticket.created_by, func.count(models.Ticket.id).label('total'))\
                     .group_by(models.Ticket.created_by).order_by(func.count(models.Ticket.id).desc()).limit(5).all()

    return {
        "status_distribution": dict(status_counts),
        "priority_distribution": dict(priority_counts),
        "active_users": [{"user_id": u[0], "ticket_count": u[1]} for u in active_users]
    }

@router.get("/export-csv")
def export_tickets_csv(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tickets = db.query(models.Ticket).order_by(models.Ticket.created_at.desc()).all()
    
    # Create an in-memory string buffer so we don't have to save a file to the hard drive
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write Headers
    writer.writerow(["Ticket ID", "Title", "Category", "Status", "Priority", "Created At", "Assigned To ID"])
    
    # Write Data Rows
    for t in tickets:
        writer.writerow([t.id, t.title, t.category, t.status, t.priority, t.created_at, t.assigned_to])
        
    output.seek(0)
    
    # Stream the file back to the browser so it instantly downloads
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=it_helpdesk_tickets_export.csv"}
    )