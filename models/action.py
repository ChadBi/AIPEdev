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

    # 标准视频文件路径（用于对照播放）
    video_path = Column(String(500), nullable=True)

    # YOLOv8 Pose 标准动作关键点序列（后台批处理后保存）
    # 格式: { "sequence": [ { "keypoints": {...} }, ... ] }
    keypoints = Column(JSON, nullable=True)

    # 关键点识别状态: pending（待处理）, processing（处理中）, completed（已完成）, failed（失败）
    recognition_status = Column(String(20), default="pending", nullable=False)

    # 识别失败的错误信息
    recognition_error = Column(String(500), nullable=True)

    # 实时检测使用的音乐绑定（可选）
    music_id = Column(Integer, ForeignKey("music.id"), nullable=True)

    # 音乐相对标准视频的偏移（毫秒）
    sync_offset_ms = Column(Integer, default=0, nullable=False)

    # 是否已完成对齐
    is_aligned = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

