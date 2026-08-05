import uuid
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.block import BlockModel, BlockGridItem
from backend.app.schemas.block import BlockModelCreate, BlockModelUpdate, BlockGridItemUpdate

DEFAULT_BASE_CURVES = [Decimal("2.00"), Decimal("4.00"), Decimal("6.00")]
DEFAULT_ADDITIONS = [
    Decimal("0.75"), Decimal("1.00"), Decimal("1.25"), Decimal("1.50"),
    Decimal("1.75"), Decimal("2.00"), Decimal("2.25"), Decimal("2.50"),
    Decimal("2.75"), Decimal("3.00"), Decimal("3.25")
]

def parse_decimal_list(config_str: Optional[str], default_list: List[Decimal]) -> List[Decimal]:
    """Converte uma string separada por vírgula em lista de Decimals ordenados."""
    if not config_str or not config_str.strip():
        return default_list
    try:
        parts = [p.strip().replace('+', '') for p in config_str.split(',') if p.strip()]
        vals = sorted(list(set(Decimal(p) for p in parts if p)))
        return vals if vals else default_list
    except Exception:
        return default_list

async def get_block_models(db: AsyncSession, active_only: bool = False) -> List[BlockModel]:
    """Lista todos os modelos de blocos cadastrados."""
    query = select(BlockModel).options(selectinload(BlockModel.grid_items))
    if active_only:
        query = query.where(BlockModel.is_active == True)
    result = await db.execute(query.order_by(BlockModel.brand, BlockModel.name))
    return list(result.scalars().all())

