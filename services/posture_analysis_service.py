"""
体态分析核心服务

负责基于YOLOv8 Pose关键点数据进行体态分析和问题检测
参考了以下开源项目：
- Sitting-Posture-Analysis (shamiul5201)
- opencv2-posture-corrector (wtbates99)
"""

import math
import logging
from typing import Dict, List, Optional, Tuple, Any
import numpy as np

logger = logging.getLogger(__name__)

# YOLOv8 Pose 关键点映射 (COCO17)
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

# 正常角度范围（参考值） - 基于医学标准和开源项目优化
NORMAL_ANGLES = {
    'head_neck_angle': (0, 15),           # 头颈角度：正常为0-15度（放宽阈值）
    'shoulder_balance': (-8, 8),          # 肩膀平衡度：左右差异在8度内
    'pelvis_tilt': (-12, 12),              # 骨盆倾斜：正常为-12到12度
    'spine_curvature_side': (0, 25),       # 侧面脊柱弯曲：正常为0-25度
    'spine_curvature_front': (0, 15),      # 正面脊柱弯曲：正常为0-15度
}

# 体态评分阈值配置 - 参考opencv2-posture-corrector
SCORE_THRESHOLDS = {
    'head_tilt': 8.0,           # 头部前倾阈值系数
    'neck_angle': 30.0,         # 颈部角度阈值（度）
    'shoulder_level': 10.0,     # 肩膀水平位置阈值系数
    'shoulder_roll': 10.0,      # 肩膀旋转阈值系数
    'spine_angle': 30.0,        # 脊柱角度阈值（度）
    'hip_alignment': 10.0,      # 髋部对齐阈值系数
    'posture_stability': 8.0,   # 体态稳定性阈值系数
}

# 理想向量（用于角度计算）
IDEAL_NECK_VECTOR = np.array([0, -1, 0])    # 理想颈部方向（垂直向上）
IDEAL_SPINE_VECTOR = np.array([0, -1, 0])   # 理想脊柱方向（垂直向上）


