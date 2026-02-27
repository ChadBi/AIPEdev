from typing import Dict, List, Any
import random
import base64
import logging
from functools import lru_cache
from core.config import USE_MOCK, YOLO_MODEL_PATH, YOLO_DEVICE, SAMPLE_FPS, YOLO_CONFIDENCE, YOLO_IOU

logger = logging.getLogger(__name__)

# =========================
# 配置
# =========================

# YOLOv8 Pose 关键点映射表 (COCO17)
KEYPOINT_MAP = {
    0: "nose",
    1: "left_eye",
    2: "right_eye",
    3: "left_ear",
    4: "right_ear",
    5: "left_shoulder",
    6: "right_shoulder",
    7: "left_elbow",
    8: "right_elbow",
    9: "left_wrist",
    10: "right_wrist",
    11: "left_hip",
    12: "right_hip",
    13: "left_knee",
    14: "right_knee",
    15: "left_ankle",
    16: "right_ankle",
}

# YOLO 推理参数 (从 config.yaml 读取)
YOLO_CONF = YOLO_CONFIDENCE  # 置信度阈值
YOLO_IOU_THRESHOLD = YOLO_IOU # NMS IOU 阈值
YOLO_IMGSZ = 640       # 推理图片尺寸
KEEP_TOP1 = True       # 是否只保留置信度最高的一个人

def _get_mock_keypoints() -> Dict[str, list[float]]:
    """
    生成一帧 mock 关键点
    """
    frame_kp: Dict[str, list[float]] = {}
    for name in KEYPOINT_MAP.values():
        frame_kp[name] = [
            round(random.uniform(0, 1), 3),
            round(random.uniform(0, 1), 3),
            round(random.uniform(0.8, 1), 2),
        ]
    return frame_kp


@lru_cache(maxsize=1)
def _load_pose_model():
    """
    懒加载 YOLO Pose 模型，避免重复初始化导致实时卡顿
    """
    from ultralytics import YOLO
    return YOLO(YOLO_MODEL_PATH)


def is_pose_model_loaded() -> bool:
    """
    检查 YOLO 模型是否已加载到缓存
    """
    return _load_pose_model.cache_info().hits > 0 or _load_pose_model.cache_info().misses > 0


def _extract_frame_keypoints(results: Any, width: int, height: int) -> Dict[str, list[float]]:
    """
    从 YOLO 推理结果提取单帧关键点（归一化）
    """
    frame_kp: Dict[str, list[float]] = {}

    for result in results:
        if result.keypoints is None or result.boxes is None:
            continue

        kpts = result.keypoints.xy.cpu().numpy()
        confs = result.keypoints.conf.cpu().numpy()
        box_scores = result.boxes.conf.cpu().numpy()

        if len(box_scores) == 0:
            continue

        if KEEP_TOP1:
            person_ids = [int(box_scores.argmax())]
        else:
            person_ids = range(len(box_scores))

        for pid in person_ids:
            for idx, name in KEYPOINT_MAP.items():
                x_px, y_px = kpts[pid][idx]
                conf = float(confs[pid][idx])
                if not (0 <= x_px <= width and 0 <= y_px <= height):
                    continue
                frame_kp[name] = [
                    round(float(x_px) / float(width), 4) if width > 0 else 0.0,
                    round(float(y_px) / float(height), 4) if height > 0 else 0.0,
                    round(conf, 3),
                ]
    return frame_kp

# =========================
# 对外统一入口
# =========================

def recognize_video(video_path: str) -> Dict:
    """
    视频识别主入口

    根据全局配置 USE_MOCK 决定使用 Mock 数据还是真实 YOLO 识别。

    :param video_path: 视频文件路径
    :return: 识别结果字典，包含关键点序列
        {
            "sequence": [
                {
                    "keypoints": {
                        "left_knee": [x, y, conf],
                        ...
                    }
                },
                ...
            ]
        }
    """

    if USE_MOCK:
        return _mock_recognition(video_path)

    return _yolo_recognition(video_path)


def decode_base64_frame(frame_base64: str):
    """
    将 base64 图片解码为 OpenCV BGR 图像
    """
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("缺少图像解码依赖，请安装 opencv-python") from exc

    encoded = frame_base64
    if "," in frame_base64:
        encoded = frame_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(encoded)
    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise RuntimeError("无效的图像数据，无法解码")
    return frame


