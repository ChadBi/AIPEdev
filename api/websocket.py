from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Any
import json
import asyncio
import time
import logging
from datetime import datetime

from core.database import SessionLocal
from core.config import SAMPLE_FPS
from crud import video as video_crud
from crud import action as action_crud
from services.recognition_service import recognize_frame_base64
from services.background_recognition import get_action_keypoints_safely

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]

    async def send_message(self, channel: str, message: dict):
        if channel not in self.active_connections:
            return
        for connection in list(self.active_connections[channel]):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection, channel)


manager = ConnectionManager()


def _utc_now() -> str:
    return datetime.utcnow().isoformat()


def _select_standard_keypoints(
    standard_sequence: list[dict],
    elapsed_ms: int,
    sync_offset_ms: int
) -> tuple[int, dict]:
    if not standard_sequence:
        return 0, {}
    adjusted_elapsed_ms = max(0, elapsed_ms + sync_offset_ms)
    frame_index = int((adjusted_elapsed_ms / 1000.0) * SAMPLE_FPS)
    frame_index = min(frame_index, len(standard_sequence) - 1)
    return frame_index, standard_sequence[frame_index].get("keypoints", {})


async def _send_error(channel: str, message: str, error_code: str = "runtime_error"):
    await manager.send_message(channel, {
        "type": "error",
        "data": {"message": message, "error_code": error_code},
        "timestamp": _utc_now()
    })


async def _handle_live_session(
    websocket: WebSocket,
    channel: str,
    standard_sequence: list[dict],
    sync_offset_ms: int = 0,
):
    await manager.connect(websocket, channel)
    await manager.send_message(channel, {
        "type": "status",
        "data": {
            "status": "connected",
            "message": "实时检测连接已建立",
            "standard_frames": len(standard_sequence),
            "sample_fps": SAMPLE_FPS,
            "sync_offset_ms": sync_offset_ms,
        },
        "timestamp": _utc_now()
    })

    start_monotonic = time.monotonic()
    total_score = 0.0
    processed_frames = 0
    last_emit_at = 0.0

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await manager.send_message(channel, {
                    "type": "ping",
                    "data": {},
                    "timestamp": _utc_now()
                })
                continue

            payload = json.loads(raw)
            message_type = payload.get("type")
            data = payload.get("data", {}) or {}

            if message_type == "ping":
                await manager.send_message(channel, {
                    "type": "pong",
                    "data": {"message": "pong"},
                    "timestamp": _utc_now()
                })
                continue

            if message_type not in {"frame", "keypoints"}:
                await _send_error(channel, f"未知消息类型: {message_type}", "invalid_message_type")
                continue

            now = time.monotonic()
            # 减少节流限制，从 0.1 秒改为 0.05 秒（约 20 FPS）
            if now - last_emit_at < 0.05:
                continue
            last_emit_at = now

            elapsed_ms = int(data.get("elapsed_ms") or ((now - start_monotonic) * 1000))

            client_keypoints = data.get("keypoints")
            if message_type == "frame":
                frame_base64 = data.get("image_base64") or data.get("frame_base64")
                if not frame_base64:
                    await _send_error(channel, "frame 消息缺少 image_base64", "missing_frame_data")
                    continue
                try:
                    result = recognize_frame_base64(frame_base64)
                    # recognize_frame_base64 返回嵌套结构，需要提取实际的 keypoints
                    client_keypoints = result.get("keypoints", result)
                except Exception as exc:
                    logger.exception("单帧识别失败")
                    await _send_error(channel, str(exc), "frame_inference_failed")
                    continue

            # 确保获取到的是关键点字典（兼容嵌套结构）
            if isinstance(client_keypoints, dict):
                if "keypoints" in client_keypoints:
                    client_keypoints = client_keypoints["keypoints"]
            if not isinstance(client_keypoints, dict):
                await _send_error(channel, "关键点数据格式错误", "invalid_keypoints")
                continue

            # 获取标准动作关键点用于骨架绘制
            std_idx, standard_frame = _select_standard_keypoints(
                standard_sequence=standard_sequence,
                elapsed_ms=elapsed_ms,
                sync_offset_ms=sync_offset_ms,
            )

            score = calculate_similarity(client_keypoints, standard_frame)
            processed_frames += 1
            total_score += score
            average_score = total_score / processed_frames if processed_frames > 0 else score
            completion = 0.0
            if len(standard_sequence) > 0:
                completion = min(100.0, ((std_idx + 1) / len(standard_sequence)) * 100)

            await manager.send_message(channel, {
                "type": "score",
                "data": {
                    "current_score": round(score, 2),
                    "average_score": round(average_score, 2),
                    "completion_rate": round(completion, 2),
                    "frame_index": std_idx,
                    "elapsed_ms": elapsed_ms,
                    "processed_frames": processed_frames,
                    "music_time_ms": max(0, elapsed_ms + sync_offset_ms),
                    "keypoints": client_keypoints,  # 返回客户端关键点用于骨架绘制
                    "standard_keypoints": standard_frame,  # 返回标准关键点用于骨架绘制
                },
                "timestamp": _utc_now()
            })
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", channel)
    except json.JSONDecodeError:
        await _send_error(channel, "无效的 JSON 格式", "invalid_json")
    except Exception:
        logger.exception("WebSocket 会话处理异常: %s", channel)
        await _send_error(channel, "服务内部错误", "internal_error")
    finally:
        manager.disconnect(websocket, channel)


