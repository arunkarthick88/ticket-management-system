from sqlalchemy.orm import Session
from datetime import datetime
import models

class TicketRepository:
    def get_all_active(self, db: Session):
        """Fetches all tickets that have NOT been soft-deleted."""
        return db.query(models.Ticket).filter(models.Ticket.is_deleted == False).order_by(models.Ticket.created_at.desc()).all()

    def get_by_id(self, db: Session, ticket_id: int):
        return db.query(models.Ticket).filter(models.Ticket.id == ticket_id, models.Ticket.is_deleted == False).first()

    def create(self, db: Session, ticket_data: dict, user_id: int, due_at: datetime):
        # Extract tag_ids if they exist, remove from dict so SQLAlchemy doesn't crash
        tag_ids = ticket_data.pop('tag_ids', [])
        
        new_ticket = models.Ticket(**ticket_data, created_by=user_id, due_at=due_at)
        db.add(new_ticket)
        db.commit()
        db.refresh(new_ticket)

        # Handle Phase 2: Many-to-Many Tags Assignment
        if tag_ids:
            tags = db.query(models.Tag).filter(models.Tag.id.in_(tag_ids)).all()
            new_ticket.tags.extend(tags)
            db.commit()
            db.refresh(new_ticket)

        return new_ticket

    def soft_delete(self, db: Session, ticket_id: int):
        """Phase 2: Soft Delete - Hides the ticket instead of erasing it."""
        ticket = self.get_by_id(db, ticket_id)
        if ticket:
            ticket.is_deleted = True
            ticket.deleted_at = datetime.utcnow()
            db.commit()
            db.refresh(ticket)
        return ticket

ticket_repo = TicketRepository()