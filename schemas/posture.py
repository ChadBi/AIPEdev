from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# 枚举类型定义
class AssessmentType(str, Enum):
    BASELINE = "baseline"
    ROUTINE = "routine"
    PRE_TRAINING = "pre_training"


class ViewAngle(str, Enum):
    FRONT = "front"
    LEFT_SIDE = "left_side"
    RIGHT_SIDE = "right_side"
    BACK = "back"


class Severity(str, Enum):
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class TrendDirection(str, Enum):
    IMPROVED = "improved"
    STABLE = "stable"
    DECLINED = "declined"


class RecommendationType(str, Enum):
    DAILY_HABIT = "daily_habit"
    EXERCISE = "exercise"
    MEDICAL_ADVICE = "medical_advice"


class DifficultyLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


# ========== 体态检测相关 Schema ==========

class PostureAssessmentBase(BaseModel):
    """体态检测基础模型"""
    user_id: int
    assessment_type: AssessmentType = AssessmentType.ROUTINE
    age: Optional[int] = Field(None, ge=1, le=120, description="用户年龄")
    height: Optional[int] = Field(None, ge=50, le=250, description="用户身高(cm)")
    weight: Optional[int] = Field(None, ge=20, le=200, description="用户体重(kg)")
    notes: Optional[str] = None


class PostureAssessmentCreate(PostureAssessmentBase):
    """创建体态检测"""
    pass


class PostureAssessmentUpdate(BaseModel):
    """更新体态检测"""
    overall_score: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class PostureAssessment(PostureAssessmentBase):
    """体态检测输出"""
    id: int
    assessment_date: datetime
    overall_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 多角度照片相关 Schema ==========

class PosturePhotoBase(BaseModel):
    """照片基础模型"""
    view_angle: ViewAngle
    image_width: Optional[int] = None
    image_height: Optional[int] = None


class PosturePhotoCreate(PosturePhotoBase):
    """创建照片记录"""
    assessment_id: int
    photo_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    keypoints: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    capture_quality_score: Optional[float] = Field(None, ge=0, le=100)


class PosturePhoto(PosturePhotoBase):
    """照片输出"""
    id: int
    assessment_id: int
    photo_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    keypoints: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    capture_quality_score: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ========== 体态指标相关 Schema ==========

class PostureMetricsBase(BaseModel):
    """体态指标基础模型"""
    body_balance: Optional[float] = Field(None, ge=0, le=100)
    spinal_alignment: Optional[float] = Field(None, ge=0, le=100)
    shoulder_balance: Optional[float] = Field(None, ge=0, le=100)
    hip_alignment: Optional[float] = Field(None, ge=0, le=100)
    head_neck_angle: Optional[float] = Field(None, ge=0, le=180)
    spine_curvature_front: Optional[float] = Field(None, ge=0, le=180)
    spine_curvature_side: Optional[float] = Field(None, ge=0, le=180)
    pelvis_tilt_angle: Optional[float] = Field(None, ge=-45, le=45)
    skeletal_symmetry: Optional[float] = Field(None, ge=0, le=100)
    posture_stability: Optional[float] = Field(None, ge=0, le=100)
    depth_estimates: Optional[Dict[str, Any]] = None


class PostureMetricsCreate(PostureMetricsBase):
    """创建体态指标"""
    assessment_id: int


class PostureMetrics(PostureMetricsBase):
    """体态指标输出"""
    id: int
    assessment_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ========== 体态问题相关 Schema ==========

class PostureIssueBase(BaseModel):
    """体态问题基础模型"""
    issue_code: str = Field(..., max_length=50)
    issue_name: str = Field(..., max_length=100)
    issue_description: Optional[str] = None
    detection_rule: str
    detection_angles: Optional[List[str]] = None
    severity_levels: Optional[Dict[str, Any]] = None
    weight_score: float = Field(default=10.0, ge=0, le=100)
    recommendations: Optional[str] = None
    exercise_suggestions: Optional[List[int]] = None
    is_active: bool = True


class PostureIssueCreate(PostureIssueBase):
    """创建体态问题规则"""
    pass


class PostureIssueUpdate(BaseModel):
    """更新体态问题规则"""
    issue_name: Optional[str] = Field(None, max_length=100)
    issue_description: Optional[str] = None
    detection_rule: Optional[str] = None
    severity_levels: Optional[Dict[str, Any]] = None
    weight_score: Optional[float] = Field(None, ge=0, le=100)
    recommendations: Optional[str] = None
    exercise_suggestions: Optional[List[int]] = None
    is_active: Optional[bool] = None


class PostureIssue(PostureIssueBase):
    """体态问题输出"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 体态问题检测结果相关 Schema ==========

class PostureAssessmentIssueBase(BaseModel):
    """检测结果基础模型"""
    assessment_id: int
    issue_id: int
    severity: Severity = Severity.NONE
    detected_value: Optional[float] = None
    threshold_value: Optional[float] = None
    score_impact: float = Field(default=0.0, ge=0)
    evidence_data: Optional[Dict[str, Any]] = None


class PostureAssessmentIssueCreate(PostureAssessmentIssueBase):
    """创建检测结果"""
    pass


class PostureAssessmentIssue(PostureAssessmentIssueBase):
    """检测结果输出"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ========== 体态趋势相关 Schema ==========

