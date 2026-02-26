"""
直接检查API返回的数据格式
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
    draw.ellipse([280, 50, 320, 90], fill='black')
    draw.line([300, 90, 300, 250], fill='black', width=3)
    draw.line([300, 110, 250, 160], fill='black', width=2)
    draw.line([300, 110, 350, 160], fill='black', width=2)
    draw.line([300, 250, 270, 350], fill='black', width=2)
    draw.line([300, 250, 330, 350], fill='black', width=2)

    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='JPEG', quality=85)
    return img_byte_arr.getvalue()

async def check_api_format():
    """检查API返回格式"""
    print("=== 检查API返回数据格式 ===\n")

    try:
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
            response = await client.post(
                'http://localhost:8890/posture/assess',
                files=files,
                data=data
            )

            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                result = response.json()

                print(f"\n1. 体态指标:")
                print(json.dumps(result.get('metrics', {}), indent=2, ensure_ascii=False))

                print(f"\n2. 检测到的问题:")
                issues = result.get('detected_issues', [])
                print(f"问题数量: {len(issues)}")

                for i, issue in enumerate(issues):
                    print(f"\n问题 {i+1}:")
                    print(f"  ID: {issue.get('id')}")
                    print(f"  Issue ID: {issue.get('issue_id')}")
                    print(f"  Issue Code: {issue.get('issue_code')}")
                    print(f"  Severity: {issue.get('severity')}")

                    if 'issue' in issue:
                        print(f"  Issue对象详情:")
                        issue_obj = issue['issue']
                        print(f"    issue_code: {issue_obj.get('issue_code')}")
                        print(f"    issue_name: {issue_obj.get('issue_name')}")

                print(f"\n3. Issue Codes数组:")
                issue_codes = result.get('issue_codes', [])
                print(f"Issue Codes: {issue_codes}")

                return True
            else:
                print(f"请求失败: {response.status_code}")
                return False

    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(check_api_format())
    exit(0 if result else 1)
