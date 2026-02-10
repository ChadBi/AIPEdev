from sqlalchemy import Column, Integer, String
from core.database import Base

class User(Base):
    """
    用户模型
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # 用户名 (唯一)
    username = Column(String(50), unique=True, index=True, nullable=False)
    
    # 加密后的密码哈希值
    hashed_password = Column(String(255), nullable=False)
    
    # 角色（所有用户权限相同）
    role = Column(String(20), default="user")
