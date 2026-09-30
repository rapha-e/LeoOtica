import uuid
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class LaboratoryBase(BaseModel):
    name: str = Field(..., max_length=150, description="Nome do laboratório/sistema")
    address: str = Field(..., max_length=255, description="Endereço físico")
    cep: str = Field(..., max_length=20, description="CEP")
    telephone: str = Field(..., max_length=50, description="Telefone comercial")
    cnpj: str = Field(..., max_length=25, description="CNPJ")
    ie: Optional[str] = Field(None, max_length=30, description="Inscrição Estadual")

class LaboratoryCreate(LaboratoryBase):
    pass

class LaboratoryUpdate(BaseModel):
    name: str = Field(..., max_length=150)
    address: str = Field(..., max_length=255)
    cep: str = Field(..., max_length=20)
    telephone: str = Field(..., max_length=50)
    cnpj: str = Field(..., max_length=25)
    ie: Optional[str] = Field(None, max_length=30, description="Inscrição Estadual")

class LaboratoryResponse(LaboratoryBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
