"""数据库会话与初始化。

SQLAlchemy 负责与数据库交互。
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _get_connect_args(url: str) -> dict:
	"""根据数据库类型调整连接参数。"""
	if url.startswith("sqlite"):
		return {"check_same_thread": False}
	return {}


engine = create_engine(settings.DATABASE_URL, connect_args=_get_connect_args(settings.DATABASE_URL))
# 会话工厂：每个请求会创建一个独立的会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 是所有 ORM 模型的基类
Base = declarative_base()


def get_db():
	"""FastAPI 依赖注入：获取数据库会话。"""
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def init_db() -> None:
	"""创建数据库表（首次启动时使用）。"""
	from app.db import models  # noqa: F401

	Base.metadata.create_all(bind=engine)