def _load_standard_by_video(db: Session, video_id: int) -> tuple[list[dict], int]:
    video = video_crud.get_video_by_id(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")
    standard_result = recognize_video(video.file_path)
    return standard_result.get("sequence", []), 0


def _load_standard_by_action(db: Session, action_id: int) -> tuple[list[dict], int]:
    action = action_crud.get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="动作不存在")
    if not action.video_path:
        raise HTTPException(status_code=400, detail="动作未绑定标准视频，无法实时检测")

    # 从数据库获取预保存的关键点序列
    standard_sequence = get_action_keypoints_safely(db, action_id)

    return standard_sequence, int(action.sync_offset_ms or 0)


@router.websocket("/live/{video_id}")
async def websocket_live_detection(websocket: WebSocket, video_id: int):
    """
    兼容旧接口：基于视频ID进行实时检测
    """
    db = SessionLocal()
    try:
        try:
            standard_sequence, sync_offset_ms = _load_standard_by_video(db, video_id)
        except HTTPException as exc:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "data": {"message": exc.detail, "error_code": "resource_not_found"},
                "timestamp": _utc_now()
            })
            await websocket.close(code=4004)
            return
        await _handle_live_session(
            websocket=websocket,
            channel=f"video:{video_id}",
            standard_sequence=standard_sequence,
            sync_offset_ms=sync_offset_ms,
        )
    finally:
        db.close()


@router.websocket("/live/action/{action_id}")
async def websocket_live_detection_by_action(websocket: WebSocket, action_id: int):
    """
    新接口：基于动作ID进行实时检测
    """
    db = SessionLocal()
    try:
        try:
            standard_sequence, sync_offset_ms = _load_standard_by_action(db, action_id)
            override_offset = websocket.query_params.get("sync_offset_ms")
            if override_offset is not None:
                try:
                    sync_offset_ms = int(override_offset)
                except ValueError:
                    await websocket.accept()
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "sync_offset_ms 必须是整数", "error_code": "invalid_query_param"},
                        "timestamp": _utc_now()
                    })
                    await websocket.close(code=4400)
                    return
        except HTTPException as exc:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "data": {"message": exc.detail, "error_code": "resource_not_found"},
                "timestamp": _utc_now()
            })
            await websocket.close(code=4004)
            return
        await _handle_live_session(
            websocket=websocket,
            channel=f"action:{action_id}",
            standard_sequence=standard_sequence,
            sync_offset_ms=sync_offset_ms,
        )
    finally:
        db.close()


def calculate_similarity(client_kp: dict, standard_kp: dict) -> float:
    """
    计算两个姿态关键点集合的相似度（0-100）
    """
    if not client_kp or not standard_kp:
        return 0.0

    total_distance = 0.0
    valid_points = 0
    keypoint_pairs = [
        ("left_shoulder", "left_shoulder"),
        ("right_shoulder", "right_shoulder"),
        ("left_elbow", "left_elbow"),
        ("right_elbow", "right_elbow"),
        ("left_wrist", "left_wrist"),
        ("right_wrist", "right_wrist"),
        ("left_hip", "left_hip"),
        ("right_hip", "right_hip"),
        ("left_knee", "left_knee"),
        ("right_knee", "right_knee"),
        ("left_ankle", "left_ankle"),
        ("right_ankle", "right_ankle"),
    ]

    for client_name, standard_name in keypoint_pairs:
        client_point = client_kp.get(client_name)
        standard_point = standard_kp.get(standard_name)
        if (
            client_point and standard_point and
            len(client_point) >= 3 and len(standard_point) >= 3 and
            client_point[2] > 0.3 and standard_point[2] > 0.3
        ):
            distance = (
                (client_point[0] - standard_point[0]) ** 2 +
                (client_point[1] - standard_point[1]) ** 2
            ) ** 0.5
            total_distance += distance
            valid_points += 1

    if valid_points == 0:
        return 0.0

    avg_distance = total_distance / valid_points
    score = max(0, min(100, 100 * (1 - avg_distance * 2)))
    return score


@router.get("/live/status/action/{action_id}")
async def get_live_status_by_action(action_id: int):
    """
    获取动作实时检测连接状态
    """
    return {
        "action_id": action_id,
        "connected_clients": len(manager.active_connections.get(f"action:{action_id}", set())),
        "is_streaming": len(manager.active_connections.get(f"action:{action_id}", set())) > 0
    }


@router.get("/live/status/video/{video_id}")
async def get_live_status_by_video(video_id: int):
    """
    获取视频实时检测连接状态（兼容）
    """
    return {
        "video_id": video_id,
        "connected_clients": len(manager.active_connections.get(f"video:{video_id}", set())),
        "is_streaming": len(manager.active_connections.get(f"video:{video_id}", set())) > 0
    }
