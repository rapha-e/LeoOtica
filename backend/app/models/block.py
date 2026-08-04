import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, Index, Uuid, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class BlockModel(Base):
    __tablename__ = "block_models"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    material: Mapped[str] = mapped_column(String(50), default="CR-39", nullable=False)
    refractive_index: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.56"), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("35.00"), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("95.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    base_curves_config: Mapped[Optional[str]] = mapped_column(String(255), default="2.00, 4.00, 6.00", nullable=True)
    additions_config: Mapped[Optional[str]] = mapped_column(String(255), default="0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00", nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamento com os itens de grade de blocos
    grid_items: Mapped[List["BlockGridItem"]] = relationship(
        "BlockGridItem", 
        back_populates="block_model",
        cascade="all, delete-orphan"
    )

class BlockGridItem(Base):
    __tablename__ = "block_grid_items"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    block_model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("block_models.id", ondelete="CASCADE"), nullable=False)
    base_curve: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)   # 2.00, 4.00, 6.00
    addition: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)     # 0.00, 1.00 ... 3.00
    eye_side: Mapped[str] = mapped_column(String(10), default="AMBOS", nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_stock: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    barcode: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    location_tag: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    block_model: Mapped["BlockModel"] = relationship("BlockModel", back_populates="grid_items")

    __table_args__ = (
        UniqueConstraint('block_model_id', 'base_curve', 'addition', 'eye_side', name='_block_grid_uc'),
        Index("idx_block_dioptria", "block_model_id", "base_curve", "addition"),
        Index("idx_block_barcode", "barcode"),
    )
