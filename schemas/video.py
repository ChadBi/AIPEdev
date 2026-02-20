from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class VideoBase(BaseModel):
    """
    视频基础模型

    定义视频的基本属性，如文件路径、帧率等。
    """
    file_path: str
    fps: int | None = None
    total_frames: int | None = None


class VideoCreate(VideoBase):
    """
    创建视频记录请求模型
    """
    music_id: Optional[int] = None


class VideoUpdate(BaseModel):
    """
    更新视频记录请求模型
    """
    music_id: Optional[int] = None


class VideoOut(VideoBase):
    """
    视频信息响应模型

    用于 API 响应，包含数据库 ID 和创建时间。
    """
    id: int
    user_id: int
    music_id: Optional[int] = None
    sync_config_id: Optional[int] = None
    created_at: datetime

    class Config:
        # Pydantic V2 配置 (兼容 ORM 对象)
        from_attributes = True


class VideoWithSyncOut(VideoOut):
    """
    包含同步配置信息的视频响应模型
    """
    music_name: Optional[str] = None
    music_file_path: Optional[str] = None
    sync_offset_ms: Optional[int] = None
    is_aligned: Optional[bool] = False
