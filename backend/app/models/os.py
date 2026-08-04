import uuid
import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Index, Uuid, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, SafeVector

class OSStatus(str, enum.Enum):
    RECEBIDA = "Recebida"
    TRIAGEM = "Triagem"
    SEPARACAO = "Separação"
    SURFACAGEM = "Surfaçagem"
    PRODUCAO = "Produção"
    INSP_BRUTA = "Inspeção Bruta"
    TINGIMENTO = "Tingimento"
    ENDURECIMENTO = "Endurecimento"
    INSP_POS = "Inspeção Pós-Tratamento"
    FACETAMENTO = "Facetamento"
    INSP_FACETA = "Inspeção de Faceta"
    MONTAGEM = "Montagem"
    CQ_FINAL = "CQ Final"
    CQ = "CQ"
    EMBALAGEM = "Embalagem"
    EXPEDICAO = "Expedição"
    CONCLUIDA = "Concluída"
    ENTREGUE = "Entregue"
    CANCELADA = "Cancelada"
    AGUARDANDO_LIBERACAO = "Aguardando Liberação Financeira"
    BLOQUEADA_FINANCEIRO = "Bloqueada por Inadimplência"
    LIBERADA_FINANCEIRO = "Liberada Financeiramente"


class ServiceOrder(Base):
    __tablename__ = "service_orders"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    os_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    client_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), 
        default="Recebida", 
        nullable=False
    )
    os_type: Mapped[str] = mapped_column(String(30), default="PADRAO", nullable=False) # 'PADRAO' ou 'REPARO_SERVICO'



    
    # Dados da Receita (Olho Direito)
    od_spherical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    od_cylindrical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    od_axis: Mapped[Optional[int]] = mapped_column(Numeric, nullable=True)
    od_addition: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    od_dnp: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    od_prism: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    od_height: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    
    # Dados da Receita (Olho Esquerdo)
    oe_spherical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    oe_cylindrical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    oe_axis: Mapped[Optional[int]] = mapped_column(Numeric, nullable=True)
    oe_addition: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    oe_dnp: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    oe_prism: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    oe_height: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    
    # Medidas de Armação
    frame_a: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    frame_bridge: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    frame_ed: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    
    # Lentes alocadas do estoque físico (Módulo 1)
    od_lens_inventory_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("lens_inventory_grade.id", ondelete="SET NULL"), nullable=True
    )
    oe_lens_inventory_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("lens_inventory_grade.id", ondelete="SET NULL"), nullable=True
    )
    
    # Origem do pedido (Módulo 4 lojistas)
    partner_shop_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("partner_shops.id", ondelete="SET NULL"), nullable=True
    )
    
    # Vínculo comercial da fábrica para Faturamento (Sprint 4)
    optical_store_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("optical_stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    # Total de Faturamento Acumulado (Lente + Tratamentos + Serviços)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    
    doctor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    clinical_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    clinical_embedding: Mapped[Optional[List[float]]] = mapped_column(SafeVector, nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_rework: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Histórico e Auditoria de Restrição Financeira
    financial_validation_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    financial_policy_applied: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    financial_overdue_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    financial_overdue_count: Mapped[Optional[int]] = mapped_column(Numeric, nullable=True)
    financial_max_overdue_days: Mapped[Optional[int]] = mapped_column(Numeric, nullable=True)
    financial_authorized_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    financial_authorized_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    financial_authorization_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    
    # Relacionamentos
    od_lens_inventory: Mapped[Optional["LensInventoryGrade"]] = relationship(
        "LensInventoryGrade", foreign_keys=[od_lens_inventory_id]
    )
    oe_lens_inventory: Mapped[Optional["LensInventoryGrade"]] = relationship(
        "LensInventoryGrade", foreign_keys=[oe_lens_inventory_id]
    )
    partner_shop: Mapped[Optional["PartnerShop"]] = relationship(
        "PartnerShop", back_populates="service_orders"
    )
    optical_store: Mapped[Optional["OpticalStore"]] = relationship(
        "OpticalStore"
    )
    
    workflow_history: Mapped[List["OSWorkflowHistory"]] = relationship(
        "OSWorkflowHistory", back_populates="service_order", cascade="all, delete-orphan"
    )
    
    items: Mapped[List["ServiceOrderItem"]] = relationship(
        "ServiceOrderItem", back_populates="service_order", cascade="all, delete-orphan"
    )
    
    cq_inspections: Mapped[List["OSCQInspection"]] = relationship(
        "OSCQInspection", back_populates="service_order", cascade="all, delete-orphan", order_by="OSCQInspection.created_at.asc()"
    )
    
    billing_item: Mapped[Optional["BillingItem"]] = relationship(
        "BillingItem", back_populates="service_order", uselist=False
    )

    __table_args__ = (
        Index("idx_os_number", "os_number"),
        Index("idx_os_status", "status"),
        Index("idx_partner_shop", "partner_shop_id"),
    )

class OSWorkflowHistory(Base):
    __tablename__ = "os_workflow_history"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service_order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False
    )
    previous_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)

    operator_notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sector: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Relacionamentos
    service_order: Mapped["ServiceOrder"] = relationship("ServiceOrder", back_populates="workflow_history")
    operator: Mapped[Optional["User"]] = relationship("User")

class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'product', 'treatment', 'service'
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    custom_price_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    original_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    price_override_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relacionamentos
    service_order: Mapped[ServiceOrder] = relationship(ServiceOrder, back_populates="items")

class OSCQInspection(Base):
    __tablename__ = "os_cq_inspections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    operator_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    # Checklist
    check_grau: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_eixo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_prisma: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_acabamento: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Resultado (Aprovado, Retrabalho, Reprovado)
    result: Mapped[str] = mapped_column(String(50), nullable=False) # 'APROVADO', 'RETRABALHO', 'REPROVADO'
    
    # Destino para Retrabalho (opcional, ex: 'Produção' ou 'Montagem')
    rework_destination: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    service_order: Mapped["ServiceOrder"] = relationship("ServiceOrder", back_populates="cq_inspections")
    operator: Mapped["User"] = relationship("User")


class MESStageLog(Base):
    __tablename__ = "mes_stage_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Numeric, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relacionamentos
    service_order: Mapped["ServiceOrder"] = relationship("ServiceOrder")
    operator: Mapped[Optional["User"]] = relationship("User")

