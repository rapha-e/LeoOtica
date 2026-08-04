import uuid
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# --- Permissão ---
class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None

class PermissionResponse(PermissionBase):
    id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)

# --- Perfil (Role) ---
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleResponse(RoleBase):
    id: uuid.UUID
    permissions: List[PermissionResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# --- Usuário ---
class UserBase(BaseModel):
    name: str
    email: str  # Mudado de EmailStr para str para aceitar logins alfanuméricos
    is_active: Optional[bool] = True
    must_change_password: Optional[bool] = False

class UserCreate(UserBase):
    password: str
    role_id: Optional[uuid.UUID] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[uuid.UUID] = None
    must_change_password: Optional[bool] = None

class UserResponse(UserBase):
    id: uuid.UUID
    role_id: Optional[uuid.UUID] = None
    role: Optional[RoleResponse] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Token de Segurança ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    must_change_password: bool

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class LoginPayload(BaseModel):
    email: str  # Mudado de EmailStr para str para aceitar logins alfanuméricos
    password: str

class ChangePasswordPayload(BaseModel):
    new_password: str
