import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey, Uuid, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class Product(Base):
    __tablename__ = "products"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    cost_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    sale_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Especificações físicas de lente (opcionais para unificação)
    is_lens: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    material: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    refractive_index: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    treatment: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    diameter: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lens_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("lens_models.id", ondelete="SET NULL"), nullable=True)
    
    # Relacionamento com o estoque físico
    lens_model: Mapped[Optional["LensModel"]] = relationship("LensModel")

class Treatment(Base):
    __tablename__ = "treatments"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class TechnicalService(Base):
    __tablename__ = "technical_services"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class PriceHistory(Base):
    __tablename__ = "price_history"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'product', 'treatment', 'service'
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True) # Apenas para produtos
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    changed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    change_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relacionamento com Usuário que fez a alteração
    changed_by: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("idx_price_history_entity", "entity_type", "entity_id"),
    )
