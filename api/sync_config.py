from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from schemas.sync_config import (
    SyncConfigCreate,
    SyncConfigUpdate,
    SyncConfigOut,
    SyncAlignRequest,
    SyncAlignResponse
)
from crud import sync_config as sync_crud
from crud import video as video_crud
from crud import music as music_crud

router = APIRouter()


@router.post("/align", response_model=SyncAlignResponse)
def manual_align(
    request: SyncAlignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    手动对齐标准视频和音乐

    保存同步偏移量，定义：
    - sync_offset_ms > 0：音乐提前 sync_offset_ms 毫秒播放
    - sync_offset_ms < 0：音乐延后 |sync_offset_ms| 毫秒播放

    参数：
    - video_id: 标准视频ID
    - music_id: 音乐ID
    - sync_offset_ms: 同步偏移量（毫秒）
    - alignment_note: 对齐备注（可选）
    """
    # 验证视频存在
    video = video_crud.get_video_by_id(db, request.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    # 验证音乐存在
    music = music_crud.get_music_by_id(db, request.music_id)
    if not music:
        raise HTTPException(status_code=404, detail="音乐不存在")

    # 创建或更新同步配置
    sync_config = sync_crud.upsert_sync_config(
        db=db,
        video_id=request.video_id,
        music_id=request.music_id,
        sync_offset_ms=request.sync_offset_ms,
        is_manually_aligned=True,
        alignment_note=request.alignment_note,
        created_by=current_user.id
    )

    return SyncAlignResponse(
        sync_config_id=sync_config.id,
        video_id=request.video_id,
        music_id=request.music_id,
        sync_offset_ms=request.sync_offset_ms,
        video_time_at_aligned=0,  # 视频从0开始播放
        music_time_at_aligned=request.sync_offset_ms / 1000.0,  # 音乐的起始偏移时间
        message="对齐保存成功"
    )


@router.get("/video/{video_id}", response_model=SyncConfigOut)
def get_sync_config_by_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    获取视频的同步配置
    """
    sync_config = sync_crud.get_sync_config_by_video_id(db, video_id)
    if not sync_config:
        raise HTTPException(status_code=404, detail="未找到同步配置")
    return sync_config


@router.post("/", response_model=SyncConfigOut)
def create_sync_config(
    sync_config: SyncConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建同步配置
    """
    # 验证视频和音乐存在
    video = video_crud.get_video_by_id(db, sync_config.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    music = music_crud.get_music_by_id(db, sync_config.music_id)
    if not music:
        raise HTTPException(status_code=404, detail="音乐不存在")

    return sync_crud.create_sync_config(
        db=db,
        video_id=sync_config.video_id,
        music_id=sync_config.music_id,
        sync_offset_ms=sync_config.sync_offset_ms,
        is_manually_aligned=sync_config.is_manually_aligned,
        alignment_note=sync_config.alignment_note,
        created_by=current_user.id
    )


@router.put("/{sync_id}", response_model=SyncConfigOut)
def update_sync_config(
    sync_id: int,
    updates: SyncConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新同步配置
    """
    update_dict = updates.model_dump(exclude_unset=True)
    sync_config = sync_crud.update_sync_config(db, sync_id, **update_dict)

    if not sync_config:
        raise HTTPException(status_code=404, detail="同步配置不存在")

    return sync_config


@router.delete("/{sync_id}")
def delete_sync_config(
    sync_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    删除同步配置
    """
    success = sync_crud.delete_sync_config(db, sync_id)
    if not success:
        raise HTTPException(status_code=404, detail="同步配置不存在")
    return {"message": "删除成功"}


@router.get("/list", response_model=list[SyncConfigOut])
def list_sync_configs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    获取所有同步配置列表
    """
    return sync_crud.get_all_sync_configs(db, skip=skip, limit=limit)
