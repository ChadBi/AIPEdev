from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MusicBase(BaseModel):
    """
    音乐基础模型
    """
    name: str
    file_path: str
    duration_seconds: Optional[float] = None
    file_size: Optional[int] = None
    is_default: Optional[bool] = False


class MusicCreate(MusicBase):
    """
    创建音乐请求模型
    """
    pass


class MusicOut(MusicBase):
    """
    音乐信息响应模型
    """
    id: int
    uploaded_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MusicListResponse(BaseModel):
    """
    音乐列表响应
    """
    items: list[MusicOut]
    total: int
