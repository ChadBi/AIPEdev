"""
迁移脚本：为 score_records 表添加 video_id, student_video_delay, frame_scores 列
"""
from sqlalchemy import create_engine, text
from core.config import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # 检查列是否已存在
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'aipe_db' 
            AND TABLE_NAME = 'score_records' 
            AND COLUMN_NAME = 'video_id'
        """))
        
        if result.fetchone()[0] == 0:
            print("添加 video_id 列...")
            conn.execute(text("""
                ALTER TABLE score_records 
                ADD COLUMN video_id INT NULL,
                ADD CONSTRAINT fk_score_video 
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL
            """))
            conn.commit()
            print("✓ video_id 列添加成功")
        else:
            print("video_id 列已存在")
        
        # 检查 student_video_delay 列
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'aipe_db' 
            AND TABLE_NAME = 'score_records' 
            AND COLUMN_NAME = 'student_video_delay'
        """))
        
        if result.fetchone()[0] == 0:
            print("添加 student_video_delay 列...")
            conn.execute(text("""
                ALTER TABLE score_records 
                ADD COLUMN student_video_delay FLOAT NOT NULL DEFAULT 0.0
            """))
            conn.commit()
            print("✓ student_video_delay 列添加成功")
        else:
            print("student_video_delay 列已存在")
        
        # 检查 frame_scores 列
        result = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'aipe_db' 
            AND TABLE_NAME = 'score_records' 
            AND COLUMN_NAME = 'frame_scores'
        """))
        
        if result.fetchone()[0] == 0:
            print("添加 frame_scores 列...")
            conn.execute(text("""
                ALTER TABLE score_records 
                ADD COLUMN frame_scores JSON NULL
            """))
            conn.commit()
            print("✓ frame_scores 列添加成功")
        else:
            print("frame_scores 列已存在")
    
    print("\n✅ 数据库迁移完成！")

if __name__ == "__main__":
    migrate()
