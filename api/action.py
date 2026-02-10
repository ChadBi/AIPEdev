from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from core.database import get_db
from core.config import UPLOAD_DIR
from schemas.action import ActionCreate, ActionUpdate, ActionOut
from services import action_service
from services.recognition_service import recognize_video

router = APIRouter()

@router.post("/create-from-video", response_model=ActionOut)
def create_action_from_video(
    name: str = Form(...),
    description: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    从标准视频创建动作
    
    上传一个标准动作的视频，系统自动进行姿态识别，
    将识别结果作为该动作的关键点定义。
    
    参数:
    - name: 动作名称
    - description: 动作描述
    - file: 标准视频文件
    
    返回:
    - 创建的动作记录
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
    
    # 不再在创建时识别关键点，延迟到评分时进行
    # 这样可以确保标准动作和用户动作使用相同的识别参数
    
    # 创建动作并保存视频路径（不保存关键点）
    action_in = ActionCreate(
        name=name,
        description=description,
        keypoints=None  # 评分时动态识别
    )
    
    action = action_service.create_action(db, action_in)
    
    # 保存视频路径到动作记录
    action.video_path = permanent_file_path
    db.commit()
    db.refresh(action)
    
    return action

@router.post("/", response_model=ActionOut)
def create_action(action: ActionCreate, db: Session = Depends(get_db)):
    """
    创建标准动作
    
    参数:
    - action: 动作数据，包含名称、描述和关键点序列
    """
    return action_service.create_action(db, action)

@router.get("/{action_id}", response_model=ActionOut)
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

@router.put("/{action_id}", response_model=ActionOut)
def update_action(
    action_id: int,
    action: ActionUpdate,
    db: Session = Depends(get_db)
):
    """
    更新动作信息
    """
    return action_service.update_action(db, action_id, action)

@router.delete("/{action_id}")
def delete_action(action_id: int, db: Session = Depends(get_db)):
    """
    删除动作
    """
    action_service.delete_action(db, action_id)
    return {"message": "Action deleted successfully"}
