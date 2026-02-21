from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean
from datetime import datetime
from core.database import Base

class Action(Base):
    """
    标准动作模型
    
    存储预定义的标准动作数据，作为评分的参考基准。
    """
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    
    # 动作名称 
    name = Column(String(100), unique=True, nullable=False)
    
    # 动作描述
    description = Column(String(255), nullable=True)

    # YOLOv8 Pose 标准动作关键点序列
    # 格式: { "sequence": [ { "keypoints": {...} }, ... ] }
    # 注意：新方案中不再预存关键点，在评分时动态识别
    keypoints = Column(JSON, nullable=True)
    
    # 标准视频文件路径（用于对照播放）
    video_path = Column(String(500), nullable=True)

    # 实时检测使用的音乐绑定（可选）
    music_id = Column(Integer, ForeignKey("music.id"), nullable=True)

    # 音乐相对标准视频的偏移（毫秒）
    sync_offset_ms = Column(Integer, default=0, nullable=False)

    # 是否已完成对齐
    is_aligned = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

