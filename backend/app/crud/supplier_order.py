import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.supplier_order import SupplierOrder, SupplierOrderItem
from backend.app.models.lens import LensModel
from backend.app.schemas.supplier_order import SupplierOrderCreate, SupplierOrderItemCreate
from backend.app.services.predictive import calculate_predictive_alerts

async def generate_supplier_order_number(db: AsyncSession) -> str:
    query = select(func.count(SupplierOrder.id))
    count = (await db.execute(query)).scalar_one()
    return f"PED-FORN-{datetime.now().year}-{count + 1:04d}"

async def get_last_purchased_cost(db: AsyncSession, lens_model_id: uuid.UUID) -> Optional[Decimal]:
    """
    Retorna o último preço de custo pago no fornecedor para determinado modelo de lente.
    """
    query = (
        select(SupplierOrderItem.unit_cost_price)
        .where(SupplierOrderItem.lens_model_id == lens_model_id)
        .order_by(desc(SupplierOrderItem.created_at))
        .limit(1)
    )
    res = await db.execute(query)
    cost = res.scalar_one_or_none()
    if cost is not None:
        return Decimal(str(cost))
        
    # Se ainda não houver pedido no fornecedor, busca o cost_price padrão do modelo
    model_query = select(LensModel.cost_price).where(LensModel.id == lens_model_id)
    model_cost = (await db.execute(model_query)).scalar_one_or_none()
    return Decimal(str(model_cost)) if model_cost is not None else None

async def create_supplier_order(db: AsyncSession, obj_in: SupplierOrderCreate) -> SupplierOrder:
    order_num = await generate_supplier_order_number(db)
    
    db_order = SupplierOrder(
        order_number=order_num,
        supplier_name=obj_in.supplier_name,
        notes=obj_in.notes,
        status="RASCUNHO"
    )
    db.add(db_order)
    await db.flush()
    
    total_c = Decimal("0.00")
    total_r = Decimal("0.00")
    
    for item_in in obj_in.items:
        t_cost = Decimal(str(item_in.unit_cost_price)) * Decimal(item_in.quantity)
        t_resale = Decimal(str(item_in.unit_resale_price)) * Decimal(item_in.quantity)
        
        db_item = SupplierOrderItem(
            supplier_order_id=db_order.id,
            lens_model_id=item_in.lens_model_id,
            model_name=item_in.model_name,
            dioptria=item_in.dioptria,
            quantity=item_in.quantity,
            unit_cost_price=item_in.unit_cost_price,
            total_cost_price=t_cost,
            unit_resale_price=item_in.unit_resale_price,
            total_resale_price=t_resale
        )
        db.add(db_item)
        total_c += t_cost
        total_r += t_resale
        
    margin_amt = total_r - total_c
    margin_pct = (margin_amt / total_r * Decimal("100.00")) if total_r > 0 else Decimal("0.00")
    
    db_order.total_cost = total_c
    db_order.total_estimated_resale = total_r
    db_order.gross_margin_amount = margin_amt
    db_order.gross_margin_percent = margin_pct
    
    await db.commit()
    return await get_supplier_order(db, db_order.id)

async def get_supplier_orders(db: AsyncSession, skip: int = 0, limit: int = 50) -> List[SupplierOrder]:
    query = (
        select(SupplierOrder)
        .options(selectinload(SupplierOrder.items))
        .order_by(desc(SupplierOrder.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list((await db.execute(query)).scalars().all())

async def get_supplier_order(db: AsyncSession, order_id: uuid.UUID) -> Optional[SupplierOrder]:
    query = (
        select(SupplierOrder)
        .where(SupplierOrder.id == order_id)
        .options(selectinload(SupplierOrder.items))
    )
    return (await db.execute(query)).scalars().first()

async def create_order_from_predictive_ai(
    db: AsyncSession,
    supplier_name: str = "Distribuidora de Lentes Matriz",
    lead_time_days: int = 7,
    safety_days: int = 30,
    coverage_days: int = 15
) -> SupplierOrder:
    alerts = await calculate_predictive_alerts(db, lead_time_days=lead_time_days, safety_days=safety_days, coverage_days=coverage_days)
    
    items_to_create = []
    for alert in alerts:
        suggested_qty = alert.get("suggested_buy_qty", 0)
        if suggested_qty > 0:
            unit_c = Decimal(str(alert.get("cost_price", 35.00)))
            unit_r = Decimal(str(alert.get("sale_price", unit_c * Decimal("3.0"))))
            
            items_to_create.append(SupplierOrderItemCreate(
                lens_model_id=alert.get("lens_model_id"),
                model_name=f"{alert.get('brand')} {alert.get('material')}",
                dioptria=f"Sph {alert.get('spherical')} / Cyl {alert.get('cylindrical')}",
                quantity=suggested_qty,
                unit_cost_price=unit_c,
                unit_resale_price=unit_r
            ))
            
    if not items_to_create:
        # Cria item padrao caso nao haja rupturas ativas
        items_to_create.append(SupplierOrderItemCreate(
            model_name="Lente Essilor Crizal 1.56",
            dioptria="Sph -2.00 / Cyl -1.00",
            quantity=10,
            unit_cost_price=Decimal("35.00"),
            unit_resale_price=Decimal("120.00")
        ))
        
    order_in = SupplierOrderCreate(
        supplier_name=supplier_name,
        notes="Pedido gerado automaticamente pela IA de Compras Preditivas",
        items=items_to_create
    )
    return await create_supplier_order(db, order_in)
