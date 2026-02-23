"""
迁移脚本：添加动作识别状态字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def migrate():
    """添加识别状态相关字段到 actions 表"""

    # 检查字段是否已存在
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'aipe_db'
            AND TABLE_NAME = 'actions'
            AND COLUMN_NAME = 'recognition_status'
        """))
        if result.fetchone():
            print("字段 recognition_status 已存在，跳过迁移")
            return

    # 添加新字段
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE actions
            ADD COLUMN recognition_status VARCHAR(20) DEFAULT 'pending' NOT NULL COMMENT '识别状态: pending/processing/completed/failed'
        """))

        conn.execute(text("""
            ALTER TABLE actions
            ADD COLUMN recognition_error VARCHAR(500) NULL COMMENT '识别失败的错误信息'
        """))

        # 更新已存在动作的状态
        conn.execute(text("""
            UPDATE actions
            SET recognition_status = 'pending'
            WHERE recognition_status IS NULL OR recognition_status = ''
        """))

        conn.commit()

    print("迁移完成：添加 recognition_status 和 recognition_error 字段")


if __name__ == "__main__":
    migrate()
