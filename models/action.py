from sqlalchemy import Column, Integer, String, JSON, DateTime
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

    created_at = Column(DateTime, default=datetime.utcnow)

