"""
调试体态关键点分析
检查关键点数据格式和置信度
"""

import asyncio
import base64
from io import BytesIO
from PIL import Image
import httpx
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_image(width=640, height=480, color=(255, 255, 255)):
    """创建一个测试用的图片"""
    img = Image.new('RGB', (width, height), color=color)

    # 绘制一些简单的形状作为测试
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)

    # 绘制一个火柴人
    # 头部
    draw.ellipse([280, 50, 320, 90], fill='black')
    # 身体
    draw.line([300, 90, 300, 250], fill='black', width=3)
    # 手臂
    draw.line([300, 110, 250, 160], fill='black', width=2)
    draw.line([300, 110, 350, 160], fill='black', width=2)
    # 腿
    draw.line([300, 250, 270, 350], fill='black', width=2)
    draw.line([300, 250, 330, 350], fill='black', width=2)

    # 转换为字节数据
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='JPEG', quality=85)
    return img_byte_arr.getvalue()

async def debug_keypoints():
    """调试关键点分析"""
    print("=== 调试体态关键点 ===\n")

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
                'http://localhost:8889/posture/assess',
                files=files,
                data=data
            )

            print(f"响应状态码: {response.status_code}")

            if response.status_code == 200:
                result = response.json()

                print("\n3. 分析响应数据...")

                # 分析photos中的keypoints
                if 'photos' in result:
                    photos = result['photos']
                    print(f"   总共 {len(photos)} 张照片")

                    for i, photo in enumerate(photos):
                        print(f"\n   照片 {i+1}: {photo.get('view_angle', 'unknown')}")
                        if 'keypoints' in photo:
                            keypoints = photo['keypoints']
                            print(f"   关键点数量: {len(keypoints)}")

                            # 检查关键点置信度
                            low_confidence = []
                            high_confidence = []

                            for name, coords in keypoints.items():
                                if isinstance(coords, (list, tuple)) and len(coords) >= 3:
                                    conf = coords[2]
                                    if conf < 0.5:
                                        low_confidence.append((name, conf))
                                    else:
                                        high_confidence.append((name, conf))

                            print(f"   高置信度关键点 (>0.5): {len(high_confidence)}")
                            print(f"   低置信度关键点 (<0.5): {len(low_confidence)}")

                            if low_confidence:
                                print(f"   低置信度关键点列表:")
                                for name, conf in low_confidence[:5]:  # 只显示前5个
                                    print(f"      - {name}: {conf:.3f}")

                # 检查metrics
                if 'metrics' in result:
                    print(f"\n4. 分析体态指标:")
                    metrics = result['metrics']
                    null_count = 0
                    valid_count = 0

                    for key, value in metrics.items():
                        if value is None:
                            null_count += 1
                            print(f"   - {key}: None ❌")
                        else:
                            valid_count += 1
                            print(f"   - {key}: {value} ✅")

                    print(f"\n   有效指标: {valid_count}/{len(metrics)}")
                    print(f"   无效指标: {null_count}/{len(metrics)}")

                return True
            else:
                print(f"API请求失败: {response.status_code}")
                print(f"响应: {response.text}")
                return False

    except Exception as e:
        print(f"请求过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(debug_keypoints())
    exit(0 if result else 1)
