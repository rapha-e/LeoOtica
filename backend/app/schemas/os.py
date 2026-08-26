import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.lens import LensInventoryGradeResponse
from backend.app.schemas.optical_store import OpticalStoreResponse
from backend.app.models.os import OSStatus


class UserMinResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    
    model_config = ConfigDict(from_attributes=True)

class OSWorkflowHistoryResponse(BaseModel):
    id: uuid.UUID
    service_order_id: uuid.UUID
    previous_status: Optional[str] = None
    new_status: str

    operator_notes: Optional[str] = None
    changed_at: datetime
    operator_id: Optional[uuid.UUID] = None
    operator: Optional[UserMinResponse] = None
    sector: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Schemas do Item da OS (Faturamento) ---
class ServiceOrderItemBase(BaseModel):
    entity_type: str # 'product', 'treatment', 'service'
    entity_id: uuid.UUID
    quantity: int = 1

class ServiceOrderItemCreate(ServiceOrderItemBase):
    override_price: Optional[float] = None
    price_override_reason: Optional[str] = None

class ServiceOrderItemResponse(ServiceOrderItemBase):
    id: uuid.UUID
    service_order_id: uuid.UUID
    unit_price: float
    total_price: float
    created_at: datetime
    custom_price_applied: bool
    original_price: Optional[float] = None
    price_override_reason: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

# --- Schemas do Controle de Qualidade (CQ) ---
class CQInspectionCreate(BaseModel):
    check_grau: bool = Field(..., description="Validação de grau")
    check_eixo: bool = Field(..., description="Validação de eixo")
    check_prisma: bool = Field(..., description="Validação de prisma")
    check_acabamento: bool = Field(..., description="Validação de acabamento")
    result: str = Field(..., description="Resultado: APROVADO, RETRABALHO ou REPROVADO")
    rework_destination: Optional[str] = Field(None, description="Bancada de destino para retrabalho")
    notes: Optional[str] = Field(None, max_length=255, description="Observações da inspeção")

class CQInspectionResponse(BaseModel):
    id: uuid.UUID
    service_order_id: uuid.UUID
    operator_id: uuid.UUID
    operator: Optional[UserMinResponse] = None
    check_grau: bool
    check_eixo: bool
    check_prisma: bool
    check_acabamento: bool
    result: str
    rework_destination: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Schemas da Ordem de Serviço (OS) ---
class ServiceOrderBase(BaseModel):
    os_number: str = Field(..., max_length=50)
    client_name: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=150)
    partner_shop_id: Optional[uuid.UUID] = Field(None)
    optical_store_id: Optional[uuid.UUID] = Field(None)
    status: str = Field("Recebida")
    os_type: Optional[str] = Field("PADRAO", max_length=30)

    client_order_number: Optional[str] = Field(None, max_length=100)
    tray_number: Optional[str] = Field(None, max_length=50)
    priority: Optional[str] = Field("NORMAL", max_length=20)
    service_type: Optional[str] = Field(None, max_length=100)
    manual_price: Optional[float] = Field(None)
    price_override_reason: Optional[str] = Field(None, max_length=255)
    special_instructions: Optional[str] = Field(None)

    total_amount: float = 0.00

    clinical_notes: Optional[str] = Field(None, max_length=500)
    cancellation_reason: Optional[str] = Field(None, max_length=255)
    is_rework: bool = Field(False)
    
    # Receita OD
    od_spherical: Optional[Decimal] = Field(None)
    od_cylindrical: Optional[Decimal] = Field(None)
    od_axis: Optional[int] = Field(None, ge=0, le=180)
    od_addition: Optional[Decimal] = Field(None)
    od_dnp: Optional[Decimal] = Field(None)
    od_prism: Optional[str] = Field(None, max_length=50)
    od_height: Optional[Decimal] = Field(None)
    
    # Receita OE
    oe_spherical: Optional[Decimal] = Field(None)
    oe_cylindrical: Optional[Decimal] = Field(None)
    oe_axis: Optional[int] = Field(None, ge=0, le=180)
    oe_addition: Optional[Decimal] = Field(None)
    oe_dnp: Optional[Decimal] = Field(None)
    oe_prism: Optional[str] = Field(None, max_length=50)
    oe_height: Optional[Decimal] = Field(None)
    
    # Armação
    frame_a: Optional[Decimal] = Field(None)
    frame_bridge: Optional[Decimal] = Field(None)
    frame_ed: Optional[Decimal] = Field(None)

