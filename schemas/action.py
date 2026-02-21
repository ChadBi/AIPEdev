from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime

class ActionBase(BaseModel):
    name: str
    description: str | None = None
    keypoints: Dict[str, Any] | None = None  # 可选，评分时动态识别
    music_id: int | None = None
    sync_offset_ms: int = 0
    is_aligned: bool = False

class ActionCreate(ActionBase):
    """创建动作请求模型"""
    pass

class ActionUpdate(BaseModel):
    """更新动作请求模型"""
    description: str | None = None
    keypoints: Dict[str, Any] | None = None
    music_id: int | None = None
    sync_offset_ms: int | None = None
    is_aligned: bool | None = None

class ActionOut(ActionBase):
    """动作响应模型"""
    id: int
    video_path: str | None = None
    created_at: datetime

    class Config:
        # Pydantic V2 配置 (兼容 ORM 对象)
        from_attributes = True


class ActionLiveConfigUpdate(BaseModel):
    """更新动作实时配置"""
    music_id: int | None = None
    sync_offset_ms: int | None = None
    is_aligned: bool | None = None


class ActionLiveConfigOut(BaseModel):
    """动作实时配置响应"""
    action_id: int
    music_id: int | None = None
    sync_offset_ms: int
    is_aligned: bool
