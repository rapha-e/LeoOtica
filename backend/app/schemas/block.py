import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class BlockModelBase(BaseModel):
    brand: str
    name: str
    material: str = "CR-39"
    refractive_index: float = 1.56
    cost_price: float = 35.00
    sale_price: float = 95.00
    is_active: bool = True
    base_curves_config: Optional[str] = "2.00, 4.00, 6.00"
    additions_config: Optional[str] = "1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"

class BlockModelCreate(BlockModelBase):
    initial_quantity: Optional[int] = 0

class BlockModelUpdate(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    material: Optional[str] = None
    refractive_index: Optional[float] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    is_active: Optional[bool] = None
    base_curves_config: Optional[str] = None
    additions_config: Optional[str] = None

class BlockGridItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    block_model_id: uuid.UUID
    base_curve: float
    addition: float
    eye_side: str
    quantity_available: int
    quantity_reserved: int
    min_stock: int
    barcode: Optional[str] = None
    location_tag: Optional[str] = None
    updated_at: Optional[datetime] = None

class BlockModelResponse(BlockModelBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    grid_items: Optional[List[BlockGridItemResponse]] = None

class BlockGridItemUpdate(BaseModel):
    quantity_available: Optional[int] = None
    min_stock: Optional[int] = None
    barcode: Optional[str] = None
    location_tag: Optional[str] = None

class BlockBipIncrementRequest(BaseModel):
    barcode: str
    quantity: int = 1
