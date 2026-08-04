import uuid
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.schemas.lens import LensModelCreate, LensInventoryGradeCreate, LensModelUpdate

# --- LENS MODEL CRUD ---

async def create_lens_model(db: AsyncSession, obj_in: LensModelCreate) -> LensModel:
    from backend.app.models.financial_catalog import Product, PriceHistory
    from datetime import datetime

    db_obj = LensModel(
        brand=obj_in.brand,
        material=obj_in.material,
        refractive_index=obj_in.refractive_index,
        treatment=obj_in.treatment,
        diameter=obj_in.diameter,
        cost_price=obj_in.cost_price,
        sale_price=obj_in.sale_price
    )
    db.add(db_obj)
    await db.flush()  # Gera o id do LensModel no banco
    
    # Cria o correspondente Product faturável no catálogo comercial
    idx_str = f"{db_obj.refractive_index:.2f}"
    name_parts = ["Lente", db_obj.brand.strip(), db_obj.treatment.strip(), idx_str]
    prod_name = " ".join(part for part in name_parts if part)
    
    brand_slug = db_obj.brand[:3].upper() if db_obj.brand else "LNT"
    treat_slug = db_obj.treatment[:3].upper() if db_obj.treatment else "INC"
    idx_slug = idx_str.replace(".", "")
    rand_id = str(db_obj.id)[:4].upper()
    sku_code = f"L-{brand_slug}-{treat_slug}-{idx_slug}-{rand_id}"
    
    new_prod = Product(
        name=prod_name,
        description=f"Lente fisica de estoque. Material: {db_obj.material}, Diametro: {db_obj.diameter}mm.",
        sku=sku_code,
        cost_price=float(db_obj.cost_price),
        sale_price=float(db_obj.sale_price),
        is_active=True,
        is_lens=True,
        brand=db_obj.brand,
        material=db_obj.material,
        refractive_index=float(db_obj.refractive_index),
        treatment=db_obj.treatment,
        diameter=db_obj.diameter,
        lens_model_id=db_obj.id,
        current_version=1
    )
    db.add(new_prod)
    await db.flush()
    
    # Registra preço histórico de versão inicial do produto
    price_hist = PriceHistory(
        entity_type="product",
        entity_id=new_prod.id,
        price=new_prod.sale_price,
        cost_price=new_prod.cost_price,
        version=1,
        start_date=datetime.utcnow(),
        change_reason="Cadastro de lente (unificacao)"
    )
    db.add(price_hist)
    
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def get_lens_models(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[LensModel]:
    query = select(LensModel).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_lens_model(db: AsyncSession, model_id: uuid.UUID) -> Optional[LensModel]:
    query = select(LensModel).where(LensModel.id == model_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def update_lens_model(db: AsyncSession, model_id: uuid.UUID, obj_in: LensModelUpdate) -> Optional[LensModel]:
    from backend.app.models.financial_catalog import Product, PriceHistory
    from datetime import datetime

    db_obj = await get_lens_model(db, model_id)
    if not db_obj:
        return None
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    await db.flush()
    
    # Sincroniza com o Product correspondente se houver no catálogo
    p_query = select(Product).where(Product.lens_model_id == db_obj.id)
    p_result = await db.execute(p_query)
    prod = p_result.scalar_one_or_none()
    
    if prod:
        idx_str = f"{db_obj.refractive_index:.2f}"
        name_parts = ["Lente", db_obj.brand.strip(), db_obj.treatment.strip(), idx_str]
        prod.name = " ".join(part for part in name_parts if part)
        prod.cost_price = float(db_obj.cost_price)
        
        new_sale_price = float(db_obj.sale_price)
        if prod.sale_price != new_sale_price or prod.cost_price != float(db_obj.cost_price):
            prod.sale_price = new_sale_price
            prod.current_version += 1
            db.add(prod)
            await db.flush()
            
            price_hist = PriceHistory(
                entity_type="product",
                entity_id=prod.id,
                price=prod.sale_price,
                cost_price=prod.cost_price,
                version=prod.current_version,
                start_date=datetime.utcnow(),
                change_reason="Atualizacao de preco da lente (unificacao)"
            )
            db.add(price_hist)
        else:
            db.add(prod)
            
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_lens_model(db: AsyncSession, model_id: uuid.UUID) -> bool:
    from backend.app.models.financial_catalog import Product

    db_obj = await get_lens_model(db, model_id)
    if not db_obj:
        return False
        
    # Remove o correspondente Product comercial do catálogo
    p_query = select(Product).where(Product.lens_model_id == db_obj.id)
    p_result = await db.execute(p_query)
    prod = p_result.scalar_one_or_none()
    if prod:
        await db.delete(prod)
        
    await db.delete(db_obj)
    await db.commit()
    return True

async def get_lens_model_by_attributes(
    db: AsyncSession, brand: str, material: str, refractive_index: Decimal, treatment: str, diameter: int
) -> Optional[LensModel]:
    query = select(LensModel).where(
        LensModel.brand == brand,
        LensModel.material == material,
        LensModel.refractive_index == refractive_index,
        LensModel.treatment == treatment,
        LensModel.diameter == diameter
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


# --- LENS INVENTORY GRADE CRUD ---

async def get_inventory_by_barcode(db: AsyncSession, barcode: str) -> Optional[LensInventoryGrade]:
    query = select(LensInventoryGrade).where(LensInventoryGrade.barcode == barcode).options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def get_inventory_by_dioptria(
    db: AsyncSession, lens_model_id: uuid.UUID, spherical: Decimal, cylindrical: Decimal
) -> Optional[LensInventoryGrade]:
    query = select(LensInventoryGrade).where(
        LensInventoryGrade.lens_model_id == lens_model_id,
        LensInventoryGrade.spherical == spherical,
        LensInventoryGrade.cylindrical == cylindrical
    ).options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_inventory_item(db: AsyncSession, obj_in: LensInventoryGradeCreate) -> LensInventoryGrade:
    db_obj = LensInventoryGrade(
        lens_model_id=obj_in.lens_model_id,
        spherical=obj_in.spherical,
        cylindrical=obj_in.cylindrical,
        barcode=obj_in.barcode,
        quantity_available=obj_in.quantity_available,
        location_tag=obj_in.location_tag
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    # Recarrega com a relação lens_model para retornar no schema
    query = select(LensInventoryGrade).where(LensInventoryGrade.id == db_obj.id).options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalar_one()

async def get_inventory_grid(db: AsyncSession, lens_model_id: Optional[uuid.UUID] = None) -> List[LensInventoryGrade]:
    query = select(LensInventoryGrade).options(selectinload(LensInventoryGrade.lens_model))
    if lens_model_id is not None:
        query = query.where(LensInventoryGrade.lens_model_id == lens_model_id)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_inventory_item(db: AsyncSession, item_id: uuid.UUID) -> Optional[LensInventoryGrade]:
    query = select(LensInventoryGrade).where(LensInventoryGrade.id == item_id).options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_predictive_inventory_report(db: AsyncSession) -> dict:
    """
    Motor Preditivo de Estoque Adaptativo & Parametrizável.
    Calcula Ruptura, Crítico, Baixo, Normal, Excedente e Sugestões de Compra.
    """
    from backend.app.crud.crud_system_parameters import get_parameter
    
    crit_qty = int(await get_parameter(db, "inventory_critical_qty", "0"))
    low_qty = int(await get_parameter(db, "inventory_low_qty", "5"))
    ideal_qty = int(await get_parameter(db, "inventory_ideal_qty", "15"))
    lead_time = int(await get_parameter(db, "inventory_lead_time_days", "10"))
    safety_days = int(await get_parameter(db, "inventory_safety_stock_days", "7"))
    coverage_days = int(await get_parameter(db, "inventory_desired_coverage_days", "30"))

    grid_items = await get_inventory_grid(db)

    # Busca também os itens da grade de blocos
    from backend.app.models.block import BlockGridItem
    block_stmt = select(BlockGridItem).options(selectinload(BlockGridItem.block_model))
    block_items = (await db.execute(block_stmt)).scalars().all()

    counts = {
        "RUPTURA": 0,
        "CRITICO": 0,
        "BAIXO": 0,
        "NORMAL": 0,
        "EXCEDENTE": 0
    }
    
    suggestions = []
    
    for item in grid_items:
        qty = item.quantity_available
        if qty == 0:
            status = "RUPTURA"
        elif qty <= crit_qty:
            status = "CRITICO"
        elif qty <= low_qty:
            status = "BAIXO"
        elif qty <= ideal_qty:
            status = "NORMAL"
        else:
            status = "EXCEDENTE"
            
        counts[status] += 1

        if qty <= low_qty:
            needed = ideal_qty - qty
            suggestions.append({
                "item_id": str(item.id),
                "item_type": "LENTE",
                "model_name": f"{item.lens_model.brand} {item.lens_model.material} ({item.lens_model.refractive_index})",
                "dioptria": f"ESF: {item.spherical:+.2f} | CIL: {item.cylindrical:+.2f}",
                "current_qty": qty,
                "suggested_buy_qty": needed if needed > 0 else 10,
                "status": status,
                "estimated_cost": float(needed * float(item.lens_model.cost_price or 0))
            })

    for bitem in block_items:
        if not bitem.block_model or not bitem.block_model.is_active:
            continue
        qty = bitem.quantity_available
        if qty == 0:
            status = "RUPTURA"
        elif qty <= crit_qty:
            status = "CRITICO"
        elif qty <= low_qty:
            status = "BAIXO"
        elif qty <= ideal_qty:
            status = "NORMAL"
        else:
            status = "EXCEDENTE"

        counts[status] += 1

        if qty <= low_qty:
            needed = ideal_qty - qty
            suggestions.append({
                "item_id": str(bitem.id),
                "item_type": "BLOCO",
                "model_name": f"[BLOCO] {bitem.block_model.brand} {bitem.block_model.name} ({bitem.block_model.material})",
                "dioptria": f"Base: {float(bitem.base_curve):+.2f} | Adição: {float(bitem.addition):+.2f}",
                "current_qty": qty,
                "suggested_buy_qty": needed if needed > 0 else 10,
                "status": status,
                "estimated_cost": float(needed * float(bitem.block_model.cost_price or 0))
            })

    return {
        "parameters": {
            "critical_qty": crit_qty,
            "low_qty": low_qty,
            "ideal_qty": ideal_qty,
            "lead_time_days": lead_time,
            "safety_stock_days": safety_days,
            "desired_coverage_days": coverage_days
        },
        "counts": counts,
        "total_items_evaluated": len(grid_items) + len(block_items),
        "purchase_suggestions": suggestions
    }

