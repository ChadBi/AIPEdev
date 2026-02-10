from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import SAMPLE_FPS, ENABLE_SEQUENCE_LOOP, SEQUENCE_LOOP_THRESHOLD
from services.score_service import score_action_by_angle
from crud.action import get_action_by_id
from services.recognition_service import recognize_video
from crud.score import create_score_record, get_user_scores, get_score_by_id
from crud.video import get_video_by_id
from core.deps import get_current_user
from models.user import User
from models.action import Action as ActionModel
from schemas.score import ScoreOut, ScoreHistoryItem
import copy

router = APIRouter()

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
    print(f"\n{'='*60}")
    print(f"[识别策略] 实时识别模式：确保标准动作和用户动作使用相同配置")
    print(f"[识别参数] SAMPLE_FPS={SAMPLE_FPS}, 采样间隔={1/SAMPLE_FPS:.3f}秒/帧")
    print(f"[标准动作] 视频路径: {action.video_path}")
    print(f"[用户动作] 视频路径: {resolved_path}")
    
    # 识别标准动作视频
    try:
        standard_sequence = recognize_video(action.video_path)
        print(f"[识别完成] 标准动作识别成功，帧数: {len(standard_sequence['sequence'])}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"标准动作识别失败: {str(e)}")
    
    # 识别用户视频
    try:
        user_action = recognize_video(resolved_path)
        print(f"[识别完成] 用户动作识别成功，帧数: {len(user_action['sequence'])}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"用户动作识别失败: {str(e)}")
    
    # 打印原始序列长度
    print(f"\n{'='*60}")
    print(f"[序列信息] 标准动作原始帧数: {len(standard_sequence['sequence'])}")
    print(f"[序列信息] 学生视频原始帧数: {len(user_action['sequence'])}")
    print(f"[序列信息] 时间延迟参数: {student_video_delay}秒")
    
    # 应用时间延迟修正
    # studentVideoDelay > 0: 学生视频提前播放，跳过学生视频的前几帧
    # studentVideoDelay < 0: 标准动作提前播放，跳过标准动作的前几帧
    if student_video_delay > 0:
        # 学生视频提前播放，需要跳过学生视频的前几帧
        skip_frames = int(round(student_video_delay * SAMPLE_FPS))
        if skip_frames > 0 and len(user_action["sequence"]) > skip_frames:
            user_action["sequence"] = user_action["sequence"][skip_frames:]
            print(f"[时间对齐] 跳过学生视频前 {skip_frames} 帧，剩余 {len(user_action['sequence'])} 帧")
    elif student_video_delay < 0:
        # 标准动作提前播放，需要跳过标准动作的前几帧
        skip_frames = int(round(abs(student_video_delay) * SAMPLE_FPS))
        if skip_frames > 0 and len(standard_sequence["sequence"]) > skip_frames:
            standard_sequence["sequence"] = standard_sequence["sequence"][skip_frames:]
            print(f"[时间对齐] 跳过标准动作前 {skip_frames} 帧，剩余 {len(standard_sequence['sequence'])} 帧")
    
    print(f"[序列信息] 对齐后标准动作帧数: {len(standard_sequence['sequence'])}")
    print(f"[序列信息] 对齐后学生视频帧数: {len(user_action['sequence'])}")
    final_frames = min(len(standard_sequence['sequence']), len(user_action['sequence']))
    print(f"[序列信息] 实际评分帧数: {final_frames}")
    
    # 循环标准动作序列以匹配学生视频长度（如果启用）
    std_len = len(standard_sequence['sequence'])
    usr_len = len(user_action['sequence'])
    
    if ENABLE_SEQUENCE_LOOP and std_len > 0 and usr_len > std_len * SEQUENCE_LOOP_THRESHOLD:
        # 如果学生视频比标准动作长超过阈值倍，循环标准动作
        repeat_times = (usr_len // std_len) + 1
        original_std_seq = standard_sequence['sequence'].copy()
        standard_sequence['sequence'] = (original_std_seq * repeat_times)[:usr_len]
        print(f"🔄 [序列循环] 启用: 原始{std_len}帧 → 重复{repeat_times}次 → 截取至{usr_len}帧")
        print(f"    理由: 学生视频({usr_len}帧) > 标准动作({std_len}帧) × {SEQUENCE_LOOP_THRESHOLD}")
        final_frames = min(len(standard_sequence['sequence']), len(user_action['sequence']))
    elif not ENABLE_SEQUENCE_LOOP:
        print(f"ℹ️  [序列循环] 已禁用 (配置: enable_sequence_loop = false)")
    
    # 警告：如果评分帧数太少
    if final_frames < 30:
        print(f"⚠️  警告: 评分帧数过少 ({final_frames} 帧)，可能影响评分准确性！")
        if not ENABLE_SEQUENCE_LOOP:
            print(f"    提示: 可在 config.yaml 中启用 enable_sequence_loop 来循环标准动作")
        print(f"    建议: 1) 使用更长的标准动作视频")
        print(f"         2) 减少时间延迟值")
        print(f"         3) 确保学生视频足够长")
    
    print(f"{'='*60}\n")

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
        "standard_video_path": action.video_path,
        "user_video_path": resolved_path,
        "student_video_delay": student_video_delay,
        "total_score": result["total_score"],
        "joint_scores": result["joint_scores"],
        "frame_scores": result.get("frame_scores", []),
        "feedback": result["feedback"]
    }

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
    print(f"[DEBUG] Fetching history for user_id={current_user.id}, skip={skip}, limit={limit}")
    records = get_user_scores(db, current_user.id, skip, limit)
    print(f"[DEBUG] Found {len(records)} records for user {current_user.id}")
    
    result = []
    for record in records:
        # 获取关联的动作名称
        action = get_action_by_id(db, record.action_id)
        action_name = action.name if action else f"动作#{record.action_id}"
        
        print(f"[DEBUG] Record {record.id}: action={action_name}, score={record.total_score}")
        
        result.append(ScoreHistoryItem(
            id=record.id,
            action_id=record.action_id,
            action_name=action_name,
            total_score=record.total_score,
            joint_scores=record.joint_scores,
            feedback=record.feedback,
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
    print(f"[DEBUG] Getting score detail for score_id={score_id}, user_id={current_user.id}")
    
    record = get_score_by_id(db, score_id)
    if not record:
        print(f"[DEBUG] Score record not found: {score_id}")
        raise HTTPException(status_code=404, detail="Score record not found")
    
    print(f"[DEBUG] Record found, record.user_id={record.user_id}, current_user.id={current_user.id}")
    
    # 验证权限：只能查看自己的评分记录（或者记录的user_id为空，表示匿名评分）
    if record.user_id is not None and record.user_id != current_user.id:
        print(f"[DEBUG] Permission denied: record.user_id={record.user_id} != current_user.id={current_user.id}")
        raise HTTPException(status_code=403, detail="Not authorized to view this score")
    
    # 获取关联的动作信息
    action = get_action_by_id(db, record.action_id)
    standard_video_path = action.video_path if action else None
    
    # 获取学生视频路径
    user_video_path = None
    if record.video_id:
        from crud.video import get_video_by_id
        video = get_video_by_id(db, record.video_id)
        if video:
            user_video_path = video.file_path
    
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
    
    print(f"[DEBUG] Returning score detail: score_id={result.score_id}, total_score={result.total_score}")
    return result
