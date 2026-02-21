from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import shutil
import os
import uuid

from core.database import get_db
from core.deps import get_current_user
from core.config import UPLOAD_DIR
from models.user import User
from models.music import Music
from schemas.music import MusicOut, MusicCreate, MusicListResponse
from crud import music as music_crud
from utils.file import normalize_storage_path

router = APIRouter()

# 音乐上传目录
MUSIC_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "music")
os.makedirs(MUSIC_UPLOAD_DIR, exist_ok=True)


def get_audio_duration(file_path: str) -> float | None:
    """
    获取音频文件时长（秒）
    使用 mutagen 或 ffprobe，如果不可用则返回 None
    """
    try:
        import mutagen
        audio = mutagen.File(file_path)
        if audio and audio.info:
            return float(audio.info.length)
    except ImportError:
        pass
    except Exception:
        pass

    # 尝试使用 ffprobe
    try:
        import subprocess
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", file_path
            ],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
    except (FileNotFoundError, ValueError, Exception):
        pass

    return None


@router.post("/upload", response_model=MusicOut)
def upload_music(
    file: UploadFile = File(...),
    name: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    上传音乐文件

    功能：
    1. 接收上传的音频文件（mp3/wav等）
    2. 生成唯一文件名并保存到服务器
    3. 提取音频时长（如果可能）
    4. 在数据库中创建音乐记录

    参数：
    - file: 音频文件
    - name: 自定义音乐名称（可选，如果未提供则使用文件名）

    返回：
    - 创建的音乐记录信息
    """
    # 验证文件类型
    allowed_types = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac"}
    content_type = file.content_type or ""

    if content_type not in allowed_types and not any(
        file.filename.lower().endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".flac"]
    ):
        raise HTTPException(status_code=400, detail="只支持 MP3、WAV、OGG、FLAC 格式的音频文件")

    # 生成唯一文件名
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
    if not file_ext:
        file_ext = ".mp3"
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(MUSIC_UPLOAD_DIR, file_name)

    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存文件失败: {str(e)}")

    # 获取文件大小
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else None

    # 获取音频时长
    duration = get_audio_duration(file_path)

    # 获取音乐名称
    music_name = name or (file.filename.rsplit(".", 1)[0] if file.filename else "未命名音乐")

    # 创建数据库记录
    music_create = MusicCreate(
        name=music_name,
        file_path=normalize_storage_path(file_path),
        duration_seconds=duration,
        file_size=file_size,
        is_default=False
    )

    return music_crud.create_music(db, music_create, uploaded_by=current_user.id)


@router.get("/", response_model=MusicListResponse)
def list_music(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    获取音乐列表

    参数：
    - skip: 跳过记录数
    - limit: 返回记录数
    """
    items = music_crud.get_music_list(db, skip=skip, limit=limit)
    total = music_crud.get_music_count(db)
    return {"items": items, "total": total}


@router.get("/me", response_model=list[MusicOut])
def list_my_music(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户上传的音乐列表
    """
    return music_crud.get_user_music(db, current_user.id, skip=skip, limit=limit)


@router.get("/{music_id}", response_model=MusicOut)
def get_music(music_id: int, db: Session = Depends(get_db)):
    """
    获取单个音乐详情
    """
    music = music_crud.get_music_by_id(db, music_id)
    if not music:
        raise HTTPException(status_code=404, detail="音乐不存在")
    return music


@router.put("/{music_id}", response_model=MusicOut)
def update_music(
    music_id: int,
    name: str | None = None,
    is_default: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新音乐信息

    参数：
    - name: 新的音乐名称
    - is_default: 是否设为默认音乐
    """
    updates = {}
    if name is not None:
        updates["name"] = name
    if is_default is not None:
        # 如果设为默认，需要将其他音乐设为非默认
        if is_default:
            existing_default = music_crud.get_default_music(db)
            if existing_default and existing_default.id != music_id:
                music_crud.update_music(db, existing_default.id, is_default=False)
        updates["is_default"] = is_default

    music = music_crud.update_music(db, music_id, **updates)
    if not music:
        raise HTTPException(status_code=404, detail="音乐不存在")
    return music


@router.delete("/{music_id}")
def delete_music(
    music_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    删除音乐
    """
    success = music_crud.delete_music(db, music_id)
    if not success:
        raise HTTPException(status_code=404, detail="音乐不存在")
    return {"message": "删除成功"}
