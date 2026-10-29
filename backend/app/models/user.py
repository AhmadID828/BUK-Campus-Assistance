from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    registration_number = Column(String, unique=True, nullable=True)
    faculty = Column(String, nullable=True)
    department = Column(String, nullable=True)
    level = Column(Integer, nullable=True)
    role = Column(String, default="student")          # "student" or "admin"
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)      # Admin must approve
    must_change_password = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    study_materials = relationship("StudyMaterial", back_populates="owner")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    quizzes = relationship("Quiz", back_populates="owner")
