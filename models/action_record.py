from sqlalchemy import Column, Integer, ForeignKey, DateTime
from datetime import datetime
from core.database import Base

class ActionRecord(Base):
    __tablename__ = "action_records"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_id = Column(Integer, ForeignKey("actions.id"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
