from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default="General")
    location = Column(String, nullable=True)
    event_date = Column(Date, nullable=False)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    organizer = Column(String, nullable=True)
    image_url = Column(String, nullable=True)          # Optional image
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rsvps = relationship("EventRSVP", back_populates="event")

class EventRSVP(Base):
    __tablename__ = "event_rsvps"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="going")           # going, maybe, not_going
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="rsvps")
