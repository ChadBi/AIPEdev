from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean, DECIMAL, TEXT, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional
from enum import Enum

from core.database import Base


class AssessmentType(str, Enum):
    """体态检测类型枚举"""
    BASELINE = "baseline"        # 基准体态
    ROUTINE = "routine"          # 常规检测
    PRE_TRAINING = "pre_training"  # 训练前检测


class ViewAngle(str, Enum):
    """拍摄角度枚举"""
    FRONT = "front"                # 正面
    LEFT_SIDE = "left_side"        # 左侧
    RIGHT_SIDE = "right_side"      # 右侧
    BACK = "back"                  # 背面


class Severity(str, Enum):
    """严重程度枚举"""
    NONE = "none"                  # 无
    MILD = "mild"                  # 轻微
    MODERATE = "moderate"          # 中等
    SEVERE = "severe"              # 严重


class TrendDirection(str, Enum):
    """趋势方向枚举"""
    IMPROVED = "improved"          # 改善
    STABLE = "stable"              # 稳定
    DECLINED = "declined"          # 下降


class PostureAssessment(Base):
    """体态检测记录表"""
    __tablename__ = "posture_assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_date = Column(DateTime, default=datetime.utcnow, index=True)
    overall_score = Column(DECIMAL(5, 2), nullable=True)
    assessment_type = Column(SQLEnum(AssessmentType), default=AssessmentType.ROUTINE, nullable=False)

    # 用户基本信息（用于年龄相关性分析）
    age = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)       # 身高(cm)
    weight = Column(Integer, nullable=True)       # 体重(kg)

    notes = Column(TEXT, nullable=True)           # 备注

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PosturePhoto(Base):
    """多角度照片表"""
    __tablename__ = "posture_photos"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("posture_assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    view_angle = Column(SQLEnum(ViewAngle), nullable=False)

    # 照片存储路径
    photo_path = Column(String(500), nullable=True)
    thumbnail_path = Column(String(500), nullable=True)

    # 关键点检测结果
    keypoints = Column(JSON, nullable=True)           # YOLOv8检测到的17个关键点数据
    confidence_score = Column(DECIMAL(5, 3), nullable=True)  # 关键点检测置信度

    # 图片信息
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    capture_quality_score = Column(DECIMAL(5, 2), nullable=True)  # 拍摄质量评分

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        # 确保每个检测记录的每个角度只有一张照片
        None,  # 将在MySQL中创建唯一索引
    )


