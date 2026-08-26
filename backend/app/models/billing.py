import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base
from backend.app.models.nfe import NfeSaida

class BillingCycle(Base):
    __tablename__ = "billing_cycles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("optical_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="FECHADO", nullable=False) # 'FECHADO', 'PAGO'
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relacionamentos
    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore")
    items: Mapped[List["BillingItem"]] = relationship("BillingItem", back_populates="billing_cycle", cascade="all, delete-orphan")
    nfe_saida: Mapped[Optional["NfeSaida"]] = relationship("NfeSaida", back_populates="billing_cycle", uselist=False, cascade="all, delete-orphan")

    @property
    def optical_store_name(self) -> Optional[str]:
        return self.optical_store.trade_name if self.optical_store else None

    @property
    def is_overdue(self) -> bool:
        if self.status in ["PAGO", "Pago"] or not self.due_date:
            return False
        from datetime import datetime, timezone
        now_utc = datetime.now(timezone.utc)
        due = self.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        return due < now_utc

class BillingItem(Base):
    __tablename__ = "billing_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    billing_cycle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("billing_cycles.id", ondelete="CASCADE"), nullable=False, index=True)
    service_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("service_orders.id", ondelete="RESTRICT"), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    billing_cycle: Mapped["BillingCycle"] = relationship("BillingCycle", back_populates="items")
    service_order: Mapped["ServiceOrder"] = relationship("ServiceOrder", back_populates="billing_item")

    @property
    def os_number(self) -> Optional[str]:
        return self.service_order.os_number if self.service_order else None

    @property
    def client_name(self) -> Optional[str]:
        return self.service_order.client_name if self.service_order else None
