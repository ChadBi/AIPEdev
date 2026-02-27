from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from sqlalchemy import and_, or_, desc
from datetime import datetime, timedelta

from models.posture import (
    PostureAssessment, PosturePhoto, PostureMetrics,
    PostureIssue, PostureAssessmentIssue, PostureTrend,
    PostureRecommendation, PostureExerciseLibrary,
    AssessmentType, ViewAngle, Severity, TrendDirection, DifficultyLevel
)
from schemas.posture import (
    PostureAssessmentCreate, PostureAssessmentUpdate,
    PosturePhotoCreate,
    PostureMetricsCreate,
    PostureIssueCreate, PostureIssueUpdate,
    PostureAssessmentIssueCreate,
    PostureTrendUpdate,
    PostureRecommendationCreate, PostureRecommendationUpdate,
    PostureExerciseCreate, PostureExerciseUpdate
)


# ========== 体态检测记录 CRUD ==========

def create_posture_assessment(
    db: Session,
    assessment: PostureAssessmentCreate
) -> PostureAssessment:
    """创建体态检测记录"""
    db_assessment = PostureAssessment(**assessment.model_dump())
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    return db_assessment


def get_posture_assessment(
    db: Session,
    assessment_id: int
) -> Optional[PostureAssessment]:
    """获取体态检测记录"""
    return db.query(PostureAssessment).filter(
        PostureAssessment.id == assessment_id
    ).first()


def get_user_posture_assessments(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 10,
    assessment_type: Optional[AssessmentType] = None
) -> List[PostureAssessment]:
    """获取用户的体态检测记录"""
    query = db.query(PostureAssessment).filter(
        PostureAssessment.user_id == user_id
    )

    if assessment_type:
        query = query.filter(PostureAssessment.assessment_type == assessment_type)

    return query.order_by(
        desc(PostureAssessment.assessment_date)
    ).offset(skip).limit(limit).all()


def get_user_assessment_count(
    db: Session,
    user_id: int,
    assessment_type: Optional[AssessmentType] = None
) -> int:
    """获取用户体态检测记录总数"""
    query = db.query(PostureAssessment).filter(
        PostureAssessment.user_id == user_id
    )

    if assessment_type:
        query = query.filter(PostureAssessment.assessment_type == assessment_type)

    return query.count()


def update_posture_assessment(
    db: Session,
    assessment_id: int,
    assessment_update: PostureAssessmentUpdate
) -> Optional[PostureAssessment]:
    """更新体态检测记录"""
    db_assessment = get_posture_assessment(db, assessment_id)
    if db_assessment:
        update_data = assessment_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_assessment, key, value)
        db.commit()
        db.refresh(db_assessment)
    return db_assessment


def delete_posture_assessment(
    db: Session,
    assessment_id: int
) -> bool:
    """删除体态检测记录"""
    db_assessment = get_posture_assessment(db, assessment_id)
    if db_assessment:
        db.delete(db_assessment)
        db.commit()
        return True
    return False


def get_latest_assessment(
    db: Session,
    user_id: int,
    assessment_type: Optional[AssessmentType] = None
) -> Optional[PostureAssessment]:
    """获取用户最新的体态检测记录"""
    query = db.query(PostureAssessment).filter(
        PostureAssessment.user_id == user_id
    )

    if assessment_type:
        query = query.filter(PostureAssessment.assessment_type == assessment_type)

    return query.order_by(
        desc(PostureAssessment.assessment_date)
    ).first()


# ========== 多角度照片 CRUD ==========

def create_posture_photo(
    db: Session,
    photo: PosturePhotoCreate
) -> Optional[PosturePhoto]:
    """创建照片记录"""
    # 检查是否已存在相同角度的照片
    existing = db.query(PosturePhoto).filter(
        and_(
            PosturePhoto.assessment_id == photo.assessment_id,
            PosturePhoto.view_angle == photo.view_angle
        )
    ).first()

    if existing:
        # 更新现有记录
        update_data = photo.model_dump(exclude={'assessment_id'})
        for key, value in update_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 创建新记录
        db_photo = PosturePhoto(**photo.model_dump())
        db.add(db_photo)
        db.commit()
        db.refresh(db_photo)
        return db_photo


