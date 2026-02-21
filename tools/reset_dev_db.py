"""
Reset development database schema (DROP ALL + CREATE ALL).

Usage:
    .venv/Scripts/python.exe tools/reset_dev_db.py --yes
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from core.database import engine, Base
import models  # noqa: F401  # ensure all models are registered
import argparse


def reset_dev_db() -> None:
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Development database reset complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset development database schema.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm destructive operation.",
    )
    args = parser.parse_args()

    if not args.yes:
        raise SystemExit("Refusing to reset DB without --yes.")

    reset_dev_db()
