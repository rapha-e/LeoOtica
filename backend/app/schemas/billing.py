import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.nfe import NfeSaidaResponse

class BillingCycleCreate(BaseModel):
    optical_store_id: uuid.UUID
    start_date: datetime
    end_date: datetime
    service_order_ids: List[uuid.UUID]
    due_date: Optional[datetime] = None

class OSItemDetail(BaseModel):
    name: str
    description: Optional[str] = None
    item_type: str = "Serviço" # 'Lente', 'Serviço', 'Tratamento'
    quantity: int = 1
    unit_price: float = 0.0
    total_price: float = 0.0

    model_config = ConfigDict(from_attributes=True)

class BillingItemResponse(BaseModel):
    id: uuid.UUID
    billing_cycle_id: uuid.UUID
    service_order_id: uuid.UUID
    amount: float
    created_at: datetime
    
    # Informações detalhadas da OS para a fatura de fechamento
    os_number: Optional[str] = None
    client_name: Optional[str] = None
    lens_type: Optional[str] = None
    treatments: Optional[str] = None
    services: Optional[str] = None
    lens_price: Optional[float] = 0.0
    service_price: Optional[float] = 0.0
    treatment_price: Optional[float] = 0.0
    detailed_items: List[OSItemDetail] = []

    model_config = ConfigDict(from_attributes=True)


class BillingCycleResponse(BaseModel):
    id: uuid.UUID
    optical_store_id: uuid.UUID
    optical_store_name: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: str
    total_amount: float
    created_at: datetime
    closed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    is_overdue: bool = False
    items: List[BillingItemResponse] = []
    nfe_saida: Optional[NfeSaidaResponse] = None

    model_config = ConfigDict(from_attributes=True)

class PendingBillingGroupResponse(BaseModel):
    optical_store_id: uuid.UUID
    optical_store_name: str
    pending_os_count: int
    estimated_total_amount: float

    model_config = ConfigDict(from_attributes=True)

class PendingOrderResponse(BaseModel):
    id: uuid.UUID
    os_number: str
    client_name: Optional[str] = None
    status: str
    total_amount: float
    created_at: datetime
    lens_type: Optional[str] = None
    treatments: Optional[str] = None
    services: Optional[str] = None
    lens_price: Optional[float] = 0.0
    service_price: Optional[float] = 0.0
    treatment_price: Optional[float] = 0.0
    detailed_items: List[OSItemDetail] = []

    model_config = ConfigDict(from_attributes=True)

