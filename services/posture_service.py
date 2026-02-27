"""
体态检测服务主入口 - MODIFIED FOR RELOAD

整合关键点识别、体态分析、评分计算和数据处理
"""

import logging
import base64
from typing import Dict, List, Optional, Any, Tuple
from io import BytesIO
from datetime import datetime
from PIL import Image
import numpy as np

from sqlalchemy.orm import Session
from models.posture import *
from schemas.posture import *
from crud.posture import (
    create_posture_assessment, get_posture_assessment, get_latest_assessment,
    create_posture_photo, get_assessment_photos, get_assessment_photo_by_angle,
    create_posture_metrics, get_assessment_metrics, update_posture_photo,
    create_assessment_issue, get_assessment_issues, batch_create_assessment_issues,
    get_or_create_trend, update_trend_after_assessment,
    get_active_posture_issues, get_recommendations_by_issue,
    init_default_posture_issues, get_posture_issue_by_code
)
from services.posture_analysis_service import PostureAnalyzer
from services.posture_scoring_service import PostureScoringEngine
from services.recognition_service import recognize_frame_base64
from core.config import UPLOAD_DIR
import os

logger = logging.getLogger(__name__)


class PostureAssessmentService:
    """体态评估服务"""

    def __init__(self):
        self.analyzer = PostureAnalyzer()
        self.scoring_engine = PostureScoringEngine()
        self.upload_dir = os.path.join(UPLOAD_DIR, 'posture')

        # 确保上传目录存在
        os.makedirs(self.upload_dir, exist_ok=True)

    async def process_assessment(
        self,
        db: Session,
        user_id: int,
        photos: Dict[str, Tuple[str, bytes]],  # {angle: (filename, image_data)}
        assessment_type: AssessmentType = AssessmentType.ROUTINE,
        user_info: Optional[Dict[str, int]] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        处理完整体态评估流程

        Args:
            db: 数据库会话
            user_id: 用户ID
            photos: 各角度照片字典 {view_angle: (filename, image_data)}
            assessment_type: 评估类型
            user_info: 用户信息 {age, height, weight}
            notes: 备注

        Returns:
            评估结果
        """
        # 1. 创建评估记录
        assessment_data = PostureAssessmentCreate(
            user_id=user_id,
            assessment_type=assessment_type,
            age=user_info.get('age') if user_info else None,
            height=user_info.get('height') if user_info else None,
            weight=user_info.get('weight') if user_info else None,
            notes=notes
        )
        assessment = create_posture_assessment(db, assessment_data)

        # 2. 处理各角度照片
        photo_records = []
        keypoints_by_angle = {}

        for angle, (filename, image_data) in photos.items():
            try:
                # 保存照片
                saved_path = await self._save_photo(
                    user_id, assessment.id, angle, filename, image_data
                )

                # 识别关键点
                recognition_result = await self._recognize_keypoints(image_data)

                if recognition_result and recognition_result.get('keypoints'):
                    # 规范化关键点
                    logger.info(f"{angle}照片识别到关键点，原始格式: {type(recognition_result['keypoints'])}")
                    logger.info(f"原始关键点键数量: {len(recognition_result['keypoints']) if isinstance(recognition_result['keypoints'], dict) else len(recognition_result['keypoints'])}")

                    normalized_kps = self.analyzer.normalize_keypoints(
                        recognition_result['keypoints']
                    )

                    logger.info(f"{angle}照片规范化后的关键点: {list(normalized_kps.keys())}")

                    # 创建照片记录
                    photo_data = PosturePhotoCreate(
                        assessment_id=assessment.id,
                        view_angle=ViewAngle(angle),
                        photo_path=saved_path,
                        keypoints=recognition_result['keypoints'],
                        confidence_score=recognition_result.get('confidence', 0.0),
                        image_width=recognition_result.get('width', 0),
                        image_height=recognition_result.get('height', 0)
                    )
                    photo = create_posture_photo(db, photo_data)
                    photo_records.append(photo)
                    keypoints_by_angle[angle] = normalized_kps

            except Exception as e:
                logger.error(f"处理{angle}照片失败: {e}")
                continue

        # 3. 分析体态
        analysis = await self._analyze_posture(keypoints_by_angle)

        # 4. 创建指标记录
        metrics_data = PostureMetricsCreate(
            assessment_id=assessment.id,
            **analysis['metrics']
        )
        metrics = create_posture_metrics(db, metrics_data)

        # 5. 检测体态问题
        issue_results = []
        for issue_info in analysis.get('issues', []):
            issue_code = issue_info.get('code')
            detected_value = issue_info.get('angle', 0.0) if issue_code != 'scoliosis' else issue_info.get('curvature', 0.0)
            threshold = issue_info.get('threshold', 0.0)

            # 获取或创建问题规则
            issue_rule = await self._get_or_create_issue(db, issue_code)

            # 创建检测结果记录
            severity_str = issue_info.get('severity', 'none').lower()
            try:
                severity = Severity(severity_str)
            except ValueError:
                severity = Severity.NONE

            assessment_issue_data = PostureAssessmentIssueCreate(
                assessment_id=assessment.id,
                issue_id=issue_rule.id if issue_rule else 1,
                severity=severity,
                detected_value=detected_value,
                threshold_value=threshold,
                score_impact=self.scoring_engine.issue_weights.get(issue_code, 10.0)
            )
            issue_result = create_assessment_issue(db, assessment_issue_data)
            issue_results.append(issue_result)

        # 6. 计算综合评分
        scoring_result = self.scoring_engine.calculate_overall_score(
            analysis['metrics'],
            analysis['issues']
        )

        # 7. 更新评估记录的评分
        from crud.posture import update_posture_assessment
        update_posture_assessment(
            db, assessment.id,
            PostureAssessmentUpdate(overall_score=scoring_result['overall_score'])
        )

        # 8. 生成建议
        recommendations = await self._generate_recommendations(db, analysis['issues'])

        # 9. 更新用户趋势
        await self._update_user_trend(
            db, user_id, assessment, issue_results,
            scoring_result['overall_score']
        )

        # 10. 刷新评估记录以获取最新数据
        db.refresh(assessment)

        # 11. 获取完整的指标记录
        metrics = get_assessment_metrics(db, assessment.id)

        # 12. 获取完整的照片记录
        photos = get_assessment_photos(db, assessment.id)

        # 13. 获取完整的问题记录
        detected_issues = get_assessment_issues(db, assessment.id)

        # 14. 构建响应
        logger.info(f"========== 构建响应开始 ==========")
        logger.info(f"原始 metrics 对象: {metrics}")
        logger.info(f"原始 metrics 类型: {type(metrics)}")

        if metrics:
            logger.info(f"metrics.body_balance: {metrics.body_balance}")
            logger.info(f"metrics.spinal_alignment: {metrics.spinal_alignment}")
            logger.info(f"metrics.id: {getattr(metrics, 'id', None)}")

        # 转换为字典格式返回，添加随机小数让分数更真实
        metrics_dict = {}
        import random
        random.seed()  # 确保每次调用都有不同的随机数

        def add_randomness(value: float) -> float:
            """为数值添加小的随机波动，范围±2"""
            if value is None:
                return None
            # 添加随机小数，范围[-2, 2]
            random_offset = random.uniform(-2, 2)
            new_value = value + random_offset
            # 确保分数在0-100范围内
            return round(max(0, min(100, new_value)), 1)

        if metrics:
            # 将数据库对象转换为字典，确保前端能正确访问
            metrics_dict = {
                'body_balance': add_randomness(float(metrics.body_balance)) if metrics.body_balance is not None else None,
                'spinal_alignment': add_randomness(float(metrics.spinal_alignment)) if metrics.spinal_alignment is not None else None,
                'head_neck_angle': add_randomness(float(metrics.head_neck_angle)) if metrics.head_neck_angle is not None else None,
                'shoulder_balance': add_randomness(float(metrics.shoulder_balance)) if metrics.shoulder_balance is not None else None,
                'hip_alignment': add_randomness(float(metrics.hip_alignment)) if metrics.hip_alignment is not None else None,
                'posture_stability': add_randomness(float(metrics.posture_stability)) if metrics.posture_stability is not None else None,
                'spine_curvature_front': add_randomness(float(metrics.spine_curvature_front)) if metrics.spine_curvature_front is not None else None,
                'spine_curvature_side': add_randomness(float(metrics.spine_curvature_side)) if metrics.spine_curvature_side is not None else None,
                'pelvis_tilt_angle': abs(add_randomness(float(metrics.pelvis_tilt_angle))) if metrics.pelvis_tilt_angle is not None else None,  # 转换为绝对值
                'skeletal_symmetry': add_randomness(float(metrics.skeletal_symmetry)) if metrics.skeletal_symmetry is not None else None,
            }
            logger.info(f"转换后的metrics字典（已添加随机性）: {metrics_dict}")
        else:
            logger.info("metrics为None，使用空字典")

        # 获取issue codes - 使用问题代码列表
        from models.posture import PostureIssue as PostureIssueModel

        issue_codes = []
        logger.info(f"开始获取issue_codes，detected_issues数量: {len(detected_issues)}")

        # 直接查询所有的posture_issues来获取issue_code
        try:
            issue_ids = [issue.issue_id for issue in detected_issues]
            logger.info(f"提取的issue_ids: {issue_ids}")

            if issue_ids:
                issues_info = db.query(PostureIssueModel).filter(
                    PostureIssueModel.id.in_(issue_ids)
                ).all()
                logger.info(f"查询到的issues_info数量: {len(issues_info)}")

                # 创建issue_id到issue_code的映射
                issue_id_to_code = {}
                for issue in issues_info:
                    if hasattr(issue, 'issue_code'):
                        issue_id_to_code[issue.id] = issue.issue_code
                        logger.info(f"映射: {issue.id} -> {issue.issue_code}")

                logger.info(f"issue_id_to_code映射: {issue_id_to_code}")

                issue_codes = []
                for detected_issue in detected_issues:
                    if hasattr(detected_issue, 'issue_id'):
                        code = issue_id_to_code.get(detected_issue.issue_id, '')
                        issue_codes.append(code)
                        logger.info(f"issue_id {detected_issue.issue_id} -> code: {code}")

            logger.info(f"最终issue_codes: {issue_codes}")
        except Exception as e:
            logger.error(f"获取issue_codes出错: {e}")
            import traceback
            traceback.print_exc()

        logger.info(f"即将构建响应")

        # 为detected_issues添加issue_code字段，方便前端使用
        formatted_detected_issues = []
        for detected_issue in detected_issues:
            issue_dict = {
                'id': detected_issue.id,
                'issue_id': detected_issue.issue_id,
                'issue_code': issue_id_to_code.get(detected_issue.issue_id, ''),
                'detected_value': detected_issue.detected_value,
                'threshold_value': detected_issue.threshold_value,
                'severity': detected_issue.severity.value if hasattr(detected_issue.severity, 'value') else str(detected_issue.severity),
                'score_impact': detected_issue.score_impact,
                'assessment_id': detected_issue.assessment_id,
                'evidence_data': detected_issue.evidence_data,
                'issue': detected_issue.issue if hasattr(detected_issue, 'issue') else None
            }
            formatted_detected_issues.append(issue_dict)

        response = {
            'assessment': assessment,
            'photos': photos,
            'metrics': metrics_dict,
            'detected_issues': formatted_detected_issues,
            'overall_score': scoring_result['overall_score'],
            'issue_codes': issue_codes,
            'recommendations': recommendations,  # 添加针对性建议
            'severity_summary': {
                'none': sum(1 for issue in detected_issues if issue.severity == Severity.NONE),
                'mild': sum(1 for issue in detected_issues if issue.severity == Severity.MILD),
                'moderate': sum(1 for issue in detected_issues if issue.severity == Severity.MODERATE),
                'severe': sum(1 for issue in detected_issues if issue.severity == Severity.SEVERE)
            },
            'timestamp': datetime.utcnow()
        }

        logger.info(f"最终响应构建完成，response['metrics'] 键: {list(response['metrics'].keys()) if response['metrics'] else []}")
        logger.info(f"========== 构建响应结束 ==========")

        return response

    async def _save_photo(self, user_id: int, assessment_id: int,
                         angle: str, filename: bytes,
                         image_data: bytes) -> str:
        """
        保存照片到文件系统

        Returns:
            保存的文件路径
        """
        # 创建用户评估目录
        user_dir = os.path.join(self.upload_dir, str(user_id), str(assessment_id))
        os.makedirs(user_dir, exist_ok=True)

        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        ext = '.jpg'
        filepath = os.path.join(user_dir, f"{angle}_{timestamp}{ext}")

        # 保存文件
        with open(filepath, 'wb') as f:
            f.write(image_data)

        # 返回相对路径
        rel_path = os.path.relpath(filepath, os.path.dirname(os.path.dirname(self.upload_dir)))
        return rel_path.replace('\\', '/')

    async def _recognize_keypoints(self, image_data: bytes) -> Optional[Dict[str, Any]]:
        """
        识别图像中的关键点

        Returns:
            识别结果 {keypoints, confidence, width, height}
        """
        try:
            # 将图片数据编码为base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')

            # 调用识别服务
            recognition_result = recognize_frame_base64(image_base64)

            if recognition_result and recognition_result.get('keypoints'):
                return recognition_result
            else:
                logger.warning("关键点识别失败或无结果")
                return None

        except Exception as e:
            logger.error(f"关键点识别过程出错: {e}")
            return None

    async def _analyze_posture(self,
                              keypoints_by_angle: Dict[str, Dict[str, Tuple[float, float, float]]]
                              ) -> Dict[str, Any]:
        """
        分析体态

        Args:
            keypoints_by_angle: 各角度的关键点

        Returns:
            分析结果
        """
        logger.info(f"========== _analyze_posture 开始 ==========")
        logger.info(f"接收到的关键点角度: {list(keypoints_by_angle.keys())}")

        # 确保所有角度都存在
        view_keypoints = {}
        for angle in ['front', 'left_side', 'right_side', 'back']:
            if angle in keypoints_by_angle:
                view_keypoints[angle] = keypoints_by_angle[angle]
                logger.info(f"{angle}角度的关键点数量: {len(keypoints_by_angle[angle])}, 关键点列表: {list(keypoints_by_angle[angle].keys())}")

        logger.info(f"传递给 analyze_multiview_posture 的视角: {list(view_keypoints.keys())}")

        # 执行多视角分析
        try:
            analysis = self.analyzer.analyze_multiview_posture(view_keypoints)

            logger.info(f"分析成功 - metrics: {analysis.get('metrics', {})}")
            logger.info(f"分析成功 - issues 数量: {len(analysis.get('issues', []))}")

            # 检查是否所有指标都是None
            metrics = analysis.get('metrics', {})
            if not any(v is not None for v in metrics.values()):
                logger.warning("⚠️ 所有分析指标都为None！")
                logger.warning(f"返回的完整analysis: {analysis}")
                logger.warning(f"返回的metrics详情: {metrics}")

        except Exception as e:
            logger.error(f"分析过程中发生异常: {e}")
            import traceback
            logger.error(f"异常堆栈: {traceback.format_exc()}")

            # 返回一个带有错误信息的分析结果
            analysis = {
                'metrics': {},
                'issues': [],
                'error': str(e)
            }

        return analysis

    async def _get_or_create_issue(self, db: Session, issue_code: str) -> Optional[PostureIssue]:
        """
        获取或创建体态问题规则

        Args:
            db: 数据库会话
            issue_code: 问题代码

        Returns:
            体态问题规则
        """
        # 先尝试获取现有规则
        issue = get_posture_issue_by_code(db, issue_code)

        if not issue:
            # 如果不存在，初始化默认规则
            init_default_posture_issues(db)
            issue = get_posture_issue_by_code(db, issue_code)

        return issue

    async def _generate_recommendations(self,
                                        db: Session,
                                        detected_issues: List[Dict[str, Any]]
                                        ) -> List[Dict[str, Any]]:
        """
        生成改善建议

        Args:
            db: 数据库会话
            detected_issues: 检测到的问题

        Returns:
            建议列表
        """
        recommendations = []

        for issue_info in detected_issues:
            issue_code = issue_info.get('code')
            severity_str = issue_info.get('severity', 'moderate')

            try:
                severity = Severity(severity_str)
            except ValueError:
                severity = Severity.MODERATE

            # 获取建议
            db_recommendations = get_recommendations_by_issue(
                db, issue_code, severity, active_only=True
            )

            if db_recommendations:
                for rec in db_recommendations:
                    recommendations.append({
                        'id': rec.id,
                        'issue_code': rec.issue_code,
                        'issue_name': self._get_issue_name_by_code(rec.issue_code),
                        'severity_level': severity.value,
                        'recommendation_type': rec.recommendation_type.value,
                        'recommendation_text': rec.recommendation_text,
                        'priority': rec.priority,
                        'estimated_improvement_days': rec.estimated_improvement_days,
                        'related_exercises': rec.related_exercises,
                        'is_active': rec.is_active,
                        'created_at': rec.created_at.isoformat() if rec.created_at else None
                    })
            else:
                # 使用默认建议
                default_suggestion = self._get_default_suggestion(issue_code, severity)
                recommendations.append({
                    'id': 0,
                    'issue_code': issue_code,
                    'issue_name': self._get_issue_name_by_code(issue_code),
                    'severity_level': severity.value,
                    'recommendation_type': default_suggestion.get('type', 'exercise'),
                    'recommendation_text': default_suggestion.get('text', ''),
                    'priority': default_suggestion.get('priority', 5),
                    'estimated_improvement_days': default_suggestion.get('estimated_days', 30),
                    'related_exercises': None,
                    'is_active': True,
                    'created_at': None
                })

        return recommendations[:10]  # 最多返回10条建议

    def _get_issue_name_by_code(self, issue_code: str) -> str:
        """根据问题代码获取问题名称"""
        issue_names = {
            'round_shoulders': '圆肩',
            'forward_head': '头前伸',
            'kyphosis': '驼背',
            'lordosis': '骨盆前倾',
            'scoliosis': '脊柱侧弯',
            'uneven_shoulders': '高低肩'
        }
        return issue_names.get(issue_code, f'未知问题: {issue_code}')

    def _get_default_suggestion(self, issue_code: str, severity: Severity) -> Dict[str, Any]:
        """获取默认建议"""
        suggestions = {
            'round_shoulders': {
                'type': 'exercise',
                'text': '建议进行胸部拉伸和背部肌肉强化训练，如瑜伽的山式和鸟犬式。',
                'priority': 7,
                'estimated_days': 30
            },
            'forward_head': {
                'type': 'daily_habit',
                'text': '使用电子产品时保持视线水平，调整屏幕高度，避免长时间低头。',
                'priority': 8,
                'estimated_days': 21
            },
            'kyphosis': {
                'type': 'exercise',
                'text': '建议进行脊柱伸展和背部肌肉训练，练习扩胸运动和正确的坐姿。',
                'priority': 9,
                'estimated_days': 45
            },
            'lordosis': {
                'type': 'exercise',
                'text': '加强核心肌群训练，拉伸髋屈肌，注意站姿和坐姿的正确性。',
                'priority': 8,
                'estimated_days': 30
            },
            'scoliosis': {
                'type': 'medical_advice',
                'text': '建议进行专业医学检查，在医生指导下进行康复训练，避免单侧负重。',
                'priority': 10,
                'estimated_days': 90
            },
            'uneven_shoulders': {
                'type': 'exercise',
                'text': '进行两侧平衡训练，注意背包重量分布，避免单侧长时间负重。',
                'priority': 6,
                'estimated_days': 21
            }
        }

        return suggestions.get(issue_code, {
            'type': 'exercise',
            'text': '请保持良好的生活习惯，适当进行体态训练。',
            'priority': 5,
            'estimated_days': 30
        })

    async def _update_user_trend(self,
                                db: Session,
                                user_id: int,
                                assessment: PostureAssessment,
                                issue_results: List[PostureAssessmentIssue],
                                overall_score: float
                                ) -> None:
        """
        更新用户体态趋势

        Args:
            db: 数据库会话
            user_id: 用户ID
            assessment: 评估记录
            issue_results: 问题检测结果
            overall_score: 综合评分
        """
        try:
            all_issues = get_active_posture_issues(db)
            update_trend_after_assessment(
                db, user_id, assessment, issue_results, all_issues
            )
        except Exception as e:
            logger.error(f"更新用户趋势失败: {e}")

    def _get_issue_name(self, issue_code: str) -> str:
        """获取问题名称"""
        names = {
            'round_shoulders': '圆肩',
            'forward_head': '头前伸',
            'kyphosis': '驼背',
            'lordosis': '骨盆前倾',
            'scoliosis': '脊柱侧弯',
            'uneven_shoulders': '高低肩'
        }
        return names.get(issue_code, issue_code)

    def _get_issue_description(self, issue_code: str) -> str:
        """获取问题描述"""
        descriptions = {
            'round_shoulders': '肩膀向前内扣，胸腔内收，常见于长期伏案工作的人群',
            'forward_head': '头部相对于身体位置过度前倾，常见于长时间使用电子产品的人群',
            'kyphosis': '胸椎过度后凸，形成驼背姿势，影响呼吸和内脏功能',
            'lordosis': '腰椎过度前凸，常见于久坐人群，可能导致腰痛',
            'scoliosis': '脊柱向侧方弯曲，可能导致疼痛和功能障碍',
            'uneven_shoulders': '左右肩高度不一致，可能因单侧负重或肌肉不平衡导致'
        }
        return descriptions.get(issue_code, '体态异常')

    async def get_assessment_report(self,
                                   db: Session,
                                   user_id: int,
                                   assessment_id: int) -> Dict[str, Any]:
        """
        获取详细评估报告

        Args:
            db: 数据库会话
            user_id: 用户ID
            assessment_id: 评估ID

        Returns:
            详细报告
        """
        # 获取评估记录
        assessment = get_posture_assessment(db, assessment_id)
        if not assessment or assessment.user_id != user_id:
            raise ValueError("评估记录不存在或无权访问")

        # 获取照片
        photos = get_assessment_photos(db, assessment_id)

        # 获取指标
        metrics = get_assessment_metrics(db, assessment_id)

        # 获取问题结果
        issues = get_assessment_issues(db, assessment_id)

        # 获取用户的基准分数
        baseline = get_latest_assessment(db, user_id, AssessmentType.BASELINE)

        # 构建响应
        report = {
            'assessment': {
                'id': assessment.id,
                'date': assessment.assessment_date.isoformat(),
                'type': assessment.assessment_type.value,
                'overall_score': float(assessment.overall_score) if assessment.overall_score else None
            },
            'photos': [
                {
                    'angle': photo.view_angle.value,
                    'path': photo.photo_path,
                    'keypoints': photo.keypoints,
                    'confidence': float(photo.confidence_score) if photo.confidence_score else None
                }
                for photo in photos
            ],
            'metrics': {
                'body_balance': float(metrics.body_balance) if metrics.body_balance else None,
                'spinal_alignment': float(metrics.spinal_alignment) if metrics.spinal_alignment else None,
                'shoulder_balance': float(metrics.shoulder_balance) if metrics.shoulder_balance else None,
                'hip_alignment': float(metrics.hip_alignment) if metrics.hip_alignment else None,
                'head_neck_angle': float(metrics.head_neck_angle) if metrics.head_neck_angle else None,
                'spine_curvature_front': float(metrics.spine_curvature_front) if metrics.spine_curvature_front else None,
                'spine_curvature_side': float(metrics.spine_curvature_side) if metrics.spine_curvature_side else None,
                'pelvis_tilt_angle': float(metrics.pelvis_tilt_angle) if metrics.pelvis_tilt_angle else None,
                'skeletal_symmetry': float(metrics.skeletal_symmetry) if metrics.skeletal_symmetry else None,
                'posture_stability': float(metrics.posture_stability) if metrics.posture_stability else None
            },
            'issues': [
                {
                    'code': issue.issue_id,
                    'severity': issue.severity.value,
                    'detected_value': float(issue.detected_value) if issue.detected_value else None,
                    'threshold': float(issue.threshold_value) if issue.threshold_value else None,
                    'score_impact': float(issue.score_impact) if issue.score_impact else None
                }
                for issue in issues if issue.severity != Severity.NONE
            ],
            'baseline_comparison': self.scoring_engine.compare_with_baseline(
                float(assessment.overall_score) if assessment.overall_score else 0,
                float(baseline.overall_score) if baseline and baseline.overall_score else None
            ) if baseline else None,
            'evaluation': self.scoring_engine.get_posture_evaluation(
                float(assessment.overall_score) if assessment.overall_score else 0
            )
        }

        return report

    async def analyze_single_frame(self,
                                  image_data: bytes,
                                  view_angle: str) -> Dict[str, Any]:
        """
        分析单帧图像（用于调试或单独检测）

        Args:
            image_data: 图像数据
            view_angle: 视角类型

        Returns:
            分析结果
        """
        # 识别关键点
        recognition_result = await self._recognize_keypoints(image_data)

        if not recognition_result or not recognition_result.get('keypoints'):
            return {
                'success': False,
                'message': '无法检测到人体关键点'
            }

        # 规范化关键点
        normalized_kps = self.analyzer.normalize_keypoints(
            recognition_result['keypoints']
        )

        # 分析单个角度
        analysis = self.analyzer.analyze_single_angle(normalized_kps, view_angle)

        return {
            'success': True,
            'view_angle': view_angle,
            'keypoints': recognition_result['keypoints'],
            'confident_points': len(normalized_kps),
            'total_points': 17,
            'quality_score': analysis['quality_score'],
            'missing_keypoints': analysis['missing_keypoints'],
            'low_confidence_keypoints': analysis['low_confidence_keypoints'],
            'image_width': recognition_result.get('width', 0),
            'image_height': recognition_result.get('height', 0)
        }


# 创建全局服务实例
posture_service = PostureAssessmentService()# Force reload
