from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
import models, schemas, auth
from database import get_db

# --- PHASE 2: Standardized Responses ---
from utils.response import success_response, error_response

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.APIResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(name=user.name, email=user.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return success_response(
        data=schemas.UserResponse.from_orm(new_user), 
        message="User registered successfully"
    )

# NOTE: Removed 'response_model=schemas.APIResponse' here to satisfy Swagger UI requirements
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        # Swagger specifically looks for 401 or 400 with a "detail" field
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = auth.create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )
    
    # CRITICAL: Swagger UI requires 'access_token' and 'token_type' at the TOP LEVEL
    # Your frontend will still be able to read this just fine!
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role,
        "status": "success" # Optional: kept for frontend consistency
    }

@router.get("/me", response_model=schemas.APIResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return success_response(
        data=schemas.UserResponse.from_orm(current_user),
        message="User profile retrieved successfully"
    )