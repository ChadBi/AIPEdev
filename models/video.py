from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from core.database import Base

class Video(Base):
    """
    视频记录模型

    存储用户上传的运动视频元数据。
    """
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)

    # 关联用户
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 关联音乐（可选，用于实时检测时自动播放）
    music_id = Column(Integer, ForeignKey("music.id"), nullable=True)

    # 视频文件存储路径 (相对路径或绝对路径)
    file_path = Column(String(255), nullable=False)

    # 视频帧率 (FPS)
    fps = Column(Integer, nullable=True)

    # 总帧数
    total_frames = Column(Integer, nullable=True)

    # 同步配置ID（如果有手动对齐配置）
    sync_config_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
