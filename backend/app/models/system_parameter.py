import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base

class SystemParameter(Base):
    __tablename__ = "system_parameters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    group: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False, index=True) # 'FINANCIAL', 'INVENTORY', 'PRODUCTION', 'GENERAL'
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
