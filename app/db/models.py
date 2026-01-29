"""数据库模型定义。"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.session import Base


class User(Base):
	"""用户表模型。"""
	__tablename__ = "users"

	id = Column(Integer, primary_key=True, index=True)
	# 用户名：唯一
	username = Column(String(50), unique=True, index=True, nullable=False)
	# 邮箱：唯一
	email = Column(String(120), unique=True, index=True, nullable=False)
	# 哈希后的密码
	hashed_password = Column(String(255), nullable=False)
	# 是否启用
	is_active = Column(Boolean, default=True)
	# 创建时间
	created_at = Column(DateTime, default=datetime.utcnow)