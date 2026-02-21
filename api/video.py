from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from core.database import get_db
from core.deps import get_current_user
from core.config import UPLOAD_DIR
from models.user import User
from models.video import Video
from schemas.video import VideoOut, VideoCreate, VideoUpdate, VideoWithSyncOut
from crud import video as video_crud
from crud import music as music_crud
from crud import sync_config as sync_crud
from services.recognition_service import get_video_metadata
from utils.file import normalize_storage_path

router = APIRouter()

# 视频上传目录（从配置文件读取）
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=VideoOut)
def upload_video(
    file: UploadFile = File(...),
    music_id: int | None = Query(None, description="关联的音乐ID（可选）"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    上传视频文件

    功能：
    1. 接收上传的视频文件
    2. 生成唯一文件名并保存到服务器 'uploads/videos' 目录
    3. 使用 OpenCV 自动提取视频帧率和总帧数
    4. 在数据库中创建视频记录（可关联音乐）

    参数：
    - file: 视频文件 (Multipart/form-data)
    - music_id: 关联的音乐ID（可选）

    返回：
    - 创建的视频记录信息
    """
    # 验证文件类型 (简单验证)
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # 验证 music_id
    if music_id:
        music = music_crud.get_music_by_id(db, music_id)
        if not music:
            raise HTTPException(status_code=400, detail="关联的音乐不存在")

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
        file_path=normalize_storage_path(file_path),
        fps=metadata.get("fps"),
        total_frames=metadata.get("total_frames"),
        music_id=music_id
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


@router.get("/me/count", response_model=dict)
def get_my_video_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户视频总数
    """
    return {"count": video_crud.get_user_video_count(db, current_user.id)}

@router.get("/{video_id}", response_model=VideoWithSyncOut)
def get_video_with_sync(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    获取视频详情（包含同步配置信息）
    """
    video = video_crud.get_video_by_id(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    # 获取音乐信息
    music_name = None
    music_file_path = None
    if video.music_id:
        music = music_crud.get_music_by_id(db, video.music_id)
        if music:
            music_name = music.name
            music_file_path = normalize_storage_path(music.file_path)

    # 获取同步配置
    sync_offset_ms = None
    is_aligned = False
    sync_config = sync_crud.get_sync_config_by_video_id(db, video.id)
    resolved_sync_id = None
    if sync_config:
        resolved_sync_id = sync_config.id
        sync_offset_ms = sync_config.sync_offset_ms
        is_aligned = sync_config.is_manually_aligned

    return VideoWithSyncOut(
        id=video.id,
        user_id=video.user_id,
        file_path=normalize_storage_path(video.file_path),
        fps=video.fps,
        total_frames=video.total_frames,
        music_id=video.music_id,
        sync_config_id=resolved_sync_id,
        created_at=video.created_at,
        music_name=music_name,
        music_file_path=music_file_path,
        sync_offset_ms=sync_offset_ms,
        is_aligned=is_aligned
    )

@router.put("/{video_id}", response_model=VideoOut)
def update_video(
    video_id: int,
    music_id: int | None = Query(None, description="关联的音乐ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新视频信息（主要是关联音乐）

    参数：
    - video_id: 视频ID
    - music_id: 新的关联音乐ID（可选，为null表示解除关联）
    """
    video = video_crud.get_video_by_id(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    # 验证 music_id
    if music_id:
        music = music_crud.get_music_by_id(db, music_id)
        if not music:
            raise HTTPException(status_code=400, detail="关联的音乐不存在")

    updates = {}
    if music_id is not None:
        updates["music_id"] = music_id if music_id > 0 else None

    if updates:
        return video_crud.update_video(db, video_id, **updates)
    return video
