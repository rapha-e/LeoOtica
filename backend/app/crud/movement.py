from typing import List, Optional
from decimal import Decimal
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.app.models.movement import StockMovement
from backend.app.models.lens import LensInventoryGrade
from backend.app.schemas.movement import StockMovementCreate

async def create_stock_movement(db: AsyncSession, obj_in: StockMovementCreate, unit_cost: Optional[float] = None) -> StockMovement:
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
    query_item = select(LensInventoryGrade).where(LensInventoryGrade.id == obj_in.lens_inventory_id).options(selectinload(LensInventoryGrade.lens_model)).with_for_update()
    result_item = await db.execute(query_item)
    inventory_item = result_item.scalar_one()

    # Cálculo do Custo Médio Ponderado (CMP) quando há entrada
    if obj_in.movement_type in ["IN", "AUDIT"] and obj_in.quantity > 0:
        cost_val = unit_cost
        if cost_val is None and inventory_item.lens_model and inventory_item.lens_model.cost_price is not None:
            cost_val = float(inventory_item.lens_model.cost_price)
        
        if cost_val is not None and cost_val > 0:
            current_qty = inventory_item.quantity_available or 0
            current_cmp = float(inventory_item.average_cost_price or (inventory_item.lens_model.cost_price if inventory_item.lens_model else 25.00))
            
            total_current_val = current_qty * current_cmp
            total_added_val = obj_in.quantity * cost_val
            new_qty = current_qty + obj_in.quantity
            
            new_cmp = (total_current_val + total_added_val) / new_qty if new_qty > 0 else cost_val
            
            inventory_item.average_cost_price = Decimal(f"{new_cmp:.2f}")
            inventory_item.last_purchase_price = Decimal(f"{cost_val:.2f}")
            if inventory_item.lens_model:
                inventory_item.lens_model.average_cost_price = Decimal(f"{new_cmp:.2f}")
                inventory_item.lens_model.last_purchase_price = Decimal(f"{cost_val:.2f}")
    
    if obj_in.movement_type == "IN":
        inventory_item.quantity_available += obj_in.quantity
    elif obj_in.movement_type == "OUT":
        inventory_item.quantity_available = max(0, inventory_item.quantity_available - obj_in.quantity)
    elif obj_in.movement_type == "AUDIT":
        inventory_item.quantity_available += obj_in.quantity
        
    db.add(inventory_item)
    await db.commit()
    await db.refresh(inventory_item)
    
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
