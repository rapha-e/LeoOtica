import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

class OpticalStoreBase(BaseModel):
    corporate_name: str
    trade_name: str
    fantasy_name: Optional[str] = None
    cnpj: str

    ie: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    is_active: Optional[bool] = True

class OpticalStoreCreate(OpticalStoreBase):
    pass

class OpticalStoreUpdate(BaseModel):
    corporate_name: Optional[str] = None
    trade_name: Optional[str] = None
    cnpj: Optional[str] = None
    ie: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class OpticalStoreResponse(OpticalStoreBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
