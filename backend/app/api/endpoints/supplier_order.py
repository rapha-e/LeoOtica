import uuid
from typing import List, Optional, Any

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.supplier_order import SupplierOrderCreate, SupplierOrderResponse
from backend.app.crud import supplier_order as crud_supplier
from backend.app.api.deps import get_current_active_operator

router = APIRouter()

@router.post("/", response_model=SupplierOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier_order_endpoint(
    payload: SupplierOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Cria um novo pedido de compra no fornecedor com calculos automaticos de margem custo vs revenda.
    """
    return await crud_supplier.create_supplier_order(db, payload)

@router.get("/", response_model=List[SupplierOrderResponse])
async def list_supplier_orders_endpoint(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista todos os pedidos de fornecedores com descritivo de margem de lucro.
    """
    return await crud_supplier.get_supplier_orders(db, skip=skip, limit=limit)

@router.get("/last-cost/{lens_model_id}")
async def get_last_cost_endpoint(
    lens_model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Retorna o ultimo preco de custo pago no fornecedor para a lente selecionada.
    """
    cost = await crud_supplier.get_last_purchased_cost(db, lens_model_id)
    return {"lens_model_id": lens_model_id, "last_purchased_cost": float(cost) if cost is not None else 0.00}

@router.post("/from-predictive-ai", response_model=SupplierOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_from_predictive_ai_endpoint(
    supplier_name: str = Query("Distribuidora de Lentes Matriz"),
    lead_time_days: int = Query(7),
    safety_days: int = Query(30),
    coverage_days: int = Query(15),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Converte as sugestoes de compra geradas pela IA Preditiva em um Pedido no Fornecedor (1-Clique).
    """
    return await crud_supplier.create_order_from_predictive_ai(
        db, supplier_name=supplier_name, lead_time_days=lead_time_days, safety_days=safety_days, coverage_days=coverage_days
    )
