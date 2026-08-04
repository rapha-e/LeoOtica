from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_admin
from backend.app.models.user import User
from backend.app.crud import crud_system_parameters

router = APIRouter()

@router.get("/", response_model=Dict[str, str])
async def list_system_parameters(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todos os parâmetros e configurações ativas do sistema.
    """
    return await crud_system_parameters.get_all_parameters(db)

@router.post("/", response_model=Dict[str, str])
async def update_system_parameters(
    payload: Dict[str, str],
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):

    """
    Atualiza parâmetros do sistema (exclusivo para perfil Administrador).
    """
    return await crud_system_parameters.set_multiple_parameters(db, payload)
