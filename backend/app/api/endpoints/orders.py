import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator, get_current_active_admin
from backend.app.models.user import User
from backend.app.crud import crud_order
from backend.app.schemas.order import (
    CommercialOrderCreate, CommercialOrderUpdate, CommercialOrderResponse
)

router = APIRouter()

@router.get("/", response_model=List[CommercialOrderResponse])
async def list_commercial_orders(
    status: Optional[str] = Query(None),
    optical_store_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todos os Pedidos Comerciais de Venda recebidos das Óticas Parceiras.
    """
    return await crud_order.get_orders(
        db, status=status, optical_store_id=optical_store_id, search=search, skip=skip, limit=limit
    )

@router.post("/", response_model=CommercialOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_commercial_order(
    payload: CommercialOrderCreate,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Cadastra um novo Pedido Comercial de Venda recebido de uma Ótica parceira, 
    rodando a verificação automática de inadimplência e limite de crédito.
    """
    try:
        return await crud_order.create_commercial_order(db, payload)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

@router.get("/{order_id}", response_model=CommercialOrderResponse)
async def get_commercial_order_details(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os detalhes completos de um Pedido Comercial de Venda pelo ID.
    """
    order = await crud_order.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido comercial não localizado.")
    return order

@router.post("/{order_id}/approve-financial", response_model=CommercialOrderResponse)
async def approve_financial_hold(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Libera manualmente um Pedido Comercial que foi bloqueado por análise de crédito.
    """
    updated = await crud_order.approve_financial_hold(db, order_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Pedido comercial não localizado.")
    return updated

@router.post("/{order_id}/bill", response_model=CommercialOrderResponse)
async def bill_commercial_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Fatura o Pedido Comercial de Venda e gera automaticamente o título no Contas a Receber (AR).
    """
    billed = await crud_order.bill_commercial_order(db, order_id)
    if not billed:
        raise HTTPException(status_code=404, detail="Pedido comercial não localizado.")
    return billed
