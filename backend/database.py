from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# The @ in your password (arun@123) is URL-encoded as %40 so it doesn't break the connection string!
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:arun%40123@localhost/ticket_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()