from pydantic import BaseModel
from typing import Dict, List
from datetime import datetime

class FrameScore(BaseModel):
    """帧级别评分"""
    frame_index: int
    score: float
    timestamp: float

class ScoreOut(BaseModel):
    """
    评分结果响应模型

    包含评分记录 ID、总分、各关节得分、帧级评分、视频路径、时间延迟和文字反馈。
    """
    score_id: int
    action_id: int | None = None
    video_id: int | None = None
    standard_video_path: str | None = None
    user_video_path: str | None = None
    student_video_delay: float = 0.0
    total_score: float
    joint_scores: Dict[str, float]
    frame_scores: List[FrameScore] = []
    feedback: List[str]

class ScoreHistoryItem(BaseModel):
    """
    评分历史记录响应模型
    """
    id: int
    action_id: int
    action_name: str
    total_score: float
    joint_scores: Dict[str, float]
    feedback: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

