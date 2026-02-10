"""
数据库迁移脚本：修改 score_records 的外键约束为级联删除
"""
from sqlalchemy import text
from core.database import engine

def migrate():
    """运行数据库迁移"""
    with engine.connect() as connection:
        try:
            print("正在删除旧的外键约束...")
            connection.execute(text("""
                ALTER TABLE score_records 
                DROP FOREIGN KEY score_records_ibfk_2
            """))
            connection.commit()
            print("✓ 成功删除旧的外键约束")
        except Exception as e:
            print(f"删除外键约束出错（可能已删除）: {e}")
        
        try:
            print("正在添加新的级联删除外键约束...")
            connection.execute(text("""
                ALTER TABLE score_records 
                ADD CONSTRAINT score_records_ibfk_2 
                FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
            """))
            connection.commit()
            print("✓ 成功添加级联删除外键约束")
        except Exception as e:
            print(f"添加外键约束出错: {e}")

if __name__ == "__main__":
    migrate()