class PostureTrendBase(BaseModel):
    """体态趋势基础模型"""
    baseline_score: Optional[float] = Field(None, ge=0, le=100)
    current_score: Optional[float] = Field(None, ge=0, le=100)
    improvement_rate: Optional[float] = Field(None, ge=-100, le=100)
    trend_direction: TrendDirection = TrendDirection.STABLE


class PostureTrendUpdate(PostureTrendBase):
    """更新体态趋势"""
    trend_data: Optional[Dict[str, Any]] = None
    persistent_issues: Optional[List[str]] = None
    resolved_issues: Optional[List[str]] = None
    new_issues: Optional[List[str]] = None
    last_assessment_date: Optional[datetime] = None


class PostureTrend(PostureTrendBase):
    """体态趋势输出"""
    id: int
    user_id: int
    trend_data: Optional[Dict[str, Any]] = None
    persistent_issues: Optional[List[str]] = None
    resolved_issues: Optional[List[str]] = None
    new_issues: Optional[List[str]] = None
    last_assessment_date: Optional[datetime] = None
    assessment_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 改善建议相关 Schema ==========

class PostureRecommendationBase(BaseModel):
    """改善建议基础模型"""
    issue_code: str = Field(..., max_length=50)
    severity_level: Severity
    recommendation_type: RecommendationType
    recommendation_text: str
    priority: int = Field(default=0, ge=0, le=10)
    estimated_improvement_days: Optional[int] = Field(None, ge=1, le=365)
    related_exercises: Optional[List[int]] = None
    is_active: bool = True


class PostureRecommendationCreate(PostureRecommendationBase):
    """创建改善建议"""
    pass


class PostureRecommendationUpdate(BaseModel):
    """更新改善建议"""
    recommendation_text: Optional[str] = None
    recommendation_type: Optional[RecommendationType] = None
    priority: Optional[int] = Field(None, ge=0, le=10)
    estimated_improvement_days: Optional[int] = Field(None, ge=1, le=365)
    related_exercises: Optional[List[int]] = None
    is_active: Optional[bool] = None


class PostureRecommendation(PostureRecommendationBase):
    """改善建议输出"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 运动库相关 Schema ==========

class PostureExerciseBase(BaseModel):
    """运动基础模型"""
    exercise_name: str = Field(..., max_length=100)
    target_issues: Optional[List[str]] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    difficulty_level: DifficultyLevel = DifficultyLevel.BEGINNER
    duration_minutes: Optional[int] = Field(None, ge=1, le=120)
    repetitions: Optional[int] = Field(None, ge=1, le=1000)
    video_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    tags: Optional[List[str]] = None
    muscle_groups: Optional[List[str]] = None
    is_active: bool = True


class PostureExerciseCreate(PostureExerciseBase):
    """创建运动"""
    pass


class PostureExerciseUpdate(BaseModel):
    """更新运动"""
    exercise_name: Optional[str] = Field(None, max_length=100)
    target_issues: Optional[List[str]] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=120)
    repetitions: Optional[int] = Field(None, ge=1, le=1000)
    video_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    tags: Optional[List[str]] = None
    muscle_groups: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PostureExercise(PostureExerciseBase):
    """运动输出"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 复合输出 Schema ==========

class PostureAssessmentResponse(BaseModel):
    """体态评估完整响应"""
    assessment: PostureAssessment
    photos: List[PosturePhoto]
    metrics: PostureMetrics
    detected_issues: List[PostureAssessmentIssue]
    overall_score: float
    issue_codes: List[str]  # 检测到的问题代码列表
    severity_summary: Dict[str, int]  # 严重程度统计
    timestamp: datetime


class PostureHistoryItem(PostureAssessment):
    """体态历史记录项"""
    photo_count: int
    issue_count: int
    severe_issue_count: int


class PostureHistoryList(BaseModel):
    """体态历史列表"""
    items: List[PostureHistoryItem]
    total: int
    skip: int
    limit: int


class PostureTrendResponse(BaseModel):
    """体态趋势响应"""
    trend: PostureTrend
    history: List[PostureHistoryItem]


class DetailedAssessmentReport(BaseModel):
    """详细体态评估报告"""
    assessment: PostureAssessment
    photos: List[PosturePhoto]
    metrics: PostureMetrics
    detected_issues: List[PostureAssessmentIssue]
    issue_details: List[Dict[str, Any]]  # 问题详细信息
    recommendations: List[Dict[str, Any]]  # 改善建议
    overall_score: float
    score_breakdown: Dict[str, Any]
    comparison_with_baseline: Optional[Dict[str, Any]]
    assessment_date: datetime


class PostureAssessmentRequest(BaseModel):
    """体态评估请求"""
    assessment_type: AssessmentType = AssessmentType.ROUTINE
    age: Optional[int] = None
    height: Optional[int] = None
    weight: Optional[int] = None
    notes: Optional[str] = None


class AnalysisProgress(BaseModel):
    """分析进度"""
    step: str
    progress: float  # 0-100
    message: str
    current_angle: Optional[ViewAngle] = None


class SkeletonAnalysisResponse(BaseModel):
    """骨架分析响应（单张图片）"""
    view_angle: ViewAngle
    keypoints: Dict[str, Any]
    confidence_score: float
    image_width: int
    image_height: int
    detected_body: bool
    quality_score: float
    processing_time: float
