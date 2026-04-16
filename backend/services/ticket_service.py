from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
import models, schemas
from repositories.ticket_repo import ticket_repo

SLA_HOURS = {
    "Low": 72,
    "Medium": 48,
    "High": 24,
    "Urgent": 8
}

class TicketService:
    def calculate_due_at(self, priority: str, start_time: datetime = None) -> datetime:
        if start_time is None:
            start_time = datetime.utcnow()
        hours = SLA_HOURS.get(priority, 48)
        return start_time + timedelta(hours=hours)

    def create_ticket(self, db: Session, ticket_in: schemas.TicketCreate, current_user: models.User):
        if current_user.role != "user":
            raise HTTPException(status_code=403, detail="Only standard users can create tickets")
            
        due_at = self.calculate_due_at(ticket_in.priority)
        
        # Pass to repository to actually save it
        return ticket_repo.create(db, ticket_in.dict(), current_user.id, due_at)

    def soft_delete_ticket(self, db: Session, ticket_id: int, current_user: models.User):
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can delete tickets")
            
        deleted_ticket = ticket_repo.soft_delete(db, ticket_id)
        if not deleted_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or already deleted")
            
        return deleted_ticket

ticket_service = TicketService()