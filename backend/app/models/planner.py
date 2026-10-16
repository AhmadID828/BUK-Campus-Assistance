from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    course_code = Column(String, nullable=False)          # e.g. SWE401
    course_title = Column(String, nullable=False)
    credit_units = Column(Integer, default=3)
    exam_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    topics = relationship("StudyTopic", back_populates="course")

class StudyTopic(Base):
    __tablename__ = "study_topics"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Integer, default=2)                 # 1 = High, 2 = Medium, 3 = Low
    is_completed = Column(Boolean, default=False)
    estimated_hours = Column(Float, default=2.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="topics")

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    plan_data = Column(Text)                              # JSON string of daily schedule
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
