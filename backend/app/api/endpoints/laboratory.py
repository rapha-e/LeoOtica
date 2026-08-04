from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.laboratory import LaboratoryResponse, LaboratoryUpdate
from backend.app.crud import laboratory as crud_laboratory
from backend.app.api.deps import get_current_active_operator

router = APIRouter()

@router.get("/", response_model=LaboratoryResponse)
async def read_laboratory_profile(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Retorna os dados cadastrais do laboratório.
    """
    lab = await crud_laboratory.get_laboratory(db)
    if not lab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil do laboratório não semeado/encontrado."
        )
    return lab

@router.put("/", response_model=LaboratoryResponse)
async def update_laboratory_profile(
    payload: LaboratoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Atualiza as informações cadastrais do laboratório.
    """
    return await crud_laboratory.update_laboratory(db, payload)
