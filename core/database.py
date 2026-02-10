from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import DATABASE_URL

# =============================================================================
# 数据库连接配置
# =============================================================================

# 创建数据库引擎
# pool_pre_ping=True: 每次连接前进行 Ping 检测，防止 MySQL 连接超时断开
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明式基类 (所有 Model 需继承此类)
Base = declarative_base()

def get_db():
    """
    获取数据库会话 (Dependency Injection)
    
    用于 FastAPI 的 Depends() 依赖注入。
    请求结束时自动关闭会话。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
