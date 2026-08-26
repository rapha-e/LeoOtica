import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field

class DegreePricingPolicyBase(BaseModel):
    degree_threshold: Decimal = Field(default=Decimal("2.00"), description="Limite de cilíndrico padrão (2.00D)")
    default_sale_price_le: Decimal = Field(default=Decimal("75.00"), description="Preço base (Esférico 0 a 4 | Cilíndrico 0 a 2)")
    default_sale_price_gt: Decimal = Field(default=Decimal("95.00"), description="Preço ajustado (Cilíndrico > 2 ou Esférico > 4)")
    is_active: bool = True

class DegreePricingPolicyCreate(DegreePricingPolicyBase):
    pass

class DegreePricingPolicyUpdate(BaseModel):
    degree_threshold: Optional[Decimal] = None
    default_sale_price_le: Optional[Decimal] = None
    default_sale_price_gt: Optional[Decimal] = None
    is_active: Optional[bool] = None

class DegreePricingPolicyResponse(DegreePricingPolicyBase):
    id: uuid.UUID
    updated_at: datetime
    updated_by_id: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True
