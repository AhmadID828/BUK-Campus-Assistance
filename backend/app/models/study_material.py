from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import TSVECTOR
from app.models.base import Base



class StudyMaterial(Base):
    __tablename__ = "study_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text)
    file_path = Column(String)
    subject = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Full-text search vector
    search_vector = Column(TSVECTOR)

    owner = relationship("User", back_populates="study_materials")

    # Create GIN index for fast full-text search
    __table_args__ = (
        Index('ix_study_materials_search_vector', 'search_vector', postgresql_using='gin'),
    )

