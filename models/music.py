from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from datetime import datetime
from core.database import Base


class Music(Base):
    """
    音乐文件模型

    存储健美操音乐的元数据，包括名称、时长、文件路径等。
    用于实时检测时的自动音乐播放和动作对齐。
    """
    __tablename__ = "music"

    id = Column(Integer, primary_key=True, index=True)

    # 音乐名称
    name = Column(String(255), nullable=False)

    # 文件路径 (相对路径或绝对路径)
    file_path = Column(String(512), nullable=False)

    # 音乐时长（秒）
    duration_seconds = Column(Float, nullable=True)

    # 文件大小（字节）
    file_size = Column(Integer, nullable=True)

    # 是否为默认音乐
    is_default = Column(Boolean, default=False)

    # 上传者ID
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
