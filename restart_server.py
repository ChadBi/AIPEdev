"""
重启后端服务器
"""

import subprocess
import time
import os
import signal

def kill_server():
    """杀掉现有的服务器进程"""
    print("停止现有的服务器进程...")
    try:
        # 尝试使用taskkill命令杀掉Python进程
        subprocess.run(['taskkill', '/F', '/IM', 'python.exe'], capture_output=True, text=True)
        subprocess.run(['taskkill', '/F', '/IM', 'pythonw.exe'], capture_output=True, text=True)
        print("✅ 已发送停止信号")
    except Exception as e:
        print(f"⚠️  停止服务器时可能出现问题: {e}")

    time.sleep(2)  # 等待进程结束

def start_server():
    """启动服务器"""
    print("启动新的服务器...")
    try:
        # 启动服务器
        process = subprocess.Popen(
            ['python', 'main.py'],
            cwd=r'E:\DDesktop\aisport\bjf1\AIPEdev',
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        print(f"✅ 服务器已启动 (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"❌ 启动服务器失败: {e}")
        return None

def wait_for_server():
    """等待服务器启动"""
    print("等待服务器启动...")
    import httpx
    max_attempts = 30
    for attempt in range(max_attempts):
        try:
            response = httpx.get('http://localhost:8890/health', timeout=5)
            if response.status_code == 200:
                print("✅ 服务器已就绪！")
                return True
        except Exception:
            time.sleep(1)
            if attempt % 5 == 0:
                print(f"   等待中... ({attempt}/{max_attempts})")
    print("❌ 服务器启动超时")
    return False

if __name__ == "__main__":
    kill_server()
    start_server()
    if wait_for_server():
        print("\n🎉 服务器重启成功！")
    else:
        print("\n❌ 服务器重启失败")
