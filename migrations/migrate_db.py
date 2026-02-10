"""
数据库迁移脚本：为 actions 表添加 video_path 列
"""
from sqlalchemy import text
from core.database import engine

def migrate():
    """运行数据库迁移"""
    with engine.connect() as connection:
        # 检查列是否存在
        try:
            connection.execute(text("SELECT video_path FROM actions LIMIT 1"))
            print("✓ video_path 列已存在，不需要迁移")
        except Exception:
            # 列不存在，添加它
            print("正在添加 video_path 列...")
            connection.execute(text("""
                ALTER TABLE actions 
                ADD COLUMN video_path VARCHAR(500) NULL
            """))
            connection.commit()
            print("✓ 成功添加 video_path 列")

if __name__ == "__main__":
    migrate()
