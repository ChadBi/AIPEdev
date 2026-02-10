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

    # 视频文件存储路径 (相对路径或绝对路径)
    file_path = Column(String(255), nullable=False)
    
    # 视频帧率 (FPS)
    fps = Column(Integer, nullable=True)
    
    # 总帧数
    total_frames = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
