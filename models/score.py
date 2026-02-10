from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from core.database import Base

class ScoreRecord(Base):
    """
    评分记录模型
    
    存储用户每次动作练习的评分结果、关节得分和AI反馈。
    """
    __tablename__ = "score_records"

    id = Column(Integer, primary_key=True, index=True)

    # 关联用户 (可为空，支持匿名测试)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 关联标准动作 (删除动作时级联删除相关评分记录)
    action_id = Column(Integer, ForeignKey("actions.id", ondelete="CASCADE"), nullable=False)
    
    # 关联学生视频 (可为空)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True)
    
    # 学生视频时间延迟(秒)
    student_video_delay = Column(Float, default=0.0, nullable=False)

    # 总分 (0-100)
    total_score = Column(Float, nullable=False)

    # 各关节得分详情 (JSON)
    # 格式: { "left_knee": 85.5, "right_knee": 90.0, ... }
    joint_scores = Column(JSON, nullable=False)
    
    # 帧级得分 (JSON)
    # 格式: [{"frame_index": 0, "score": 85.5, "timestamp": 0.0}, ...]
    frame_scores = Column(JSON, nullable=True)
    
    # AI 建议反馈 (JSON List)
    # 格式: ["左膝弯曲幅度不足", "动作节奏良好"]
    feedback = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
