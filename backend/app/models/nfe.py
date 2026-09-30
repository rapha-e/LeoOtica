import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Uuid, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class NfeSaida(Base):
    __tablename__ = "nfe_saida"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    billing_cycle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("billing_cycles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    nfe_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    serie: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    chave_acesso: Mapped[str] = mapped_column(String(44), nullable=False, unique=True)
    xml_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="EMITIDA", nullable=False)  # 'EMITIDA', 'AUTORIZADA', 'PROCESSANDO', 'REJEITADA', 'CANCELADA'
    focus_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    protocolo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    danfe_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    xml_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    mensagem_sefaz: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    emitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamento de volta para o ciclo
    billing_cycle: Mapped["BillingCycle"] = relationship("BillingCycle", back_populates="nfe_saida")
