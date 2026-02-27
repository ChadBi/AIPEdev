"""
改进的服务器启动脚本
"""

import sys
import time
import httpx

def test_server_ready():
    """测试服务器是否就绪"""
    max_attempts = 30
    print("等待服务器启动...")
    for attempt in range(max_attempts):
        try:
            response = httpx.get('http://localhost:8890/health', timeout=2)
            if response.status_code == 200:
                print("✅ 服务器已就绪！")
                return True
        except Exception:
            time.sleep(1)
            if attempt % 5 == 0:
                print(f"   等待中... ({attempt + 1}/{max_attempts})")
    print("❌ 服务器启动超时")
    return False

if __name__ == "__main__":
    print("启动AI体育教学系统...")
    print("注意：服务器需要加载YOLO模型，可能需要一些时间")
    print("请等待健康检查通过\n")

    # 直接导入并启动应用
    import uvicorn
    from main import app

    try:
        # 在后台线程中测试服务器就绪
        import threading
        test_thread = threading.Thread(target=test_server_ready, daemon=True)
        test_thread.start()

        # 启动服务器
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8890,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except Exception as e:
        print(f"服务器启动失败: {e}")
        sys.exit(1)