def get_assessment_photos(
    db: Session,
    assessment_id: int
) -> List[PosturePhoto]:
    """获取指定的所有照片"""
    return db.query(PosturePhoto).filter(
        PosturePhoto.assessment_id == assessment_id
    ).all()


def get_assessment_photo_by_angle(
    db: Session,
    assessment_id: int,
    view_angle: ViewAngle
) -> Optional[PosturePhoto]:
    """获取指定角度的照片"""
    return db.query(PosturePhoto).filter(
        and_(
            PosturePhoto.assessment_id == assessment_id,
            PosturePhoto.view_angle == view_angle
        )
    ).first()


def update_posture_photo(
    db: Session,
    photo_id: int,
    update_data: Dict[str, Any]
) -> Optional[PosturePhoto]:
    """更新照片记录"""
    db_photo = db.query(PosturePhoto).filter(
        PosturePhoto.id == photo_id
    ).first()

    if db_photo:
        for key, value in update_data.items():
            setattr(db_photo, key, value)
        db.commit()
        db.refresh(db_photo)

    return db_photo


# ========== 体态指标 CRUD ==========

def create_posture_metrics(
    db: Session,
    metrics: PostureMetricsCreate
) -> Optional[PostureMetrics]:
    """创建体态指标"""
    # 检查是否已存在
    existing = db.query(PostureMetrics).filter(
        PostureMetrics.assessment_id == metrics.assessment_id
    ).first()

    if existing:
        # 更新现有记录
        update_data = metrics.model_dump(exclude={'assessment_id'})
        for key, value in update_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 创建新记录
        db_metrics = PostureMetrics(**metrics.model_dump())
        db.add(db_metrics)
        db.commit()
        db.refresh(db_metrics)
        return db_metrics


def get_assessment_metrics(
    db: Session,
    assessment_id: int
) -> Optional[PostureMetrics]:
    """获取指定的体态指标"""
    return db.query(PostureMetrics).filter(
        PostureMetrics.assessment_id == assessment_id
    ).first()


# ========== 体态问题规则 CRUD ==========

def create_posture_issue(
    db: Session,
    issue: PostureIssueCreate
) -> PostureIssue:
    """创建体态问题规则"""
    db_issue = PostureIssue(**issue.model_dump())
    db.add(db_issue)
    db.commit()
    db.refresh(db_issue)
    return db_issue


def get_posture_issue(
    db: Session,
    issue_id: int
) -> Optional[PostureIssue]:
    """获取体态问题规则"""
    return db.query(PostureIssue).filter(
        PostureIssue.id == issue_id
    ).first()


def get_posture_issue_by_code(
    db: Session,
    issue_code: str
) -> Optional[PostureIssue]:
    """根据代码获取体态问题规则"""
    return db.query(PostureIssue).filter(
        PostureIssue.issue_code == issue_code
    ).first()


def get_active_posture_issues(
    db: Session,
    active_only: bool = True
) -> List[PostureIssue]:
    """获取启用的体态问题规则"""
    query = db.query(PostureIssue)
    if active_only:
        query = query.filter(PostureIssue.is_active == True)
    return query.all()


def update_posture_issue(
    db: Session,
    issue_id: int,
    issue_update: PostureIssueUpdate
) -> Optional[PostureIssue]:
    """更新体态问题规则"""
    db_issue = get_posture_issue(db, issue_id)
    if db_issue:
        update_data = issue_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_issue, key, value)
        db.commit()
        db.refresh(db_issue)
    return db_issue


