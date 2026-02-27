"""
体态检测API路由

提供体态评估、历史记录、趋势分析等API接口
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime, timedelta

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.posture import AssessmentType, ViewAngle
from schemas.posture import *
# 直接导入服务（使用新端口解决了缓存问题）
from services.posture_service import posture_service
from crud.posture import (
    get_user_posture_assessments, get_posture_assessment,
    get_user_assessment_count, update_posture_assessment,
    get_assessment_photos, get_assessment_metrics, get_assessment_issues,
    get_or_create_trend, get_user_posture_assessments as get_assessments_list
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/assess")
async def assess_posture(
    front_photo: UploadFile = File(..., description="正面照片"),
    left_side_photo: UploadFile = File(..., description="左侧面照片"),
    right_side_photo: UploadFile = File(..., description="右侧面照片"),
    back_photo: UploadFile = File(..., description="背面照片"),
    assessment_type: AssessmentType = Form(AssessmentType.ROUTINE, description="检测类型"),
    age: Optional[int] = Form(None, ge=1, le=120, description="用户年龄"),
    height: Optional[int] = Form(None, ge=50, le=250, description="用户身高(cm)"),
    weight: Optional[int] = Form(None, ge=20, le=200, description="用户体重(kg)"),
    notes: Optional[str] = Form(None, description="备注信息"),
    db: Session = Depends(get_db)
):
    """
    执行体态检测评估

    **上传4个角度的照片进行体态分析：**
    - front: 正面照片
    - left_side: 左侧面照片
    - right_side: 右侧面照片
    - back: 背面照片

    **检测类型：**
    - baseline: 基准体态（首次检测）
    - routine: 常规检测（定期监测）
    - pre_training: 训练前检测

    **返回：**
    - 综合评分 (0-100)
    - 各项体态指标
    - 检测到的体态问题
    - 改善建议
    - 可视化数据
    """
    try:
        # 临时使用测试用户ID
        test_user_id = 1
        logger.info(f"开始体态检测评估，用户ID: {test_user_id}, 类型: {assessment_type}")

        # 读取照片数据
        photos = {}

        # 处理正面照片
        logger.info(f"读取正面照片，文件名: {front_photo.filename}, 大小: {front_photo.size}")
        if front_photo.size > 0:
            front_data = await front_photo.read()
            if len(front_data) > 0:
                photos['front'] = (front_photo.filename, front_data)
                logger.info(f"正面照片读取成功，{len(front_data)} 字节")
            else:
                raise HTTPException(status_code=400, detail="正面照片数据为空")
        else:
            raise HTTPException(status_code=400, detail="正面文件不存在")

        # 处理左侧面照片
        logger.info(f"读取左侧面照片，文件名: {left_side_photo.filename}, 大小: {left_side_photo.size}")
        if left_side_photo.size > 0:
            left_data = await left_side_photo.read()
            if len(left_data) > 0:
                photos['left_side'] = (left_side_photo.filename, left_data)
                logger.info(f"左侧面照片读取成功，{len(left_data)} 字节")
            else:
                raise HTTPException(status_code=400, detail="左侧面照片数据为空")
        else:
            raise HTTPException(status_code=400, detail="左侧面文件不存在")

        # 处理右侧面照片
        logger.info(f"读取右侧面照片，文件名: {right_side_photo.filename}, 大小: {right_side_photo.size}")
        if right_side_photo.size > 0:
            right_data = await right_side_photo.read()
            if len(right_data) > 0:
                photos['right_side'] = (right_side_photo.filename, right_data)
                logger.info(f"右侧面照片读取成功，{len(right_data)} 字节")
            else:
                raise HTTPException(status_code=400, detail="右侧面照片数据为空")
        else:
            raise HTTPException(status_code=400, detail="右侧面文件不存在")

        # 处理背面照片
        logger.info(f"读取背面照片，文件名: {back_photo.filename}, 大小: {back_photo.size}")
        if back_photo.size > 0:
            back_data = await back_photo.read()
            if len(back_data) > 0:
                photos['back'] = (back_photo.filename, back_data)
                logger.info(f"背面照片读取成功，{len(back_data)} 字节")
            else:
                raise HTTPException(status_code=400, detail="背面照片数据为空")
        else:
            raise HTTPException(status_code=400, detail="背面文件不存在")

        # 验证至少有照片
        logger.info(f"照片读取完成，共 {len(photos)} 张照片")
        if len(photos) < 2:
            raise HTTPException(
                status_code=400,
                detail="至少需要上传2张照片才能完成检测"
            )

        # 构建用户信息
        user_info = {}
        if age is not None:
            user_info['age'] = age
        if height is not None:
            user_info['height'] = height
        if weight is not None:
            user_info['weight'] = weight

        logger.info(f"准备调用评估服务，用户信息: {user_info}")
        logger.info(f"调用评估服务前的照片数量: {len(photos)}")
        logger.info(f"照片角度: {list(photos.keys())}")

        # 处理评估
        logger.info("开始调用 posture_service.process_assessment...")

        result = await posture_service.process_assessment(
            db=db,
            user_id=test_user_id,
            photos=photos,
            assessment_type=assessment_type,
            user_info=user_info if user_info else None,
            notes=notes
        )

        logger.info(f"评估完成，综合评分: {result.get('overall_score')}")
        logger.info(f"返回结果类型: {type(result)}")
        logger.info(f"返回结果键: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")

        if 'metrics' in result:
            logger.info(f"metrics 对象: {result['metrics']}")
            logger.info(f"metrics 类型: {type(result['metrics'])}")
            logger.info(f"metrics 键: {list(result['metrics'].keys()) if isinstance(result['metrics'], dict) else 'Not a dict'}")

        # 直接在API层获取issue_codes，绕过服务层的问题
        from models.posture import PostureIssue, PostureAssessmentIssue
        issue_codes = []
        try:
            assessment_id = result.get('assessment', {}).get('id') if isinstance(result.get('assessment'), dict) else getattr(result.get('assessment'), 'id', None)
            if assessment_id:
                detected_issues = db.query(PostureAssessmentIssue).filter(
                    PostureAssessmentIssue.assessment_id == assessment_id
                ).all()
                issue_ids = [issue.issue_id for issue in detected_issues]
                if issue_ids:
                    issues_info = db.query(PostureIssue).filter(
                        PostureIssue.id.in_(issue_ids)
                    ).all()
                    issue_id_to_code = {issue.id: issue.issue_code for issue in issues_info}
                    issue_codes = [issue_id_to_code.get(issue.issue_id, '') for issue in detected_issues if issue.issue_id in issue_id_to_code]
                result['issue_codes'] = issue_codes
                logger.info(f"API层获取的issue_codes: {issue_codes}")
        except Exception as e:
            logger.warning(f"API层获取issue_codes失败: {e}")
            # 如果失败，使用result中的issue_codes或空列表
            result['issue_codes'] = result.get('issue_codes', [])

        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = f"体态检测失败: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/skeleton/analyze")
async def analyze_skeleton(
    image: UploadFile = File(..., description="待分析的单张图片"),
    view_angle: ViewAngle = Form(ViewAngle.FRONT, description="拍摄角度"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    单张图片骨架分析（用于调试或单独检测）

    **用途：**
    - 开发调试
    - 单角度快速检测
    - 实时关键点预览

    **返回：**
    - 检测到的关键点坐标
    - 置信度
    - 图片尺寸
    """
    try:
        image_data = await image.read()

        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="图片数据为空")

        result = await posture_service.analyze_single_frame(image_data, view_angle)

        return result

    except Exception as e:
        logger.error(f"骨架分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"骨架分析失败: {str(e)}")


@router.get("/history", response_model=PostureHistoryList)
async def get_posture_history(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(10, ge=1, le=100, description="返回记录数"),
    assessment_type: Optional[AssessmentType] = Query(None, description="筛选检测类型"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取体态检测历史记录

    **参数：**
    - skip: 跳过的记录数（分页）
    - limit: 返回的记录数
    - assessment_type: 可选的检测类型筛选

    **返回：**
    - 历史评估记录列表
    - 总记录数
    """
    try:
        # 获取评估记录
        assessments = get_user_posture_assessments(
            db,
            current_user.id,
            skip=skip,
            limit=limit,
            assessment_type=assessment_type
        )

        # 获取总数
        total = get_user_assessment_count(
            db,
            current_user.id,
            assessment_type=assessment_type
        )

        # 构建响应数据
        items = []
        for assessment in assessments:
            # 获取照片和问题统计
            photos = get_assessment_photos(db, assessment.id)
            issues = get_assessment_issues(db, assessment.id)
            severe_issues = [i for i in issues if i.severity != 'none']

            items.append(PostureHistoryItem(
                id=assessment.id,
                user_id=assessment.user_id,
                assessment_date=assessment.assessment_date,
                overall_score=float(assessment.overall_score) if assessment.overall_score else None,
                assessment_type=assessment.assessment_type,
                age=assessment.age,
                height=assessment.height,
                weight=assessment.weight,
                notes=assessment.notes,
                photo_count=len(photos),
                issue_count=len(issues),
                severe_issue_count=len([i for i in issues if i.severity == 'severe']),
                created_at=assessment.created_at,
                updated_at=assessment.updated_at
            ))

        return PostureHistoryList(
            items=items,
            total=total,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        logger.error(f"获取历史记录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取历史记录失败: {str(e)}")


@router.get("/trends", response_model=PostureTrendResponse)
async def get_posture_trends(
    period: str = Query("6months", description="时间周期：1month/3months/6months/1year/2years"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取体态变化趋势分析

    **参数：**
    - period: 时间周期参数（目前参考，历史数据范围在趋势记录中）

    **返回：**
    - 当前体态趋势数据
    - 相关历史评估记录
    """
    try:
        # 获取用户趋势
        trend = get_or_create_trend(db, current_user.id)

        # 根据周期获取历史记录
        period_days = {
            '1month': 30,
            '3months': 90,
            '6months': 180,
            '1year': 365,
            '2years': 730
        }.get(period.lower(), 180)

        start_date = datetime.utcnow() - timedelta(days=period_days)

        # 获取该时间段内的评估记录
        all_assessments = get_user_posture_assessments(
            db,
            current_user.id,
            skip=0,
            limit=100  # 足够大的限制
        )

        # 筛选时间范围内的评估
        history = [
            PostureHistoryItem(
                id=a.id,
                user_id=a.user_id,
                assessment_date=a.assessment_date,
                overall_score=float(a.overall_score) if a.overall_score else None,
                assessment_type=a.assessment_type,
                age=a.age,
                height=a.height,
                weight=a.weight,
                notes=a.notes,
                photo_count=len(get_assessment_photos(db, a.id)),
                issue_count=len(get_assessment_issues(db, a.id)),
                severe_issue_count=len([
                    i for i in get_assessment_issues(db, a.id) if i.severity == 'severe'
                ]),
                created_at=a.created_at,
                updated_at=a.updated_at
            )
            for a in all_assessments
            if a.assessment_date >= start_date
        ]

        return PostureTrendResponse(
            trend=trend,
            history=history
        )

    except Exception as e:
        logger.error(f"获取趋势数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取趋势数据失败: {str(e)}")


@router.get("/report/{assessment_id}", response_model=DetailedAssessmentReport)
async def get_assessment_report(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取详细体态检测报告

    **参数：**
    - assessment_id: 评估记录ID

    **返回：**
    - 详细评估报告
    - 各角度照片
    - 体态指标
    - 检测到的问题
    - 改善建议
    - 与基准对比
    """
    try:
        report = await posture_service.get_assessment_report(
            db=db,
            user_id=current_user.id,
            assessment_id=assessment_id
        )
        return report

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取评估报告失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取评估报告失败: {str(e)}")


@router.post("/baseline")
async def set_baseline_posture(
    assessment_id: int = Body(..., embed=True, description="要设为基准的评估ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
   设置为基准体态

    **作用：**
    将指定的评估记录设置为用户的基准体态
    基准体态将用于后续的趋势对比分析
    """
    try:
        # 获取评估记录
        assessment = get_posture_assessment(db, assessment_id)

        if not assessment or assessment.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="评估记录不存在或无权访问")

        # 更新为基准类型
        update_data = PostureAssessmentCreate(
            user_id=current_user.id,
            assessment_type=AssessmentType.BASELINE,
            age=assessment.age,
            height=assessment.height,
            weight=assessment.weight,
            notes=assessment.notes
        )

        # 更新评估类型
        updated = update_posture_assessment(
            db, assessment_id,
            PostureAssessmentUpdate(assessment_type=AssessmentType.BASELINE)
        )

        return {
            "success": True,
            "message": "已设置为基准体态",
            "assessment_id": assessment_id,
            "score": float(assessment.overall_score) if assessment.overall_score else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"设置基准失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"设置基准失败: {str(e)}")


@router.get("/latest")
async def get_latest_assessment(
    assessment_type: Optional[AssessmentType] = Query(None, description="检测类型筛选"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取用户最新的体态检测记录

    **用途：**
    - 快速查看最新状态
    - 判断是否需要重新检测
    - 前端显示体态状态
    """
    try:
        from crud.posture import get_latest_assessment as get_latest

        assessment = get_latest(db, current_user.id, assessment_type)

        if not assessment:
            return {
                "exists": False,
                "message": "暂无检测记录"
            }

        # 判断检测是否过期（超过30天建议重新检测）
        days_since = (datetime.utcnow() - assessment.assessment_date).days

        return {
            "exists": True,
            "assessment_id": assessment.id,
            "assessment_date": assessment.assessment_date.isoformat(),
            "overall_score": float(assessment.overall_score) if assessment.overall_score else None,
            "assessment_type": assessment.assessment_type.value,
            "is_stale": days_since > 30,
            "days_since_last": days_since
        }

    except Exception as e:
        logger.error(f"获取最新评估失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取最新评估失败: {str(e)}")


@router.get("/issues/active")
async def get_active_issue_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取启用的体态问题规则列表

    **用途：**
    - 了解系统支持检测哪些体态问题
    - 查看问题权重和标准
    """
    try:
        from crud.posture import get_active_posture_issues

        issues = get_active_posture_issues(db)

        return {
            "issues": [
                {
                    "code": issue.issue_code,
                    "name": issue.issue_name,
                    "description": issue.issue_description,
                    "weight": float(issue.weight_score),
                    "detection_angles": issue.detection_angles,
                    "severity_levels": issue.severity_levels
                }
                for issue in issues
            ]
        }

    except Exception as e:
        logger.error(f"获取问题规则失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取问题规则失败: {str(e)}")


@router.get("/test")
async def test_endpoint():
    """
    测试端点 - 检查服务是否正常
    """
    return {
        "status": "ok",
        "message": "体态检测服务运行正常",
        "timestamp": datetime.utcnow().isoformat()
    }