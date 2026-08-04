import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class CommercialOrderItemBase(BaseModel):
    item_type: str  # 'LENTE_ACABADA', 'BLOCO_SEMIACABADO', 'TRATAMENTO', 'SERVICO_MONTAGEM', 'SERVICO_SURFACAGEM'
    item_name: str
    quantity: int = 1
    unit_price: float = 0.00
    total_price: float = 0.00
    reference_id: Optional[uuid.UUID] = None

class CommercialOrderItemCreate(CommercialOrderItemBase):
    pass

class CommercialOrderItemResponse(CommercialOrderItemBase):
    id: uuid.UUID
    order_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CommercialOrderBase(BaseModel):
    optical_store_id: uuid.UUID
    client_name: Optional[str] = "Cliente Consumidor"
    doctor_name: Optional[str] = None
    frame_type: Optional[str] = "METAL" # 'METAL', 'ACETATO', 'NYLON', 'PARAFUSO'
    payment_terms: Optional[str] = "A_VISTA" # 'A_VISTA', '30_DIAS', 'FATURAMENTO_MENSAL'
    
    # Prescrição Óptica (Olho Direito)
    od_spherical: Optional[float] = 0.00
    od_cylindrical: Optional[float] = 0.00
    od_axis: Optional[int] = 0
    od_addition: Optional[float] = 0.00
    od_dnp: Optional[float] = 30.00
    od_height: Optional[float] = 18.00

    # Prescrição Óptica (Olho Esquerdo)
    oe_spherical: Optional[float] = 0.00
    oe_cylindrical: Optional[float] = 0.00
    oe_axis: Optional[int] = 0
    oe_addition: Optional[float] = 0.00
    oe_dnp: Optional[float] = 30.00
    oe_height: Optional[float] = 18.00

    notes: Optional[str] = None

class CommercialOrderCreate(CommercialOrderBase):
    items: List[CommercialOrderItemCreate] = []

class CommercialOrderUpdate(BaseModel):
    client_name: Optional[str] = None
    doctor_name: Optional[str] = None
    frame_type: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

class CommercialOrderResponse(CommercialOrderBase):
    id: uuid.UUID
    order_number: str
    status: str # 'RASCUNHO', 'BLOQUEADO_FINANCEIRO', 'PENDENTE_APROVACAO', 'EM_PRODUCAO', 'PRONTO_EXPEDICAO', 'FATURADO', 'CONCLUIDO', 'CANCELADO'
    subtotal: float
    discount_amount: float
    total_amount: float
    financial_hold_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[CommercialOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
