"""
创建体态改善建议数据库

为每种体态问题添加针对性的改善建议
"""

import sys
import os
import io

# 设置UTF-8编码输出，解决Windows控制台emoji显示问题
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.database import SessionLocal
from models.posture import PostureIssue, PostureRecommendation, Severity, RecommendationType
from datetime import datetime

def create_recommendations():
    """创建针对每种体态问题的改善建议"""

    db = SessionLocal()

    try:
        # 确保问题记录存在
        issues_to_create = [
            {
                'code': 'round_shoulders',
                'name': '圆肩',
                'description': '肩膀向内扣，驼背体态，可能影响呼吸和姿态美观',
                'detection_rule': 'shoulder_width_ratio < 0.85',
                'detection_angles': ['front', 'side'],
                'severity_levels': {'mild': 0.7, 'moderate': 0.5, 'severe': 0.3},
                'weight_score': 8.0,
                'recommendations': '建议进行肩部拉伸和背部肌肉强化训练'
            },
            {
                'code': 'forward_head',
                'name': '头前伸',
                'description': '头部前倾，颈部肌肉紧张，容易导致颈椎问题',
                'detection_rule': 'head_forward_position > 30度',
                'detection_angles': ['side'],
                'severity_levels': {'mild': 0.8, 'moderate': 0.6, 'severe': 0.4},
                'weight_score': 10.0,
                'recommendations': '建议进行颈部拉伸和下巴回收训练'
            },
            {
                'code': 'kyphosis',
                'name': '驼背',
                'description': '脊柱过度后凸，胸部肌肉紧张，背部肌肉薄弱',
                'detection_rule': 'spine_curvation > 40度',
                'detection_angles': ['side'],
                'severity_levels': {'mild': 0.8, 'moderate': 0.6, 'severe': 0.4},
                'weight_score': 12.0,
                'recommendations': '建议进行胸肌拉伸和背肌强化训练'
            },
            {
                'code': 'lordosis',
                'name': '骨盆前倾',
                'description': '骨盆过度前倾，腰椎过度前凸，容易导致腰痛',
                'detection_rule': 'pelvis_tilt > 15度',
                'detection_angles': ['side'],
                'severity_levels': {'mild': 0.8, 'moderate': 0.6, 'severe': 0.4},
                'weight_score': 10.0,
                'recommendations': '建议进行髋屈肌拉伸和核心肌群训练'
            },
            {
                'code': 'scoliosis',
                'name': '脊柱侧弯',
                'description': '脊柱向一侧弯曲，可能影响身体平衡和姿态',
                'detection_rule': 'spine_lateral_deviation > 1.5cm',
                'detection_angles': ['front', 'back'],
                'severity_levels': {'mild': 0.9, 'moderate': 0.7, 'severe': 0.5},
                'weight_score': 15.0,
                'recommendations': '建议咨询专业医生，进行专业矫正训练'
            },
            {
                'code': 'uneven_shoulders',
                'name': '高低肩',
                'description': '两肩高度不一致，可能是肌肉不平衡或脊柱侧弯',
                'detection_rule': 'shoulder_height_diff > 1cm',
                'detection_angles': ['front', 'back'],
                'severity_levels': {'mild': 0.9, 'moderate': 0.7, 'severe': 0.5},
                'weight_score': 5.0,
                'recommendations': '建议进行单侧平衡训练和对称性练习'
            }
        ]

        # 创建问题记录
        for issue_data in issues_to_create:
            # 检查问题是否已存在
            existing_issue = db.query(PostureIssue).filter(
                PostureIssue.issue_code == issue_data['code']
            ).first()

            if not existing_issue:
                new_issue = PostureIssue(
                    issue_code=issue_data['code'],
                    issue_name=issue_data['name'],
                    issue_description=issue_data['description'],
                    detection_rule=issue_data['detection_rule'],
                    detection_angles=issue_data['detection_angles'],
                    severity_levels=issue_data['severity_levels'],
                    weight_score=issue_data['weight_score'],
                    recommendations=issue_data['recommendations'],
                    is_active=True
                )
                db.add(new_issue)
                print(f"Created issue: {issue_data['name']}")
            else:
                print(f"Issue already exists: {issue_data['name']}")

        db.commit()

        # 针对性的改善建议
        recommendations_data = [
            # 圆肩建议
            {
                'issue_code': 'round_shoulders',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '每天进行10分钟肩部拉伸，特别是三角肌前束拉伸。工作间隙做扩胸运动，每次20次，每天3-5次。',
                'priority': 8,
                'days': 21
            },
            {
                'issue_code': 'round_shoulders',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '每日进行肩部和背部肌肉强化训练，包括划船、弹力带反向飞鸟等。每次15-20分钟，建议训练30天可见明显改善。',
                'priority': 9,
                'days': 30
            },
            {
                'issue_code': 'round_shoulders',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '圆肩问题比较严重，建议咨询专业康复医生或物理治疗师，制定个性化矫正计划。同时坚持进行肩部拉伸和背部强化训练。',
                'priority': 10,
                'days': 60
            },

            # 头前伸建议
            {
                'issue_code': 'forward_head',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '每小时提醒自己将下巴水平后收，保持头部在肩膀正上方。工作电脑调整到眼睛水平，减少低头习惯。',
                'priority': 7,
                'days': 14
            },
            {
                'issue_code': 'forward_head',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '进行颈部拉伸训练：轻轻向后仰头保持5秒，然后回正，重复5次。下巴后收训练：将下巴水平后收保持3秒，重复10次，每天3组。',
                'priority': 8,
                'days': 21
            },
            {
                'issue_code': 'forward_head',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '头前伸问题较为严重，建议尽早就医检查颈椎状况。平时注意睡眠姿势，选择合适的枕头。避免长时间低头看手机，每30分钟休息活动颈部。',
                'priority': 9,
                'days': 45
            },

            # 驼背建议
            {
                'issue_code': 'kyphosis',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '注意保持正确的站姿和坐姿，肩膀后张下沉，胸部挺起。工作间隙做扩胸运动，每次20次，每天3次。',
                'priority': 7,
                'days': 21
            },
            {
                'issue_code': 'kyphosis',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '进行胸部肌肉拉伸：面对墙角，手臂呈90度，身体前倾感受胸部拉伸，保持30秒，每天3次。背部肌肉强化：猫牛式伸展，每次10次，每天3组。',
                'priority': 8,
                'days': 30
            },
            {
                'issue_code': 'kyphosis',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '驼背较为严重，建议咨询专业医生或康复治疗师。在进行任何训练前，最好先进行专业评估，确保训练方法安全有效。',
                'priority': 9,
                'days': 60
            },

            # 骨盆前倾建议
            {
                'issue_code': 'lordosis',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '注意核心肌群锻炼，避免久坐不动。每30分钟起来活动，进行简单的核心收缩训练。',
                'priority': 7,
                'days': 21
            },
            {
                'issue_code': 'lordosis',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '髋屈肌拉伸：弓步姿势，感受前腿髋部前侧拉伸，保持30秒每侧。核心肌群训练：平板支撑，从30秒开始逐渐增加，每天3组。',
                'priority': 8,
                'days': 30
            },
            {
                'issue_code': 'lordosis',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '骨盆前倾较为严重，建议咨询物理治疗师进行专业评估。在进行训练时注意循序渐进，避免过度训练腰椎。',
                'priority': 9,
                'days': 60
            },

            # 脊柱侧弯建议
            {
                'issue_code': 'scoliosis',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '注意保持正确的站立和坐姿，避免单侧承重。进行对称性练习，避免强化一侧肌肉。',
                'priority': 8,
                'days': 30
            },
            {
                'issue_code': 'scoliosis',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '进行脊柱对称性训练：猫牛式伸展、婴儿式姿势等。建议在专业指导下进行定期训练，保持身体对称性。',
                'priority': 9,
                'days': 45
            },
            {
                'issue_code': 'scoliosis',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '脊柱侧弯较为严重，强烈建议咨询专业医生进行详细检查。可能需要X光片评估侧弯程度，制定专门的治疗方案。不要自行进行激烈训练。',
                'priority': 10,
                'days': 90
            },

            # 高低肩建议
            {
                'issue_code': 'uneven_shoulders',
                'severity': 'mild',
                'type': 'daily_habit',
                'text': '注意日常姿势，避免长时间单侧承重如单肩背包。定期检查两侧肌肉平衡，进行对称性训练。',
                'priority': 6,
                'days': 14
            },
            {
                'issue_code': 'uneven_shoulders',
                'severity': 'moderate',
                'type': 'exercise',
                'text': '进行单侧平衡训练：侧平板支撑，每侧30秒，每天3组。加强较弱侧肌肉力量，提高两侧肌肉平衡。',
                'priority': 7,
                'days': 21
            },
            {
                'issue_code': 'uneven_shoulders',
                'severity': 'severe',
                'type': 'medical_advice',
                'text': '高低肩问题较为明显，建议咨询专业医生检查是否为结构性问题。训练时注意循序渐进，避免加重不平衡。',
                'priority': 8,
                'days': 45
            }
        ]

        # 创建改善建议
        for rec_data in recommendations_data:
            # 查找对应的问题记录
            issue = db.query(PostureIssue).filter(
                PostureIssue.issue_code == rec_data['issue_code']
            ).first()

            if issue:
                # 检查建议是否已存在
                existing_rec = db.query(PostureRecommendation).filter(
                    PostureRecommendation.issue_code == issue.issue_code,
                    PostureRecommendation.severity_level == Severity(rec_data['severity'])
                ).first()

                if not existing_rec:
                    new_rec = PostureRecommendation(
                        issue_code=issue.issue_code,
                        severity_level=Severity(rec_data['severity']),
                        recommendation_type=RecommendationType(rec_data['type']),
                        recommendation_text=rec_data['text'],
                        priority=rec_data['priority'],
                        estimated_improvement_days=rec_data['days'],
                        related_exercises=None,
                        is_active=True
                    )
                    db.add(new_rec)
                    print(f"Created recommendation for {issue.issue_name} (severity: {rec_data['severity']})")
                else:
                    print(f"Recommendation already exists for {issue.issue_name} (severity: {rec_data['severity']})")

        db.commit()
        print("\n✅ 所有体态改善建议已成功创建！")

        # 显示统计信息
        total_issues = db.query(PostureIssue).count()
        total_recommendations = db.query(PostureRecommendation).count()

        print(f"📊 数据库统计:")
        print(f"   体态问题数量: {total_issues}")
        print(f"   改善建议数量: {total_recommendations}")

    except Exception as e:
        db.rollback()
        print(f"❌ 创建改善建议失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

    return True

if __name__ == "__main__":
    print("开始创建体态改善建议数据库...")
    success = create_recommendations()
    exit(0 if success else 1)
