from fastapi import APIRouter, Depends, HTTPException
from app.database import get_database
from app.domain import User
from app.auth_utils import get_current_active_db_user

router = APIRouter()

@router.get("/me", response_model=User, summary="Get current user")
async def read_users_me(current_user: User = Depends(get_current_active_db_user)):
    return current_user
