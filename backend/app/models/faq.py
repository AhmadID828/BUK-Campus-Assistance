from sqlalchemy import Boolean, Column, Integer, String, Text
from app.models.base import Base


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(80), nullable=False, default="general")
    related_location_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
