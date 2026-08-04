import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class LensModel(Base):
    __tablename__ = "lens_models"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    material: Mapped[str] = mapped_column(String(50), nullable=False)
    refractive_index: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    treatment: Mapped[str] = mapped_column(String(100), nullable=False)
    diameter: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("25.00"), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("75.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamento com as dioptrias em estoque
    inventory_items: Mapped[List["LensInventoryGrade"]] = relationship(
        "LensInventoryGrade", 
        back_populates="lens_model",
        cascade="all, delete-orphan"
    )

class LensInventoryGrade(Base):
    __tablename__ = "lens_inventory_grade"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lens_model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lens_models.id", ondelete="CASCADE"), nullable=False)
    spherical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    cylindrical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    barcode: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    quantity_available: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    location_tag: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    batch_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    expiration_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    lens_model: Mapped["LensModel"] = relationship("LensModel", back_populates="inventory_items")
    movements: Mapped[List["StockMovement"]] = relationship(
        "StockMovement",
        back_populates="lens_inventory",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_lens_barcode", "barcode"),
        Index("idx_lens_dioptria", "lens_model_id", "spherical", "cylindrical"),
    )


class BlindInventorySession(Base):
    __tablename__ = "blind_inventory_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    operator_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    location_tag: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ABERTO", nullable=False) # ABERTO, CONCLUIDO, CANCELADO
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_items_counted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_divergences: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relacionamentos
    items: Mapped[List["BlindInventoryItem"]] = relationship("BlindInventoryItem", back_populates="session", cascade="all, delete-orphan")
    operator: Mapped[Optional["User"]] = relationship("User")


class BlindInventoryItem(Base):
    __tablename__ = "blind_inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("blind_inventory_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    lens_inventory_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("lens_inventory_grade.id", ondelete="CASCADE"), nullable=False, index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    system_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    counted_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    difference: Mapped[int] = mapped_column(Integer, nullable=False)
    counted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    session: Mapped["BlindInventorySession"] = relationship("BlindInventorySession", back_populates="items")
    lens_inventory: Mapped["LensInventoryGrade"] = relationship("LensInventoryGrade")