class PostureAnalyzer:
    """体态分析引擎"""

    def __init__(self):
        self.confidence_threshold = 0.3  # 关键点置信度阈值

    def normalize_keypoints(self, keypoints) -> Dict[str, Tuple[float, float, float]]:
        """
        规范化关键点数据，支持多种输入格式

        Args:
            keypoints: 可以是多种格式：
                       - 字典格式: {'nose': [x, y, conf], 'left_eye': [...], ...}
                       - 列表格式: [{'id': 0, 'x': 0.5, 'y': 0.6, 'confidence': 0.9}, ...]
                       - 列表格式: [{'name': 'nose', 'x': 0.5, 'y': 0.6, 'confidence': 0.9}, ...]

        Returns:
            格式化的关键点字典 {name: (x, y, confidence)}
        """
        normalized = {}

        # 检查输入格式
        if isinstance(keypoints, dict):
            # 字典格式：{'nose': [x, y, conf], 'left_eye': [...], ...}
            for name, value in keypoints.items():
                if isinstance(value, (list, tuple)) and len(value) >= 3:
                    normalized[name] = (
                        float(value[0]),
                        float(value[1]),
                        float(value[2])
                    )
                elif isinstance(value, dict) and 'x' in value and 'y' in value:
                    # 字典格式：{'nose': {'x': 0.5, 'y': 0.6, 'confidence': 0.9}}
                    normalized[name] = (
                        float(value['x']),
                        float(value['y']),
                        float(value.get('confidence', value.get('visibility', 1.0)))
                    )
        elif isinstance(keypoints, list):
            # 列表格式：[{'id': 0, 'x': 0.5, 'y': 0.6, 'confidence': 0.9}, ...]
            for kp in keypoints:
                # YOLOv8输出格式：[x, y, confidence]
                if 'id' in kp:
                    kp_id = int(kp['id'])
                    if kp_id in KEYPOINT_MAP:
                        name = KEYPOINT_MAP[kp_id]
                        normalized[name] = (
                            float(kp['x']),
                            float(kp['y']),
                            float(kp.get('confidence', kp.get('visibility', 1.0)))
                        )
                elif 'name' in kp:
                    # 如果直接使用关键点名称
                    name = kp['name']
                    normalized[name] = (
                        float(kp['x']),
                        float(kp['y']),
                        float(kp.get('confidence', kp.get('visibility', 1.0)))
                    )

        logger.info(f"规范化的关键点数量: {len(normalized)}, 关键点: {list(normalized.keys())}")
        return normalized

    def calculate_angle(self, point_a: Tuple[float, float],
                       point_b: Tuple[float, float],
                       point_c: Tuple[float, float]) -> float:
        """
        计算以点B为顶点的角度ABC

        Args:
            point_a: 点A坐标
            point_b: 点B坐标（顶点）
            point_c: 点C坐标

        Returns:
            角度（度）
        """
        # 向量BA
        vector_ba = (point_a[0] - point_b[0], point_a[1] - point_b[1])
        # 向量BC
        vector_bc = (point_c[0] - point_b[0], point_c[1] - point_b[1])

        # 计算向量长度
        length_ba = math.sqrt(vector_ba[0]**2 + vector_ba[1]**2)
        length_bc = math.sqrt(vector_bc[0]**2 + vector_bc[1]**2)

        # 避免除零错误
        if length_ba == 0 or length_bc == 0:
            return 0.0

        # 计算点积
        dot_product = vector_ba[0] * vector_bc[0] + vector_ba[1] * vector_bc[1]

        # 计算夹角的余弦值，并限制在[-1, 1]范围内以避免数值误差
        cosine_angle = max(-1, min(1, dot_product / (length_ba * length_bc)))

        # 计算角度（弧度）
        angle_radians = math.acos(cosine_angle)

        # 转换为角度
        angle_degrees = math.degrees(angle_radians)

        return angle_degrees

    def angle_between_vectors(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """
        计算两个向量之间的角度（改进版，参考opencv2-posture-corrector）

        Args:
            v1: 向量1
            v2: 向量2

        Returns:
            角度（度）
        """
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 < 1e-6 or norm_v2 < 1e-6:
            return 0.0
        v1_norm = v1 / norm_v1
        v2_norm = v2 / norm_v2
        dot_product = np.clip(np.dot(v1_norm, v2_norm), -1.0, 1.0)
        return float(np.degrees(np.arccos(dot_product)))

    def calculate_body_balance(self, front_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算身体平衡度（正面视角） - 改进版

        基于肩膀、臀部、膝盖、脚踝的左右对称性
        参考opencv2-posture-corrector的肩膀水平度算法

        Args:
            front_keypoints: 正面视角的关键点数据

        Returns:
            平衡度评分 (0-100)
        """
        required_pairs = [
            ('left_shoulder', 'right_shoulder'),
            ('left_hip', 'right_hip'),
            ('left_knee', 'right_knee'),
            ('left_ankle', 'right_ankle')
        ]

        deviations = []
        missing_count = 0

        for left_name, right_name in required_pairs:
            left_kp = front_keypoints.get(left_name)
            right_kp = front_keypoints.get(right_name)

            # 检查关键点是否存在且置信度达标
            if left_kp and right_kp:
                left_conf, right_conf = left_kp[2], right_kp[2]

                if left_conf >= self.confidence_threshold and right_conf >= self.confidence_threshold:
                    # 计算相对于中心线的偏移
                    left_x = left_kp[0]
                    left_y = left_kp[1]
                    right_x = right_kp[0]
                    right_y = right_kp[1]

                    # 对于肩膀和髋部，计算Y轴水平差异
                    if 'shoulder' in left_name or 'hip' in left_name:
                        y_diff = abs(left_y - right_y)
                        deviations.append(y_diff * 100)  # 转换为百分比差异

                    # 对于膝盖和脚踝，主要计算X轴对称性
                    else:
                        # 理想情况下，左右关键点应该对称（即left_x + right_x ≈ 1）
                        actual_center = (left_x + right_x) / 2
                        ideal_center = 0.5

                        deviation = abs(actual_center - ideal_center) * 2  # 放大一倍便于评分

                        # 如果偏差过大，可能是检测错误，限制最大偏差
                        if deviation > 1.0:
                            logger.warning(f"{left_name} 和 {right_name} 的水平偏差过大: {deviation}，可能是检测错误")
                            deviation = 0.2  # 给一个合理的中等偏差

                        deviations.append(deviation)
                else:
                    missing_count += 1
            else:
                missing_count += 1

        if not deviations:
            # 如果有缺失的关键点，给默认分数
            if missing_count > 0:
                logger.warning(f"身体平衡度计算失败：缺少 {missing_count} 个成对关键点，使用默认分数")
                return 50.0  # 给默认分数，避免0分
            # 如果完全没有关键点对，也给默认分数
            logger.warning("身体平衡度计算失败：没有可用的成对关键点，使用默认分数")
            return 50.0

        # 计算平均偏差
        avg_deviation = sum(deviations) / len(deviations)

        # 将偏差转换为评分（偏差越小评分越高）
        # 偏差0.0 -> 100分，偏差0.1 -> 80分，偏差0.2 -> 60分...
        balance_score = max(0, min(100, 100 - avg_deviation * 300))  # 降低扣分权重

        # 确保最低分不低于60分，提高基础分数
        return round(max(60, balance_score), 2)

    def calculate_shoulder_balance(self, front_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算肩膀平衡度（正面视角） - 新增

        参考opencv2-posture-corrector的肩膀算法

        Args:
            front_keypoints: 正面视角的关键点数据

        Returns:
            肩膀平衡度评分 (0-100)
        """
        left_shoulder = front_keypoints.get('left_shoulder')
        right_shoulder = front_keypoints.get('right_shoulder')

        if not all([left_shoulder, right_shoulder]):
            logger.warning("肩膀平衡度计算失败：缺失肩膀关键点")
            return 60.0

        if left_shoulder[2] < self.confidence_threshold or right_shoulder[2] < self.confidence_threshold:
            logger.warning("肩膀平衡度计算失败：关键点置信度过低")
            return 60.0

        # 计算肩膀在Y轴上的差异（水平位置差异）
        shoulder_y_diff = abs(left_shoulder[1] - right_shoulder[1])

        # 计算肩膀在X轴上的对称性
        left_x, right_x = left_shoulder[0], right_shoulder[0]
        center_alignment = abs((left_x + right_x) / 2 - 0.5) * 2

        # 综合评分
        y_score = np.clip(1 - shoulder_y_diff * SCORE_THRESHOLDS['shoulder_level'], 0, 1)
        x_score = np.clip(1 - center_alignment * SCORE_THRESHOLDS['shoulder_level'], 0, 1)

        balance_score = (y_score + x_score) * 50  # 权重平均

        # 添加基础分数保护，避免过低分数
        balance_score = max(55, balance_score)

        return round(balance_score, 2)

    def calculate_spinal_alignment(self, side_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算脊柱对齐度（侧面视角） - 改进版

        基于耳-肩-髋-膝-踝应该在同一条垂直线上
        参考opencv2-posture-corrector的脊柱对齐算法

        Args:
            side_keypoints: 侧面视角的关键点数据

        Returns:
            对齐度评分 (0-100)
        """
        # 获取关键点对（优先使用左侧，没有则用右侧）
        spine_points = []

        point_pairs = [
            (('left_ear', 'right_ear'), 'ear'),
            (('left_shoulder', 'right_shoulder'), 'shoulder'),
            (('left_hip', 'right_hip'), 'hip'),
            (('left_knee', 'right_knee'), 'knee'),
            (('left_ankle', 'right_ankle'), 'ankle')
        ]

        for (primary, secondary), label in point_pairs:
            primary_kp = side_keypoints.get(primary)
            secondary_kp = side_keypoints.get(secondary)

            # 选择置信度更高的关键点
            selected_kp = None
            if primary_kp and primary_kp[2] >= self.confidence_threshold:
                selected_kp = primary_kp
            elif secondary_kp and secondary_kp[2] >= self.confidence_threshold:
                selected_kp = secondary_kp

            if selected_kp:
                spine_points.append((selected_kp[0], selected_kp[1], label))

        if len(spine_points) < 3:
            logger.warning(f"脊柱对齐度计算失败：只找到 {len(spine_points)} 个关键点，需要至少3个，使用默认分数")
            return 55.0  # 关键点不足，返回稍高的默认分数

        # 使用改进的算法：基于向量角度的脊柱对齐度
        # 参考opencv2-posture-corrector的方法

        # 计算肩膀中点到髋部中点的向量
        shoulders = [spine_points[i] for i, p in enumerate(spine_points) if p[2] == 'shoulder']
        hips = [spine_points[i] for i, p in enumerate(spine_points) if p[2] == 'hip']

        if shoulders and hips:
            shoulder_mid = shoulders[0]  # 取第一个肩膀
            hip_mid = hips[0]            # 取第一个髋部

            # 计算脊柱向量（从髋部到肩膀）
            spine_vector = np.array([
                shoulder_mid[0] - hip_mid[0],
                shoulder_mid[1] - hip_mid[1]
            ])

            # 计算脊柱向量与理想垂直向量的角度
            ideal_vertical = np.array([0, -1])  # 垂直向上
            spine_angle = self.angle_between_vectors(spine_vector, ideal_vertical)

            # 基于角度的评分
            alignment_score = np.clip(
                1 - abs(spine_angle) / SCORE_THRESHOLDS['spine_angle'], 0, 1
            ) * 100

            # 增加基础分数，避免过低
            alignment_score = max(60, alignment_score)
        else:
            # 降级到原有的偏差计算方法
            x_coords = [p[0] for p in spine_points]
            y_coords = [p[1] for p in spine_points]

            # 理想情况下，脊柱应该是垂直的（x坐标一致）
            ideal_x = sum(x_coords) / len(x_coords)

            # 计算各点到理想垂直线的水平距离
            horizontal_deviations = [abs(x - ideal_x) for x in x_coords]

            # 计算最大偏差和平均偏差
            max_deviation = max(horizontal_deviations) if horizontal_deviations else 0
            avg_deviation = sum(horizontal_deviations) / len(horizontal_deviations) if horizontal_deviations else 0

            # 综合评分（考虑最大偏差和平均偏差）
            # 最大偏差影响更大，但增加容错性
            if max_deviation > 0.8:  # 如果偏差过大，可能是检测错误
                logger.warning(f"脊柱对齐度检测到异常大的偏差: {max_deviation}，可能是检测错误")
                alignment_score = 55.0  # 给稍高的默认分数，避免极端低分
            else:
                alignment_score = max(0, min(100,
                    100 - (max_deviation * 150 + avg_deviation * 50)  # 降低扣分权重
                ))

        # 确保最低分不低于55分，提高基础分数
        return round(max(55, alignment_score), 2)

    def calculate_hip_alignment(self, front_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算髋部对齐度（正面视角） - 新增

        参考opencv2-posture-corrector的算法

        Args:
            front_keypoints: 正面视角的关键点数据

        Returns:
            髋部对齐度评分 (0-100)
        """
        left_hip = front_keypoints.get('left_hip')
        right_hip = front_keypoints.get('right_hip')

        if not all([left_hip, right_hip]):
            logger.warning("髋部对齐度计算失败：缺失髋部关键点")
            return 65.0

        if left_hip[2] < self.confidence_threshold or right_hip[2] < self.confidence_threshold:
            logger.warning("髋部对齐度计算失败：关键点置信度过低")
            return 65.0

        # 计算髋部在Y轴的差异（水平位置相同）
        hip_y_diff = abs(left_hip[1] - right_hip[1])

        # 计算髋部在X轴的对称性
        left_x, right_x = left_hip[0], right_hip[0]
        hip_center_alignment = abs((left_x + right_x) / 2 - 0.5) * 2

        # 综合评分
        y_score = np.clip(1 - hip_y_diff * SCORE_THRESHOLDS['hip_alignment'], 0, 1)
        x_score = np.clip(1 - hip_center_alignment * SCORE_THRESHOLDS['hip_alignment'], 0, 1)

        alignment_score = (y_score + x_score) * 50

        # 添加基础分数保护，避免过低分数
        alignment_score = max(55, alignment_score)

        return round(alignment_score, 2)

    def calculate_posture_stability(self, front_keypoints: Dict[str, Tuple[float, float, float]],
                                    side_keypoints: Dict[str, Tuple[float, float, float]] = None) -> float:
        """
        计算体态稳定性 - 新增

        基于身体重心分布和姿态一致性
        参考opencv2-posture-corrector的稳定性概念

        Args:
            front_keypoints: 正面视角的关键点数据
            side_keypoints: 侧面视角的关键点数据（可选）

        Returns:
            体态稳定性评分 (0-100)
        """
        stability_scores = []

        # 正面稳定性：基于左右对称性
        front_pairs = [
            ('left_shoulder', 'right_shoulder'),
            ('left_hip', 'right_hip'),
            ('left_knee', 'right_knee'),
            ('left_ankle', 'right_ankle')
        ]

        for left_name, right_name in front_pairs:
            left_kp = front_keypoints.get(left_name)
            right_kp = front_keypoints.get(right_name)

            if left_kp and right_kp and left_kp[2] >= self.confidence_threshold and right_kp[2] >= self.confidence_threshold:
                # 计算对称性差异
                y_diff = abs(left_kp[1] - right_kp[1])
                x_diff = abs((left_kp[0] + right_kp[0]) / 2 - 0.5) * 2

                single_score = np.clip(1 - (y_diff + x_diff) * SCORE_THRESHOLDS['posture_stability'], 0, 1)
                stability_scores.append(single_score)

        # 侧面稳定性：基于脊柱对齐
        if side_keypoints:
            side_pairs = [
                ('left_shoulder', 'right_shoulder'),
                ('left_hip', 'right_hip'),
                ('left_knee', 'right_knee'),
            ]

            for left_name, right_name in side_pairs:
                left_kp = side_keypoints.get(left_name)
                right_kp = side_keypoints.get(right_name)

                if left_kp and right_kp and left_kp[2] >= self.confidence_threshold and right_kp[2] >= self.confidence_threshold:
                    # 计算脊柱对齐性
                    x_diff = abs(left_kp[0] - right_kp[0])
                    single_score = np.clip(1 - x_diff * SCORE_THRESHOLDS['posture_stability'], 0, 1)
                    stability_scores.append(single_score)

        if not stability_scores:
            logger.warning("体态稳定性计算失败：可用关键点不足，使用默认分数")
            return 70.0

        # 综合评分
        avg_stability = np.mean(stability_scores)
        stability_score = max(65, avg_stability * 100)  # 提高基础分数

        return round(stability_score, 2)

    def calculate_head_neck_angle(self, side_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算头颈角度（侧面视角） - 改进版

        基于耳-肩角度，正常应该接近0度
        参考opencv2-posture-corrector的颈部角度算法

        Args:
            side_keypoints: 侧面视角的关键点数据

        Returns:
            头颈角度评分（0-100）
        """
        # 获取关键点
        ear_kp = None
        shoulder_kp = None
        hip_kp = None

        # 优先使用左侧关键点
        if side_keypoints.get('left_ear') and side_keypoints.get('left_ear')[2] >= self.confidence_threshold:
            ear_kp = side_keypoints['left_ear']
        elif side_keypoints.get('right_ear') and side_keypoints.get('right_ear')[2] >= self.confidence_threshold:
            ear_kp = side_keypoints['right_ear']

        if side_keypoints.get('left_shoulder') and side_keypoints.get('left_shoulder')[2] >= self.confidence_threshold:
            shoulder_kp = side_keypoints['left_shoulder']
        elif side_keypoints.get('right_shoulder') and side_keypoints.get('right_shoulder')[2] >= self.confidence_threshold:
            shoulder_kp = side_keypoints['right_shoulder']

        if side_keypoints.get('left_hip') and side_keypoints.get('left_hip')[2] >= self.confidence_threshold:
            hip_kp = side_keypoints['left_hip']
        elif side_keypoints.get('right_hip') and side_keypoints.get('right_hip')[2] >= self.confidence_threshold:
            hip_kp = side_keypoints['right_hip']

        if not all([ear_kp, shoulder_kp, hip_kp]):
            return 65.0  # 关键点不足，返回稍高的默认分数

        # 改进的算法：使用向量角度计算
        # 计算颈部向量（从肩膀到耳朵）
        neck_vector = np.array([
            ear_kp[0] - shoulder_kp[0],
            ear_kp[1] - shoulder_kp[1]
        ])

        # 计算颈部与理想垂直向量的角度
        neck_angle = self.angle_between_vectors(neck_vector, IDEAL_NECK_VECTOR[:2])

        # 基于角度的评分
        neck_vertical_score = np.clip(
            1 - abs(neck_angle) / SCORE_THRESHOLDS['neck_angle'], 0, 1
        ) * 100

        # 计算头颈角度（相对于身体）
        shoulder_hip_angle = self.calculate_angle(
            (shoulder_kp[0], shoulder_kp[1] + 0.1),  # 肩膀上方虚拟点
            (shoulder_kp[0], shoulder_kp[1]),          # 肩膀
            (hip_kp[0], hip_kp[1])                     # 髋部
        )

        ear_shoulder_angle = self.calculate_angle(
            (ear_kp[0] - 0.1, ear_kp[1]),              # 耳朵水平后方虚拟点
            (ear_kp[0], ear_kp[1]),                     # 耳朵
            (shoulder_kp[0], shoulder_kp[1])           # 肩膀
        )

        head_neck_angle = abs(ear_shoulder_angle - shoulder_hip_angle)

        # 综合两种算法的评分
        if head_neck_angle <= 15:
            traditional_score = 100 - (head_neck_angle * 2)
        elif head_neck_angle <= 30:
            traditional_score = 70 - ((head_neck_angle - 15) * 1.5)
        else:
            traditional_score = max(30, 50 - ((head_neck_angle - 30) * 1))

        # 权重综合
        final_score = (neck_vertical_score * 0.6 + traditional_score * 0.4)

        # 确保最低分不低于60分
        return round(max(60, final_score), 2)

    def calculate_spine_curvature_front(self, front_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算正面脊柱弯曲度 - 新增

        基于脊柱侧弯检测

        Args:
            front_keypoints: 正面视角的关键点数据

        Returns:
            脊柱弯曲度评分（0-100）
        """
        left_shoulder = front_keypoints.get('left_shoulder')
        right_shoulder = front_keypoints.get('right_shoulder')
        left_hip = front_keypoints.get('left_hip')
        right_hip = front_keypoints.get('right_hip')

        if not all([left_shoulder, right_shoulder, left_hip, right_hip]):
            logger.warning("正面脊柱弯曲度计算失败：缺少必要关键点")
            return 70.0

        required_confidence = self.confidence_threshold * 0.8
        if any(kp[2] < required_confidence for kp in [left_shoulder, right_shoulder, left_hip, right_hip]):
            logger.warning("正面脊柱弯曲度计算失败：关键点置信度过低")
            return 70.0

        # 计算肩部和臀部的中点
        shoulder_mid_y = (left_shoulder[1] + right_shoulder[1]) / 2
        shoulder_mid_x = (left_shoulder[0] + right_shoulder[0]) / 2

        hip_mid_y = (left_hip[1] + right_hip[1]) / 2
        hip_mid_x = (left_hip[0] + right_hip[0]) / 2

        # 计算脊柱侧弯度
        mid_x_difference = abs(shoulder_mid_x - hip_mid_x)
        mid_y_difference = abs(shoulder_mid_y - hip_mid_y)

        if mid_y_difference < 0.1:
            return 75.0  # 垂直距离太小，无法准确计算

        spinal_curvature = mid_x_difference / mid_y_difference

        # 将弯曲度转换为评分
        # 弯曲度越小评分越高
        threshold = 0.05
        if spinal_curvature <= threshold:
            score = 100.0
        else:
            score = max(65, 100 - (spinal_curvature - threshold) * 300)

        return round(score, 2)

    def calculate_spine_curvature_side(self, side_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算侧面脊柱弯曲度 - 新增

        基于侧面脊柱的弯曲检测

        Args:
            side_keypoints: 侧面视角的关键点数据

        Returns:
            脊柱弯曲度评分（0-100）
        """
        # 获取脊柱关键点
        spine_points = []

        point_names = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee']

        for name in point_names:
            kp = side_keypoints.get(name)
            if kp and kp[2] >= self.confidence_threshold:
                spine_points.append(kp)

        if len(spine_points) < 3:
            logger.warning("侧面脊柱弯曲度计算失败：关键点不足")
            return 70.0

        # 简化计算：基于肩-髋-膝的角度判断脊柱弯曲
        if len(spine_points) >= 3:
            # 获取肩膀、髋部、膝盖的第一个有效点
            shoulder = None
            hip = None
            knee = None

            for kp in spine_points:
                kp_str = str(kp)
                if 'shoulder' in kp_str and not shoulder:
                    shoulder = kp
                elif 'hip' in kp_str and not hip:
                    hip = kp
                elif 'knee' in kp_str and not knee:
                    knee = kp

            if shoulder and hip and knee:
                # 计算肩-髋-膝角度
                angle = self.calculate_angle(
                    (shoulder[0], shoulder[1]),
                    (hip[0], hip[1]),
                    (knee[0], knee[1])
                )

                # 理想角度应该接近180度（直线）
                curvature = abs(180 - angle)

                # 将弯曲度转换为评分
                if curvature <= 10:
                    score = 100.0
                elif curvature <= 25:
                    score = 90 - ((curvature - 10) * 3)
                else:
                    score = max(65, 60 - ((curvature - 25) * 1.5))

                return round(score, 2)

        # 降级到简单算法
        return 75.0

    def calculate_pelvis_tilt_angle(self, front_keypoints: Dict[str, Tuple[float, float, float]],
                                    side_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算骨盆倾斜角度 - 新增

        基于正面和侧面视角的骨盆位置，返回实际的角度值(-45到45度)

        Args:
            front_keypoints: 正面视角的关键点数据
            side_keypoints: 侧面视角的关键点数据

        Returns:
            骨盆倾斜角度（-45到45度，正值表示前倾，负值表示后倾）
        """
        tilt_angles = []

        # 侧面视角：更准确的前倾/后倾检测
        if side_keypoints:
            # 获取肩膀和髋部关键点
            left_shoulder = side_keypoints.get('left_shoulder')
            right_shoulder = side_keypoints.get('right_shoulder')
            left_hip = side_keypoints.get('left_hip')
            right_hip = side_keypoints.get('right_hip')

            # 选择置信度更高的关键点
            shoulder = None
            hip = None

            if left_shoulder and left_shoulder[2] >= self.confidence_threshold:
                shoulder = left_shoulder
            elif right_shoulder and right_shoulder[2] >= self.confidence_threshold:
                shoulder = right_shoulder

            if left_hip and left_hip[2] >= self.confidence_threshold:
                hip = left_hip
            elif right_hip and right_hip[2] >= self.confidence_threshold:
                hip = right_hip

            if shoulder and hip:
                # 计算肩-髋线与垂直线的角度
                # 垂直向量为 (0, -1)
                vertical_vector = np.array([0, -1])
                hip_shoulder_vector = np.array([
                    shoulder[0] - hip[0],
                    shoulder[1] - hip[1]
                ])

                if np.linalg.norm(hip_shoulder_vector) > 0.01:
                    # 计算角度
                    angle = self.angle_between_vectors(hip_shoulder_vector, vertical_vector)

                    # 确定倾角方向（正向右为前倾，负向左为后倾）
                    if shoulder[0] > hip[0]:  # 髋部偏前，可能前倾
                        angle = -angle  # 负值表示前倾
                    else:
                        angle = angle  # 正值表示后倾

                    # 限制在合理范围内
                    angle = max(-45, min(45, angle))
                    tilt_angles.append(angle)

        # 正面视角：骨盆水平度评估
        left_hip = front_keypoints.get('left_hip')
        right_hip = front_keypoints.get('right_hip')

        if left_hip and right_hip:
            if left_hip[2] >= self.confidence_threshold and right_hip[2] >= self.confidence_threshold:
                # 左髋低于右髋表示骨盆倾斜
                hip_level_diff = (left_hip[1] - right_hip[1]) * 100  # 放大差异

                # 将Y轴差异转换为角度（近似）
                tilt_angle = hip_level_diff * 2  # 转换为角度

                # 限制范围
                tilt_angle = max(-45, min(45, tilt_angle))
                tilt_angles.append(tilt_angle)

        if not tilt_angles:
            logger.warning("骨盆倾斜角度计算失败：可用关键点不足")
            return 5.0  # 小正角度，轻微前倾（常见）

        # 取平均角度
        avg_tilt = np.mean(tilt_angles)

        # 确保在合理范围内
        return round(max(-45, min(45, avg_tilt)), 2)

    def detect_round_shoulders(self, side_keypoints: Dict[str, Tuple[float, float, float]]) -> Dict[str, Any]:
        """
        检测圆肩

        基于肩膀相对于身体中线的位置和角度

        Args:
            side_keypoints: 侧面视角的关键点数据

        Returns:
            检测结果
        """
        result = {
            'detected': False,
            'severity': 'none',
            'angle': 0.0,
            'threshold': 25.0
        }

        # 获取肩膀关键点
        shoulder_kp = side_keypoints.get('left_shoulder') or side_keypoints.get('right_shoulder')
        elbow_kp = side_keypoints.get('left_elbow') or side_keypoints.get('right_elbow')
        hip_kp = side_keypoints.get('left_hip') or side_keypoints.get('right_hip')

        if not all([shoulder_kp, elbow_kp, hip_kp]):
            return result

        if shoulder_kp[2] < self.confidence_threshold or elbow_kp[2] < self.confidence_threshold:
            return result

        # 计算肩膀-手臂角度（圆肩时，手臂会前倾）
        shoulder_angle = self.calculate_angle(
            (shoulder_kp[0], shoulder_kp[1] - 0.1),  # 肩膀上方
            (shoulder_kp[0], shoulder_kp[1]),         # 肩膀
            (elbow_kp[0], elbow_kp[1])                # 手肘
        )

        # 圆肩的肩膀角度通常大于正常值
        threshold = 25.0
        if shoulder_angle > threshold:
            result['detected'] = True
            result['angle'] = shoulder_angle
            result['threshold'] = threshold

            # 判断严重程度
            if shoulder_angle > 45:
                result['severity'] = 'severe'
            elif shoulder_angle > 30:
                result['severity'] = 'moderate'
            else:
                result['severity'] = 'mild'

        return result

    def detect_forward_head(self, side_keypoints: Dict[str, Tuple[float, float, float]]) -> Dict[str, Any]:
        """
        检测头前伸

        基于头部相对于肩膀的水平位置

        Args:
            side_keypoints: 侧面视角的关键点数据

        Returns:
            检测结果
        """
        result = {
            'detected': False,
            'severity': 'none',
            'ratio': 0.0,
            'threshold': 1.2
        }

        # 获取关键点
        ear_kp = None
        shoulder_kp = None

        for ear_name in ['left_ear', 'right_ear']:
            kp = side_keypoints.get(ear_name)
            if kp and kp[2] >= self.confidence_threshold:
                ear_kp = kp
                break

        for shoulder_name in ['left_shoulder', 'right_shoulder']:
            kp = side_keypoints.get(shoulder_name)
            if kp and kp[2] >= self.confidence_threshold:
                shoulder_kp = kp
                break

        if not all([ear_kp, shoulder_kp]):
            return result

        # 计算头部相对于肩膀的水平距离
        ear_x, ear_y = ear_kp[0], ear_kp[1]
        shoulder_x, shoulder_y = shoulder_kp[0], shoulder_kp[1]

        # 水平距离与垂直距离的比值
        horizontal_distance = abs(ear_x - shoulder_x)
        vertical_distance = abs(ear_y - shoulder_y)

        if vertical_distance > 0:
            head_forward_ratio = horizontal_distance / vertical_distance
        else:
            head_forward_ratio = 0.0

        # 正常比例应该在0.8左右，超过1.2视为头前伸
        threshold = 1.2
        if head_forward_ratio > threshold:
            result['detected'] = True
            result['ratio'] = head_forward_ratio
            result['threshold'] = threshold

            # 判断严重程度
            if head_forward_ratio > 1.6:
                result['severity'] = 'severe'
            elif head_forward_ratio > 1.4:
                result['severity'] = 'moderate'
            else:
                result['severity'] = 'mild'

        return result

    def detect_scoliosis(self, front_keypoints: Dict[str, Tuple[float, float, float]],
                        back_keypoints: Dict[str, Tuple[float, float, float]]) -> Dict[str, Any]:
        """
        检测脊柱侧弯

        基于正面和背面视角的脊柱对称性

        Args:
            front_keypoints: 正面视角的关键点数据
            back_keypoints: 背面视角的关键点数据

        Returns:
            检测结果
        """
        result = {
            'detected': False,
            'severity': 'none',
            'curvature': 0.0,
            'threshold': 0.05
        }

        # 优先使用背面视角，如果没有则使用正面视角
        spine_keypoints = back_keypoints if back_keypoints else front_keypoints

        # 获取脊柱关键点（肩-髋中点）
        left_shoulder = spine_keypoints.get('left_shoulder')
        right_shoulder = spine_keypoints.get('right_shoulder')
        left_hip = spine_keypoints.get('left_hip')
        right_hip = spine_keypoints.get('right_hip')

        if not all([left_shoulder, right_shoulder, left_hip, right_hip]):
            return result

        # 检查关键点置信度
        required_confidence = self.confidence_threshold * 0.8  # 稍微降低阈值
        if any(kp[2] < required_confidence for kp in [left_shoulder, right_shoulder, left_hip, right_hip]):
            return result

        # 计算肩部和臀部的中点
        shoulder_mid_y = (left_shoulder[1] + right_shoulder[1]) / 2
        shoulder_mid_x = (left_shoulder[0] + right_shoulder[0]) / 2

        hip_mid_y = (left_hip[1] + right_hip[1]) / 2
        hip_mid_x = (left_hip[0] + right_hip[0]) / 2

        # 理想情况下，肩中点和臀中点应该在同一条垂直线上
        mid_x_difference = abs(shoulder_mid_x - hip_mid_x)
        mid_y_difference = abs(shoulder_mid_y - hip_mid_y)

        # 如果垂直距离太小，计算不准确
        if mid_y_difference < 0.1:
            return result

        # 计算脊柱侧弯度（水平差与垂直差的比值）
        spinal_curvature = mid_x_difference / mid_y_difference

        # 阈值：超过0.05视为可能存在侧弯
        threshold = 0.05
        if spinal_curvature > threshold:
            result['detected'] = True
            result['curvature'] = spinal_curvature
            result['threshold'] = threshold

            # 判断严重程度
            if spinal_curvature > 0.15:
                result['severity'] = 'severe'
            elif spinal_curvature > 0.10:
                result['severity'] = 'moderate'
            else:
                result['severity'] = 'mild'

        return result

    def _calculate_skeletal_symmetry(self, front_keypoints: Dict[str, Tuple[float, float, float]]) -> float:
        """
        计算骨骼对称性（正面视角） - 新增

        评估整体身体骨骼结构的对称性

        Args:
            front_keypoints: 正面视角的关键点数据

        Returns:
            骨骼对称性评分（0-100）
        """
        symmetry_pairs = [
            ('left_shoulder', 'right_shoulder'),
            ('left_elbow', 'right_elbow'),
            ('left_wrist', 'right_wrist'),
            ('left_hip', 'right_hip'),
            ('left_knee', 'right_knee'),
            ('left_ankle', 'right_ankle')
        ]

        symmetry_scores = []
        missing_count = 0

        for left_name, right_name in symmetry_pairs:
            left_kp = front_keypoints.get(left_name)
            right_kp = front_keypoints.get(right_name)

            if left_kp and right_kp:
                if left_kp[2] >= self.confidence_threshold and right_kp[2] >= self.confidence_threshold:
                    # 计算左右对称性
                    center_x = 0.5
                    left_distance = abs(left_kp[0] - center_x)
                    right_distance = abs(right_kp[0] - center_x)

                    # 评估对称性：左右距离应该大致相等
                    distance_diff = abs(left_distance - right_distance)
                    symmetry_score = np.clip(1 - distance_diff * 5, 0, 1) * 100
                    symmetry_scores.append(symmetry_score)
                else:
                    missing_count += 1
            else:
                missing_count += 1

        if not symmetry_scores:
            logger.warning(f"骨骼对称性计算失败：可用对称对过少，缺失 {missing_count} 个，使用默认分数")
            return 70.0

        avg_symmetry = np.mean(symmetry_scores)
        return round(max(60, avg_symmetry), 2)

    def analyze_single_angle(self,
                           keypoints: Dict[str, Tuple[float, float, float]],
                           view_angle: str) -> Dict[str, Any]:
        """
        分析单个角度的关键点数据

        Args:
            keypoints: 关键点数据
            view_angle: 视角类型 (front/left_side/right_side/back)

        Returns:
            该角度的分析结果
        """
        analysis = {
            'view_angle': view_angle,
            'missing_keypoints': [],
            'low_confidence_keypoints': [],
            'quality_score': 0.0
        }

        # 检查关键点完整性
        required_keypoints = set(KEYPOINT_MAP.values())
        existing_keypoints = set(keypoints.keys())
        missing_keypoints = required_keypoints - existing_keypoints
        analysis['missing_keypoints'] = list(missing_keypoints)

        # 检查置信度
        low_confidence = []
        for name, kp in keypoints.items():
            if kp[2] < self.confidence_threshold:
                low_confidence.append(name)
        analysis['low_confidence_keypoints'] = low_confidence

        # 计算质量分数
        total_keypoints = len(required_keypoints)
        valid_keypoints = total_keypoints - len(missing_keypoints) - len(low_confidence)
        quality_score = (valid_keypoints / total_keypoints) * 100 if total_keypoints > 0 else 0
        analysis['quality_score'] = round(quality_score, 2)

        return analysis

    def analyze_multiview_posture(self,
                                 view_keypoints: Dict[str, Dict[str, Tuple[float, float, float]]]) -> Dict[str, Any]:
        """
        分析多视角体态

        Args:
            view_keypoints: 各视角的关键点字典
                {'front': kps, 'left_side': kps, 'right_side': kps, 'back': kps}

        Returns:
            完综合体态分析结果
        """
        analysis = {
            'overall_quality': 0.0,
            'view_analysis': {},
            'metrics': {},
            'issues': []
        }

        # 分析每个视角
        total_quality = 0.0
        valid_views = 0

        for view_angle, keypoints in view_keypoints.items():
            if keypoints:
                view_analysis = self.analyze_single_angle(keypoints, view_angle)
                analysis['view_analysis'][view_angle] = view_analysis

                total_quality += view_analysis['quality_score']
                if view_analysis['quality_score'] > 50:  # 认为质量足够
                    valid_views += 1

        # 计算总体质量
        if view_keypoints:
            analysis['overall_quality'] = round(total_quality / len(view_keypoints), 2)

        # 计算各项体态指标
        metrics = {}

        logger.info(f"可用的视角: {list(view_keypoints.keys())}")

        if 'front' in view_keypoints and view_keypoints['front']:
            logger.info("开始计算身体平衡度...")
            body_balance = self.calculate_body_balance(view_keypoints['front'])
            metrics['body_balance'] = body_balance
            logger.info(f"身体平衡度计算完成: {body_balance}")

            logger.info("开始计算肩膀平衡度...")
            shoulder_balance = self.calculate_shoulder_balance(view_keypoints['front'])
            metrics['shoulder_balance'] = shoulder_balance
            logger.info(f"肩膀平衡度计算完成: {shoulder_balance}")

            logger.info("开始计算髋部对齐度...")
            hip_alignment = self.calculate_hip_alignment(view_keypoints['front'])
            metrics['hip_alignment'] = hip_alignment
            logger.info(f"髋部对齐度计算完成: {hip_alignment}")

            logger.info("开始计算正面脊柱弯曲度...")
            spine_curvature_front = self.calculate_spine_curvature_front(view_keypoints['front'])
            metrics['spine_curvature_front'] = spine_curvature_front
            logger.info(f"正面脊柱弯曲度计算完成: {spine_curvature_front}")
        else:
            logger.warning("缺少正面关键点，跳过相关计算")

        if 'left_side' in view_keypoints and view_keypoints['left_side']:
            logger.info("开始计算脊柱对齐度...")
            spinal_alignment = self.calculate_spinal_alignment(view_keypoints['left_side'])
            metrics['spinal_alignment'] = spinal_alignment
            logger.info(f"脊柱对齐度计算完成: {spinal_alignment}")

            logger.info("开始计算头颈角度...")
            head_neck_angle = self.calculate_head_neck_angle(view_keypoints['left_side'])
            metrics['head_neck_angle'] = head_neck_angle
            logger.info(f"头颈角度计算完成: {head_neck_angle}")

            logger.info("开始计算侧面脊柱弯曲度...")
            spine_curvature_side = self.calculate_spine_curvature_side(view_keypoints['left_side'])
            metrics['spine_curvature_side'] = spine_curvature_side
            logger.info(f"侧面脊柱弯曲度计算完成: {spine_curvature_side}")

            # 检测侧面视角的体态问题
            round_shoulders = self.detect_round_shoulders(view_keypoints['left_side'])
            if round_shoulders['detected']:
                analysis['issues'].append({
                    'code': 'round_shoulders',
                    **round_shoulders
                })

            forward_head = self.detect_forward_head(view_keypoints['left_side'])
            if forward_head['detected']:
                analysis['issues'].append({
                    'code': 'forward_head',
                    **forward_head
                })
        else:
            logger.warning("缺少左侧面关键点，跳过相关计算")

        # 计算体态稳定性（需要正面和侧面）
        if 'front' in view_keypoints and view_keypoints['front']:
            logger.info("开始计算体态稳定性...")
            stability_score = self.calculate_posture_stability(
                view_keypoints['front'],
                view_keypoints.get('left_side')
            )
            metrics['posture_stability'] = stability_score
            logger.info(f"体态稳定性计算完成: {stability_score}")

        # 计算骨盆倾斜角度（需要正面和侧面）
        if 'front' in view_keypoints and view_keypoints['front']:
            logger.info("开始计算骨盆倾斜角度...")
            pelvis_tilt_angle = self.calculate_pelvis_tilt_angle(
                view_keypoints['front'],
                view_keypoints.get('left_side')
            )
            metrics['pelvis_tilt_angle'] = pelvis_tilt_angle
            logger.info(f"骨盆倾斜角度计算完成: {pelvis_tilt_angle}")

        # 添加骨骼对称性指标（基于正面视角）
        if 'front' in view_keypoints and view_keypoints['front']:
            skeletal_symmetry = self._calculate_skeletal_symmetry(view_keypoints['front'])
            metrics['skeletal_symmetry'] = skeletal_symmetry
            logger.info(f"骨骼对称性计算完成: {skeletal_symmetry}")

        logger.info(f"计算完成的指标: {list(metrics.keys())}")

        # 检测脊柱侧弯（需要正面或背面）
        scoliosis_result = self.detect_scoliosis(
            view_keypoints.get('front', {}),
            view_keypoints.get('back', {})
        )
        if scoliosis_result['detected']:
            analysis['issues'].append({
                'code': 'scoliosis',
                **scoliosis_result
            })

        analysis['metrics'] = metrics
        return analysis
