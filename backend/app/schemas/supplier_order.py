import uuid
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field

class SupplierOrderItemCreate(BaseModel):
    lens_model_id: Optional[uuid.UUID] = None
    model_name: str
    dioptria: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit_cost_price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    unit_resale_price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))

class SupplierOrderItemResponse(BaseModel):
    id: uuid.UUID
    supplier_order_id: uuid.UUID
    lens_model_id: Optional[uuid.UUID] = None
    model_name: str
    dioptria: Optional[str] = None
    quantity: int
    unit_cost_price: Decimal
    total_cost_price: Decimal
    unit_resale_price: Decimal
    total_resale_price: Decimal
    created_at: datetime

    class Config:
        from_attributes = True

class SupplierOrderCreate(BaseModel):
    supplier_name: str
    notes: Optional[str] = None
    items: List[SupplierOrderItemCreate] = []

class SupplierOrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    supplier_name: str
    status: str
    total_cost: Decimal
    total_estimated_resale: Decimal
    gross_margin_amount: Decimal
    gross_margin_percent: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[SupplierOrderItemResponse] = []

    class Config:
        from_attributes = True
