from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from uuid import UUID
from enum import Enum

class PriorityEnum(str, Enum):
    NORMAL = "NORMAL"
    URGENTE = "URGENTE"
    REFAZIMENTO = "REFAZIMENTO"

class EyePrescriptionSchema(BaseModel):
    spherical: float = Field(0.0, description="Grau esférico")
    cylindrical: float = Field(0.0, description="Grau cilíndrico")
    axis: int = Field(0, description="Eixo astigmático (0 a 180)")
    addition: float = Field(0.0, description="Adição multifocal")
    base_curve: float = Field(0.0, description="Curva Base em dioptrias")
    prism_value: float = Field(0.0, description="Valor do prisma")
    prism_base: Optional[str] = Field(None, description="Direção do prisma: IN, OUT, UP, DOWN")
    dnp: float = Field(0.0, description="Distância naso-pupilar em mm")
    height: float = Field(0.0, description="Altura de montagem em mm")

class FrameGeometrySchema(BaseModel):
    frame_a: float = Field(0.0, description="Largura horizontal do aro (A) em mm")
    frame_b: float = Field(0.0, description="Altura vertical do aro (B) em mm")
    frame_bridge: float = Field(0.0, description="Ponte da armação (DBL) em mm")
    frame_ed: float = Field(0.0, description="Maior diagonal / Maior diâmetro (ED) em mm")
    frame_type: str = Field("ACETATO", description="Tipo de armação: ACETATO, METAL, NYLON, BALGRIFF")
    bevel_type: str = Field("AUTOMATICO", description="Tipo de bisel: AUTOMATICO")

class OSAdditionalServiceSchema(BaseModel):
    service_id: UUID = Field(..., description="ID do Serviço Técnico cadastrado no Catálogo Financeiro")
    name: str = Field(..., description="Nome do Serviço (ex: Montagem Balgriff, Coloração Solar)")
    price: float = Field(..., description="Preço do Serviço em R$", ge=0.0)

class OSCreateFactorySchema(BaseModel):
    optical_store_id: UUID = Field(..., description="ID da Ótica Cliente")
    client_order_number: str = Field(..., description="Número do Pedido interno da Loja")
    tray_number: str = Field(..., description="Número da Bandeja de Produção (Tray ID)")
    priority: PriorityEnum = Field(PriorityEnum.NORMAL, description="Nível de prioridade")
    os_type: str = Field("PADRAO", description="Tipo da OS: PADRAO ou REPARO_SERVICO")
    
    # Prescrição Clínica (Opcional se for apenas Reparo)
    od_prescription: Optional[EyePrescriptionSchema] = None
    oe_prescription: Optional[EyePrescriptionSchema] = None
    
    # Geometria e Armação (Opcional se for Apenas Reparo/Serviço)
    frame_geometry: Optional[FrameGeometrySchema] = Field(None, description="Geometria da armação (opcional para Reparo/Serviço)")
    
    # Insumo e Matriz Selecionada (Opcional para Reparo/Serviço)
    lens_model_id: Optional[UUID] = Field(None, description="ID do Modelo do Cadastrador Unificado (Opcional se for Apenas Reparo/Serviço)")
    
    # Serviços Técnicos e Laboratoriais Adicionais (Inclusos na OS com a Lente)
    additional_services: Optional[List[OSAdditionalServiceSchema]] = Field(default=[], description="Lista de Serviços e Reparos inclusos na Ordem de Serviço")
    
    # Sobrescrita Comercial (Price Override)
    manual_price_override: Optional[float] = Field(None, description="Preço manual acordado")
    price_override_reason: Optional[str] = Field(None, description="Justificativa obrigatória para preço manual")
    special_instructions: Optional[str] = Field(None, description="Observações especiais de montagem/usinagem")

    @model_validator(mode='after')
    def validate_os_factory_rules(self):
        if self.os_type == "PADRAO" and not self.lens_model_id:
            raise ValueError("Para OS Padrão de lentes, é obrigatório selecionar o modelo da lente.")
        if self.manual_price_override is not None and not self.price_override_reason:
            raise ValueError("É obrigatório informar a justificativa (price_override_reason) ao alterar o preço manual.")
        return self
