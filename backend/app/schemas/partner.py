import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# Partner Shop Schemas
class PartnerShopBase(BaseModel):
    corporate_name: str = Field(..., max_length=200)
    trade_name: str = Field(..., max_length=150)
    cnpj: str = Field(..., max_length=18)
    is_active: Optional[bool] = True

class PartnerShopCreate(PartnerShopBase):
    pass

class PartnerShopResponse(PartnerShopBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ApiKeyCreateResponse(BaseModel):
    key_prefix: str
    api_key_secret: str
    expires_at: Optional[datetime] = None

class ApiKeyInfoResponse(BaseModel):
    id: uuid.UUID
    key_prefix: str
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Face Visagism Schemas
class FaceVisagismSessionBase(BaseModel):
    face_shape_detected: Optional[str] = Field(None, max_length=50)
    recommended_frame_types: Optional[str] = Field(None, max_length=255)
    spherical_context_od: Optional[Decimal] = None
    spherical_context_oe: Optional[Decimal] = None

class FaceVisagismSessionCreate(FaceVisagismSessionBase):
    pass

class FaceVisagismSessionResponse(FaceVisagismSessionBase):
    id: uuid.UUID
    partner_shop_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Lens Simulation Schemas
class LensSimulationRequest(BaseModel):
    od_spherical: Decimal = Field(..., description="Grau Esférico Olho Direito")
    od_cylindrical: Decimal = Field(Decimal("0.00"), description="Grau Cilíndrico Olho Direito")
    oe_spherical: Decimal = Field(..., description="Grau Esférico Olho Esquerdo")
    oe_cylindrical: Decimal = Field(Decimal("0.00"), description="Grau Cilíndrico Olho Esquerdo")
    
    frame_a: Decimal = Field(..., ge=0, description="Largura horizontal do aro (A) em mm")
    frame_bridge: Decimal = Field(..., ge=0, description="Ponte da armação (DBL) em mm")
    frame_ed: Decimal = Field(..., ge=0, description="Maior diagonal da lente (ED) em mm")
    od_dnp: Decimal = Field(..., ge=0, description="DNP Olho Direito em mm")
    oe_dnp: Decimal = Field(..., ge=0, description="DNP Olho Esquerdo em mm")
    
    refractive_index: Decimal = Field(Decimal("1.50"), description="Índice de refração do material (ex: 1.50, 1.59, 1.67, 1.74)")

class LensThicknessDetail(BaseModel):
    spherical: Decimal
    cylindrical: Decimal
    dnp: Decimal
    descentration: Decimal
    minimum_blank_diameter: Decimal
    sagita: Decimal
    thickness_center: Decimal
    thickness_edge: Decimal
    refractive_index: Decimal
    profile_points: List[Dict[str, float]] = []


class LensSimulationResponse(BaseModel):
    od: LensThicknessDetail
    oe: LensThicknessDetail
    requires_upsell: bool
    upsell_message: Optional[str] = None
    recommended_index: Optional[Decimal] = None
    thickness_reduction_percentage: Optional[Decimal] = None
    comparison: Optional[Dict[str, Any]] = None  # Detalhes das espessuras com o índice recomendado

# Visagism Detect Response
class VisagismDetectResponse(BaseModel):
    face_shape_detected: str
    recommended_frame_types: str
    recommended_models: List[Dict[str, Any]] = []
    reasoning: str

# Submit OS from Partner
class PartnerOSSubmit(BaseModel):
    client_name: str = Field(..., max_length=150)
    
    # Graus OD
    od_spherical: Decimal = Field(..., max_digits=4, decimal_places=2)
    od_cylindrical: Decimal = Field(Decimal("0.00"), max_digits=4, decimal_places=2)
    od_axis: int = Field(0, ge=0, le=180)
    od_addition: Decimal = Field(Decimal("0.00"), max_digits=4, decimal_places=2)
    od_dnp: Decimal = Field(..., max_digits=4, decimal_places=2)
    
    # Graus OE
    oe_spherical: Decimal = Field(..., max_digits=4, decimal_places=2)
    oe_cylindrical: Decimal = Field(Decimal("0.00"), max_digits=4, decimal_places=2)
    oe_axis: int = Field(0, ge=0, le=180)
    oe_addition: Decimal = Field(Decimal("0.00"), max_digits=4, decimal_places=2)
    oe_dnp: Decimal = Field(..., max_digits=4, decimal_places=2)
    
    # Medidas armação
    frame_a: Decimal = Field(..., max_digits=4, decimal_places=2)
    frame_bridge: Decimal = Field(..., max_digits=4, decimal_places=2)
    frame_ed: Decimal = Field(..., max_digits=4, decimal_places=2)
    
    # Lente base selecionada (id)
    lens_model_id: uuid.UUID
