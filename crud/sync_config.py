from sqlalchemy.orm import Session
from models.sync_config import SyncConfig
from schemas.sync_config import SyncConfigCreate, SyncConfigUpdate
from typing import Optional, List


def create_sync_config(
    db: Session,
    video_id: int,
    music_id: int,
    sync_offset_ms: int = 0,
    is_manually_aligned: bool = False,
    alignment_note: Optional[str] = None,
    created_by: Optional[int] = None
) -> SyncConfig:
    """
    创建同步配置
    """
    db_sync = SyncConfig(
        video_id=video_id,
        music_id=music_id,
        sync_offset_ms=sync_offset_ms,
        is_manually_aligned=is_manually_aligned,
        alignment_note=alignment_note,
        created_by=created_by
    )
    db.add(db_sync)
    db.commit()
    db.refresh(db_sync)
    return db_sync


def get_sync_config_by_video_id(db: Session, video_id: int) -> Optional[SyncConfig]:
    """
    根据视频ID获取同步配置
    """
    return db.query(SyncConfig).filter(SyncConfig.video_id == video_id).first()


def get_sync_config_by_id(db: Session, sync_id: int) -> Optional[SyncConfig]:
    """
    根据ID获取同步配置
    """
    return db.query(SyncConfig).filter(SyncConfig.id == sync_id).first()


def get_all_sync_configs(db: Session, skip: int = 0, limit: int = 100) -> List[SyncConfig]:
    """
    获取所有同步配置
    """
    return db.query(SyncConfig).offset(skip).limit(limit).all()


def update_sync_config(db: Session, sync_id: int, **kwargs) -> Optional[SyncConfig]:
    """
    更新同步配置
    """
    db_sync = get_sync_config_by_id(db, sync_id)
    if not db_sync:
        return None

    for key, value in kwargs.items():
        if hasattr(db_sync, key):
            setattr(db_sync, key, value)

    db.commit()
    db.refresh(db_sync)
    return db_sync


def upsert_sync_config(
    db: Session,
    video_id: int,
    music_id: int,
    sync_offset_ms: int = 0,
    is_manually_aligned: bool = False,
    alignment_note: Optional[str] = None,
    created_by: Optional[int] = None
) -> SyncConfig:
    """
    创建或更新同步配置（如果存在则更新，不存在则创建）
    """
    db_sync = get_sync_config_by_video_id(db, video_id)

    if db_sync:
        db_sync.music_id = music_id
        db_sync.sync_offset_ms = sync_offset_ms
        db_sync.is_manually_aligned = is_manually_aligned
        db_sync.alignment_note = alignment_note
        db.commit()
        db.refresh(db_sync)
        return db_sync
    else:
        return create_sync_config(
            db=db,
            video_id=video_id,
            music_id=music_id,
            sync_offset_ms=sync_offset_ms,
            is_manually_aligned=is_manually_aligned,
            alignment_note=alignment_note,
            created_by=created_by
        )


def delete_sync_config(db: Session, sync_id: int) -> bool:
    """
    删除同步配置
    """
    db_sync = get_sync_config_by_id(db, sync_id)
    if not db_sync:
        return False

    db.delete(db_sync)
    db.commit()
    return True