class PostureMetrics(Base):
    """体态指标分析表"""
    __tablename__ = "posture_metrics"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("posture_assessments.id", ondelete="CASCADE"), nullable=False, index=True)

    # 平衡度指标 (0-100)
    body_balance = Column(DECIMAL(5, 2), nullable=True)           # 左右平衡度
    shoulder_balance = Column(DECIMAL(5, 2), nullable=True)       # 肩膀平衡度
    skeletal_symmetry = Column(DECIMAL(5, 2), nullable=True)      # 整体骨骼对称性

    # 对齐度指标 (0-100)
    spinal_alignment = Column(DECIMAL(5, 2), nullable=True)       # 脊柱对齐度
    hip_alignment = Column(DECIMAL(5, 2), nullable=True)          # 骨盆对齐度
    posture_stability = Column(DECIMAL(5, 2), nullable=True)      # 体态稳定性评分

    # 角度指标 (度)
    head_neck_angle = Column(DECIMAL(6, 2), nullable=True)        # 头颈角度
    spine_curvature_front = Column(DECIMAL(6, 2), nullable=True)  # 正面脊柱弯曲度
    spine_curvature_side = Column(DECIMAL(6, 2), nullable=True)   # 侧面脊柱弯曲度
    pelvis_tilt_angle = Column(DECIMAL(6, 2), nullable=True)      # 骨盆倾斜角度

    # 3D深度推断数据
    depth_estimates = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class PostureIssue(Base):
    """体态问题库 (可配置规则)"""
    __tablename__ = "posture_issues"

    id = Column(Integer, primary_key=True, index=True)
    issue_code = Column(String(50), unique=True, nullable=False, index=True)
    issue_name = Column(String(100), nullable=False)
    issue_description = Column(TEXT, nullable=True)

    # 检测规则
    detection_rule = Column(TEXT, nullable=False)                # 检测规则表达式
    detection_angles = Column(JSON, nullable=True)               # 需要的检测角度

    # 严重程度分级
    severity_levels = Column(JSON, nullable=True)                # 严重程度分级数据

    # 评分权重
    weight_score = Column(DECIMAL(5, 2), default=10.00)          # 在总分中的权重

    # 建议信息
    recommendations = Column(TEXT, nullable=True)                # 改善建议
    exercise_suggestions = Column(JSON, nullable=True)           # 相关运动建议

    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PostureAssessmentIssue(Base):
    """体态问题检测结果表"""
    __tablename__ = "posture_assessment_issues"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("posture_assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_id = Column(Integer, ForeignKey("posture_issues.id", ondelete="CASCADE"), nullable=False, index=True)

    # 检测结果
    severity = Column(SQLEnum(Severity), default=Severity.NONE, nullable=False)
    detected_value = Column(DECIMAL(10, 4), nullable=True)       # 检测到的数值
    threshold_value = Column(DECIMAL(10, 4), nullable=True)      # 标准阈值
    score_impact = Column(DECIMAL(5, 2), default=0.00)          # 对总分的影响

    # 证据数据
    evidence_data = Column(JSON, nullable=True)                 # 检测证据数据

    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    issue = relationship("PostureIssue", backref="assessment_issues")

    __table_args__ = (
        # 确保每个检测记录的每个问题只有一条记录
        None,
    )


class PostureTrend(Base):
    """用户体态历史趋势表"""
    __tablename__ = "posture_trends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # 评分信息
    baseline_score = Column(DECIMAL(5, 2), nullable=True)        # 基准体态评分
    current_score = Column(DECIMAL(5, 2), nullable=True)         # 当前体态评分
    improvement_rate = Column(DECIMAL(5, 2), nullable=True)      # 改善率 (%)

    # 趋势分析
    trend_direction = Column(SQLEnum(TrendDirection), default=TrendDirection.STABLE, index=True)
    trend_data = Column(JSON, nullable=True)                     # 详细趋势数据

    # 问题追踪
    persistent_issues = Column(JSON, nullable=True)              # 持续存在的问题
    resolved_issues = Column(JSON, nullable=True)                # 已解决的问题
    new_issues = Column(JSON, nullable=True)                     # 新出现的问题

    # 统计信息
    last_assessment_date = Column(DateTime, nullable=True)       # 最后一次检测日期
    assessment_count = Column(Integer, default=0)                # 检测次数

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RecommendationType(str, Enum):
    """建议类型枚举"""
    DAILY_HABIT = "daily_habit"        # 生活习惯
    EXERCISE = "exercise"               # 运动建议
    MEDICAL_ADVICE = "medical_advice"   # 医学建议


class DifficultyLevel(str, Enum):
    """难度等级枚举"""
    BEGINNER = "beginner"               # 初级
    INTERMEDIATE = "intermediate"       # 中级
    ADVANCED = "advanced"               # 高级


class PostureRecommendation(Base):
    """体态改善建议库"""
    __tablename__ = "posture_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    issue_code = Column(String(50), ForeignKey("posture_issues.issue_code", ondelete="CASCADE"), nullable=False, index=True)
    severity_level = Column(SQLEnum(Severity), nullable=False, index=True)

    # 建议内容
    recommendation_type = Column(SQLEnum(RecommendationType), nullable=False)
    recommendation_text = Column(TEXT, nullable=False)

    # 优先级和效果
    priority = Column(Integer, default=0, index=True)             # 优先级 (0-10)
    estimated_improvement_days = Column(Integer, nullable=True)  # 预计改善天数

    # 相关资源
    related_exercises = Column(JSON, nullable=True)              # 相关运动推荐

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PostureExerciseLibrary(Base):
    """体态改善运动库"""
    __tablename__ = "posture_exercise_library"

    id = Column(Integer, primary_key=True, index=True)
    exercise_name = Column(String(100), nullable=False)

    # 针对的问题
    target_issues = Column(JSON, nullable=True)                  # 针对的体态问题

    # 详细描述
    description = Column(TEXT, nullable=True)
    instructions = Column(TEXT, nullable=True)                   # 详细说明

    # 难度和时间
    difficulty_level = Column(SQLEnum(DifficultyLevel), default=DifficultyLevel.BEGINNER, index=True)
    duration_minutes = Column(Integer, nullable=True)            # 建议时长(分钟)
    repetitions = Column(Integer, nullable=True)                 # 建议次数

    # 媒体资源
    video_path = Column(String(500), nullable=True)              # 演示视频路径
    thumbnail_path = Column(String(500), nullable=True)          # 缩略图路径

    # 分类和标签
    tags = Column(JSON, nullable=True)                           # 标签
    muscle_groups = Column(JSON, nullable=True)                  # 目标肌肉群

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