def recognize_frame(frame) -> Dict[str, list[float]]:
    """
    识别单帧关键点，返回 {keypoint_name: [x, y, conf]}
    """
    if USE_MOCK:
        return _get_mock_keypoints()

    try:
        model = _load_pose_model()
        height, width = frame.shape[:2]
        results = model.predict(
            source=frame,
            conf=YOLO_CONF,
            iou=YOLO_IOU_THRESHOLD,
            imgsz=YOLO_IMGSZ,
            device=YOLO_DEVICE,
            verbose=False
        )
        return _extract_frame_keypoints(results, width, height)
    except Exception as exc:
        logger.exception("单帧识别失败")
        raise RuntimeError(f"单帧识别失败: {str(exc)}") from exc


def recognize_frame_base64(frame_base64: str) -> Dict[str, list[float]]:
    """
    接收 base64 图片并识别关键点
    """
    frame = decode_base64_frame(frame_base64)
    keypoints = recognize_frame(frame)

    # 计算图片尺寸（从帧获取）
    height, width = frame.shape[:2]

    # 返回包含完整信息的字典（兼容性包装）
    return {
        'keypoints': keypoints,
        'width': width,
        'height': height,
        'confidence': 0.9 if keypoints else 0.0
    }


def get_video_metadata(video_path: str) -> Dict:
    """
    提取视频元数据（帧率、总帧数、分辨率）

    :param video_path: 视频文件路径
    :return: 元数据字典 {"fps": int, "total_frames": int, "width": int, "height": int}
    """
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"fps": None, "total_frames": None, "width": None, "height": None}

        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        return {
            "fps": fps,
            "total_frames": total_frames,
            "width": width,
            "height": height
        }
    except Exception:
        return {"fps": None, "total_frames": None, "width": None, "height": None}


# =========================
# Mock 识别
# =========================

def _mock_recognition(video_path: str) -> Dict:
    """
    Mock 识别结果 (用于测试)

    用途：
    - API 联调
    - 评分模块测试
    - 不依赖 YOLO / CUDA 环境

    :param video_path: 视频路径 (仅用于兼容接口，不实际读取)
    :return: 模拟的识别结果字典
    """

    sequence = []

    # 模拟 10 帧动作
    for _ in range(10):
        sequence.append({"keypoints": _get_mock_keypoints()})

    return {"sequence": sequence}

# =========================
# YOLOv8 Pose 真实识别
# =========================

def _yolo_recognition(video_path: str) -> Dict:
    """
    使用 Ultralytics YOLOv8 Pose 进行视频姿态识别

    整合自 PEYOLO/video_pose_to_ls_predictions.py 的成熟推理逻辑：
    - 支持抽帧采样（按 SAMPLE_FPS 控制采样密度）
    - 支持置信度过滤（YOLO_CONF）
    - 支持只保留最高置信度目标（KEEP_TOP1）
    - 输出归一化坐标 [x_norm, y_norm, conf]

    :param video_path: 视频文件路径
    :return: 识别结果字典
    :raises RuntimeError: 如果未安装 ultralytics 或 opencv-python
    """

    try:
        import cv2
    except ImportError:
        raise RuntimeError("请先安装 ultralytics 和 opencv-python: pip install ultralytics opencv-python")

    try:
        model = _load_pose_model()
    except ImportError as exc:
        raise RuntimeError("请先安装 ultralytics 和 opencv-python: uv add ultralytics opencv-python") from exc

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"无法打开视频文件: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        video_fps = 30  # 默认值

    # 计算每隔多少帧采样一次
    # 例如视频30fps，SAMPLE_FPS=6 → 每5帧采一帧
    frame_interval = max(1, int(round(video_fps / SAMPLE_FPS)))

    sequence = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # 按间隔抽帧
        if frame_idx % frame_interval != 0:
            frame_idx += 1
            continue

        h, w = frame.shape[:2]

        # YOLO 推理（单帧）
        results = model.predict(
            source=frame,
            conf=YOLO_CONF,
            iou=YOLO_IOU_THRESHOLD,
            imgsz=YOLO_IMGSZ,
            device=YOLO_DEVICE,
            verbose=False
        )

        frame_kp = _extract_frame_keypoints(results, w, h)

        if frame_kp:
            sequence.append({"keypoints": frame_kp})

        frame_idx += 1

    cap.release()

    # 如果整个视频没有识别到任何帧，返回空序列
    if not sequence:
        return {"sequence": []}

    return {"sequence": sequence}