def delete_posture_issue(
    db: Session,
    issue_id: int
) -> bool:
    """删除体态问题规则"""
    db_issue = get_posture_issue(db, issue_id)
    if db_issue:
        db.delete(db_issue)
        db.commit()
        return True
    return False


# ========== 体态问题检测结果 CRUD ==========

def create_assessment_issue(
    db: Session,
    assessment_issue: PostureAssessmentIssueCreate
) -> Optional[PostureAssessmentIssue]:
    """创建检测结果"""
    # 检查是否已存在
    existing = db.query(PostureAssessmentIssue).filter(
        and_(
            PostureAssessmentIssue.assessment_id == assessment_issue.assessment_id,
            PostureAssessmentIssue.issue_id == assessment_issue.issue_id
        )
    ).first()

    if existing:
        # 更新现有记录
        update_data = assessment_issue.model_dump(exclude={'assessment_id', 'issue_id'})
        for key, value in update_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 创建新记录
        db_issue = PostureAssessmentIssue(**assessment_issue.model_dump())
        db.add(db_issue)
        db.commit()
        db.refresh(db_issue)
        return db_issue


def get_assessment_issues(
    db: Session,
    assessment_id: int
) -> List[PostureAssessmentIssue]:
    """获取指定的问题检测结果"""
    return db.query(PostureAssessmentIssue).options(
        joinedload(PostureAssessmentIssue.issue)
    ).filter(
        PostureAssessmentIssue.assessment_id == assessment_id
    ).all()


def get_assessment_issues_by_severity(
    db: Session,
    assessment_id: int,
    severity: Severity
) -> List[PostureAssessmentIssue]:
    """按严重程度获取检测结果"""
    return db.query(PostureAssessmentIssue).filter(
        and_(
            PostureAssessmentIssue.assessment_id == assessment_id,
            PostureAssessmentIssue.severity == severity
        )
    ).all()


def batch_create_assessment_issues(
    db: Session,
    issues: List[PostureAssessmentIssueCreate]
) -> List[PostureAssessmentIssue]:
    """批量创建检测结果"""
    created_issues = []
    for issue_data in issues:
        created_issue = create_assessment_issue(db, issue_data)
        if created_issue:
            created_issues.append(created_issue)
    return created_issues


# ========== 体态趋势 CRUD ==========

def get_or_create_trend(
    db: Session,
    user_id: int
) -> PostureTrend:
    """获取或创建用户体态趋势"""
    trend = db.query(PostureTrend).filter(
        PostureTrend.user_id == user_id
    ).first()

    if not trend:
        trend = PostureTrend(user_id=user_id)
        db.add(trend)
        db.commit()
        db.refresh(trend)

    return trend


def update_trend(
    db: Session,
    user_id: int,
    trend_update: PostureTrendUpdate
) -> Optional[PostureTrend]:
    """更新体态趋势"""
    trend = get_or_create_trend(db, user_id)
    if trend:
        update_data = trend_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(trend, key, value)
        db.commit()
        db.refresh(trend)
    return trend


