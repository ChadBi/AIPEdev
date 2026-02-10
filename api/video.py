from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from core.database import get_db
from core.deps import get_current_user
from core.config import UPLOAD_DIR
from models.user import User
from models.video import Video
from schemas.video import VideoOut, VideoCreate
from crud import video as video_crud
from services.recognition_service import get_video_metadata

router = APIRouter()

# 视频上传目录（从配置文件读取）
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=VideoOut)
def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    上传视频文件

    功能：
    1. 接收上传的视频文件
    2. 生成唯一文件名并保存到服务器 'uploads/videos' 目录
    3. 使用 OpenCV 自动提取视频帧率和总帧数
    4. 在数据库中创建视频记录

    参数：
    - file: 视频文件 (Multipart/form-data)

    返回：
    - 创建的视频记录信息
    """
    # 验证文件类型 (简单验证)
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # 生成唯一文件名
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    if not file_ext:
        file_ext = ".mp4"  # 默认后缀
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # 自动提取视频元数据（fps, total_frames）
    metadata = get_video_metadata(file_path)

    # 创建数据库记录
    video_in = VideoCreate(
        file_path=file_path,
        fps=metadata.get("fps"),
        total_frames=metadata.get("total_frames")
    )
    return video_crud.create_video(db, video_in, current_user.id)

@router.get("/", response_model=list[VideoOut])
def list_videos(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """
    获取所有视频列表

    参数：
    - skip: 跳过记录数
    - limit: 返回记录数
    """
    return video_crud.get_videos(db, skip, limit)

@router.get("/me", response_model=list[VideoOut])
def list_my_videos(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户的视频列表

    参数：
    - skip: 跳过记录数
    - limit: 返回记录数
    """
    return video_crud.get_user_videos(db, current_user.id, skip, limit)
