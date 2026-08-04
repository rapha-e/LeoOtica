import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Uuid, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class OpticalStore(Base):
    __tablename__ = "optical_stores"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    corporate_name: Mapped[str] = mapped_column(String(200), nullable=False)
    trade_name: Mapped[str] = mapped_column(String(150), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(18), unique=True, nullable=False, index=True)
    ie: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    telephone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Campos do CRM (Fase 3)
    credit_limit: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    sales_representative: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rep_whatsapp: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    pipeline_stage: Mapped[str] = mapped_column(String(50), default="ATIVO", nullable=False) # LEAD, CONTATO, PROPOSTA, NEGOCIACAO, ATIVO, INATIVO
    price_table_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("customer_price_tables.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Agendamento CRM (Próxima ação/visita)
    next_contact_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_contact_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # VISITA, LIGAÇÃO, REUNIÃO
    next_contact_notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relacionamentos
    interactions: Mapped[List["StoreInteraction"]] = relationship("StoreInteraction", back_populates="optical_store", cascade="all, delete-orphan", order_by="StoreInteraction.created_at.desc()")
    documents: Mapped[List["StoreDocument"]] = relationship("StoreDocument", back_populates="optical_store", cascade="all, delete-orphan", order_by="StoreDocument.created_at.desc()")
    price_table: Mapped[Optional["CustomerPriceTable"]] = relationship("CustomerPriceTable", foreign_keys=[price_table_id])

    @property
    def fantasy_name(self) -> str:
        return self.trade_name


class StoreInteraction(Base):
    __tablename__ = "store_interactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("optical_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    operator_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    interaction_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'LIGAÇÃO', 'VISITA', 'WHATSAPP', 'EMAIL', 'REUNIÃO'
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore", back_populates="interactions")
    operator: Mapped[Optional["User"]] = relationship("User")


class StoreDocument(Base):
    __tablename__ = "store_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("optical_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False) # CNPJ, IE, ALVARÁ, CONTRATO, OUTRO
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    contract_expiration: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore", back_populates="documents")



