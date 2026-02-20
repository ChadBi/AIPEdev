from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

from core.database import get_db
from crud import video as video_crud
from crud import sync_config as sync_crud
from services.recognition_service import recognize_video

router = APIRouter()

# 连接管理器
class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        # 活跃连接: {video_id: set of WebSocket}
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, video_id: int):
        """建立连接"""
        await websocket.accept()
        if video_id not in self.active_connections:
            self.active_connections[video_id] = set()
        self.active_connections[video_id].add(websocket)

    def disconnect(self, websocket: WebSocket, video_id: int):
        """断开连接"""
        if video_id in self.active_connections:
            self.active_connections[video_id].discard(websocket)
            if not self.active_connections[video_id]:
                del self.active_connections[video_id]

    async def send_message(self, video_id: int, message: dict):
        """发送消息给指定视频的所有连接"""
        if video_id in self.active_connections:
            for connection in list(self.active_connections[video_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # 发送失败则移除连接
                    self.disconnect(connection, video_id)

    async def broadcast_score(self, video_id: int, score_data: dict):
        """广播评分数据"""
        await self.send_message(video_id, {
            "type": "score",
            "data": score_data,
            "timestamp": datetime.utcnow().isoformat()
        })


manager = ConnectionManager()


@router.websocket("/live/{video_id}")
async def websocket_live_detection(websocket: WebSocket, video_id: int):
    """
    实时检测 WebSocket 端点

    前端发送:
    - type: "keypoints" - 关键点数据
    - type: "frame" - 视频帧数据(base64编码)
    - type: "ping" -心跳保活

    后端返回:
    - type: "score" - 评分结果
    - type: "error" - 错误信息
    - type: "pong" - 心跳响应
    """
    # 验证视频存在
    db = next(get_db())
    try:
        video = video_crud.get_video_by_id(db, video_id)
        if not video:
            await websocket.send_json({
                "type": "error",
                "data": {"message": "视频不存在"},
                "timestamp": datetime.utcnow().isoformat()
            })
            await websocket.close(code=4004)
            return

        # 建立连接
        await manager.connect(websocket, video_id)

        # 发送连接成功消息
        await websocket.send_json({
            "type": "status",
            "data": {
                "status": "connected",
                "video_id": video_id,
                "message": "实时检测连接已建立"
            },
            "timestamp": datetime.utcnow().isoformat()
        })

        # 获取标准动作的关键点数据
        standard_keypoints = None
        try:
            result = recognize_video(video.file_path)
            standard_keypoints = result.get("sequence", [])
        except Exception as e:
            print(f"获取标准动作关键点失败: {e}")

        # 消息处理循环
        while True:
            try:
                # 接收前端消息
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30秒超时
                )
                data = json.loads(message)

                message_type = data.get("type")

                if message_type == "ping":
                    # 心跳响应
                    await websocket.send_json({
                        "type": "pong",
                        "data": {"message": "pong"},
                        "timestamp": datetime.utcnow().isoformat()
                    })

                elif message_type == "keypoints":
                    # 前端上传的关键点数据
                    client_keypoints = data.get("data", {})

                    if standard_keypoints and len(standard_keypoints) > 0:
                        # 与标准动作对比计算分数
                        current_frame_idx = data.get("data", {}).get("frame_index", 0)
                        frame_idx = min(current_frame_idx, len(standard_keypoints) - 1)
                        standard_frame = standard_keypoints[frame_idx].get("keypoints", {})

                        # 简单的相似度计算（实际应该使用更复杂的算法）
                        score = calculate_similarity(client_keypoints, standard_frame)

                        # 计算平均分
                        avg_score = score  # 简化版本

                        score_data = {
                            "current_score": round(score, 2),
                            "average_score": round(avg_score, 2),
                            "completion_rate": min(100, (current_frame_idx + 1) / len(standard_keypoints) * 100),
                            "frame_index": current_frame_idx
                        }

                        # 发送评分结果
                        await manager.send_message(video_id, {
                            "type": "score",
                            "data": score_data,
                            "timestamp": datetime.utcnow().isoformat()
                        })

                elif message_type == "frame":
                    # 前端上传的视频帧（Base64编码）
                    # 这种方式不适合大文件，通常只用于小尺寸缩略图
                    frame_data = data.get("data", {})
                    frame_idx = frame_data.get("frame_index", 0)

                    # 可以在这里进行后端推理
                    # 但通常推荐在前端使用 MediaPipe 进行姿态检测
                    await websocket.send_json({
                        "type": "status",
                        "data": {
                            "status": "frame_received",
                            "frame_index": frame_idx
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    })

                else:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": f"未知消息类型: {message_type}"},
                        "timestamp": datetime.utcnow().isoformat()
                    })

            except asyncio.TimeoutError:
                # 发送心跳保持连接
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "data": {},
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    break

            except WebSocketDisconnect:
                break

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "无效的 JSON 格式"},
                    "timestamp": datetime.utcnow().isoformat()
                })

            except Exception as e:
                print(f"WebSocket 处理错误: {e}")
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": str(e)},
                    "timestamp": datetime.utcnow().isoformat()
                })

    except Exception as e:
        print(f"WebSocket 连接错误: {e}")

    finally:
        manager.disconnect(websocket, video_id)


def calculate_similarity(client_kp: dict, standard_kp: dict) -> float:
    """
    计算两个姿态关键点集合的相似度

    使用简单的关键点距离作为相似度度量。
    实际应用中应该使用更复杂的算法，如:
    - PCK (Percentage of Correct Keypoints)
    - OKS (Object Keypoint Similarity)
    - 基于骨骼的向量夹角等

    返回: 0-100 的相似度分数
    """
    if not client_kp or not standard_kp:
        return 0.0

    total_distance = 0.0
    valid_points = 0

    # 定义需要对比的关键点对
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

        if (client_point and standard_point and
            len(client_point) >= 2 and len(standard_point) >= 2 and
            client_point[2] > 0.3 and standard_point[2] > 0.3):

            # 计算欧氏距离
            distance = ((client_point[0] - standard_point[0]) ** 2 +
                       (client_point[1] - standard_point[1]) ** 2) ** 0.5
            total_distance += distance
            valid_points += 1

    if valid_points == 0:
        return 0.0

    # 计算平均距离并转换为相似度分数
    avg_distance = total_distance / valid_points

    # 距离越小，分数越高
    # 使用指数衰减将距离映射到 0-100
    score = max(0, min(100, 100 * (1 - avg_distance * 2)))

    return score


@router.get("/live/status/{video_id}")
async def get_live_status(video_id: int):
    """获取实时检测状态"""
    db = next(get_db())
    video = video_crud.get_video_by_id(db, video_id)

    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    connected_count = len(manager.active_connections.get(video_id, set()))

    return {
        "video_id": video_id,
        "connected_clients": connected_count,
        "is_streaming": connected_count > 0
    }
