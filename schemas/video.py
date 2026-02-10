from pydantic import BaseModel
from datetime import datetime

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

    继承自 VideoBase，目前不需要额外字段。
    """
    pass

class VideoOut(VideoBase):
    """
    视频信息响应模型

    用于 API 响应，包含数据库 ID 和创建时间。
    """
    id: int
    user_id: int
    created_at: datetime

    class Config:
        # Pydantic V2 配置 (兼容 ORM 对象)
        from_attributes = True
