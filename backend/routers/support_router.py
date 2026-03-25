from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/support", tags=["Support Workflow"])

@router.get("/tickets", response_model=List[schemas.TicketResponse])
def get_assigned_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "support":
        raise HTTPException(status_code=403, detail="Support access required")
    return db.query(models.Ticket).filter(models.Ticket.assigned_to == current_user.id).all()