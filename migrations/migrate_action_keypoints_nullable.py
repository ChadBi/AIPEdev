"""
数据库迁移脚本：将 actions 表的 keypoints 字段改为可选

背景：
- 新方案中，标准动作的关键点不再预存，而是在评分时动态识别
- 这样可以确保标准动作和用户动作使用完全相同的识别参数
"""

from sqlalchemy import text
from core.database import engine

def migrate():
    """执行迁移"""
    with engine.connect() as conn:
        try:
            # 修改 keypoints 字段为可空
            print("正在修改 actions 表的 keypoints 字段为 nullable...")
            conn.execute(text("""
                ALTER TABLE actions 
                MODIFY COLUMN keypoints JSON NULL
            """))
            conn.commit()
            print("✅ 迁移成功: keypoints 字段现在可以为 NULL")
            
            # 清空现有的 keypoints 数据（因为要使用新方案动态识别）
            print("\n正在清空现有的 keypoints 数据...")
            result = conn.execute(text("UPDATE actions SET keypoints = NULL"))
            conn.commit()
            print(f"✅ 已清空 {result.rowcount} 条记录的 keypoints 字段")
            
            print("\n迁移完成！现在评分时会同时识别标准视频和用户视频。")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ 迁移失败: {e}")
            raise

if __name__ == "__main__":
    migrate()
