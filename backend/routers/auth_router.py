from fastapi import APIRouter, Depends, HTTPException
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

@router.post("/login", response_model=schemas.APIResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    # FIX: We just pass the data now, removing the expires_delta parameter completely
    access_token = auth.create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )
    
    return success_response(
        data={"access_token": access_token, "token_type": "bearer", "role": user.role},
        message="Login successful"
    )

@router.get("/me", response_model=schemas.APIResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return success_response(
        data=schemas.UserResponse.from_orm(current_user),
        message="User profile retrieved successfully"
    )