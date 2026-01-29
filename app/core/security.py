"""安全相关工具：密码哈希与 JWT。"""

from datetime import datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# 密码哈希上下文：bcrypt 是常用、安全的哈希算法
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""校验明文密码是否与哈希密码匹配。"""
	return pwd_context.verify(plain_password, hashed_password)



def get_password_hash(password: str) -> str:
    """将明文密码转换为哈希值后存储。"""
    b = password.encode("utf-8")
    print("DEBUG password char_len =", len(password), "byte_len =", len(b), "repr =", repr(password[:30]))
    print("psaaword = " + password)
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
	"""创建 JWT 访问令牌。

	subject 通常是用户名或用户 ID。
	"""
	expire = datetime.utcnow() + (
		expires_delta
		if expires_delta is not None
		else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
	)
	to_encode = {"sub": subject, "exp": expire}
	return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
	"""解析 JWT，取出 subject。失败返回 None。"""
	try:
		payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
		return payload.get("sub")
	except JWTError:
		return None
