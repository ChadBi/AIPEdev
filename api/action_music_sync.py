from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user
from crud import action as action_crud
from crud import action_music_sync as action_music_sync_crud
from crud import music as music_crud
from models.user import User
from schemas.action_music_sync import (
    ActionMusicSyncAlignRequest,
    ActionMusicSyncListItem,
    ActionMusicSyncLookupOut,
    ActionMusicSyncOut,
)
from utils.file import normalize_storage_path

router = APIRouter()


def _get_action_or_404(db: Session, action_id: int):
    action = action_crud.get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="动作不存在")
    if not action.video_path:
        raise HTTPException(status_code=400, detail="动作未绑定标准视频，无法实时检测")
    return action


def _get_music_or_404(db: Session, music_id: int):
    music = music_crud.get_music_by_id(db, music_id)
    if not music:
        raise HTTPException(status_code=404, detail="音乐不存在")
    return music


@router.get("/action-music", response_model=ActionMusicSyncLookupOut)
def get_action_music_sync(
    action_id: int = Query(..., description="动作ID"),
    music_id: int = Query(..., description="音乐ID"),
    db: Session = Depends(get_db),
):
    """
    查询动作-音乐组合的对齐配置
    """
    _get_action_or_404(db, action_id)
    _get_music_or_404(db, music_id)

    config = action_music_sync_crud.get_by_action_music(db, action_id, music_id)
    if not config:
        return ActionMusicSyncLookupOut(
            action_id=action_id,
            music_id=music_id,
            sync_offset_ms=0,
            is_aligned=False,
            alignment_note=None,
            has_sync_config=False,
        )

    return ActionMusicSyncLookupOut(
        action_id=config.action_id,
        music_id=config.music_id,
        sync_offset_ms=config.sync_offset_ms,
        is_aligned=bool(config.is_aligned),
        alignment_note=config.alignment_note,
        has_sync_config=True,
    )


@router.post("/action-music/align", response_model=ActionMusicSyncOut)
def align_action_music(
    payload: ActionMusicSyncAlignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    创建或更新动作-音乐组合对齐配置
    """
    _get_action_or_404(db, payload.action_id)
    _get_music_or_404(db, payload.music_id)

    config = action_music_sync_crud.upsert_action_music_sync(
        db=db,
        action_id=payload.action_id,
        music_id=payload.music_id,
        sync_offset_ms=payload.sync_offset_ms,
        is_aligned=True,
        alignment_note=payload.alignment_note,
        created_by=current_user.id,
    )
    return config


@router.get("/action-music/list", response_model=list[ActionMusicSyncListItem])
def list_action_music_sync(action_id: int, db: Session = Depends(get_db)):
    """
    返回某个动作可选音乐及其对齐状态
    """
    _get_action_or_404(db, action_id)

    music_list = music_crud.get_music_list(db, skip=0, limit=500)
    sync_list = action_music_sync_crud.list_by_action(db, action_id)
    sync_map = {item.music_id: item for item in sync_list}

    result: list[ActionMusicSyncListItem] = []
    for music in music_list:
        matched = sync_map.get(music.id)
        result.append(
            ActionMusicSyncListItem(
                music_id=music.id,
                music_name=music.name,
                music_file_path=normalize_storage_path(music.file_path),
                sync_offset_ms=matched.sync_offset_ms if matched else 0,
                is_aligned=bool(matched.is_aligned) if matched else False,
                has_sync_config=matched is not None,
            )
        )
    return result
