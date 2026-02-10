from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User
from schemas.user import UserCreate, UserLogin
from services.auth_service import (
    hash_password,
    verify_password,
    create_access_token
)
from crud import user as user_crud

router = APIRouter(tags=["Auth"])

# ========= 注册 =========

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    用户注册
    
    - 检查用户名是否已存在
    - 对密码进行哈希加密（bcrypt）
    - 创建新用户
    """
    exists = user_crud.get_user_by_username(db, user.username)
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = user_crud.create_user(
        db=db,
        username=user.username,
        hashed_password=hash_password(user.password)
    )

    return {"id": new_user.id, "username": new_user.username}

# ========= 登录 =========

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    用户登录 (OAuth2 Password Flow)
    
    - 验证用户名和密码
    - 颁发 JWT Access Token
    - 兼容 Swagger UI 的 Authorize 按钮
    """
    db_user = user_crud.get_user_by_username(db, form_data.username)
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token(db_user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }
