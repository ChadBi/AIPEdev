import math
from core.config import SAMPLE_FPS

# YOLOv8 关键点名称列表
YOLOV8_KEYPOINTS = [
    "nose",
    "left_eye", "right_eye",
    "left_ear", "right_ear",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle"
]

# 定义关节角度计算所需的三点 (A, B, C)，计算以 B 为顶点的角度
# 扩展关节评估范围，包含下肢、上肢、躯干
ANGLE_JOINTS = {
    # 下肢关节（权重高，影响稳定性和力量传递）
    "left_knee": {
        "points": ("left_hip", "left_knee", "left_ankle"),
        "weight": 1.5,  # 膝关节非常重要
        "group": "lower_body"
    },
    "right_knee": {
        "points": ("right_hip", "right_knee", "right_ankle"),
        "weight": 1.5,
        "group": "lower_body"
    },
    "left_hip": {
        "points": ("left_shoulder", "left_hip", "left_knee"),
        "weight": 1.3,  # 髋关节影响整体姿态
        "group": "lower_body"
    },
    "right_hip": {
        "points": ("right_shoulder", "right_hip", "right_knee"),
        "weight": 1.3,
        "group": "lower_body"
    },
    
    # 上肢关节（权重中等，影响动作协调）
    "left_elbow": {
        "points": ("left_shoulder", "left_elbow", "left_wrist"),
        "weight": 1.0,
        "group": "upper_body"
    },
    "right_elbow": {
        "points": ("right_shoulder", "right_elbow", "right_wrist"),
        "weight": 1.0,
        "group": "upper_body"
    },
    "left_shoulder": {
        "points": ("left_hip", "left_shoulder", "left_elbow"),
        "weight": 1.2,  # 肩关节连接躯干
        "group": "upper_body"
    },
    "right_shoulder": {
        "points": ("right_hip", "right_shoulder", "right_elbow"),
        "weight": 1.2,
        "group": "upper_body"
    },
}

# 评分参数配置
SCORING_CONFIG = {
    "angle_penalty": 1.2,  # 角度差异惩罚系数（提高到1.2，更严格）
    "confidence_threshold": 0.3,  # 关键点置信度阈值
    "perfect_score": 100,  # 满分
    "min_score": 0,  # 最低分
    "min_valid_frames_ratio": 0.5,  # 最小有效帧比例（低于此比例返回低分）
}

def _euclidean(p1, p2):
    """计算两点间的欧几里得距离"""
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

def _align_sequences(std_seq, usr_seq):
    """
    对齐标准动作序列和用户动作序列

    取最短序列长度，按 frame_index 顺序对齐。

    :param std_seq: 标准动作序列
    :param usr_seq: 用户动作序列
    :return: 对齐后的 (std_seq, usr_seq) 元组
    """
    length = min(len(std_seq), len(usr_seq))
    return std_seq[:length], usr_seq[:length]

