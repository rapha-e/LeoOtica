import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class NfeSaidaBase(BaseModel):
    billing_cycle_id: uuid.UUID
    nfe_number: int
    serie: int
    chave_acesso: str
    status: str

class NfeSaidaCreate(BaseModel):
    billing_cycle_id: uuid.UUID

class NfeSaidaResponse(BaseModel):
    id: uuid.UUID
    billing_cycle_id: uuid.UUID
    nfe_number: int
    serie: int
    chave_acesso: Optional[str] = None
    status: str
    focus_ref: Optional[str] = None
    protocolo: Optional[str] = None
    danfe_url: Optional[str] = None
    xml_url: Optional[str] = None
    mensagem_sefaz: Optional[str] = None
    emitted_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NfeCancelRequest(BaseModel):
    justification: Optional[str] = "Cancelamento homologado a pedido do cliente"

class NfeConnectionStatusResponse(BaseModel):
    configured: bool
    environment: str
    token_configured: bool
    status: str  # 'online', 'offline', 'simulation_mode'
    cnpj_emitente: Optional[str] = None
    message: str
