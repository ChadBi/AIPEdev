from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, Boolean, Text
from datetime import datetime
from core.database import Base


class SyncConfig(Base):
    """
    视频-音乐同步配置模型

    存储标准视频与音乐的同步对齐信息。
    syncOffsetMs 定义：音乐相对于视频的偏移量（毫秒）。
    - 正值：音乐比视频提前播放
    - 负值：音乐比视频延后播放
    """
    __tablename__ = "sync_configs"

    id = Column(Integer, primary_key=True, index=True)

    # 关联的标准视频ID
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, unique=True)

    # 关联的音乐ID
    music_id = Column(Integer, ForeignKey("music.id"), nullable=False)

    # 同步偏移量（毫秒）
    # 正值：音乐提前 | 负值：音乐延后
    sync_offset_ms = Column(Integer, default=0)

    # 手动对齐标记
    is_manually_aligned = Column(Boolean, default=False)

    # 对齐时的备注（如：从第3个八拍开始）
    alignment_note = Column(Text, nullable=True)

    # 创建/更新用户
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
