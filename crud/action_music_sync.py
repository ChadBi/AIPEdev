from sqlalchemy.orm import Session

from models.action_music_sync import ActionMusicSync


def get_by_action_music(db: Session, action_id: int, music_id: int) -> ActionMusicSync | None:
    """
    按动作和音乐查询对齐配置
    """
    return (
        db.query(ActionMusicSync)
        .filter(ActionMusicSync.action_id == action_id, ActionMusicSync.music_id == music_id)
        .first()
    )


def list_by_action(db: Session, action_id: int) -> list[ActionMusicSync]:
    """
    查询某个动作下的所有音乐对齐配置
    """
    return (
        db.query(ActionMusicSync)
        .filter(ActionMusicSync.action_id == action_id)
        .all()
    )


def upsert_action_music_sync(
    db: Session,
    action_id: int,
    music_id: int,
    sync_offset_ms: int,
    is_aligned: bool,
    alignment_note: str | None = None,
    created_by: int | None = None,
) -> ActionMusicSync:
    """
    创建或更新动作-音乐对齐配置
    """
    db_item = get_by_action_music(db, action_id, music_id)
    if db_item:
        db_item.sync_offset_ms = sync_offset_ms
        db_item.is_aligned = is_aligned
        db_item.alignment_note = alignment_note
    else:
        db_item = ActionMusicSync(
            action_id=action_id,
            music_id=music_id,
            sync_offset_ms=sync_offset_ms,
            is_aligned=is_aligned,
            alignment_note=alignment_note,
            created_by=created_by,
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_item)
    return db_item
