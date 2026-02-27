# -*- coding: utf-8 -*-
"""
数据库重建脚本

删除所有表并重新创建。
警告：此操作会删除所有数据！

使用方法:
    uv run python scripts/rebuild_database.py --force
"""

import sys
import argparse
from pathlib import Path

# 添加项目根目录到 sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 设置控制台 UTF-8 编码
import ctypes
ctypes.windll.kernel32.SetConsoleOutputCP(65001)

from sqlalchemy import text
from core.database import engine, Base
# 导入所有模型以确保它们被注册到 Base.metadata
from models import User, Action, Video, ScoreRecord, ActionRecord, Music, SyncConfig, ActionMusicSync
from models.posture import (
    PostureAssessment, PosturePhoto, PostureMetrics, PostureIssue,
    PostureAssessmentIssue, PostureTrend, PostureRecommendation, PostureExerciseLibrary
)


def drop_all_tables():
    """删除所有表"""
    print("正在删除所有表...")
    # 禁用外键检查以避免删除顺序问题
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        conn.commit()

    Base.metadata.drop_all(bind=engine)

    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        conn.commit()

    print("所有表已删除")


def create_all_tables():
    """创建所有表"""
    print("正在创建所有表...")
    Base.metadata.create_all(bind=engine)
    print("所有表已创建")


def list_tables():
    """列出数据库中的所有表"""
    print("\n当前数据库表列表:")
    print("-" * 40)
    with engine.connect() as conn:
        result = conn.execute(text("SHOW TABLES"))
        for row in result:
            print(f"  - {row[0]}")
    print("-" * 40)


def main():
    parser = argparse.ArgumentParser(description="AIPE 数据库重建工具")
    parser.add_argument("--force", action="store_true", help="跳过确认直接执行")
    args = parser.parse_args()

    print("=" * 50)
    print("AIPE 数据库重建工具")
    print("=" * 50)
    print("\n警告：此操作将删除所有数据！")
    print("数据库：", engine.url.database)
    print()

    # 确认操作
    if not args.force:
        confirm = input("确认要删除所有表并重建吗？(输入 'yes' 确认): ")
        if confirm.lower() != 'yes':
            print("操作已取消")
            sys.exit(0)
    else:
        print("--force 参数已指定，跳过确认")

    print("\n开始重建数据库...")

    # 1. 删除所有表
    drop_all_tables()

    # 2. 创建所有表
    create_all_tables()

    # 3. 显示结果
    list_tables()

    print("\n数据库重建完成！")


if __name__ == "__main__":
    main()