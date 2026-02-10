from datetime import datetime, timedelta
import hashlib
import bcrypt
from jose import jwt
from core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# =============================================================================
# 安全与加密工具
# =============================================================================

def _pre_hash(password: str) -> str:
    """
    密码预处理
    
    bcrypt 原生算法有 72 字节的长度限制。
    为避免长密码报错，先使用 SHA256 将密码压缩为固定长度的哈希值。
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def hash_password(password: str) -> str:
    """
    密码加密 (SHA256 + bcrypt)
    """
    # bcrypt 需要 bytes 类型输入
    pw_bytes = _pre_hash(password).encode('utf-8')
    # 生成盐并加密
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """
    密码验证
    """
    pw_bytes = _pre_hash(password).encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(pw_bytes, hashed_bytes)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """
    生成 JWT Access Token
    
    参数:
    - data: 载荷数据 (通常包含 user_id)
    - expires_delta: 可选的过期时间增量
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
