from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime

class ActionBase(BaseModel):
    name: str
    description: str | None = None
    keypoints: Dict[str, Any] | None = None  # 可选，评分时动态识别

class ActionCreate(ActionBase):
    """创建动作请求模型"""
    pass

class ActionUpdate(BaseModel):
    """更新动作请求模型"""
    description: str | None = None
    keypoints: Dict[str, Any] | None = None

class ActionOut(ActionBase):
    """动作响应模型"""
    id: int
    video_path: str | None = None
    created_at: datetime

    class Config:
        # Pydantic V2 配置 (兼容 ORM 对象)
        from_attributes = True
