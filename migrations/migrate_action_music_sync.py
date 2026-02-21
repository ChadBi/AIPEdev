"""
数据库迁移脚本：创建 action_music_sync 表
"""

from core.database import engine
from models.action_music_sync import ActionMusicSync


def migrate():
    """执行迁移"""
    ActionMusicSync.__table__.create(bind=engine, checkfirst=True)
    print("✅ action_music_sync 表已就绪")


if __name__ == "__main__":
    migrate()
