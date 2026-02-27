import subprocess
import sys
import time

print("Starting backend server...")

# 启动后端服务器
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9999", "--log-level", "debug"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

# 等待服务器启动
time.sleep(5)
print("Server should be ready...")

# 测试API
print("Testing API...")
import requests
import base64
import io

# 创建测试图像
from PIL import Image
img = Image.new('RGB', (100, 100), color='gray')
from io import BytesIO
buff = BytesIO()
img.save(buff, format='JPEG')
test_image = buff.getvalue()

# 登录
login_resp = requests.post('http://localhost:9999/auth/simple-login', json={'username': 'admin', 'password': 'admin123'})
token = login_resp.json()['access_token']

print("Sending request to pose API...")
files = {
    'front_photo': ('test.jpg', io.BytesIO(test_image), 'image/jpeg'),
    'left_side_photo': ('test.jpg', io.BytesIO(test_image), 'image/jpeg'),
    'right_side_photo': ('test.jpg', io.BytesIO(test_image), 'image/jpeg'),
    'back_photo': ('test.jpg', io.BytesIO(test_image), 'image/jpeg'),
    'assessment_type': (None, 'routine'),
}

resp = requests.post('http://localhost:9999/posture/assess', headers={'Authorization': f'Bearer {token}'}, files=files, timeout=30)
print(f"Response status: {resp.status_code}")
print(f"Response: {resp.text[:500] if resp.text else 'No response body'}")

# 打印后端日志
print("\n--- Backend Log ---")
time.sleep(2)
proc.terminate()
log = proc.stdout.read()
print(log)
