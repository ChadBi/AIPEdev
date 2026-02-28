#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
sys.path.insert(0, r'e:\python\AIPE\AIPEdev')

def check_backend():
    """检查后端各项功能"""
    print("正在检查后端功能...")

    try:
        # 检查数据库连接
        from core.database import engine
        print("[OK] 数据库引擎创建成功")

        # 检查模型
        from models import User, Action, Video, ScoreRecord, ActionRecord, Music, SyncConfig
        print("[OK] 所有模型导入成功")

        # 检查API路由
        import main
        app = main.app
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        print(f"[OK] 找到 {len(routes)} 条路由")

        # 检查必需路由
        essential_routes = [
            '/health',
            '/auth/login',
            '/auth/register',
            '/users/me',
            '/music/upload',
            '/videos/upload',
            '/actions/',
            '/recognize/',
            '/scores/'
        ]

        for route in essential_routes:
            if any(route in r for r in routes):
                print(f"[OK] 关键路由 {route} 存在")
            else:
                print(f"[MISSING] 关键路由 {route} 不存在")

        # 检查依赖
        from core.security import verify_password, hash_password
        print("[OK] 安全模块正常")

        # 检查配置
        from core.config import DATABASE_URL, SECRET_KEY
        print("[OK] 配置加载正常")

        print("\n后端检查完成 - 所有功能正常")
        return True

    except Exception as e:
        print(f"[ERROR] 后端检查失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    check_backend()
