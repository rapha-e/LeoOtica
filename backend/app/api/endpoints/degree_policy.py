from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.degree_policy import (
    DegreePricingPolicyCreate,
    DegreePricingPolicyResponse
)
from backend.app.crud import degree_policy as crud_policy
from backend.app.api.deps import get_current_user, get_current_active_admin, get_current_active_operator

router = APIRouter()

@router.get("/", response_model=Optional[DegreePricingPolicyResponse])
async def read_active_policy(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Obtém a política de precificação por grau ativa.
    Operadores e Administradores podem consultar.
    """
    policy = await crud_policy.get_active_policy(db)
    return policy

@router.post("/", response_model=DegreePricingPolicyResponse)
async def save_policy(
    policy_in: DegreePricingPolicyCreate,
    cascade_update: bool = Query(False, description="Replicar e atualizar em lote todas as lentes existentes do catálogo"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Cadastra ou atualiza a política global de precificação por grau.
    Apenas Administradores podem alterar.
    """
    policy, updated_count = await crud_policy.create_or_update_policy(
        db, policy_in, user_id=current_user.id, cascade_update=cascade_update
    )
    return policy
