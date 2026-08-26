import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator

# --- LENS MODEL SCHEMAS ---

# --- LENS MODEL SCHEMAS ---

class LensModelBase(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=150)
    brand: str = Field(..., max_length=100, description="Ex: Essilor, Hoya, Marca Própria")
    material: str = Field(..., max_length=50, description="Ex: Resina, Policarbonato, Trivex")
    refractive_index: Decimal = Field(..., description="Ex: 1.56, 1.61, 1.67")
    treatment: str = Field(..., max_length=100, description="Ex: Incolor, Antirreflexo HMC, Filtro Azul")
    diameter: int = Field(..., ge=0, description="Diâmetro da lente em milímetros")
    matrix_type: Optional[str] = Field("LP_GRADE", max_length=50)
    production_route: Optional[str] = Field("EXPRESSA_FACETAMENTO", max_length=50)
    cost_price: Decimal = Field(Decimal("25.00"), description="Preço de custo da lente")
    average_cost_price: Optional[Decimal] = Field(Decimal("25.00"), description="Custo Médio Ponderado (CMP)")
    last_purchase_price: Optional[Decimal] = Field(Decimal("25.00"), description="Último preço de compra")
    sale_price: Decimal = Field(Decimal("75.00"), description="Preço de venda (Até Grau Limite)")
    degree_threshold: Decimal = Field(Decimal("2.00"), description="Grau limite de corte (ex: 2.00)")
    sale_price_over_threshold: Decimal = Field(Decimal("95.00"), description="Preço de venda (Acima do Grau Limite)")

class LensModelCreate(LensModelBase):
    pass

class LensModelUpdate(BaseModel):
    brand: Optional[str] = Field(None, max_length=100)
    material: Optional[str] = Field(None, max_length=50)
    refractive_index: Optional[Decimal] = Field(None)
    treatment: Optional[str] = Field(None, max_length=100)
    diameter: Optional[int] = Field(None, ge=0)
    matrix_type: Optional[str] = Field(None, max_length=50)
    production_route: Optional[str] = Field(None, max_length=50)
    cost_price: Optional[Decimal] = Field(None)
    average_cost_price: Optional[Decimal] = Field(None)
    last_purchase_price: Optional[Decimal] = Field(None)
    sale_price: Optional[Decimal] = Field(None)
    degree_threshold: Optional[Decimal] = Field(None)
    sale_price_over_threshold: Optional[Decimal] = Field(None)

class LensModelResponse(LensModelBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- LENS INVENTORY GRADE SCHEMAS ---

class LensInventoryGradeBase(BaseModel):
    spherical: Optional[Decimal] = Field(Decimal("0.00"), description="Grau Esférico (ex: -4.00, +2.25)")
    cylindrical: Optional[Decimal] = Field(Decimal("0.00"), description="Grau Cilíndrico (ex: -1.50, 0.00)")
    base_curve: Optional[Decimal] = Field(None)
    addition: Optional[Decimal] = Field(None)
    eye: Optional[str] = Field(None, max_length=10)
    barcode: Optional[str] = Field(None, max_length=50, description="Código de barras exclusivo")
    quantity_available: int = Field(0, ge=0, description="Quantidade real física em estoque")
    reserved_quantity: int = Field(0, ge=0, description="Quantidade reservada em OS")
    quantity_reserved: int = Field(0, ge=0, description="Quantidade reservada em OS")
    average_cost_price: Optional[Decimal] = Field(None, description="Custo Médio Ponderado (CMP)")
    last_purchase_price: Optional[Decimal] = Field(None, description="Último preço de compra")
    location_tag: Optional[str] = Field(None, max_length=50, description="Localização física (ex: 'GAVETA-B3-L2')")

class LensInventoryGradeCreate(LensInventoryGradeBase):
    lens_model_id: uuid.UUID

class LensInventoryGradeUpdate(BaseModel):
    quantity_available: Optional[int] = Field(None, ge=0)
    reserved_quantity: Optional[int] = Field(None, ge=0)
    quantity_reserved: Optional[int] = Field(None, ge=0)
    average_cost_price: Optional[Decimal] = Field(None)
    last_purchase_price: Optional[Decimal] = Field(None)
    location_tag: Optional[str] = Field(None, max_length=50)
    barcode: Optional[str] = Field(None, max_length=50)

class LensInventoryGradeResponse(LensInventoryGradeBase):
    id: uuid.UUID
    lens_model_id: uuid.UUID
    updated_at: datetime
    lens_model: Optional[LensModelResponse] = None

    model_config = ConfigDict(from_attributes=True)

# --- SCANNERS & FALLBACKS ---

class ScanRequest(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=50)
    quantity: Optional[int] = Field(1, ge=1, description="Quantidade a incrementar se o código for localizado")
    quantity_available: Optional[int] = Field(None, ge=1)

    @model_validator(mode="after")
    def sync_scan_quantity(self) -> "ScanRequest":
        qty = 1
        if self.quantity is not None and self.quantity_available is not None:
            qty = max(self.quantity, self.quantity_available)
        elif self.quantity is not None:
            qty = self.quantity
        elif self.quantity_available is not None:
            qty = self.quantity_available

        self.quantity = qty
        return self

class ScanResponse(BaseModel):
    found: bool
    message: str
    item: Optional[LensInventoryGradeResponse] = None

class RegisterFallbackRequest(BaseModel):
    # Atributos do Modelo de Lente (ou id se já existir)
    lens_model_id: Optional[uuid.UUID] = None
    brand: Optional[str] = Field(None, max_length=100)
    material: Optional[str] = Field(None, max_length=50)
    refractive_index: Optional[Decimal] = Field(None)
    treatment: Optional[str] = Field(None, max_length=100)
    diameter: Optional[int] = Field(None, ge=0)
    matrix_type: Optional[str] = Field(None, max_length=50)
    production_route: Optional[str] = Field(None, max_length=50)
    cost_price: Optional[Decimal] = Field(None)
    average_cost_price: Optional[Decimal] = Field(None)
    last_purchase_price: Optional[Decimal] = Field(None)
    sale_price: Optional[Decimal] = Field(None)
    degree_threshold: Optional[Decimal] = Field(None)
    sale_price_over_threshold: Optional[Decimal] = Field(None)
    
    # Atributos da Dioptria/Grade
    spherical: Optional[Decimal] = Field(Decimal("0.00"))
    cylindrical: Optional[Decimal] = Field(Decimal("0.00"))
    base_curve: Optional[Decimal] = Field(None)
    addition: Optional[Decimal] = Field(None)
    eye: Optional[str] = Field(None, max_length=10)
    barcode: str = Field(..., max_length=50)
    location_tag: Optional[str] = Field(None, max_length=50)
    quantity_available: Optional[int] = Field(1, ge=0)
    quantity: Optional[int] = Field(None, ge=0)

    @model_validator(mode="after")
    def sync_quantity_fields(self) -> "RegisterFallbackRequest":
        qty = 1
        if self.quantity is not None and self.quantity_available is not None:
            qty = max(self.quantity, self.quantity_available)
        elif self.quantity is not None:
            qty = self.quantity
        elif self.quantity_available is not None:
            qty = self.quantity_available

        self.quantity = qty
        self.quantity_available = qty
        return self