def update_trend_after_assessment(
    db: Session,
    user_id: int,
    assessment: PostureAssessment,
    issues: List[PostureAssessmentIssue],
    all_issues: List[PostureIssue]
) -> PostureTrend:
    """评估后更新体态趋势"""
    trend = get_or_create_trend(db, user_id)

    # 更新基本统计
    trend.last_assessment_date = assessment.assessment_date
    trend.assessment_count += 1

    # 更新当前评分
    if assessment.overall_score is not None:
        trend.current_score = assessment.overall_score

        # 如果是首次评估或基准评估，更新基准分
        if trend.baseline_score is None or assessment.assessment_type == AssessmentType.BASELINE:
            trend.baseline_score = assessment.overall_score

        # 计算改善率
        if trend.baseline_score is not None and trend.baseline_score > 0:
            trend.improvement_rate = round(
                ((assessment.overall_score - trend.baseline_score) / trend.baseline_score) * 100,
                2
            )

            # 确定趋势方向
            if trend.improvement_rate > 5:
                trend.trend_direction = TrendDirection.IMPROVED
            elif trend.improvement_rate < -5:
                trend.trend_direction = TrendDirection.DECLINED
            else:
                trend.trend_direction = TrendDirection.STABLE

    # 更新问题追踪
    current_issue_codes = [issue.issue_id for issue in issues if issue.severity != Severity.NONE]

    # 初始化或更新问题追踪
    if not trend.trend_data:
        trend.trend_data = {}

    trend_data = trend.trend_data

    # 获取之前的评估数据作为对比
    previous_assessments = get_user_posture_assessments(db, user_id, skip=0, limit=2)
    if len(previous_assessments) > 1:
        previous_assessment_id = previous_assessments[1].id if len(previous_assessments) > 1 else None
        if previous_assessment_id:
            previous_issues = get_assessment_issues(db, previous_assessment_id)
            previous_issue_codes = [i.issue_id for i in previous_issues if i.severity != Severity.NONE]

            # 持续存在的问题（之前和现在都有）
            persistent_issues = set(current_issue_codes) & set(previous_issue_codes)

            # 已解决的问题（之前有，现在没有）
            resolved_issues = set(previous_issue_codes) - set(current_issue_codes)

            # 新出现的问题（之前没有，现在有）
            new_issues = set(current_issue_codes) - set(previous_issue_codes)

            trend.persistent_issues = list(persistent_issues)
            trend.resolved_issues = list(resolved_issues)
            trend.new_issues = list(new_issues)
    else:
        # 首次评估
        trend.persistent_issues = []
        trend.resolved_issues = []
        trend.new_issues = current_issue_codes

    # 更新趋势数据历史
    if 'history' not in trend_data:
        trend_data['history'] = []

    trend_data['history'].append({
        'date': assessment.assessment_date.isoformat(),
        'score': float(assessment.overall_score) if assessment.overall_score else None,
        'issue_codes': current_issue_codes,
        'assessment_type': assessment.assessment_type.value
    })

    # 只保留最近两年的数据
    two_years_ago = datetime.utcnow() - timedelta(days=730)
    trend_data['history'] = [
        h for h in trend_data['history']
        if datetime.fromisoformat(h['date']) > two_years_ago
    ]

    trend.trend_data = trend_data

    db.commit()
    db.refresh(trend)
    return trend


# ========== 改善建议 CRUD ==========

def create_recommendation(
    db: Session,
    recommendation: PostureRecommendationCreate
) -> PostureRecommendation:
    """创建改善建议"""
    db_recommendation = PostureRecommendation(**recommendation.model_dump())
    db.add(db_recommendation)
    db.commit()
    db.refresh(db_recommendation)
    return db_recommendation


def get_recommendation(
    db: Session,
    recommendation_id: int
) -> Optional[PostureRecommendation]:
    """获取改善建议"""
    return db.query(PostureRecommendation).filter(
        PostureRecommendation.id == recommendation_id
    ).first()


def get_recommendations_by_issue(
    db: Session,
    issue_code: str,
    severity: Severity = Severity.MODERATE,
    active_only: bool = True
) -> List[PostureRecommendation]:
    """根据体态问题获取改善建议"""
    query = db.query(PostureRecommendation).filter(
        PostureRecommendation.issue_code == issue_code
    ).filter(
        or_(
            PostureRecommendation.severity_level == severity,
            PostureRecommendation.severity_level == Severity.NONE  # 通用建议
        )
    )

    if active_only:
        query = query.filter(PostureRecommendation.is_active == True)

    return query.order_by(
        desc(PostureRecommendation.priority)
    ).all()


