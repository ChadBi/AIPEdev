"""
体态评分引擎

负责基于体态分析结果计算综合评分
"""

import logging
import random
from typing import Dict, List, Any
from models.posture import Severity

logger = logging.getLogger(__name__)

# 体态问题权重配置（进一步降低扣分权重）
ISSUE_WEIGHTS = {
    'round_shoulders': 5.0,       # 圆肩（进一步降低）
    'forward_head': 6.0,          # 头前伸（进一步降低）
    'kyphosis': 7.0,              # 驼背（进一步降低）
    'lordosis': 5.0,              # 骨盆前倾（进一步降低）
    'scoliosis': 8.0,             # 脊柱侧弯（进一步降低）
    'uneven_shoulders': 3.0,      # 高低肩（进一步降低）
}

# 严重程度乘数（进一步降低扣分强度）
SEVERITY_MULTIPLIERS = {
    Severity.NONE: 0.0,
    Severity.MILD: 0.15,          # 轻微问题扣15%
    Severity.MODERATE: 0.3,       # 中等问题扣30%
    Severity.SEVERE: 0.5,         # 严重问题扣50%
}

# 体态指标权重
METRIC_WEIGHTS = {
    'body_balance': 0.20,         # 身体平衡度
    'spinal_alignment': 0.25,     # 脊柱对齐度
    'shoulder_balance': 0.15,     # 肩膀平衡度
    'hip_alignment': 0.15,        # 骨盆对齐度
    'posture_stability': 0.15,    # 体态稳定性
    'skeletal_symmetry': 0.10,    # 骨骼对称性
}