def score_action_by_angle(standard_action: dict, user_action: dict) -> dict:
    """
    基于关节角度的动作评分算法（完善版）

    核心改进：
    1. ✅ 标准动作和用户动作都进行置信度检查（消除不对称）
    2. ✅ 准确记录有效帧数（修复平均值计算bug）
    3. ✅ 扩展关节评估范围（膝、髋、肘、肩）
    4. ✅ 引入关节权重系统（大关节权重更高）
    5. ✅ 优化帧级别分数计算
    6. ✅ 调整惩罚系数（更严格）

    :param standard_action: 标准动作数据
    :param user_action: 用户动作数据
    :return: 评分结果字典，包含总分、关节得分、帧级分数和反馈建议
    """
    std_seq = standard_action["sequence"]
    usr_seq = user_action["sequence"]

    length = min(len(std_seq), len(usr_seq))

    # 初始化各关节的角度差异累积值和有效帧计数
    angle_diff_sum = {joint: 0.0 for joint in ANGLE_JOINTS}
    valid_frame_count = {joint: 0 for joint in ANGLE_JOINTS}  # 🔥 记录每个关节的有效帧数
    
    # 记录每一帧的分数用于时间轴展示
    frame_scores = []
    
    # 统计置信度过滤情况
    total_skipped_frames = 0

    for i in range(length):
        std_kp = std_seq[i]["keypoints"]
        usr_kp = usr_seq[i]["keypoints"]
        
        # 当前帧的分数（带权重）
        frame_joint_scores = {}
        frame_skipped = True  # 标记当前帧是否完全跳过

        for joint, config in ANGLE_JOINTS.items():
            points = config["points"]
            a, b, c = points
            
            # 确保三个关键点都存在
            if not all(kp in std_kp and kp in usr_kp for kp in [a, b, c]):
                continue
            
            # 🔥 对标准动作和用户动作都进行置信度检查（修复不对称问题）
            std_valid = True
            usr_valid = True
            
            # 检查标准动作置信度
            if len(std_kp[a]) >= 3 and len(std_kp[b]) >= 3 and len(std_kp[c]) >= 3:
                if (std_kp[a][2] < SCORING_CONFIG["confidence_threshold"] or 
                    std_kp[b][2] < SCORING_CONFIG["confidence_threshold"] or 
                    std_kp[c][2] < SCORING_CONFIG["confidence_threshold"]):
                    std_valid = False
            
            # 检查用户动作置信度
            if len(usr_kp[a]) >= 3 and len(usr_kp[b]) >= 3 and len(usr_kp[c]) >= 3:
                if (usr_kp[a][2] < SCORING_CONFIG["confidence_threshold"] or 
                    usr_kp[b][2] < SCORING_CONFIG["confidence_threshold"] or 
                    usr_kp[c][2] < SCORING_CONFIG["confidence_threshold"]):
                    usr_valid = False
            
            # 只有两边都有效才进行评分
            if not (std_valid and usr_valid):
                continue
            
            # 计算角度
            std_angle = _angle(std_kp[a], std_kp[b], std_kp[c])
            usr_angle = _angle(usr_kp[a], usr_kp[b], usr_kp[c])

            angle_diff = abs(std_angle - usr_angle)
            
            # 🔥 累加到对应关节（只在有效时）
            angle_diff_sum[joint] += angle_diff
            valid_frame_count[joint] += 1  # 记录有效帧数
            frame_skipped = False  # 至少有一个关节有效
            
            # 计算当前帧的该关节分数
            score = max(
                SCORING_CONFIG["min_score"], 
                SCORING_CONFIG["perfect_score"] - angle_diff * SCORING_CONFIG["angle_penalty"]
            )
            frame_joint_scores[joint] = {
                "score": round(score, 2),
                "weight": config["weight"]
            }

        # 计算当前帧的加权总分
        if frame_joint_scores:
            # 加权平均：(score1*weight1 + score2*weight2 + ...) / (weight1 + weight2 + ...)
            weighted_sum = sum(item["score"] * item["weight"] for item in frame_joint_scores.values())
            total_weight = sum(item["weight"] for item in frame_joint_scores.values())
            frame_total = round(weighted_sum / total_weight, 2)
        else:
            frame_total = 0.0  # 无有效关节时显示0
            if frame_skipped:
                total_skipped_frames += 1
        
        frame_scores.append({
            "frame_index": i,
            "score": frame_total,
            "timestamp": round(i * 1.0 / SAMPLE_FPS, 2)
        })

    # 🔥 计算各关节加权得分（使用有效帧数而不是总帧数）
    joint_scores = {}
    for joint, diff_sum in angle_diff_sum.items():
        valid_count = valid_frame_count[joint]
        
        if valid_count == 0:
            # 该关节在所有帧中都无效，给予低分
            joint_scores[joint] = 30.0
            continue
        
        # 使用有效帧数计算平均差异
        avg_diff = diff_sum / valid_count
        
        # 评分公式
        score = max(
            SCORING_CONFIG["min_score"], 
            SCORING_CONFIG["perfect_score"] - avg_diff * SCORING_CONFIG["angle_penalty"]
        )
        joint_scores[joint] = round(score, 2)

    # 🔥 计算加权总分
    if joint_scores:
        weighted_sum = sum(
            score * ANGLE_JOINTS[joint]["weight"] 
            for joint, score in joint_scores.items()
        )
        total_weight = sum(
            ANGLE_JOINTS[joint]["weight"] 
            for joint in joint_scores.keys()
        )
        total_score = round(weighted_sum / total_weight, 2)
    else:
        total_score = 0.0

    # 检查有效数据比例
    valid_ratio = (length - total_skipped_frames) / length if length > 0 else 0
    if valid_ratio < SCORING_CONFIG["min_valid_frames_ratio"]:
        # 有效帧太少，强制降低分数并添加警告
        total_score = min(total_score, 50.0)
        print(f"⚠️  警告: 有效帧比例过低 ({valid_ratio:.1%})，评分可能不准确")

    feedback = _generate_angle_feedback(joint_scores, valid_frame_count, length)
    
    # 添加调试信息
    print(f"\n{'='*60}")
    print(f"📊 评分详情 (完善版):")
    print(f"{'='*60}")
    print(f"总帧数: {length} | 跳过帧数: {total_skipped_frames} | 有效率: {valid_ratio:.1%}")
    print(f"评估关节: {len(ANGLE_JOINTS)} 个 (含权重)")
    print(f"惩罚系数: {SCORING_CONFIG['angle_penalty']} (角度差1°扣{SCORING_CONFIG['angle_penalty']}分)")
    print(f"\n各关节得分 (带权重):")
    for joint, score in joint_scores.items():
        valid_count = valid_frame_count[joint]
        avg_diff = angle_diff_sum[joint] / valid_count if valid_count > 0 else 0
        weight = ANGLE_JOINTS[joint]["weight"]
        group = ANGLE_JOINTS[joint]["group"]
        print(f"  {_joint_name_cn(joint):6s} [{group}]: {score:5.1f}分 (权重×{weight}) | "
              f"有效帧: {valid_count}/{length} | 平均角度差: {avg_diff:.1f}°")
    print(f"\n加权总分: {total_score:.2f}")
    print(f"{'='*60}\n")

    return {
        "total_score": total_score,
        "joint_scores": joint_scores,
        "frame_scores": frame_scores,
        "feedback": feedback
    }

