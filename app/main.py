"""应用入口：创建 FastAPI 实例并挂载路由。"""

from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.db.session import init_db

# 创建 FastAPI 应用对象。
app = FastAPI(title="AIPEdev")


@app.on_event("startup")
def on_startup() -> None:
	"""应用启动时执行：初始化数据库表。"""
	init_db()


@app.get("/health")
def health_check() -> dict:
	"""健康检查接口：用于快速确认服务可用。"""
	return {"status": "ok"}


# 挂载认证相关路由，统一前缀 /auth
app.include_router(auth_router, prefix="/auth", tags=["auth"])
