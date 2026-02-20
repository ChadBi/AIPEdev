from sqlalchemy.orm import Session
from models.music import Music
from schemas.music import MusicCreate, MusicOut
from typing import List, Optional
import os


def create_music(db: Session, music: MusicCreate, uploaded_by: Optional[int] = None) -> Music:
    """
    创建音乐记录
    """
    db_music = Music(**music.model_dump(), uploaded_by=uploaded_by)
    db.add(db_music)
    db.commit()
    db.refresh(db_music)
    return db_music


def get_music_by_id(db: Session, music_id: int) -> Optional[Music]:
    """
    根据 ID 获取音乐记录
    """
    return db.query(Music).filter(Music.id == music_id).first()


def get_music_list(db: Session, skip: int = 0, limit: int = 100) -> List[Music]:
    """
    获取音乐列表
    """
    return db.query(Music).offset(skip).limit(limit).all()


def get_user_music(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Music]:
    """
    获取用户上传的音乐列表
    """
    return db.query(Music).filter(Music.uploaded_by == user_id).offset(skip).limit(limit).all()


def get_default_music(db: Session) -> Optional[Music]:
    """
    获取默认音乐
    """
    return db.query(Music).filter(Music.is_default == True).first()


def update_music(db: Session, music_id: int, **kwargs) -> Optional[Music]:
    """
    更新音乐记录
    """
    db_music = get_music_by_id(db, music_id)
    if not db_music:
        return None

    for key, value in kwargs.items():
        if hasattr(db_music, key):
            setattr(db_music, key, value)

    db.commit()
    db.refresh(db_music)
    return db_music


def delete_music(db: Session, music_id: int) -> bool:
    """
    删除音乐记录（同时删除文件）
    """
    db_music = get_music_by_id(db, music_id)
    if not db_music:
        return False

    # 删除文件
    if os.path.exists(db_music.file_path):
        try:
            os.remove(db_music.file_path)
        except Exception:
            pass  # 忽略文件删除错误

    db.delete(db_music)
    db.commit()
    return True


def get_music_count(db: Session) -> int:
    """
    获取音乐总数
    """
    return db.query(Music).count()
