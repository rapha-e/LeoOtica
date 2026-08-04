import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class StockMovement(Base):
    __tablename__ = "stock_movements"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lens_inventory_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("lens_inventory_grade.id", ondelete="CASCADE"), 
        nullable=False
    )
    movement_type: Mapped[str] = mapped_column(String(10), nullable=False) # 'IN', 'OUT', 'AUDIT'
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    movement_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamento com a dioptria correspondente
    lens_inventory: Mapped["LensInventoryGrade"] = relationship(
        "LensInventoryGrade", 
        back_populates="movements"
    )
