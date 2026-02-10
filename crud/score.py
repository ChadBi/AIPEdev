from sqlalchemy.orm import Session
from models.score import ScoreRecord

def create_score_record(
    db: Session,
    user_id: int | None,
    action_id: int,
    video_id: int | None,
    student_video_delay: float,
    total_score: float,
    joint_scores: dict,
    frame_scores: list,
    feedback: list
):
    """
    创建评分记录

    :param db: 数据库会话
    :param user_id: 用户 ID (可为空)
    :param action_id: 动作 ID
    :param video_id: 学生视频 ID (可为空)
    :param student_video_delay: 学生视频时间延迟(秒)
    :param total_score: 总分
    :param joint_scores: 关节得分详情 (字典)
    :param frame_scores: 帧级得分 (列表)
    :param feedback: 反馈建议列表
    :return: 创建后的评分记录实例
    """
    record = ScoreRecord(
        user_id=user_id,
        action_id=action_id,
        video_id=video_id,
        student_video_delay=student_video_delay,
        total_score=total_score,
        joint_scores=joint_scores,
        frame_scores=frame_scores,
        feedback=feedback
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def get_user_scores(db: Session, user_id: int, skip: int = 0, limit: int = 50):
    """
    获取指定用户的评分历史

    :param db: 数据库会话
    :param user_id: 用户 ID
    :param skip: 跳过的记录数
    :param limit: 返回的最大记录数
    :return: 评分记录列表
    """
    return (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_score_by_id(db: Session, score_id: int):
    """
    根据 ID 获取评分记录

    :param db: 数据库会话
    :param score_id: 评分记录 ID
    :return: 评分记录实例 或 None
    """
    return db.query(ScoreRecord).filter(ScoreRecord.id == score_id).first()
