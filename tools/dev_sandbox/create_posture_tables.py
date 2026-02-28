import sys
sys.stdout.reconfigure(encoding='utf-8')

from core.database import engine, Base
from models.posture import *
from models.user import User
from sqlalchemy import inspect

print("Checking database tables...")
inspector = inspect(engine)
existing_tables = inspector.get_table_names()
print("Existing tables:", existing_tables)

posture_tables = ['posture_assessments', 'posture_photos', 'posture_metrics', 'posture_issues', 'posture_assessment_issues', 'posture_trends', 'posture_recommendations', 'posture_exercise_library']
missing_tables = [t for t in posture_tables if t not in existing_tables]

if missing_tables:
    print(f"\nMissing posture tables: {missing_tables}")
    print("Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")

        # Show created tables
        new_inspector = inspect(engine)
        new_tables = new_inspector.get_table_names()
        print("\nUpdated tables:", new_tables)
    except Exception as e:
        print(f"Error creating tables: {e}")
        import traceback
        traceback.print_exc()
else:
    print("\nAll posture related tables exist")
