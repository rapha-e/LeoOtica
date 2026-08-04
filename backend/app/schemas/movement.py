import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.lens import LensInventoryGradeResponse

class StockMovementBase(BaseModel):
    lens_inventory_id: uuid.UUID
    movement_type: str = Field(..., description="Tipo de movimentação: IN, OUT, AUDIT")
    quantity: int = Field(..., description="Quantidade movimentada")
    reason: Optional[str] = Field(None, max_length=255, description="Ex: 'Inventário Inicial', 'Baixa OS 992'")

class StockMovementCreate(StockMovementBase):
    pass

class StockMovementResponse(StockMovementBase):
    id: uuid.UUID
    movement_date: datetime
    lens_inventory: Optional[LensInventoryGradeResponse] = None

    model_config = ConfigDict(from_attributes=True)

class ReserveRequest(BaseModel):
    spherical: Decimal = Field(..., max_digits=4, decimal_places=2, description="Grau Esférico da receita")
    cylindrical: Decimal = Field(..., max_digits=4, decimal_places=2, description="Grau Cilíndrico da receita")
    lens_model_id: uuid.UUID = Field(..., description="ID do modelo de lente específico")
    reason: Optional[str] = Field(None, max_length=255, description="Ex: 'Baixa OS 992'")

class ReserveResponse(BaseModel):
    success: bool
    message: str
    item_id: Optional[uuid.UUID] = None
    location_tag: Optional[str] = None
    quantity_available_now: Optional[int] = None
