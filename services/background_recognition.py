"""
后台批处理识别服务

负责异步处理标准视频的姿态识别任务
"""
import asyncio
import logging
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from core.database import SessionLocal
from models.action import Action
from services.recognition_service import recognize_video
from crud import action as action_crud

logger = logging.getLogger(__name__)

# 标记是否正在运行后台任务
_processing_active = False
# 待处理队列
_pending_actions = []


async def queue_action_recognition(action_id: int):
    """
    将动作加入待识别队列

    :param action_id: 动作ID
    """
    global _pending_actions
    if action_id not in _pending_actions:
        _pending_actions.append(action_id)
        logger.info(f"动作 {action_id} 已加入识别队列，当前队列长度: {len(_pending_actions)}")


async def _process_action_recognition(db: Session, action_id: int):
    """
    处理单个动作的视频识别

    :param db: 数据库会话
    :param action_id: 动作ID
    """
    try:
        action = db.query(Action).filter(Action.id == action_id).first()
        if not action:
            logger.warning(f"动作 {action_id} 不存在，跳过识别")
            return

        # 检查是否需要识别
        if action.recognition_status == "completed" and action.keypoints:
            logger.info(f"动作 {action_id} 已完成识别，跳过")
            return

        # 更新状态为处理中
        action.recognition_status = "processing"
        action.recognition_error = None
        db.commit()

        # 执行识别
        logger.info(f"开始识别动作 {action_id} 的标准视频: {action.video_path}")
        result = recognize_video(action.video_path)

        # 保存结果
        action.keypoints = result
        action.recognition_status = "completed"
        action.recognition_error = None
        db.commit()

        logger.info(f"动作 {action_id} 识别完成，共 {len(result.get('sequence', []))} 帧关键点")

    except Exception as e:
        logger.exception(f"动作 {action_id} 识别失败: {e}")
        try:
            action = db.query(Action).filter(Action.id == action_id).first()
            if action:
                action.recognition_status = "failed"
                action.recognition_error = str(e)[:500]  # 限制错误信息长度
                db.commit()
        except Exception as commit_error:
            logger.exception(f"更新动作 {action_id} 失败状态失败: {commit_error}")


async def _background_processor():
    """
    后台任务处理器，持续从队列中取出任务并处理
    """
    global _pending_actions, _processing_active

    logger.info("后台批处理任务已启动")

    while _processing_active:
        try:
            if _pending_actions:
                # 取出第一个待处理动作
                action_id = _pending_actions.pop(0)
                db = SessionLocal()
                try:
                    await _process_action_recognition(db, action_id)
                finally:
                    db.close()
            else:
                # 队列为空，等待 1 秒
                await asyncio.sleep(1)
        except Exception as e:
            logger.exception(f"后台任务处理器异常: {e}")
            await asyncio.sleep(1)

    logger.info("后台批处理任务已停止")


def start_background_processor():
    """
    启动后台批处理任务（在 FastAPI lifespan 中调用）
    """
    global _processing_active
    if not _processing_active:
        _processing_active = True
        # 使用 asyncio 创建后台任务
        # 注意：需要在事件循环中运行
        return True
    return False


def stop_background_processor():
    """
    停止后台批处理任务
    """
    global _processing_active
    _processing_active = False
    logger.info("后台批处理任务停止指令已发送")


def is_action_ready(action: Action) -> bool:
    """
    检查动作是否已完成识别，可用于实时检测

    :param action: 动作对象
    :return: 是否已准备好
    """
    return (
        action.recognition_status == "completed" and
        action.keypoints is not None and
        len(action.keypoints.get("sequence", [])) > 0
    )


def get_action_keypoints_safely(db: Session, action_id: int) -> list[dict]:
    """
    获取动作的关键点序列（用于实时检测）

    如果动作未完成识别，会返回空列表并自动加入识别队列

    :param db: 数据库会话
    :param action_id: 动作ID
    :return: 关键点序列
    """
    action = action_crud.get_action_by_id(db, action_id)
    if not action:
        return []

    if action.recognition_status == "completed" and action.keypoints:
        return action.keypoints.get("sequence", [])

    # 未完成识别，加入队列
    if action.recognition_status in ("pending", "failed"):
        asyncio.create_task(queue_action_recognition(action_id))

    return []
