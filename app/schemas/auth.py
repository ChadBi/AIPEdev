"""Pydantic 模型：用于请求与响应的数据校验。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
	"""注册请求体。"""
	username: str
	email: EmailStr
	password: str


class UserOut(BaseModel):
	"""返回给前端的用户信息。"""
	id: int
	username: str
	email: EmailStr
	is_active: bool
	created_at: datetime

	# 支持从 ORM 对象直接读取字段
	model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
	"""登录成功后返回的令牌结构。"""
	access_token: str
	token_type: str
