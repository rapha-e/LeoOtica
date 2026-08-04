import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Boolean, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, SafeVector

class PartnerShop(Base):
    __tablename__ = "partner_shops"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    corporate_name: Mapped[str] = mapped_column(String(200), nullable=False)
    trade_name: Mapped[str] = mapped_column(String(150), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(18), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    visagism_sessions: Mapped[List["FaceVisagismSession"]] = relationship(
        "FaceVisagismSession", back_populates="partner_shop", cascade="all, delete-orphan"
    )
    service_orders: Mapped[List["ServiceOrder"]] = relationship(
        "ServiceOrder", back_populates="partner_shop"
    )
    api_keys: Mapped[List["PartnerApiKey"]] = relationship(
        "PartnerApiKey", back_populates="partner_shop", cascade="all, delete-orphan"
    )

class PartnerApiKey(Base):
    __tablename__ = "partner_api_keys"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    partner_shop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("partner_shops.id", ondelete="CASCADE"), nullable=False
    )
    key_prefix: Mapped[str] = mapped_column(String(8), nullable=False) # Ex: LO-A8F2
    hashed_secret: Mapped[str] = mapped_column(String(64), nullable=False) # SHA-256 do Secret
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relacionamentos
    partner_shop: Mapped["PartnerShop"] = relationship("PartnerShop", back_populates="api_keys")

    __table_args__ = (
        Index("idx_partner_key_prefix", "key_prefix"),
    )

class FaceVisagismSession(Base):
    __tablename__ = "face_visagism_sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    partner_shop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("partner_shops.id", ondelete="CASCADE"), nullable=False
    )
    face_shape_detected: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    recommended_frame_types: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    spherical_context_od: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    spherical_context_oe: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    face_embedding: Mapped[Optional[List[float]]] = mapped_column(SafeVector, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    partner_shop: Mapped["PartnerShop"] = relationship("PartnerShop", back_populates="visagism_sessions")

