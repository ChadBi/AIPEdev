from core.database import engine
from models.user import User
from models.action import Action
from models.video import Video
from models.score import ScoreRecord
from models.action_record import ActionRecord
from core.database import Base

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
