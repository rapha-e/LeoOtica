import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

# --- LENS MODEL SCHEMAS ---

class LensModelBase(BaseModel):
    brand: str = Field(..., max_length=100, description="Ex: Essilor, Hoya, Marca Própria")
    material: str = Field(..., max_length=50, description="Ex: Resina, Policarbonato, Trivex")
    refractive_index: Decimal = Field(..., max_digits=3, decimal_places=2, description="Ex: 1.56, 1.61, 1.67")
    treatment: str = Field(..., max_length=100, description="Ex: Incolor, Antirreflexo HMC, Filtro Azul")
    diameter: int = Field(..., ge=0, description="Diâmetro da lente em milímetros")
    cost_price: Decimal = Field(Decimal("25.00"), max_digits=10, decimal_places=2, description="Preço de custo da lente")
    sale_price: Decimal = Field(Decimal("75.00"), max_digits=10, decimal_places=2, description="Preço de venda sugerido da lente")

class LensModelCreate(LensModelBase):
    pass

class LensModelUpdate(BaseModel):
    brand: Optional[str] = Field(None, max_length=100)
    material: Optional[str] = Field(None, max_length=50)
    refractive_index: Optional[Decimal] = Field(None)
    treatment: Optional[str] = Field(None, max_length=100)
    diameter: Optional[int] = Field(None, ge=0)
    cost_price: Optional[Decimal] = Field(None)
    sale_price: Optional[Decimal] = Field(None)

class LensModelResponse(LensModelBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- LENS INVENTORY GRADE SCHEMAS ---

class LensInventoryGradeBase(BaseModel):
    spherical: Decimal = Field(..., max_digits=4, decimal_places=2, description="Grau Esférico (ex: -4.00, +2.25)")
    cylindrical: Decimal = Field(..., max_digits=4, decimal_places=2, description="Grau Cilíndrico (ex: -1.50, 0.00)")
    barcode: Optional[str] = Field(None, max_length=50, description="Código de barras exclusivo")
    quantity_available: int = Field(0, ge=0, description="Quantidade real física em estoque")
    location_tag: Optional[str] = Field(None, max_length=50, description="Localização física (ex: 'GAVETA-B3-L2')")

class LensInventoryGradeCreate(LensInventoryGradeBase):
    lens_model_id: uuid.UUID

class LensInventoryGradeUpdate(BaseModel):
    quantity_available: Optional[int] = Field(None, ge=0)
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
    cost_price: Optional[Decimal] = Field(None)
    
    # Atributos da Dioptria/Grade
    spherical: Decimal = Field(..., max_digits=4, decimal_places=2)
    cylindrical: Decimal = Field(..., max_digits=4, decimal_places=2)
    barcode: str = Field(..., max_length=50)
    location_tag: Optional[str] = Field(None, max_length=50)
    quantity_available: int = Field(1, ge=0)
