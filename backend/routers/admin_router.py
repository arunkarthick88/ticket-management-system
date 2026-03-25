from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin Workflow"])

@router.get("/tickets", response_model=List[schemas.TicketResponse])
def get_all_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(models.Ticket).order_by(models.Ticket.created_at.desc()).all()

# We need this so the Admin can populate a dropdown of support staff to assign tickets to!
@router.get("/support-users", response_model=List[schemas.UserResponse])
def get_support_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(models.User).filter(models.User.role == "support").all()