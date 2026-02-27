import sys
from sqlalchemy import text
from core.database import engine

# 清理现有体态数据
print("清理现有体态数据问题...")

with engine.connect() as conn:
    # 删除 posture_issues 表（因为 weight_score 字段有问题）
    conn.execute(text("DELETE FROM posture_assessment_issues"))
    conn.execute(text("DELETE FROM posture_issues"))
    conn.commit()
    print("已清空 posture_issues 和 posture_assessment_issues 表")
