from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import SAMPLE_FPS, ENABLE_SEQUENCE_LOOP, SEQUENCE_LOOP_THRESHOLD
from services.score_service import score_action_by_angle
from crud.action import get_action_by_id
from services.recognition_service import recognize_video
from crud.score import create_score_record, get_user_scores, get_score_by_id, get_user_score_count
from crud.video import get_video_by_id
from core.deps import get_current_user
from models.user import User
from models.action import Action as ActionModel
from schemas.score import ScoreOut, ScoreHistoryItem, LiveScoreSaveIn, LiveScoreSaveOut, LiveScoreDetailOut
from utils.file import normalize_storage_path
import copy
import logging
from datetime import timezone

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_live_feedback(total_score: float, average_score: float, latency_ms: int) -> list[str]:
    """根据实时检测结果生成简要反馈"""
    feedback: list[str] = []
    if total_score >= 90:
        feedback.append("实时动作表现优秀，稳定性较好。")
    elif total_score >= 75:
        feedback.append("实时动作整体良好，可继续提升细节稳定性。")
    elif total_score >= 60:
        feedback.append("实时动作达到及格水平，建议加强关键动作控制。")
    else:
        feedback.append("实时动作还需改进，建议降低节奏并分解练习。")

    if average_score < 70:
        feedback.append("全程平均分偏低，建议先进行慢速跟练。")

    if latency_ms > 100:
        feedback.append("检测延迟偏高，建议检查网络和设备性能。")

    return feedback

@router.get("/test", response_model=dict)
def test_endpoint():
    """测试端点 - 检查服务器是否在线"""
    return {"status": "ok", "message": "后端服务运行正常"}

