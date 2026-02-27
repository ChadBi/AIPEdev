"""
迁移脚本：为 score_records 添加实时检测字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def _column_exists(conn, table_name: str, column_name: str, schema_name: str) -> bool:
    result = conn.execute(text("""
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = :schema_name
        AND TABLE_NAME = :table_name
        AND COLUMN_NAME = :column_name
    """), {
        "schema_name": schema_name,
        "table_name": table_name,
        "column_name": column_name,
    })
    return result.fetchone() is not None


def migrate():
    """添加 is_live 与 live_metadata 字段"""
    with engine.connect() as conn:
        current_db = conn.execute(text("SELECT DATABASE()")).scalar()

        if not _column_exists(conn, "score_records", "is_live", current_db):
            conn.execute(text("""
                ALTER TABLE score_records
                ADD COLUMN is_live TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为实时检测评分'
            """))
            print("已添加字段 is_live")
        else:
            print("字段 is_live 已存在，跳过")

        if not _column_exists(conn, "score_records", "live_metadata", current_db):
            conn.execute(text("""
                ALTER TABLE score_records
                ADD COLUMN live_metadata JSON NULL COMMENT '实时检测附加元数据'
            """))
            print("已添加字段 live_metadata")
        else:
            print("字段 live_metadata 已存在，跳过")

        conn.commit()

    print("迁移完成：score_records 已支持实时检测字段")


if __name__ == "__main__":
    migrate()
