from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from core.database import get_db
from core.config import UPLOAD_DIR
from schemas.action import (
    ActionCreate,
    ActionUpdate,
    ActionOut,
    ActionLiveConfigOut,
    ActionLiveConfigUpdate,
)
from services import action_service
from crud import action as action_crud
from crud import music as music_crud
from crud import video as video_crud
from services.recognition_service import recognize_video
from utils.file import normalize_storage_path

router = APIRouter()


def start_action_background_recognition(action_id: int):
    """启动动作的后台批处理识别任务"""
    try:
        from services.background_recognition import queue_action_recognition
        # 使用 asyncio 创建后台任务
        import asyncio
        asyncio.create_task(queue_action_recognition(action_id))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"启动动作 {action_id} 后台识别任务失败: {e}")


@router.get("/{action_id:int}/keypoints")
def get_action_keypoints(action_id: int, db: Session = Depends(get_db)):
    """
    获取动作视频的关键点序列（用于骨架显示）
    """
    action = action_service.get_action(db, action_id)
    if not action or not action.video_path:
        raise HTTPException(status_code=404, detail="动作或视频不存在")

    try:
        result = recognize_video(action.video_path)
        return {"sequence": result.get("sequence", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败：{str(e)}")


@router.get("/count", response_model=dict)
def get_action_count(db: Session = Depends(get_db)):
    """
    获取动作总数
    """
    return {"count": action_crud.get_action_count(db)}


@router.get("/live", response_model=list[ActionOut])
def list_live_actions(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """
    获取可用于实时检测的动作列表（必须有标准视频）
    """
    actions = action_service.list_actions(db, skip=skip, limit=limit)
    return [item for item in actions if item.video_path]


@router.get("/by-video/{video_id:int}", response_model=ActionOut)
def get_action_by_video(video_id: int, db: Session = Depends(get_db)):
    """
    根据视频记录ID查询对应动作（用于实时检测入口兼容）
    """
    video = video_crud.get_video_by_id(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    actions = action_service.list_actions(db, skip=0, limit=500)
    for item in actions:
        if not item.video_path:
            continue
        if normalize_storage_path(item.video_path) == normalize_storage_path(video.file_path):
            return item

    raise HTTPException(status_code=404, detail="未找到关联动作")


@router.get("/{action_id:int}/live-config", response_model=ActionLiveConfigOut)
def get_action_live_config(action_id: int, db: Session = Depends(get_db)):
    """
    获取动作实时检测配置
    """
    action = action_service.get_action(db, action_id)
    return ActionLiveConfigOut(
        action_id=action.id,
        music_id=action.music_id,
        sync_offset_ms=action.sync_offset_ms or 0,
        is_aligned=bool(action.is_aligned),
    )


@router.put("/{action_id:int}/live-config", response_model=ActionLiveConfigOut)
def update_action_live_config(
    action_id: int,
    payload: ActionLiveConfigUpdate,
    db: Session = Depends(get_db)
):
    """
    更新动作实时检测配置
    """
    action = action_service.get_action(db, action_id)

    if payload.music_id is not None:
        if payload.music_id <= 0:
            action.music_id = None
        else:
            music = music_crud.get_music_by_id(db, payload.music_id)
            if not music:
                raise HTTPException(status_code=404, detail="Music not found")
            action.music_id = payload.music_id

    if payload.sync_offset_ms is not None:
        action.sync_offset_ms = payload.sync_offset_ms

    if payload.is_aligned is not None:
        action.is_aligned = payload.is_aligned

    db.commit()
    db.refresh(action)

    return ActionLiveConfigOut(
        action_id=action.id,
        music_id=action.music_id,
        sync_offset_ms=action.sync_offset_ms or 0,
        is_aligned=bool(action.is_aligned),
    )


@router.post("/create-from-video", response_model=ActionOut)
def create_action_from_video(
    name: str = Form(...),
    description: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    从标准视频创建动作

    上传一个标准动作的视频，系统后台异步进行姿态识别。

    参数:
    - name: 动作名称
    - description: 动作描述
    - file: 标准视频文件

    返回:
    - 创建的动作记录（识别状态为 pending）
    """
    # 验证文件类型
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # 生成永久文件名用于保存
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    if not file_ext:
        file_ext = ".mp4"
    permanent_file_name = f"{uuid.uuid4()}{file_ext}"
    permanent_file_path = os.path.join(UPLOAD_DIR, permanent_file_name)

    # 保存视频文件
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(permanent_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

    # 创建动作并保存视频路径
    action_in = ActionCreate(
        name=name,
        description=description,
        keypoints=None
    )

    action = action_service.create_action(db, action_in)
    action.video_path = normalize_storage_path(permanent_file_path)
    # 设置识别状态为待处理
    action.recognition_status = "pending"
    action.recognition_error = None
    db.commit()
    db.refresh(action)

    # 启动后台批处理识别任务
    start_action_background_recognition(action.id)

    return action

@router.post("/", response_model=ActionOut)
def create_action(action: ActionCreate, db: Session = Depends(get_db)):
    """
    创建标准动作
    
    参数:
    - action: 动作数据，包含名称、描述和关键点序列
    """
    return action_service.create_action(db, action)


@router.get("/{action_id:int}", response_model=ActionOut)
def get_action(action_id: int, db: Session = Depends(get_db)):
    """
    获取动作详情
    """
    return action_service.get_action(db, action_id)

@router.get("/", response_model=list[ActionOut])
def list_actions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """
    获取动作列表（分页）
    """
    return action_service.list_actions(db, skip, limit)

@router.put("/{action_id:int}", response_model=ActionOut)
def update_action(
    action_id: int,
    action: ActionUpdate,
    db: Session = Depends(get_db)
):
    """
    更新动作信息
    """
    return action_service.update_action(db, action_id, action)

@router.delete("/{action_id:int}")
def delete_action(action_id: int, db: Session = Depends(get_db)):
    """
    删除动作
    """
    action_service.delete_action(db, action_id)
    return {"message": "Action deleted successfully"}
