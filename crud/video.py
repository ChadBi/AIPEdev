from sqlalchemy.orm import Session
from models.video import Video
from schemas.video import VideoCreate

def create_video(db: Session, video: VideoCreate, user_id: int) -> Video:
    """
    创建视频记录
    """
    db_video = Video(**video.model_dump(), user_id=user_id)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video

def get_video_by_id(db: Session, video_id: int) -> Video | None:
    """
    根据 ID 获取视频记录
    """
    return db.query(Video).filter(Video.id == video_id).first()

def get_videos(db: Session, skip: int = 0, limit: int = 100):
    """
    获取视频记录列表
    """
    return db.query(Video).offset(skip).limit(limit).all()

def get_user_videos(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """
    获取指定用户的视频记录列表
    """
    return db.query(Video).filter(Video.user_id == user_id).offset(skip).limit(limit).all()
