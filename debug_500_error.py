"""
调试500错误的脚本
模拟用户的体态检测请求并捕获详细错误信息
"""

import asyncio
import base64
from io import BytesIO
from PIL import Image
import httpx
import logging

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
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

async def debug_posture_request():
    """调试体态检测请求"""
    print("=== 调试体态检测500错误 ===\n")

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

        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            print("2. 发送调试请求...")
            response = await client.post(
                'http://localhost:8889/posture/assess',
                files=files,
                data=data
            )

            print(f"响应状态码: {response.status_code}")
            print(f"响应头: {dict(response.headers)}")

            if response.status_code == 500:
                print("3. 检测到500错误，尝试获取详细错误信息...")

                try:
                    error_data = response.json()
                    print(f"错误数据: {error_data}")
                except:
                    print(f"响应文本: {response.text}")

                return False
            elif response.status_code == 401:
                print("401 认证错误 - 这是预期的")
                return True
            elif response.status_code == 200:
                print("200 成功")
                result = response.json()
                print(f"结果: {result}")
                return True
            else:
                print(f"其他状态码: {response.status_code}")
                print(f"响应: {response.text}")
                return False

    except Exception as e:
        print(f"请求过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(debug_posture_request())
    exit(0 if result else 1)