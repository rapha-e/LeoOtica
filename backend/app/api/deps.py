import uuid
from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db, current_user_ctx
from backend.app.core.security import decode_access_token
from backend.app.models.user import User

# Esquema de autenticação Bearer Token
security_scheme = HTTPBearer()

async def get_current_user(
    token: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependência que valida o token JWT e retorna o usuário autenticado.
    Também define a ContextVar current_user_ctx para logs de auditoria automáticos.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token.credentials)
    if payload is None:
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception
        
    # Busca o usuário no banco de dados com a relação role e permissões carregadas
    query = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.role))
    )
    result = await db.execute(query)
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este usuário está inativo no sistema."
        )
        
    # Define a ContextVar para a auditoria automática do SQLAlchemy antes de retornar
    current_user_ctx.set({
        "id": user.id,
        "name": user.name,
        "email": user.email
    })
    
    return user

async def get_current_active_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verifica se o usuário atual é Administrador.
    """
    if not current_user.role or current_user.role.name != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operação permitida apenas para Administradores."
        )
    return current_user

async def get_current_active_operator(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verifica se o usuário atual é Operador ou Administrador.
    """
    if not current_user.role or current_user.role.name not in ["Operador", "Administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Perfil de Operador ou Administrador exigido."
        )
    return current_user
