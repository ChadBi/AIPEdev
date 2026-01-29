"""认证相关 API 路由。

这里定义：注册、登录、获取当前用户信息。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import Token, UserCreate, UserOut
from app.services.auth_service import (
	authenticate_user,
	create_user,
	get_user_by_email,
	get_user_by_username,
    get_all_users_all,
)
from app.core.security import create_access_token, decode_access_token

router = APIRouter()
# OAuth2 密码模式：用于从请求头读取 Bearer Token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> UserOut:
	"""注册接口。

	参数:
	- user_in: 包含用户名、邮箱和密码
	- db: 数据库会话（由依赖注入提供）
	"""
	if get_user_by_username(db, user_in.username):
		raise HTTPException(status_code=409, detail="用户名已存在")
	if get_user_by_email(db, user_in.email):
		raise HTTPException(status_code=409, detail="邮箱已存在")
	return create_user(db, user_in)


@router.post("/login", response_model=Token)
def login(
	form_data: OAuth2PasswordRequestForm = Depends(),
	db: Session = Depends(get_db),
) -> Token:
	"""登录接口。

	使用 OAuth2 的表单字段：
	- username: 实际上是用户名
	- password: 明文密码
	"""
	user = authenticate_user(db, form_data.username, form_data.password)
	if not user:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="用户名或密码错误",
			headers={"WWW-Authenticate": "Bearer"},
		)
	access_token = create_access_token(subject=user.username)
	return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserOut)
def get_me(
	token: str = Depends(oauth2_scheme),
	db: Session = Depends(get_db),
) -> UserOut:
	"""获取当前登录用户。

	通过请求头 Authorization: Bearer <token> 传入。
	"""
	username = decode_access_token(token)
	if not username:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="无效的令牌",
			headers={"WWW-Authenticate": "Bearer"},
		)
	user = get_user_by_username(db, username)
	if not user or not user.is_active:
		raise HTTPException(status_code=401, detail="用户不可用")
	return user

@router.get("/userall", response_model=list[UserOut])
def get_all_users(db: Session = Depends(get_db)) -> list[UserOut]:
	"""获取所有用户列表。"""
	users = get_all_users_all(db)
	return users
