import uuid
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Text, Uuid, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class SupplierOrder(Base):
    __tablename__ = "supplier_orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="RASCUNHO", nullable=False) # 'RASCUNHO', 'ENVIADO', 'RECEBIDO', 'CANCELADO'
    
    total_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    total_estimated_resale: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    gross_margin_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    gross_margin_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relacionamentos
    items: Mapped[List["SupplierOrderItem"]] = relationship("SupplierOrderItem", back_populates="supplier_order", cascade="all, delete-orphan")


class SupplierOrderItem(Base):
    __tablename__ = "supplier_order_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    supplier_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("supplier_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    lens_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("lens_models.id", ondelete="SET NULL"), nullable=True)
    
    model_name: Mapped[str] = mapped_column(String(150), nullable=False)
    dioptria: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # Ex: Sph -2.00 / Cyl -1.00
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    unit_cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    total_cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    unit_resale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    total_resale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamento com Pedido de Fornecedor e Modelo de Lente
    supplier_order: Mapped["SupplierOrder"] = relationship("SupplierOrder", back_populates="items")
    lens_model: Mapped[Optional["LensModel"]] = relationship("LensModel")
