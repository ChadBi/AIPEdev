from core.database import engine, Base
import models  # noqa: F401  # ensure all model modules are registered

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
