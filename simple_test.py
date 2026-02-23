import requests
import time

try:
    # 等待一段时间确保服务器稳定运行
    time.sleep(2)

    # 测试健康检查端点
    response = requests.get('http://127.0.0.1:8000/health', timeout=10)

    if response.status_code == 200:
        health_data = response.json()
        print("SUCCESS: Health check endpoint is working!")
        print(f"Response: {health_data}")
        print("Backend service is running correctly.")
    else:
        print(f"FAILED: Health check returned status {response.status_code}")

except Exception as e:
    print(f"TEST FAILED: {e}")
    print("This might be because the server is still starting up or has stopped.")