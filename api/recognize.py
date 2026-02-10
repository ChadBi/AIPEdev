from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from services.recognition_service import recognize_video
from schemas.recognition import RecognizeOut
from core.database import get_db
from crud.video import get_video_by_id

router = APIRouter()

@router.post("/", response_model=RecognizeOut)
def recognize(
    video_id: int | None = Query(None, description="视频记录 ID（优先使用）"),
    video_path: str | None = Query(None, description="视频文件路径（直接指定）"),
    db: Session = Depends(get_db)
):
    """
    视频姿态识别接口

    支持两种调用方式：
    1. 传入 video_id：从数据库查询视频路径后进行识别
    2. 传入 video_path：直接对指定路径的视频进行识别

    返回：
    - 识别结果，包含关键点序列（每帧17个COCO关键点）
    """
    # 确定视频路径
    if video_id is not None:
        video = get_video_by_id(db, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        video_path = video.file_path
    
    if not video_path:
        raise HTTPException(status_code=400, detail="Must provide either video_id or video_path")

    try:
        result = recognize_video(video_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return result