@router.post("/", response_model=ScoreOut)
def score(
    action_id: int,
    video_id: int | None = Query(None, description="视频记录 ID（优先使用）"),
    video_path: str | None = Query(None, description="视频文件路径（直接指定）"),
    student_video_delay: float = Query(0.0, description="学生视频时间延迟（秒），正值表示晚开始"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    动作评分接口
    
    完整流程：
    1. 根据 action_id 获取标准动作数据（关键点序列）
    2. 根据 video_id 或 video_path 定位视频文件
    3. 调用 YOLOv8 Pose 识别服务处理视频（自动抽帧推理）
    4. 应用时间延迟修正（跳过学生视频中对应延迟的帧数）
    5. 核心算法：对比用户动作与标准动作的关节角度差异
    6. 生成总分、分关节得分及文字反馈
    7. 保存评分记录到数据库
    
    参数:
    - action_id: 标准动作 ID
    - video_id: 视频记录 ID（优先于 video_path）
    - video_path: 视频文件路径
    - student_video_delay: 学生视频时间延迟（秒），用于时间对齐
    """
    # 获取标准动作
    action = get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # 确保标准动作有视频路径
    if not action.video_path:
        raise HTTPException(status_code=400, detail="Standard action has no video file")

    # 确定用户视频路径
    resolved_path = video_path
    if video_id is not None:
        video = get_video_by_id(db, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        resolved_path = video.file_path
    
    if not resolved_path:
        raise HTTPException(status_code=400, detail="Must provide either video_id or video_path")

    # 🔥 新方案：在评分时同时识别两个视频，确保使用相同的识别参数
    logger.info(f"\n{'='*60}")
    logger.info(f"[识别策略] 实时识别模式：确保标准动作和用户动作使用相同配置")
    logger.info(f"[识别参数] SAMPLE_FPS={SAMPLE_FPS}, 采样间隔={1/SAMPLE_FPS:.3f}秒/帧")
    logger.info(f"[标准动作] 视频路径: {action.video_path}")
    logger.info(f"[用户动作] 视频路径: {resolved_path}")
    
    # 识别标准动作视频
    try:
        standard_sequence = recognize_video(action.video_path)
        logger.info(f"[识别完成] 标准动作识别成功，帧数: {len(standard_sequence['sequence'])}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"标准动作识别失败: {str(e)}")
    
    # 识别用户视频
    try:
        user_action = recognize_video(resolved_path)
        logger.info(f"[识别完成] 用户动作识别成功，帧数: {len(user_action['sequence'])}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"用户动作识别失败: {str(e)}")
    
    # 打印原始序列长度
    logger.info(f"\n{'='*60}")
    logger.info(f"[序列信息] 标准动作原始帧数: {len(standard_sequence['sequence'])}")
    logger.info(f"[序列信息] 学生视频原始帧数: {len(user_action['sequence'])}")
    logger.info(f"[序列信息] 时间延迟参数: {student_video_delay}秒")
    
    # 应用时间延迟修正
    # studentVideoDelay > 0: 学生视频提前播放，跳过学生视频的前几帧
    # studentVideoDelay < 0: 标准动作提前播放，跳过标准动作的前几帧
    if student_video_delay > 0:
        # 学生视频提前播放，需要跳过学生视频的前几帧
        skip_frames = int(round(student_video_delay * SAMPLE_FPS))
        if skip_frames > 0 and len(user_action["sequence"]) > skip_frames:
            user_action["sequence"] = user_action["sequence"][skip_frames:]
            logger.info(f"[时间对齐] 跳过学生视频前 {skip_frames} 帧，剩余 {len(user_action['sequence'])} 帧")
    elif student_video_delay < 0:
        # 标准动作提前播放，需要跳过标准动作的前几帧
        skip_frames = int(round(abs(student_video_delay) * SAMPLE_FPS))
        if skip_frames > 0 and len(standard_sequence["sequence"]) > skip_frames:
            standard_sequence["sequence"] = standard_sequence["sequence"][skip_frames:]
            logger.info(f"[时间对齐] 跳过标准动作前 {skip_frames} 帧，剩余 {len(standard_sequence['sequence'])} 帧")
    
    logger.info(f"[序列信息] 对齐后标准动作帧数: {len(standard_sequence['sequence'])}")
    logger.info(f"[序列信息] 对齐后学生视频帧数: {len(user_action['sequence'])}")
    final_frames = min(len(standard_sequence['sequence']), len(user_action['sequence']))
    logger.info(f"[序列信息] 实际评分帧数: {final_frames}")
    
    # 循环标准动作序列以匹配学生视频长度（如果启用）
    std_len = len(standard_sequence['sequence'])
    usr_len = len(user_action['sequence'])
    
    if ENABLE_SEQUENCE_LOOP and std_len > 0 and usr_len > std_len * SEQUENCE_LOOP_THRESHOLD:
        # 如果学生视频比标准动作长超过阈值倍，循环标准动作
        repeat_times = (usr_len // std_len) + 1
        original_std_seq = standard_sequence['sequence'].copy()
        standard_sequence['sequence'] = (original_std_seq * repeat_times)[:usr_len]
        logger.info(f"🔄 [序列循环] 启用: 原始{std_len}帧 → 重复{repeat_times}次 → 截取至{usr_len}帧")
        logger.info(f"    理由: 学生视频({usr_len}帧) > 标准动作({std_len}帧) × {SEQUENCE_LOOP_THRESHOLD}")
        final_frames = min(len(standard_sequence['sequence']), len(user_action['sequence']))
    elif not ENABLE_SEQUENCE_LOOP:
        logger.info(f"ℹ️  [序列循环] 已禁用 (配置: enable_sequence_loop = false)")
    
    # 警告：如果评分帧数太少
    if final_frames < 30:
        logger.info(f"⚠️  警告: 评分帧数过少 ({final_frames} 帧)，可能影响评分准确性！")
        if not ENABLE_SEQUENCE_LOOP:
            logger.info(f"    提示: 可在 config.yaml 中启用 enable_sequence_loop 来循环标准动作")
        logger.info(f"    建议: 1) 使用更长的标准动作视频")
        logger.info(f"         2) 减少时间延迟值")
        logger.info(f"         3) 确保学生视频足够长")
    
    logger.info(f"{'='*60}\n")

    # 评分（使用处理后的序列）
    result = score_action_by_angle(
        standard_action=standard_sequence,
        user_action=user_action
    )

    # 保存评分记录
    record = create_score_record(
        db=db,
        user_id=current_user.id, 
        action_id=action_id,
        video_id=video_id,
        student_video_delay=student_video_delay,
        total_score=result["total_score"],
        joint_scores=result["joint_scores"],
        frame_scores=result.get("frame_scores", []),
        feedback=result["feedback"]
    )

    return {
        "score_id": record.id,
        "action_id": action_id,
        "video_id": video_id,
        "standard_video_path": normalize_storage_path(action.video_path) if action.video_path else None,
        "user_video_path": normalize_storage_path(resolved_path) if resolved_path else None,
        "student_video_delay": student_video_delay,
        "total_score": result["total_score"],
        "joint_scores": result["joint_scores"],
        "frame_scores": result.get("frame_scores", []),
        "feedback": result["feedback"]
    }


@router.post("/live", response_model=LiveScoreSaveOut)
def save_live_score(
    payload: LiveScoreSaveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    保存实时检测评分结果
    """
    action = get_action_by_id(db, payload.action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    frame_scores = []
    for index, frame in enumerate(payload.frame_scores):
        frame_scores.append({
            "frame_index": index,
            "score": frame.score,
            "timestamp": frame.timestamp,
        })

    live_metadata = {
        "music_id": payload.music_id,
        "music_name": payload.music_name,
        "started_at": payload.started_at.astimezone(timezone.utc).isoformat(),
        "ended_at": payload.ended_at.astimezone(timezone.utc).isoformat(),
        "duration_seconds": payload.duration_seconds,
        "current_score": payload.current_score,
        "average_score": payload.average_score,
        "frames_processed": payload.frames_processed,
        "display_fps": payload.display_fps,
        "latency_ms": payload.latency_ms,
    }

    feedback = _build_live_feedback(payload.total_score, payload.average_score, payload.latency_ms)

    record = create_score_record(
        db=db,
        user_id=current_user.id,
        action_id=payload.action_id,
        video_id=None,
        student_video_delay=0.0,
        total_score=payload.total_score,
        joint_scores={},
        frame_scores=frame_scores,
        feedback=feedback,
        is_live=True,
        live_metadata=live_metadata,
    )

    return LiveScoreSaveOut(score_id=record.id)


@router.get("/live/{score_id}", response_model=LiveScoreDetailOut)
def get_live_score_detail(
    score_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取实时检测评分详情
    """
    record = get_score_by_id(db, score_id)
    if not record:
        raise HTTPException(status_code=404, detail="Score record not found")

    if record.user_id is not None and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this score")

    if not record.is_live:
        raise HTTPException(status_code=404, detail="Live score record not found")

    action = get_action_by_id(db, record.action_id)
    action_name = action.name if action else f"动作#{record.action_id}"

    metadata = record.live_metadata or {}
    frame_scores = []
    for fs in record.frame_scores or []:
        if isinstance(fs, dict):
            frame_scores.append({
                "frame_index": fs.get("frame_index", 0),
                "score": fs.get("score", 0.0),
                "timestamp": fs.get("timestamp", 0.0),
            })

    started_at = metadata.get("started_at") or record.created_at.isoformat()
    ended_at = metadata.get("ended_at") or record.created_at.isoformat()

    return LiveScoreDetailOut(
        score_id=record.id,
        action_id=record.action_id,
        action_name=action_name,
        music_id=metadata.get("music_id"),
        music_name=metadata.get("music_name"),
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=float(metadata.get("duration_seconds", 0.0)),
        total_score=record.total_score,
        current_score=float(metadata.get("current_score", record.total_score)),
        average_score=float(metadata.get("average_score", record.total_score)),
        frames_processed=int(metadata.get("frames_processed", len(frame_scores))),
        display_fps=int(metadata.get("display_fps", 0)),
        latency_ms=int(metadata.get("latency_ms", 0)),
        frame_scores=frame_scores,
        created_at=record.created_at,
    )


@router.get("/history/count", response_model=dict)
def score_history_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户评分历史总数
    """
    return {"count": get_user_score_count(db, current_user.id)}

@router.get("/history", response_model=list[ScoreHistoryItem])
def score_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户的评分历史
    
    返回评分记录列表，包含关联动作名称。
    """
    logger.info(f"[DEBUG] Fetching history for user_id={current_user.id}, skip={skip}, limit={limit}")
    records = get_user_scores(db, current_user.id, skip, limit)
    logger.info(f"[DEBUG] Found {len(records)} records for user {current_user.id}")
    
    result = []
    for record in records:
        # 获取关联的动作名称
        action = get_action_by_id(db, record.action_id)
        action_name = action.name if action else f"动作#{record.action_id}"
        
        logger.info(f"[DEBUG] Record {record.id}: action={action_name}, score={record.total_score}")
        
        result.append(ScoreHistoryItem(
            id=record.id,
            action_id=record.action_id,
            action_name=action_name,
            total_score=record.total_score,
            joint_scores=record.joint_scores,
            feedback=record.feedback,
            is_live=bool(record.is_live),
            created_at=record.created_at
        ))
    
    return result

@router.get("/{score_id}", response_model=ScoreOut)
def get_score_detail(
    score_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取单条评分记录完整详情（包含视频路径和帧级得分）
    """
    logger.info(f"[DEBUG] Getting score detail for score_id={score_id}, user_id={current_user.id}")
    
    record = get_score_by_id(db, score_id)
    if not record:
        logger.info(f"[DEBUG] Score record not found: {score_id}")
        raise HTTPException(status_code=404, detail="Score record not found")
    
    logger.info(f"[DEBUG] Record found, record.user_id={record.user_id}, current_user.id={current_user.id}")
    
    # 验证权限：只能查看自己的评分记录（或者记录的user_id为空，表示匿名评分）
    if record.user_id is not None and record.user_id != current_user.id:
        logger.info(f"[DEBUG] Permission denied: record.user_id={record.user_id} != current_user.id={current_user.id}")
        raise HTTPException(status_code=403, detail="Not authorized to view this score")
    
    # 获取关联的动作信息
    action = get_action_by_id(db, record.action_id)
    standard_video_path = normalize_storage_path(action.video_path) if action and action.video_path else None
    
    # 获取学生视频路径
    user_video_path = None
    if record.video_id:
        from crud.video import get_video_by_id
        video = get_video_by_id(db, record.video_id)
        if video:
            user_video_path = normalize_storage_path(video.file_path)
    
    # 处理 frame_scores，确保格式正确
    frame_scores_list = []
    if record.frame_scores:
        for fs in record.frame_scores:
            if isinstance(fs, dict):
                frame_scores_list.append({
                    "frame_index": fs.get("frame_index", 0),
                    "score": fs.get("score", 0.0),
                    "timestamp": fs.get("timestamp", 0.0)
                })
    
    result = ScoreOut(
        score_id=record.id,
        action_id=record.action_id,
        video_id=record.video_id,
        standard_video_path=standard_video_path,
        user_video_path=user_video_path,
        student_video_delay=record.student_video_delay or 0.0,
        total_score=record.total_score,
        joint_scores=record.joint_scores,
        frame_scores=frame_scores_list,
        feedback=record.feedback
    )
    
    logger.info(f"[DEBUG] Returning score detail: score_id={result.score_id}, total_score={result.total_score}")
    return result