def _generate_angle_feedback(joint_scores: dict, valid_frame_count: dict, total_frames: int) -> list[str]:
    """
    根据关节得分生成反馈建议（完善版）

    :param joint_scores: 关节得分字典
    :param valid_frame_count: 各关节有效帧数
    :param total_frames: 总帧数
    :return: 反馈建议字符串列表
    """
    feedback = []
    
    # 按分数分组
    excellent = []  # >= 90
    good = []       # 80-89
    fair = []       # 70-79
    poor = []       # < 70
    low_data = []   # 有效帧数不足

    for joint, score in joint_scores.items():
        joint_name = _joint_name_cn(joint)
        valid_ratio = valid_frame_count[joint] / total_frames if total_frames > 0 else 0
        
        # 检查数据完整性
        if valid_ratio < 0.5:
            low_data.append(f"⚠️ {joint_name}检测数据不足({valid_ratio:.0%})，建议调整拍摄角度")
            continue
        
        # 按分数分类
        if score >= 90:
            excellent.append(joint_name)
        elif score >= 80:
            good.append(joint_name)
        elif score >= 70:
            fair.append(joint_name)
        else:
            poor.append(joint_name)

    # 生成反馈
    if excellent:
        feedback.append(f"✅ 优秀: {', '.join(excellent)} - 动作标准，继续保持")
    
    if good:
        feedback.append(f"👍 良好: {', '.join(good)} - 动作基本规范，可进一步优化")
    
    if fair:
        feedback.append(f"⚠️ 一般: {', '.join(fair)} - 动作偏离标准，需要改进")
    
    if poor:
        feedback.append(f"❌ 较差: {', '.join(poor)} - 动作明显不规范，重点练习")
    
    if low_data:
        feedback.extend(low_data)

    # 添加评分说明
    feedback.append(f"\n📌 评分标准:")
    feedback.append(f"  • 角度差异惩罚: 每{SCORING_CONFIG['angle_penalty']}°扣1分")
    feedback.append(f"  • 关节权重: 下肢(1.3-1.5) > 上肢(1.0-1.2)")
    feedback.append(f"  • 评估关节: {len(ANGLE_JOINTS)}个 (膝、髋、肘、肩)")

    return feedback

def _joint_name_cn(joint: str) -> str:
    """
    获取关节的中文名称

    :param joint: 关节英文名
    :return: 关节中文名
    """
    mapping = {
        "left_knee": "左膝",
        "right_knee": "右膝",
        "left_elbow": "左肘",
        "right_elbow": "右肘",
        "left_shoulder": "左肩",
        "right_shoulder": "右肩",
        "left_hip": "左髋",
        "right_hip": "右髋"
    }
    return mapping.get(joint, joint)

def _angle(a, b, c):
    """
    计算 ∠ABC 的角度（B 为顶点）

    利用向量点积公式计算夹角。

    :param a: 点 A [x, y, score]
    :param b: 点 B [x, y, score] (顶点)
    :param c: 点 C [x, y, score]
    :return: 角度 (度数)
    """
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])

    dot = ba[0] * bc[0] + ba[1] * bc[1]
    mag_ba = math.sqrt(ba[0] ** 2 + ba[1] ** 2)
    mag_bc = math.sqrt(bc[0] ** 2 + bc[1] ** 2)

    if mag_ba == 0 or mag_bc == 0:
        return 0.0

    # 限制余弦值在 [-1, 1] 范围内，防止浮点误差导致 acos 报错
    cos_angle = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return math.degrees(math.acos(cos_angle))