def update_recommendation(
    db: Session,
    recommendation_id: int,
    recommendation_update: PostureRecommendationUpdate
) -> Optional[PostureRecommendation]:
    """更新改善建议"""
    db_recommendation = get_recommendation(db, recommendation_id)
    if db_recommendation:
        update_data = recommendation_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_recommendation, key, value)
        db.commit()
        db.refresh(db_recommendation)
    return db_recommendation


def delete_recommendation(
    db: Session,
    recommendation_id: int
) -> bool:
    """删除改善建议"""
    db_recommendation = get_recommendation(db, recommendation_id)
    if db_recommendation:
        db.delete(db_recommendation)
        db.commit()
        return True
    return False


# ========== 运动库 CRUD ==========

def create_exercise(
    db: Session,
    exercise: PostureExerciseCreate
) -> PostureExerciseLibrary:
    """创建改善运动"""
    db_exercise = PostureExerciseLibrary(**exercise.model_dump())
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return db_exercise


def get_exercise(
    db: Session,
    exercise_id: int
) -> Optional[PostureExerciseLibrary]:
    """获取改善运动"""
    return db.query(PostureExerciseLibrary).filter(
        PostureExerciseLibrary.id == exercise_id
    ).first()


def get_exercises_by_issue(
    db: Session,
    issue_code: Optional[str] = None,
    difficulty: Optional[DifficultyLevel] = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 10
) -> List[PostureExerciseLibrary]:
    """根据条件获取改善运动"""
    query = db.query(PostureExerciseLibrary)

    if issue_code:
        # 查找针对特定问题的运动
        query = query.filter(
            PostureExerciseLibrary.target_issues.contains([issue_code])
        )

    if difficulty:
        query = query.filter(PostureExerciseLibrary.difficulty_level == difficulty)

    if active_only:
        query = query.filter(PostureExerciseLibrary.is_active == True)

    return query.offset(skip).limit(limit).all()


def get_all_exercises(
    db: Session,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 20
) -> List[PostureExerciseLibrary]:
    """获取所有改善运动"""
    query = db.query(PostureExerciseLibrary)

    if active_only:
        query = query.filter(PostureExerciseLibrary.is_active == True)

    return query.order_by(
        desc(PostureExerciseLibrary.difficulty_level)
    ).offset(skip).limit(limit).all()


def get_exercise_count(
    db: Session,
    active_only: bool = True
) -> int:
    """获取改善运动总数"""
    query = db.query(PostureExerciseLibrary)

    if active_only:
        query = query.filter(PostureExerciseLibrary.is_active == True)

    return query.count()


def update_exercise(
    db: Session,
    exercise_id: int,
    exercise_update: PostureExerciseUpdate
) -> Optional[PostureExerciseLibrary]:
    """更新改善运动"""
    db_exercise = get_exercise(db, exercise_id)
    if db_exercise:
        update_data = exercise_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_exercise, key, value)
        db.commit()
        db.refresh(db_exercise)
    return db_exercise


def delete_exercise(
    db: Session,
    exercise_id: int
) -> bool:
    """删除改善运动"""
    db_exercise = get_exercise(db, exercise_id)
    if db_exercise:
        db.delete(db_exercise)
        db.commit()
        return True
    return False


# ========== 初始化默认数据 ==========

