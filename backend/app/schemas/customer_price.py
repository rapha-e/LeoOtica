import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.optical_store import OpticalStoreResponse

# --- Itens de Preço na Tabela ---
class CustomerPriceItemBase(BaseModel):
    entity_type: str # 'product', 'treatment', 'service'
    entity_id: uuid.UUID
    custom_price: float

class CustomerPriceItemCreate(CustomerPriceItemBase):
    pass

class CustomerPriceItemUpdate(BaseModel):
    custom_price: float

class CustomerPriceItemResponse(CustomerPriceItemBase):
    id: uuid.UUID
    price_table_id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Tabela de Preços do Cliente ---
class CustomerPriceTableBase(BaseModel):
    name: str
    optical_store_id: uuid.UUID
    discount_percent: float = 0.00
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = True

class CustomerPriceTableCreate(CustomerPriceTableBase):
    pass

class CustomerPriceTableUpdate(BaseModel):
    name: Optional[str] = None
    optical_store_id: Optional[uuid.UUID] = None
    discount_percent: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class CustomerPriceTableResponse(CustomerPriceTableBase):
    id: uuid.UUID
    created_at: datetime
    optical_store: Optional[OpticalStoreResponse] = None
    items: List[CustomerPriceItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# --- Payload de Cálculo/Simulação ---
class PriceCalculationRequest(BaseModel):
    optical_store_id: uuid.UUID
    entity_type: str # 'product', 'treatment', 'service'
    entity_id: uuid.UUID

class PriceCalculationResponse(BaseModel):
    optical_store_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    original_price: float
    calculated_price: float
    rule_applied: str # 'default_catalog_price', 'specific_customer_price', 'customer_general_discount'
    price_table_id: Optional[uuid.UUID] = None
    discount_applied: float = 0.00