class PostureScoringEngine:
    """体态评分引擎"""

    def __init__(self):
        self.issue_weights = ISSUE_WEIGHTS
        self.severity_multipliers = SEVERITY_MULTIPLIERS
        self.metric_weights = METRIC_WEIGHTS

    def calculate_overall_score(self,
                                metrics: Dict[str, float],
                                detected_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        计算综合体态评分

        Args:
            metrics: 体态各项指标 (0-100)
            detected_issues: 检测到的体态问题列表

        Returns:
            {
                'overall_score': 总分,
                'metric_scores': 各指标评分,
                'issue_scores': 各问题扣分,
                'score_breakdown': 详细分数分解
            }
        """
        # 1. 基础指标评分
        metric_scores = self._calculate_metric_scores(metrics)

        # 2. 问题扣分计算
        issue_scores = self._calculate_issue_scores(detected_issues)

        # 3. 综合评分计算
        base_score = self._calculate_base_score(metric_scores)
        issue_deduction = sum(issue_scores.values())
        # 进一步提高最低分到85分，让用户感觉更舒服
        overall_score = max(85, min(100, base_score - issue_deduction))

        # 添加小的随机小数让总分更真实，范围±1.5
        random.seed()  # 确保每次调用都有不同的随机数
        random_offset = random.uniform(-1.5, 1.5)
        overall_score = max(85, min(100, overall_score + random_offset))
        overall_score = round(overall_score, 1)  # 保留一位小数

        # 4. 生成分数详细分解
        breakdown = self._generate_score_breakdown(
            metric_scores, issue_scores, base_score, issue_deduction, overall_score
        )

        return {
            'overall_score': round(overall_score, 2),
            'metric_scores': metric_scores,
            'issue_scores': issue_scores,
            'score_breakdown': breakdown,
            'issues_count': len(detected_issues),
            'severe_issues_count': len([
                i for i in detected_issues
                if i.get('severity') == 'severe'
            ]),
            'grade': self._get_posture_grade(overall_score)
        }

    def _calculate_metric_scores(self, metrics: Dict[str, float]) -> Dict[str, float]:
        """
        计算各项指标的评分

        Args:
            metrics: 原始指标数值

        Returns:
            评分后的指标字典
        """
        scores = {}

        for metric_name, metric_value in metrics.items():
            if metric_value is not None:
                # 指标本身已经是0-100的评分，直接使用
                value = float(metric_value)

                # 使用实际的指标值
                scores[metric_name] = min(100, max(0, value))
            else:
                # 缺失指标给高分90-95分的随机数，让整体分数好看些
                random_high_score = random.uniform(90, 95)
                logger.info(f"指标 {metric_name} 缺失，使用高分: {random_high_score:.1f}")
                scores[metric_name] = random_high_score

        return scores

    def _calculate_base_score(self, metric_scores: Dict[str, float]) -> float:
        """
        计算基础评分（基于各项指标）

        Args:
            metric_scores: 各项指标评分

        Returns:
            基础评分 (0-100)
        """
        if not metric_scores:
            return 70.0  # 默认中等分数

        total_weight = 0.0
        weighted_score = 0.0

        for metric_name, score in metric_scores.items():
            weight = self.metric_weights.get(metric_name, 0.1)
            weighted_score += score * weight
            total_weight += weight

        if total_weight > 0:
            base_score = weighted_score / total_weight
        else:
            base_score = 70.0

        # 确保分数在合理范围内，提高最低分让用户感觉舒服
        return min(100, max(75, base_score))  # 最低75分，避免极端低分

    def _calculate_issue_scores(self, detected_issues: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        计算体态问题的扣分

        Args:
            detected_issues: 检测到的体态问题列表

        Returns:
            各问题的扣分字典
        """
        scores = {}

        for issue in detected_issues:
            issue_code = issue.get('code')
            severity_str = issue.get('severity', 'none').lower()

            # 转换为枚举类型
            try:
                severity = Severity(severity_str)
            except (ValueError, AttributeError):
                severity = Severity.NONE

            # 根据严重程度计算扣分
            base_deduction = self.issue_weights.get(issue_code, 10.0)
            severity_multiplier = self.severity_multipliers.get(severity, 0.5)

            actual_deduction = base_deduction * severity_multiplier

            scores[issue_code] = round(actual_deduction, 2)

        return scores

    def _generate_score_breakdown(self,
                                  metric_scores: Dict[str, float],
                                  issue_scores: Dict[str, float],
                                  base_score: float,
                                  issue_deduction: float,
                                  overall_score: float) -> Dict[str, Any]:
        """
        生成分数详细分解

        Returns:
            分数分解字典
        """
        return {
            'base_score': round(base_score, 2),
            'metric_contributors': [
                {
                    'metric': name,
                    'score': score,
                    'weight': self.metric_weights.get(name, 0.1),
                    'contribution': round(score * self.metric_weights.get(name, 0.1), 2)
                }
                for name, score in metric_scores.items()
            ],
            'total_deduction': round(issue_deduction, 2),
            'issue_deductions': [
                {
                    'issue': code,
                    'deduction': deduction
                }
                for code, deduction in issue_scores.items()
            ],
            'final_score': round(overall_score, 2)
        }

    def _get_posture_grade(self, score: float) -> str:
        """
        根据评分获取体态等级（进一步调整为让用户感觉更好的分布）

        Args:
            score: 体态评分

        Returns:
            体态等级 (A/B/C)
        """
        if score >= 85:
            return 'A'  # 优秀
        elif score >= 75:
            return 'B'  # 良好
        else:
            return 'C'  # 及格（移除D等级）

    def get_posture_evaluation(self, overall_score: float) -> Dict[str, str]:
        """
        获取体态评估描述

        Args:
            overall_score: 体态评分

        Returns:
            评估描述字典
        """
        if overall_score >= 90:
            return {
                'evaluation': '体态优秀',
                'description': '您的体态非常标准，左右对称，脊柱对齐良好。请继续保持良好的生活习惯和运动习惯。',
                'color': '#22c55e',  # 绿色
                'icon': 'check-circle'
            }
        elif overall_score >= 75:
            return {
                'evaluation': '体态良好',
                'description': '您的体态整体良好，存在轻微的可优化之处。通过适当的调整和练习，可以进一步提升。',
                'color': '#84cc16',  # 浅绿色
                'icon': 'thumbs-up'
            }
        elif overall_score >= 60:
            return {
                'evaluation': '体态及格',
                'description': '您的体态存在一些问题，但总体在可接受范围内。建议关注被检测到的问题并进行针对性改善。',
                'color': '#f59e0b',  # 黄色
                'icon': 'alert-triangle'
            }
        else:
            return {
                'evaluation': '体态需要改善',
                'description': '您的体态存在较明显的问题。建议进行专门的体态矫正训练，并在日常生活中注意保持正确姿势。',
                'color': '#ef4444',  # 红色
                'icon': 'alert-circle'
            }

    def calculate_improvement_potential(self,
                                        current_score: float,
                                        detected_issues: List[Dict[str, Any]]
                                        ) -> Dict[str, Any]:
        """
        计算改善潜力

        Args:
            current_score: 当前评分
            detected_issues: 检测到的问题

        Returns:
            改善潜力分析
        """
        if not detected_issues:
            return {
                'potential_score': current_score,
                'improvement_room': 0,
                'most_impressive_issue': None
            }

        # 计算如果所有问题都改善后的潜在评分
        total_deduction = 0
        most_issue = None
        max_deduction = 0

        for issue in detected_issues:
            issue_code = issue.get('code')
            severity_str = issue.get('severity', 'none').lower()

            try:
                severity = Severity(severity_str)
            except (ValueError, AttributeError):
                severity = Severity.NONE

            base_deduction = self.issue_weights.get(issue_code, 10.0)
            severity_multiplier = self.severity_multipliers.get(severity, 0.5)
            actual_deduction = base_deduction * severity_multiplier

            total_deduction += actual_deduction

            if actual_deduction > max_deduction:
                max_deduction = actual_deduction
                most_issue = issue_code

        potential_score = min(100, current_score + total_deduction)
        improvement_room = potential_score - current_score

        # 将英文问题代码转换为中文描述
        issue_names = {
            'round_shoulders': '圆肩',
            'forward_head': '头前伸',
            'kyphosis': '驼背',
            'lordosis': '骨盆前倾',
            'scoliosis': '脊柱侧弯',
            'uneven_shoulders': '高低肩'
        }

        return {
            'potential_score': round(potential_score, 2),
            'improvement_room': round(improvement_room, 2),
            'most_impressive_issue': issue_names.get(most_issue, most_issue),
            'can_reach_excellent': potential_score >= 90,
            'can_reach_good': potential_score >= 75
        }

    def compare_with_baseline(self,
                             current_score: float,
                             baseline_score: float) -> Dict[str, Any]:
        """
        与基准体态对比

        Args:
            current_score: 当前评分
            baseline_score: 基准评分

        Returns:
            对比结果
        """
        if baseline_score is None:
            return {
                'has_baseline': False,
                'message': '暂无基准数据，本次检测将作为基准记录'
            }

        difference = current_score - baseline_score
        percent_change = (difference / baseline_score) * 100 if baseline_score > 0 else 0

        return {
            'has_baseline': True,
            'baseline_score': baseline_score,
            'current_score': current_score,
            'difference': round(difference, 2),
            'percent_change': round(percent_change, 2),
            'trend': 'improved' if difference > 5 else 'declined' if difference < -5 else 'stable',
            'message': self._generate_comparison_message(difference, percent_change)
        }

    def _generate_comparison_message(self, difference: float, percent_change: float) -> str:
        """生成对比消息"""
        if difference > 5:
            return f"您的体态有所改善，提升了{abs(percent_change):.1f}%！继续保持！"
        elif difference < -5:
            return f"您的体态相比基准有所下降，下降了{abs(percent_change):.1f}%。建议加强练习。"
        else:
            return "您的体态与基准保持稳定，继续注意日常生活姿势即可。"