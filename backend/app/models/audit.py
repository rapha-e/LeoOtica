import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Uuid, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False) # ex: "CREATE", "UPDATE", "DELETE"
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_id: Mapped[str] = mapped_column(String(100), nullable=False)
    old_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON como string
    new_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON como string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relacionamento
    user: Mapped[Optional["User"]] = relationship("User")