async def get_block_model_by_id(db: AsyncSession, model_id: uuid.UUID) -> Optional[BlockModel]:
    """Obtém um modelo de bloco específico com seus itens de grade."""
    query = (
        select(BlockModel)
        .where(BlockModel.id == model_id)
        .options(selectinload(BlockModel.grid_items))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def create_block_model(db: AsyncSession, data: BlockModelCreate) -> BlockModel:
    """Cria um novo modelo de bloco com suporte a preços e bases/adições customizadas."""
    block_model = BlockModel(
        brand=data.brand.strip(),
        name=data.name.strip(),
        material=data.material.strip(),
        refractive_index=Decimal(str(data.refractive_index)),
        cost_price=Decimal(str(data.cost_price)),
        sale_price=Decimal(str(data.sale_price)),
        is_active=data.is_active,
        base_curves_config=data.base_curves_config,
        additions_config=data.additions_config
    )
    db.add(block_model)
    await db.flush()

    # Gera a matriz de células zeradas com base nas curvas e adições especificadas
    await generate_grid_for_model(db, block_model.id)
    await db.commit()
    return await get_block_model_by_id(db, block_model.id)

async def update_block_model(db: AsyncSession, model_id: uuid.UUID, data: BlockModelUpdate) -> Optional[BlockModel]:
    """Atualiza dados cadastrais, financeiros e especificações do modelo de bloco."""
    block_model = await get_block_model_by_id(db, model_id)
    if not block_model:
        return None

    if data.brand is not None:
        block_model.brand = data.brand.strip()
    if data.name is not None:
        block_model.name = data.name.strip()
    if data.material is not None:
        block_model.material = data.material.strip()
    if data.refractive_index is not None:
        block_model.refractive_index = Decimal(str(data.refractive_index))
    if data.cost_price is not None:
        block_model.cost_price = Decimal(str(data.cost_price))
    if data.sale_price is not None:
        block_model.sale_price = Decimal(str(data.sale_price))
    if data.is_active is not None:
        block_model.is_active = data.is_active
    if data.base_curves_config is not None:
        block_model.base_curves_config = data.base_curves_config
    if data.additions_config is not None:
        block_model.additions_config = data.additions_config

    db.add(block_model)
    await db.flush()

    # Regenera/garante que as células para as bases/adições estejam criadas
    await generate_grid_for_model(db, block_model.id)
    await db.commit()
    return await get_block_model_by_id(db, model_id)

async def delete_block_model(db: AsyncSession, model_id: uuid.UUID) -> bool:
    """Exclui permanentemente um modelo de bloco e suas células de grade."""
    block_model = await get_block_model_by_id(db, model_id)
    if not block_model:
        return False
    await db.delete(block_model)
    await db.commit()
    return True

async def generate_grid_for_model(db: AsyncSession, model_id: uuid.UUID) -> List[BlockGridItem]:
    """Gera as células da grade para o modelo de bloco com suporte a olho Direito (D) e Esquerdo (E)."""
    block_model = await get_block_model_by_id(db, model_id)
    
    bases = parse_decimal_list(block_model.base_curves_config if block_model else None, DEFAULT_BASE_CURVES)
    additions = parse_decimal_list(block_model.additions_config if block_model else None, DEFAULT_ADDITIONS)

    existing_res = await db.execute(
        select(BlockGridItem).where(BlockGridItem.block_model_id == model_id)
    )
    existing_items = existing_res.scalars().all()
    
    # Migra automaticamente qualquer item legado 'AMBOS' em sub-itens explícitos 'D' e 'E'
    ambos_items = [i for i in existing_items if i.eye_side == "AMBOS"]
    if ambos_items:
        for old_item in ambos_items:
            qty_d = (old_item.quantity_available + 1) // 2
            qty_e = old_item.quantity_available // 2
            
            item_d = BlockGridItem(
                block_model_id=model_id,
                base_curve=old_item.base_curve,
                addition=old_item.addition,
                eye_side="D",
                quantity_available=qty_d,
                min_stock=old_item.min_stock,
                barcode=f"{old_item.barcode}-D" if old_item.barcode else None,
                location_tag=f"{old_item.location_tag}-D" if old_item.location_tag else None
            )
            item_e = BlockGridItem(
                block_model_id=model_id,
                base_curve=old_item.base_curve,
                addition=old_item.addition,
                eye_side="E",
                quantity_available=qty_e,
                min_stock=old_item.min_stock,
                barcode=f"{old_item.barcode}-E" if old_item.barcode else None,
                location_tag=f"{old_item.location_tag}-E" if old_item.location_tag else None
            )
            db.add_all([item_d, item_e])
            await db.delete(old_item)
        await db.commit()

        existing_res = await db.execute(
            select(BlockGridItem).where(BlockGridItem.block_model_id == model_id)
        )
        existing_items = existing_res.scalars().all()

    existing_set = {(float(i.base_curve), float(i.addition), i.eye_side) for i in existing_items}

    new_items = []
    for base in bases:
        for add in additions:
            for side in ["D", "E"]:
                key = (float(base), float(add), side)
                if key not in existing_set:
                    item = BlockGridItem(
                        block_model_id=model_id,
                        base_curve=base,
                        addition=add,
                        eye_side=side,
                        quantity_available=0,
                        quantity_reserved=0,
                        min_stock=2
                    )
                    db.add(item)
                    new_items.append(item)

    if new_items:
        await db.commit()

    res = await db.execute(
        select(BlockGridItem)
        .where(BlockGridItem.block_model_id == model_id)
        .order_by(BlockGridItem.base_curve.asc(), BlockGridItem.addition.asc(), BlockGridItem.eye_side.asc())
    )
    return list(res.scalars().all())

async def get_grid_matrix_data(db: AsyncSession, model_id: uuid.UUID) -> Dict[str, Any]:
    """Retorna os dados estruturados da matriz de blocos (bases, adições, subcolunas D/E e grade)."""
    block_model = await get_block_model_by_id(db, model_id)
    items = await generate_grid_for_model(db, model_id)

    bases_dec = parse_decimal_list(block_model.base_curves_config if block_model else None, DEFAULT_BASE_CURVES)
    additions_dec = parse_decimal_list(block_model.additions_config if block_model else None, DEFAULT_ADDITIONS)

    bases = [float(b) for b in bases_dec]
    additions = [float(a) for a in additions_dec]

    grid_map = {}
    for item in items:
        k_side = f"{float(item.base_curve):.2f}_{float(item.addition):.2f}_{item.eye_side}"
        item_obj = {
            "id": str(item.id),
            "base_curve": float(item.base_curve),
            "addition": float(item.addition),
            "eye_side": item.eye_side,
            "quantity_available": item.quantity_available,
            "min_stock": item.min_stock,
            "barcode": item.barcode,
            "location_tag": item.location_tag
        }
        grid_map[k_side] = item_obj

        k_agg = f"{float(item.base_curve):.2f}_{float(item.addition):.2f}"
        if k_agg not in grid_map:
            grid_map[k_agg] = {
                "base_curve": float(item.base_curve),
                "addition": float(item.addition),
                "quantity_available": 0,
                "items": []
            }
        grid_map[k_agg]["quantity_available"] += item.quantity_available
        grid_map[k_agg]["items"].append(item_obj)

    return {
        "model": {
            "id": str(block_model.id) if block_model else str(model_id),
            "brand": block_model.brand if block_model else "",
            "name": block_model.name if block_model else "",
            "material": block_model.material if block_model else "CR-39",
            "refractive_index": float(block_model.refractive_index) if block_model else 1.56,
            "cost_price": float(block_model.cost_price) if block_model else 35.0,
            "sale_price": float(block_model.sale_price) if block_model else 95.0,
            "is_active": block_model.is_active if block_model else True,
            "base_curves_config": block_model.base_curves_config if block_model else "2.00, 4.00, 6.00",
            "additions_config": block_model.additions_config if block_model else "0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"
        },
        "base_curves": bases,
        "additions": additions,
        "items_map": grid_map,
        "total_items": len(items)
    }

async def update_grid_item(db: AsyncSession, item_id: uuid.UUID, data: BlockGridItemUpdate) -> Optional[BlockGridItem]:
    """Atualiza quantidade, estoque mínimo, código de barras ou localização de um item da grade."""
    res = await db.execute(select(BlockGridItem).where(BlockGridItem.id == item_id))
    item = res.scalars().first()
    if not item:
        return None

    if data.quantity_available is not None:
        item.quantity_available = max(0, data.quantity_available)
    if data.min_stock is not None:
        item.min_stock = max(0, data.min_stock)
    if data.barcode is not None:
        item.barcode = data.barcode.strip() if data.barcode else None
    if data.location_tag is not None:
        item.location_tag = data.location_tag.strip() if data.location_tag else None

    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

async def increment_by_barcode(db: AsyncSession, barcode: str, quantity: int = 1) -> Optional[BlockGridItem]:
    """Incrementa a quantidade disponível de um bloco através de código de barras bipado."""
    res = await db.execute(select(BlockGridItem).where(BlockGridItem.barcode == barcode.strip()))
    item = res.scalars().first()
    if not item:
        return None

    item.quantity_available += quantity
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
