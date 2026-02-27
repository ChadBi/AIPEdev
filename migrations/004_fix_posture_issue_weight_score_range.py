"""
迁移脚本：修复 posture_issues.weight_score 字段范围过小问题

问题背景：
- 旧字段定义为 DECIMAL(3,2)，最大仅 9.99
- 业务默认权重会写入 10/15/20/25/30，导致写入时报 1264 越界
"""
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine


def _get_column_numeric_info(conn, schema_name: str, table_name: str, column_name: str):
    result = conn.execute(
        text(
            """
            SELECT NUMERIC_PRECISION, NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = :schema_name
              AND TABLE_NAME = :table_name
              AND COLUMN_NAME = :column_name
            """
        ),
        {
            "schema_name": schema_name,
            "table_name": table_name,
            "column_name": column_name,
        },
    ).fetchone()
    return result


def migrate():
    with engine.connect() as conn:
        current_db = conn.execute(text("SELECT DATABASE()")).scalar()
        column_info = _get_column_numeric_info(
            conn, current_db, "posture_issues", "weight_score"
        )

        if not column_info:
            print("字段 posture_issues.weight_score 不存在，跳过迁移")
            return

        precision, scale = column_info
        if precision is not None and scale is not None and precision >= 5 and scale == 2:
            print("字段 posture_issues.weight_score 已是 DECIMAL(5,2) 或更大，跳过迁移")
            return

        conn.execute(
            text(
                """
                ALTER TABLE posture_issues
                MODIFY COLUMN weight_score DECIMAL(5,2) NULL DEFAULT 10.00 COMMENT '在总分中的权重'
                """
            )
        )
        conn.commit()
        print("迁移完成：posture_issues.weight_score 已调整为 DECIMAL(5,2)")


if __name__ == "__main__":
    migrate()
