from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.schemas.movement import StockMovementResponse, ReserveRequest, ReserveResponse, StockMovementCreate
from backend.app.crud import movement as crud_movement
from backend.app.crud import lens as crud_lens

router = APIRouter()

@router.get("/", response_model=List[StockMovementResponse])
async def read_stock_movements(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o histórico completo de movimentações de estoque (Trilha de Auditoria).
    """
    return await crud_movement.get_movements(db, skip=skip, limit=limit)

@router.post("/reserve", response_model=ReserveResponse)
async def reserve_lens(
    payload: ReserveRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Consumido pelo módulo de OS para reservar uma lente baseado na receita.
    Localiza o item correspondente, subtrai temporariamente do estoque lógico (-1)
    e retorna o 'location_tag' (gaveta física) exato para o estoquista.
    """
    # 1. Localiza a lente na grade de estoque
    inventory_item = await crud_lens.get_inventory_by_dioptria(
        db,
        lens_model_id=payload.lens_model_id,
        spherical=payload.spherical,
        cylindrical=payload.cylindrical
    )
    
    if not inventory_item:
        return ReserveResponse(
            success=False,
            message="Esta combinação de dioptria (grau) e modelo de lente não está cadastrada na grade de estoque."
        )
        
    # 2. Verifica se há estoque físico disponível
    if inventory_item.quantity_available <= 0:
        return ReserveResponse(
            success=False,
            message="Não há unidades físicas disponíveis para esta lente no momento.",
            item_id=inventory_item.id,
            location_tag=inventory_item.location_tag,
            quantity_available_now=0
        )
        
    # 3. Registra a saída da reserva
    reason_str = payload.reason or "Reserva para Ordem de Serviço"
    movement_out = StockMovementCreate(
        lens_inventory_id=inventory_item.id,
        movement_type="OUT",
        quantity=1,
        reason=reason_str
    )
    
    updated_movement = await crud_movement.create_stock_movement(db, movement_out)
    updated_item = updated_movement.lens_inventory
    
    return ReserveResponse(
        success=True,
        message="Lente reservada com sucesso. Retire da gaveta indicada.",
        item_id=updated_item.id,
        location_tag=updated_item.location_tag,
        quantity_available_now=updated_item.quantity_available
    )
