import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class CommercialOrder(Base):
    __tablename__ = "commercial_orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("optical_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    client_name: Mapped[Optional[str]] = mapped_column(String(150), default="Cliente Consumidor")
    doctor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    frame_type: Mapped[Optional[str]] = mapped_column(String(50), default="METAL")
    payment_terms: Mapped[Optional[str]] = mapped_column(String(50), default="A_VISTA")

    # Dioptrias Olho Direito
    od_spherical: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    od_cylindrical: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    od_axis: Mapped[int] = mapped_column(Integer, default=0)
    od_addition: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    od_dnp: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("30.00"))
    od_height: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("18.00"))

    # Dioptrias Olho Esquerdo
    oe_spherical: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    oe_cylindrical: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    oe_axis: Mapped[int] = mapped_column(Integer, default=0)
    oe_addition: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    oe_dnp: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("30.00"))
    oe_height: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("18.00"))

    # Status e Valores
    status: Mapped[str] = mapped_column(String(50), default="PENDENTE_APROVACAO", nullable=False, index=True)
    financial_hold_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relacionamentos
    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore")
    items: Mapped[List["CommercialOrderItem"]] = relationship("CommercialOrderItem", back_populates="order", cascade="all, delete-orphan")

class CommercialOrderItem(Base):
    __tablename__ = "commercial_order_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("commercial_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    order: Mapped["CommercialOrder"] = relationship("CommercialOrder", back_populates="items")
