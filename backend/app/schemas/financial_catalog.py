import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.user import UserResponse

# --- Histórico de Preços ---
class PriceHistoryResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    price: float
    cost_price: Optional[float] = None
    version: int
    start_date: datetime
    end_date: Optional[datetime] = None
    changed_by_id: Optional[uuid.UUID] = None
    changed_by: Optional[UserResponse] = None
    change_reason: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Produto ---
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: str
    cost_price: float
    sale_price: float
    is_active: Optional[bool] = True
    is_lens: Optional[bool] = False
    brand: Optional[str] = None
    material: Optional[str] = None
    refractive_index: Optional[float] = None
    treatment: Optional[str] = None
    diameter: Optional[int] = None
    lens_model_id: Optional[uuid.UUID] = None
    matrix_type: Optional[str] = None
    quantity: Optional[int] = 1
    eye_side: Optional[str] = None
    base_curve: Optional[float] = None
    addition: Optional[float] = None
    spherical: Optional[float] = None
    cylindrical: Optional[float] = None

class ProductCreate(ProductBase):
    change_reason: Optional[str] = "Cadastro inicial do produto"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    is_active: Optional[bool] = None
    change_reason: Optional[str] = None # Motivo se o preço mudar
    is_lens: Optional[bool] = None
    brand: Optional[str] = None
    material: Optional[str] = None
    refractive_index: Optional[float] = None
    treatment: Optional[str] = None
    diameter: Optional[int] = None
    lens_model_id: Optional[uuid.UUID] = None
    matrix_type: Optional[str] = None
    quantity: Optional[int] = None
    eye_side: Optional[str] = None
    base_curve: Optional[float] = None
    addition: Optional[float] = None
    spherical: Optional[float] = None
    cylindrical: Optional[float] = None

class ProductResponse(ProductBase):
    id: uuid.UUID
    current_version: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Tratamento ---
class TreatmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    is_active: Optional[bool] = True

class TreatmentCreate(TreatmentBase):
    change_reason: Optional[str] = "Cadastro inicial do tratamento"

class TreatmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None
    change_reason: Optional[str] = None # Motivo se o preço mudar

class TreatmentResponse(TreatmentBase):
    id: uuid.UUID
    current_version: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Serviço Técnico ---
class TechnicalServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    is_active: Optional[bool] = True

class TechnicalServiceCreate(TechnicalServiceBase):
    change_reason: Optional[str] = "Cadastro inicial do serviço técnico"

class TechnicalServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None
    change_reason: Optional[str] = None # Motivo se o preço mudar

class TechnicalServiceResponse(TechnicalServiceBase):
    id: uuid.UUID
    current_version: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
