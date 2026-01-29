"""认证相关的服务层逻辑。

服务层用于封装数据库操作与业务逻辑。
"""

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.db.models import User
from app.schemas.auth import UserCreate


def get_user_by_username(db: Session, username: str) -> User | None:
	"""通过用户名查询用户。"""
	return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
	"""通过邮箱查询用户。"""
	return db.query(User).filter(User.email == email).first()


def create_user(db: Session, user_in: UserCreate) -> User:
	"""创建用户。

	注意：密码会被哈希存储，而不是明文。
	"""
	user = User(
		username=user_in.username,
		email=user_in.email,
		hashed_password=get_password_hash(user_in.password),
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
	"""校验用户名与密码，返回用户对象或 None。"""
	user = get_user_by_username(db, username)
	if not user:
		return None
	if not verify_password(password, user.hashed_password):
		return None
	return user

def get_all_users_all(db: Session) -> list[User]:
    """获取所有用户列表。"""
    return db.query(User).all()