class ServiceOrderCreate(BaseModel):
    os_number: Optional[str] = Field(None, max_length=50, description="Gerado automaticamente se não fornecido")
    client_name: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=150)
    client_order_number: Optional[str] = Field(None, max_length=100, description="Número de controle interno da Ótica Cliente")
    partner_shop_id: Optional[uuid.UUID] = None
    optical_store_id: Optional[uuid.UUID] = None
    os_type: Optional[str] = "PADRAO"
    clinical_notes: Optional[str] = Field(None, max_length=500)

    is_rework: Optional[bool] = False
    
    od_spherical: Optional[Decimal] = None
    od_cylindrical: Optional[Decimal] = None
    od_axis: Optional[int] = None
    od_addition: Optional[Decimal] = None
    od_dnp: Optional[Decimal] = None
    od_prism: Optional[str] = None
    od_height: Optional[Decimal] = None
    
    oe_spherical: Optional[Decimal] = None
    oe_cylindrical: Optional[Decimal] = None
    oe_axis: Optional[int] = None
    oe_addition: Optional[Decimal] = None
    oe_dnp: Optional[Decimal] = None
    oe_prism: Optional[str] = None
    oe_height: Optional[Decimal] = None
    
    # Armação opcional na criação
    frame_a: Optional[Decimal] = None
    frame_bridge: Optional[Decimal] = None
    frame_ed: Optional[Decimal] = None
    lens_model_id: Optional[uuid.UUID] = None

class ServiceOrderUpdate(BaseModel):
    client_name: Optional[str] = Field(None, max_length=150)
    doctor_name: Optional[str] = Field(None, max_length=150)
    optical_store_id: Optional[uuid.UUID] = None
    partner_shop_id: Optional[uuid.UUID] = None
    clinical_notes: Optional[str] = Field(None, max_length=500)
    
    od_spherical: Optional[Decimal] = None
    od_cylindrical: Optional[Decimal] = None
    od_axis: Optional[int] = Field(None, ge=0, le=180)
    od_addition: Optional[Decimal] = None
    od_dnp: Optional[Decimal] = None
    od_prism: Optional[str] = Field(None, max_length=50)
    od_height: Optional[Decimal] = None
    
    oe_spherical: Optional[Decimal] = None
    oe_cylindrical: Optional[Decimal] = None
    oe_axis: Optional[int] = Field(None, ge=0, le=180)
    oe_addition: Optional[Decimal] = None
    oe_dnp: Optional[Decimal] = None
    oe_prism: Optional[str] = Field(None, max_length=50)
    oe_height: Optional[Decimal] = None
    
    frame_a: Optional[Decimal] = None
    frame_bridge: Optional[Decimal] = None
    frame_ed: Optional[Decimal] = None
    lens_model_id: Optional[uuid.UUID] = None

class OSCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=5, max_length=255)

class PartnerShopMinResponse(BaseModel):
    id: uuid.UUID
    trade_name: str
    cnpj: str
    
    model_config = ConfigDict(from_attributes=True)

class ServiceOrderResponse(ServiceOrderBase):
    id: uuid.UUID
    od_lens_inventory_id: Optional[uuid.UUID] = None
    oe_lens_inventory_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    
    od_lens_inventory: Optional[LensInventoryGradeResponse] = None
    oe_lens_inventory: Optional[LensInventoryGradeResponse] = None
    partner_shop: Optional[PartnerShopMinResponse] = None
    optical_store: Optional[OpticalStoreResponse] = None
    workflow_history: List[OSWorkflowHistoryResponse] = []

    items: List[ServiceOrderItemResponse] = []
    cq_inspections: List[CQInspectionResponse] = []

    model_config = ConfigDict(from_attributes=True)

class AllocateRequest(BaseModel):
    frame_a: Decimal = Field(..., ge=0, description="Largura horizontal do aro em mm (A)")
    frame_bridge: Decimal = Field(..., ge=0, description="Ponte da armação em mm (DBL)")
    frame_ed: Decimal = Field(..., ge=0, description="Maior diagonal da lente em mm (ED)")
    lens_model_id: uuid.UUID = Field(..., description="ID do modelo base da lente no estoque")
    
    od_dnp: Optional[Decimal] = Field(None, ge=0)
    oe_dnp: Optional[Decimal] = Field(None, ge=0)

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Status de destino (ex: Produção, Separação, Montagem, CQ, Expedição)")
    operator_notes: Optional[str] = Field(None, max_length=255, description="Notas explicativas")
    sector: Optional[str] = Field(None, max_length=100, description="Setor onde ocorreu a transição")


class ReprocessRequest(BaseModel):
    operator_notes: str = Field(..., max_length=255, description="Motivo pelo qual a lente quebrou/precisa de reprocessamento")

class BipBancadaRequest(BaseModel):
    os_number: str = Field(..., description="Número da OS bipado pelo leitor de código de barras")
    target_status: Optional[str] = Field(None, description="Status de destino (opcional)")

    operator_notes: Optional[str] = Field(None, max_length=255, description="Notas adicionais do operador")
