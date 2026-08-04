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
    chave_acesso: str
    status: str
    emitted_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
