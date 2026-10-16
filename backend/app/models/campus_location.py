from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.models.base import Base

class CampusLocation(Base):
    __tablename__ = "campus_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                  # e.g. Faculty of Engineering
    category = Column(String, nullable=False)              # Faculty, Hostel, Library, Clinic, Bank, etc.
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    building_code = Column(String(50), nullable=True)
    is_emergency_point = Column(Boolean, default=False)


