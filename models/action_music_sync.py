from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint

from core.database import Base


class ActionMusicSync(Base):
    """
    动作-音乐对齐配置模型

    用于存储某个标准动作与某首音乐的对齐偏移。
    """

    __tablename__ = "action_music_sync"
    __table_args__ = (
        UniqueConstraint("action_id", "music_id", name="uq_action_music_sync_action_music"),
    )

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(Integer, ForeignKey("actions.id"), nullable=False, index=True)
    music_id = Column(Integer, ForeignKey("music.id"), nullable=False, index=True)
    sync_offset_ms = Column(Integer, nullable=False, default=0)
    is_aligned = Column(Boolean, nullable=False, default=False)
    alignment_note = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
