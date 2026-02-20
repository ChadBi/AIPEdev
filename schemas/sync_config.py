from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SyncConfigBase(BaseModel):
    """
    同步配置基础模型
    """
    video_id: int
    music_id: int
    sync_offset_ms: Optional[int] = 0
    is_manually_aligned: Optional[bool] = False
    alignment_note: Optional[str] = None


class SyncConfigCreate(SyncConfigBase):
    """
    创建同步配置请求模型
    """
    pass


class SyncConfigUpdate(BaseModel):
    """
    更新同步配置请求模型（所有字段都是可选的）
    """
    music_id: Optional[int] = None
    sync_offset_ms: Optional[int] = None
    is_manually_aligned: Optional[bool] = None
    alignment_note: Optional[str] = None


class SyncConfigOut(SyncConfigBase):
    """
    同步配置响应模型
    """
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SyncAlignRequest(BaseModel):
    """
    手动对齐请求模型
    """
    video_id: int
    music_id: int
    sync_offset_ms: int
    alignment_note: Optional[str] = None


class SyncAlignResponse(BaseModel):
    """
    对齐完成响应模型
    """
    sync_config_id: int
    video_id: int
    music_id: int
    sync_offset_ms: int
    video_time_at_aligned: float  # 对齐时视频的时间点（秒）
    music_time_at_aligned: float  # 对齐时音乐的起始时间点（秒）
    message: str
