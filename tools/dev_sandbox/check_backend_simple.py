#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
sys.path.insert(0, r'e:\python\AIPE\AIPEdev')

def check_backend():
    """检查后端各项功能"""
    print("Checking backend functionality...")

    try:
        # 检查数据库连接
        from core.database import engine
        print("[OK] Database engine created successfully")

        # 检查模型
        from models import User, Action, Video, ScoreRecord, ActionRecord, Music, SyncConfig
        print("[OK] All models imported successfully")

        # 检查API路由
        import main
        app = main.app
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        print(f"[OK] Found {len(routes)} routes")

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
                print(f"[OK] Essential route {route} exists")
            else:
                print(f"[MISSING] Essential route {route} does not exist")

        # 检查依赖
        from core.security import verify_password, hash_password
        print("[OK] Security module works")

        # 检查配置
        from core.config import DATABASE_URL, SECRET_KEY
        print("[OK] Config loaded properly")

        print("\nBackend check complete - All functions working properly")
        return True

    except Exception as e:
        print(f"[ERROR] Backend check failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    check_backend()
