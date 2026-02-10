from pydantic import BaseModel
from typing import Dict, List

class FrameKeypoints(BaseModel):
    """
    单帧关键点字典
    key: 关键点名称
    value: [x, y, conf]
    """
    # 动态键，使用 Dict[str, List[float]]
    keypoints: Dict[str, List[float]]

class RecognizeOut(BaseModel):
    """
    视频识别响应
    sequence: 帧序列，每帧包含关键点
    """
    sequence: List[FrameKeypoints]
