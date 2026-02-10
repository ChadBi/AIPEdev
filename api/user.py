from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from schemas.user import UserOut

router = APIRouter()

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户信息

    需要 Bearer Token 认证。
    """
    return current_user

@router.get("/", response_model=List[UserOut])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    获取用户列表

    参数：
    - skip: 跳过记录数
    - limit: 返回记录数
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users
