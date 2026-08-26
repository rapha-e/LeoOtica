import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, Index, Uuid, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class MatrixType(str, enum.Enum):
    LP_GRADE = "LP_GRADE"
    MF_ACB = "MF_ACB"
    GRADE_167 = "GRADE_167"
    BLOCO_VS = "BLOCO_VS"
    MF_BLOCO = "MF_BLOCO"

class ProductionRoute(str, enum.Enum):
    EXPRESSA_FACETAMENTO = "EXPRESSA_FACETAMENTO"
    SURFACAGEM_CNC = "SURFACAGEM_CNC"

class LensModel(Base):
    __tablename__ = "lens_models"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    material: Mapped[str] = mapped_column(String(50), nullable=False)
    refractive_index: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    treatment: Mapped[str] = mapped_column(String(100), nullable=False)
    diameter: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    matrix_type: Mapped[str] = mapped_column(String(50), default="LP_GRADE", nullable=False)
    production_route: Mapped[str] = mapped_column(String(50), default="EXPRESSA_FACETAMENTO", nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("25.00"), nullable=False)
    average_cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("25.00"), nullable=False)
    last_purchase_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("25.00"), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("75.00"), nullable=False)
    degree_threshold: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("2.00"), nullable=False)
    sale_price_over_threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("95.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relacionamento com as dioptrias em estoque
    inventory_items: Mapped[List["LensInventoryGrade"]] = relationship(
        "LensInventoryGrade", 
        back_populates="lens_model",
        cascade="all, delete-orphan"
    )
    pricing_policies: Mapped[List["DegreePricingPolicyRange"]] = relationship(
        "DegreePricingPolicyRange",
        back_populates="lens_model",
        cascade="all, delete-orphan"
    )

    def get_sale_price_for_diopter(self, spherical: Decimal, cylindrical: Decimal) -> Decimal:
        """
        Calcula o preço de venda da lente com a regra por dioptria:
        - Transposição de Cilíndrico Positivo para Negativo caso necessário.
        - Esférico de 0 até 4.00 e Cilíndrico de 0 até degree_threshold: sale_price (Base)
        - Cilíndrico acima de degree_threshold ou Esférico > 4.00: sale_price_over_threshold
        """
        sph = Decimal(str(spherical or "0.00"))
        cyl = Decimal(str(cylindrical or "0.00"))

        if cyl > Decimal("0.00"):
            sph = sph + cyl
            cyl = -cyl

        abs_sph = abs(sph)
        abs_cyl = abs(cyl)
        
        thresh = self.degree_threshold if self.degree_threshold is not None else Decimal("2.00")
        
        if abs_sph <= Decimal("4.00") and abs_cyl <= thresh:
            return self.sale_price
        return self.sale_price_over_threshold if self.sale_price_over_threshold is not None else self.sale_price

class LensInventoryGrade(Base):
    __tablename__ = "lens_inventory_grade"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lens_model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lens_models.id", ondelete="CASCADE"), nullable=False)
    spherical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    cylindrical: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    base_curve: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    addition: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2), nullable=True)
    eye: Mapped[Optional[str]] = mapped_column(String(10), nullable=True) # 'OD', 'OE', 'AMB'
    barcode: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    quantity_available: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    last_purchase_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
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

    @property
    def quantity(self) -> int:
        return self.quantity_available

    @property
    def quantity_reserved(self) -> int:
        return self.reserved_quantity or 0

    @quantity_reserved.setter
    def quantity_reserved(self, value: int):
        self.reserved_quantity = value

    __table_args__ = (
        Index("idx_lens_barcode", "barcode"),
        Index("idx_lens_dioptria", "lens_model_id", "spherical", "cylindrical"),
    )

class DegreePricingPolicyRange(Base):
    __tablename__ = "degree_pricing_policy_ranges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lens_model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lens_models.id", ondelete="CASCADE"), nullable=False)
    
    min_spherical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    max_spherical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    min_cylindrical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    max_cylindrical: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    lens_model: Mapped["LensModel"] = relationship("LensModel", back_populates="pricing_policies")


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