def init_default_posture_issues(db: Session) -> bool:
    """初始化默认体态问题规则库"""
    default_issues = [
        {
            "issue_code": "round_shoulders",
            "issue_name": "圆肩",
            "issue_description": "肩膀向前内扣，胸腔内收，常见于长期伏案工作的人群",
            "detection_rule": "shoulder_forward_angle > 25",
            "detection_angles": ["left_side", "right_side"],
            "severity_levels": {
                "mild": {"range": "25-30度", "description": "肩膀轻微前倾"},
                "moderate": {"range": "30-45度", "description": "明显圆肩"},
                "severe": {"range": "45度以上", "description": "严重圆肩"}
            },
            "weight_score": 15.0,
            "recommendations": "定期进行胸部拉伸，强化背部肌肉；工作时注意坐姿，保持肩膀自然下沉"
        },
        {
            "issue_code": "forward_head",
            "issue_name": "头前伸",
            "issue_description": "头部相对于身体位置过度前倾，常见于长时间使用电子产品的人群",
            "detection_rule": "head_forward_ratio > 1.2",
            "detection_angles": ["left_side", "right_side"],
            "severity_levels": {
                "mild": {"range": "1.2-1.4倍", "description": "头部轻微前倾"},
                "moderate": {"range": "1.4-1.6倍", "description": "明显头前伸"},
                "severe": {"range": "1.6倍以上", "description": "严重头前伸"}
            },
            "weight_score": 20.0,
            "recommendations": "经常进行颈部伸展运动；使用电子产品时保持视线水平；调整屏幕高度，避免低头"
        },
        {
            "issue_code": "kyphosis",
            "issue_name": "驼背",
            "issue_description": "胸椎过度后凸，形成驼背姿势，影响呼吸和内脏功能",
            "detection_rule": "spine_curvature_t_value > 15",
            "detection_angles": ["left_side", "right_side"],
            "severity_levels": {
                "mild": {"range": "15-25度", "description": "轻微驼背"},
                "moderate": {"range": "25-40度", "description": "明显驼背"},
                "severe": {"range": "40度以上", "description": "严重驼背"}
            },
            "weight_score": 25.0,
            "recommendations": "加强背部肌肉训练；练习扩胸运动；保持正确坐姿和站姿"
        },
        {
            "issue_code": "lordosis",
            "issue_name": "骨盆前倾",
            "issue_description": "腰椎过度前凸，常见于久坐人群，可能导致腰痛",
            "detection_rule": "pelvis_tilt_angle > 15",
            "detection_angles": ["left_side", "right_side"],
            "severity_levels": {
                "mild": {"range": "15-20度", "description": "轻微骨盆前倾"},
                "moderate": {"range": "20-30度", "description": "明显骨盆前倾"},
                "severe": {"range": "30度以上", "description": "严重骨盆前倾"}
            },
            "weight_score": 20.0,
            "recommendations": "加强核心肌群训练；拉伸髋屈肌；矫正站姿，收紧腹部"
        },
        {
            "issue_code": "scoliosis",
            "issue_name": "脊柱侧弯",
            "issue_description": "脊柱向侧方弯曲，可能导致疼痛和功能障碍",
            "detection_rule": "spine_curvature_lateral > 10",
            "detection_angles": ["front", "back"],
            "severity_levels": {
                "mild": {"range": "10-15度", "description": "轻微脊柱侧弯"},
                "moderate": {"range": "15-25度", "description": "明显脊柱侧弯"},
                "severe": {"range": "25度以上", "description": "严重脊柱侧弯"}
            },
            "weight_score": 30.0,
            "recommendations": "建议进行脊柱X光检查确诊；在医生指导下进行康复训练；避免单侧负重"
        },
        {
            "issue_code": "uneven_shoulders",
            "issue_name": "高低肩",
            "issue_description": "左右肩高度不一致，可能因单侧负重或肌肉不平衡导致",
            "detection_rule": "shoulder_height_difference > 0.03",
            "detection_angles": ["front", "back"],
            "severity_levels": {
                "mild": {"range": "3-5cm", "description": "轻微高低肩"},
                "moderate": {"range": "5-8cm", "description": "明显高低肩"},
                "severe": {"range": "8cm以上", "description": "严重高低肩"}
            },
            "weight_score": 10.0,
            "recommendations": "进行两侧平衡训练；检查背包重量分布；避免单侧长时间负重"
        }
    ]

    for issue_data in default_issues:
        # 检查是否已存在
        existing = get_posture_issue_by_code(db, issue_data["issue_code"])
        if not existing:
            create_issue = PostureIssueCreate(**issue_data)
            create_posture_issue(db, create_issue)

    return True
