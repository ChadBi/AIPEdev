"""
直接测试体态分析服务
"""

from services.posture_analysis_service import PostureAnalyzer

# 创建分析器实例
analyzer = PostureAnalyzer()

# 创建测试关键点数据 (模拟正面视角)
test_front_keypoints = {
    'nose': (0.5, 0.2, 0.95),
    'left_eye': (0.45, 0.18, 0.97),
    'right_eye': (0.55, 0.18, 0.96),
    'left_ear': (0.42, 0.22, 0.94),
    'right_ear': (0.58, 0.22, 0.95),
    'left_shoulder': (0.35, 0.35, 0.98),
    'right_shoulder': (0.65, 0.35, 0.97),
    'left_elbow': (0.30, 0.45, 0.96),
    'right_elbow': (0.70, 0.45, 0.94),
    'left_wrist': (0.25, 0.55, 0.93),
    'right_wrist': (0.75, 0.55, 0.92),
    'left_hip': (0.40, 0.55, 0.96),
    'right_hip': (0.60, 0.55, 0.97),
    'left_knee': (0.38, 0.70, 0.95),
    'right_knee': (0.62, 0.70, 0.94),
    'left_ankle': (0.37, 0.85, 0.93),
    'right_ankle': (0.63, 0.85, 0.92),
}

# 创建测试关键点数据 (模拟侧面视角)
test_side_keypoints = {
    'nose': (0.3, 0.2, 0.95),
    'left_eye': (0.28, 0.18, 0.97),
    'right_eye': (0.32, 0.18, 0.96),
    'left_ear': (0.25, 0.22, 0.94),
    'right_ear': (0.35, 0.22, 0.95),
    'left_shoulder': (0.25, 0.35, 0.98),
    'right_shoulder': (0.35, 0.35, 0.97),
    'left_elbow': (0.20, 0.45, 0.96),
    'right_elbow': (0.40, 0.45, 0.94),
    'left_wrist': (0.15, 0.55, 0.93),
    'right_wrist': (0.45, 0.55, 0.92),
    'left_hip': (0.30, 0.55, 0.96),
    'right_hip': (0.40, 0.55, 0.97),
    'left_knee': (0.28, 0.70, 0.95),
    'right_knee': (0.42, 0.70, 0.94),
    'left_ankle': (0.27, 0.85, 0.93),
    'right_ankle': (0.43, 0.85, 0.92),
}

print("=== 测试体态分析服务 ===\n")

print("1. 测试身体平衡度计算...")
try:
    body_balance = analyzer.calculate_body_balance(test_front_keypoints)
    print(f"   身体平衡度: {body_balance}")
    print(f"   类型: {type(body_balance)}")
except Exception as e:
    print(f"   身体平衡度计算失败: {e}")
    import traceback
    traceback.print_exc()

print("\n2. 测试脊柱对齐度计算...")
try:
    spinal_alignment = analyzer.calculate_spinal_alignment(test_side_keypoints)
    print(f"   脊柱对齐度: {spinal_alignment}")
    print(f"   类型: {type(spinal_alignment)}")
except Exception as e:
    print(f"   脊柱对齐度计算失败: {e}")
    import traceback
    traceback.print_exc()

print("\n3. 测试头颈角度计算...")
try:
    head_neck_angle = analyzer.calculate_head_neck_angle(test_side_keypoints)
    print(f"   头颈角度: {head_neck_angle}")
    print(f"   类型: {type(head_neck_angle)}")
except Exception as e:
    print(f"   头颈角度计算失败: {e}")
    import traceback
    traceback.print_exc()

print("\n4. 测试多视角体态分析...")
try:
    view_keypoints = {
        'front': test_front_keypoints,
        'left_side': test_side_keypoints,
        'right_side': test_side_keypoints,  # 使用同样的数据作为右侧面
        'back': test_front_keypoints,       # 使用正面数据作为背面
    }

    analysis = analyzer.analyze_multiview_posture(view_keypoints)
    print(f"   分析结果: {analysis}")
    print(f"   指标: {analysis.get('metrics', {})}")
    print(f"   检测到的问题: {len(analysis.get('issues', []))}")
except Exception as e:
    print(f"   多视角分析失败: {e}")
    import traceback
    traceback.print_exc()

print("\n=== 测试完成 ===")
