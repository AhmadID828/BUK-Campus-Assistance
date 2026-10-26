from sqlalchemy import Column, DateTime, Index, Integer, String

from app.models.base import Base


class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limits"

    bucket_key = Column(String(64), primary_key=True)
    window_started_at = Column(DateTime(timezone=True), nullable=False)
    request_count = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_auth_rate_limits_updated_at", "updated_at"),
    )
