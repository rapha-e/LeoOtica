from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.app.models.movement import StockMovement
from backend.app.models.lens import LensInventoryGrade
from backend.app.schemas.movement import StockMovementCreate

async def create_stock_movement(db: AsyncSession, obj_in: StockMovementCreate) -> StockMovement:
    # 1. Registra o movimento na tabela stock_movements
    db_obj = StockMovement(
        lens_inventory_id=obj_in.lens_inventory_id,
        movement_type=obj_in.movement_type, # 'IN', 'OUT', 'AUDIT'
        quantity=obj_in.quantity,
        reason=obj_in.reason
    )
    db.add(db_obj)
    
    # 2. Atualiza a quantidade disponível na tabela lens_inventory_grade
    # NOTA: Usamos lock/select para garantir consistência ACID sob concorrência
    query_item = select(LensInventoryGrade).where(LensInventoryGrade.id == obj_in.lens_inventory_id).with_for_update()
    result_item = await db.execute(query_item)
    inventory_item = result_item.scalar_one()
    
    if obj_in.movement_type == "IN":
        inventory_item.quantity_available += obj_in.quantity
    elif obj_in.movement_type == "OUT":
        # Evita estoque negativo, mas permite zerar
        inventory_item.quantity_available = max(0, inventory_item.quantity_available - obj_in.quantity)
    elif obj_in.movement_type == "AUDIT":
        # No caso do MVP, a bipagem móvel incrementa em +1 a quantidade disponível
        inventory_item.quantity_available += obj_in.quantity
        
    await db.commit()
    
    # Recarrega o movimento com o relacionamento lens_inventory populado
    query_movement = select(StockMovement).where(StockMovement.id == db_obj.id).options(
        selectinload(StockMovement.lens_inventory).selectinload(LensInventoryGrade.lens_model)
    )
    result_movement = await db.execute(query_movement)
    return result_movement.scalar_one()

async def get_movements(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[StockMovement]:
    query = select(StockMovement).options(
        selectinload(StockMovement.lens_inventory).selectinload(LensInventoryGrade.lens_model)
    ).order_by(StockMovement.movement_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
