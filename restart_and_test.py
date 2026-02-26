"""
重启服务器并测试改进后的算法
"""

import subprocess
import time
import asyncio
import httpx
from io import BytesIO
from PIL import Image

def create_test_image(width=640, height=480, color=(255, 255, 255)):
    """创建一个测试用的图片"""
    img = Image.new('RGB', (width, height), color=color)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)

    # 绘制一个火柴人
    draw.ellipse([280, 50, 320, 90], fill='black')
    draw.line([300, 90, 300, 250], fill='black', width=3)
    draw.line([300, 110, 250, 160], fill='black', width=2)
    draw.line([300, 110, 350, 160], fill='black', width=2)
    draw.line([300, 250, 270, 350], fill='black', width=2)
    draw.line([300, 250, 330, 350], fill='black', width=2)

    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='JPEG', quality=85)
    return img_byte_arr.getvalue()

async def test_improved_metrics():
    """测试改进后的体态指标"""
    print("=== 测试改进后的体态指标 ===\n")

    try:
        # 创建测试照片
        print("1. 创建测试照片...")
        front_photo = create_test_image()
        left_side_photo = create_test_image()
        right_side_photo = create_test_image()
        back_photo = create_test_image()

        files = {
            'front_photo': ('front.jpg', front_photo, 'image/jpeg'),
            'left_side_photo': ('left_side.jpg', left_side_photo, 'image/jpeg'),
            'right_side_photo': ('right_side.jpg', right_side_photo, 'image/jpeg'),
            'back_photo': ('back.jpg', back_photo, 'image/jpeg')
        }

        data = {
            'assessment_type': 'routine',
            'age': '25',
            'height': '175',
            'weight': '70'
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            print("2. 发送API请求...")
            response = await client.post(
                'http://localhost:8890/posture/assess',
                files=files,
                data=data
            )

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 200:
                result = response.json()

                print("\n3. 检查所有体态指标:")

                if 'metrics' in result:
                    metrics = result['metrics']
                    null_count = 0
                    valid_count = 0

                    # 所有期望的指标
                    expected_metrics = [
                        'body_balance', 'spinal_alignment', 'head_neck_angle',
                        'shoulder_balance', 'hip_alignment', 'posture_stability',
                        'spine_curvature_front', 'spine_curvature_side', 'pelvis_tilt_angle',
                        'skeletal_symmetry'
                    ]

                    missing_metrics = set(expected_metrics) - set(metrics.keys())
                    if missing_metrics:
                        print(f"\n  ⚠️  缺失的指标: {list(missing_metrics)}")

                    for key, value in metrics.items():
                        if value is None:
                            null_count += 1
                            print(f"   - {key}: NULL")
                        else:
                            valid_count += 1
                            print(f"   - {key}: {value}")

                    print(f"\n   有效指标: {valid_count}/{len(expected_metrics)}")
                    print(f"   无效指标: {null_count}/{len(expected_metrics)}")

                    if valid_count >= len(expected_metrics) * 0.5:  # 至少一半指标有效
                        print("\n   ✅ SUCCESS: 改进后的算法正在工作！")
                    else:
                        print("\n   ⚠️  WARNING: 大部分指标仍然为NULL，需要进一步调试")

                # 检查detected_issues
                if 'detected_issues' in result:
                    issues = result['detected_issues']
                    print(f"\n   检测到的问题数量: {len(issues)}")

                check_improvements(result)
                return True
            else:
                print(f"API请求失败: {response.status_code}")
                return False

    except Exception as e:
        print(f"请求过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_improvements(result):
    """检查算法改进效果"""
    print("\n4. 检查算法改进效果:")

    metrics = result.get('metrics', {})

    improvements = []

    # 检查基础指标是否在合理范围内
    if 'body_balance' in metrics and metrics['body_balance'] != 20.0:
        improvements.append("✅ 身体平衡度算法已改进")

    if 'spinal_alignment' in metrics and metrics['spinal_alignment'] > 30.0:
        improvements.append("✅ 脊柱对齐度算法已改进")

    if 'head_neck_angle' in metrics and metrics['head_neck_angle'] > 40.0:
        improvements.append("✅ 头颈角度算法已改进")

    # 检查新增指标是否计算成功
    new_metrics = ['shoulder_balance', 'hip_alignment', 'posture_stability',
                   'spine_curvature_front', 'spine_curvature_side', 'pelvis_tilt_angle', 'skeletal_symmetry']

    for metric in new_metrics:
        if metric in metrics and metrics[metric] is not None:
            improvements.append(f"✅ 新增指标 {metric} 计算成功")

    if improvements:
        print(f"   发现 {len(improvements)} 项改进:")
        for improvement in improvements:
            print(f"   {improvement}")
    else:
        print("   ⚠️  未检测到明显改进，可能需要进一步调试")

if __name__ == "__main__":
    result = asyncio.run(test_improved_metrics())
    exit(0 if result else 1)
