import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class CostCenter(Base):
    __tablename__ = "cost_centers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

class FinancialCategory(Base):
    __tablename__ = "financial_categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False) # 'RECEITA', 'DESPESA'
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

class AccountsPayable(Base):
    __tablename__ = "accounts_payable"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(150), nullable=False)
    document_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDENTE", nullable=False) # 'PENDENTE', 'PAGO_PARCIAL', 'PAGO', 'CANCELADO'
    
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("financial_categories.id", ondelete="SET NULL"), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True)
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    category: Mapped[Optional["FinancialCategory"]] = relationship("FinancialCategory")
    cost_center: Mapped[Optional["CostCenter"]] = relationship("CostCenter")

class AccountsReceivable(Base):
    __tablename__ = "accounts_receivable"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    billing_cycle_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("billing_cycles.id", ondelete="SET NULL"), nullable=True, index=True)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("optical_stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amount_received: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDENTE", nullable=False) # 'PENDENTE', 'RECEBIDO_PARCIAL', 'RECEBIDO', 'ATRASADO', 'CANCELADO'
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore")
    billing_cycle: Mapped[Optional["BillingCycle"]] = relationship("BillingCycle")


class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(20), nullable=False) # 'RECEITA', 'DESPESA'
    category: Mapped[str] = mapped_column(String(100), default="OUTROS", nullable=False) # 'FOLHA', 'FORNECEDOR', 'OPERACIONAL', 'FATURAMENTO', 'OUTROS'
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    accounts_payable_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("accounts_payable.id", ondelete="SET NULL"), nullable=True, index=True)
    accounts_receivable_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("accounts_receivable.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    accounts_payable: Mapped[Optional["AccountsPayable"]] = relationship("AccountsPayable")
    accounts_receivable: Mapped[Optional["AccountsReceivable"]] = relationship("AccountsReceivable")

