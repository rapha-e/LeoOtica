import uuid
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from backend.app.core.database import get_db
from backend.app.schemas.user import UserCreate, UserUpdate, UserResponse, RoleResponse
from backend.app.crud import user as crud_user
from backend.app.api.deps import get_current_active_admin

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = Query(None, description="Filtro por nome ou e-mail"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Lista todos os usuários com suporte a paginação e filtro por nome ou e-mail.
    Acesso restrito a Administradores.
    """
    return await crud_user.get_users(db, skip=skip, limit=limit, query=query)

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Lista todos os perfis de acesso cadastrados no sistema.
    Acesso restrito a Administradores.
    """
    return await crud_user.get_roles(db)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_details(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Retorna os detalhes de um usuário específico.
    Acesso restrito a Administradores.
    """
    db_user = await crud_user.get_user(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )
    return db_user

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Cadastra um novo usuário no sistema. Valida duplicidade de login.
    Acesso restrito a Administradores.
    """
    existing_user = await crud_user.get_user_by_email(db, email=payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um usuário cadastrado com este login."
        )
    return await crud_user.create_user(db, payload)

@router.put("/{user_id}", response_model=UserResponse)
async def update_existing_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Atualiza os dados de um usuário cadastrado. Valida duplicidade se o login for alterado.
    Acesso restrito a Administradores.
    """
    db_user = await crud_user.get_user(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )
        
    if payload.email is not None and payload.email != db_user.email:
        existing_user = await crud_user.get_user_by_email(db, email=payload.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe outro usuário cadastrado com este login."
            )
            
    return await crud_user.update_user(db, db_user=db_user, user_in=payload)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Exclui permanentemente um usuário. Impede exclusão caso possua amarrações (IntegrityError).
    Acesso restrito a Administradores.
    """
    try:
        success = await crud_user.delete_user(db, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado."
            )
        return
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir este usuário pois ele possui históricos de Ordens de Serviço ou logs associados."
        )
