"""
分析真实的体态关键点数据
查看为什么计算结果很低
"""

import asyncio
from io import BytesIO
from PIL import Image
import httpx
import json

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

async def analyze_real_keypoints():
    """分析真实的体态检测结果"""
    print("=== 分析真实体态关键点 ===\n")

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

                print("\n3. 分析关键点数据:")
                if 'photos' in result:
                    for photo in result['photos']:
                        view_angle = photo.get('view_angle', 'unknown')
                        keypoints = photo.get('keypoints', {})

                        print(f"\n {view_angle} 视角关键点分析:")

                        # 分析成对关键点的对称性
                        if view_angle == 'front':
                            pairs = [('left_shoulder', 'right_shoulder'), ('left_hip', 'right_hip')]
                            for left, right in pairs:
                                if left in keypoints and right in keypoints:
                                    left_x, left_conf = keypoints[left][0], keypoints[left][2]
                                    right_x, right_conf = keypoints[right][0], keypoints[right][2]

                                    actual_center = (left_x + right_x) / 2
                                    deviation = abs(actual_center - 0.5) * 2

                                    print(f"  - {left.replace('_', ' ')} vs {right.replace('_', ' ')}:")
                                    print(f"    左坐标: {left_x:.3f}, 右坐标: {right_x:.3f}")
                                    print(f"    中心点: {actual_center:.3f}, 偏差: {deviation:.3f}")

                print(f"\n4. 体态指标结果:")
                metrics = result.get('metrics', {})
                for key, value in metrics.items():
                    if value is not None:
                        print(f"  - {key}: {value}")

                print(f"\n5. 综合评分: {result.get('overall_score', 'N/A')}")
                print(f"6. 检测到的问题: {result.get('detected_issues', [])}")

                return True
            else:
                print(f"API请求失败: {response.status_code}")
                return False

    except Exception as e:
        print(f"请求过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(analyze_real_keypoints())
    exit(0 if result else 1)
