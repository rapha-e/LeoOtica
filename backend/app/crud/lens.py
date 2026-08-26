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
    from backend.app.crud.degree_policy import get_active_policy
    from backend.app.crud.crud_system_parameters import get_all_parameters, get_preset_key_for_lens
    from datetime import datetime, timezone
    from fastapi import HTTPException, status

    code_in = getattr(obj_in, "code", None)
    
    # 0. Verifica se já existe um modelo com o mesmo código de barras ou atributos principais
    if code_in:
        model_by_code = (await db.execute(select(LensModel).where(LensModel.code == code_in))).scalars().first()
        if model_by_code:
            if (model_by_code.brand == obj_in.brand and 
                model_by_code.treatment == obj_in.treatment and 
                model_by_code.refractive_index == obj_in.refractive_index and 
                model_by_code.diameter == obj_in.diameter):
                return model_by_code
            else:
                # O código de barras pertence a outro modelo comercial; limpa o campo `code` do modelo para evitar violação UNIQUE em lens_models.code
                code_in = None

    existing_model = await get_lens_model_by_attributes(
        db,
        brand=obj_in.brand,
        material=obj_in.material,
        refractive_index=obj_in.refractive_index,
        treatment=obj_in.treatment,
        diameter=obj_in.diameter,
        matrix_type=getattr(obj_in, "matrix_type", None)
    )
    
    if existing_model:
        # Atualiza o código de barras no modelo se informado
        if code_in and not existing_model.code:
            existing_model.code = code_in
            db.add(existing_model)

        # Garante que o Product correspondente no catálogo financeiro existe e está atualizado
        p_query = select(Product).where(Product.lens_model_id == existing_model.id)
        p_result = await db.execute(p_query)
        prod = p_result.scalar_one_or_none()
        
        if prod:
            if code_in and (not prod.sku or prod.sku.startswith("L-")):
                prod.sku = code_in
            if obj_in.cost_price is not None:
                prod.cost_price = float(obj_in.cost_price)
            if obj_in.sale_price is not None:
                prod.sale_price = float(obj_in.sale_price)
            db.add(prod)
        else:
            # Cria o Product se porventura não existia
            idx_str = f"{existing_model.refractive_index:.2f}"
            name_parts = ["Lente", (existing_model.brand or "").strip(), (existing_model.treatment or "").strip(), idx_str]
            prod_name = " ".join(part for part in name_parts if part)
            sku_code = code_in or f"L-{(existing_model.brand or 'LNT')[:3].upper()}-{(existing_model.treatment or 'INC')[:3].upper()}-{str(existing_model.id)[:4].upper()}"
            new_p = Product(
                name=prod_name,
                description=f"Lente física de estoque. Material: {existing_model.material}.",
                sku=sku_code,
                cost_price=float(existing_model.cost_price),
                sale_price=float(existing_model.sale_price),
                is_active=True,
                is_lens=True,
                brand=existing_model.brand,
                material=existing_model.material,
                refractive_index=float(existing_model.refractive_index),
                treatment=existing_model.treatment,
                diameter=existing_model.diameter,
                lens_model_id=existing_model.id,
                current_version=1
            )
            db.add(new_p)

        await db.commit()
        await db.refresh(existing_model)
        return existing_model

    sys_params = await get_all_parameters(db)
    policy = await get_active_policy(db)
    
    pk = get_preset_key_for_lens(
        brand=obj_in.brand,
        name=getattr(obj_in, "name", None),
        refractive_index=obj_in.refractive_index,
        treatment=obj_in.treatment,
        material=obj_in.material
    )

    sys_base = sys_params.get(f"{pk}_price_base") if pk else None
    sys_over = sys_params.get(f"{pk}_price_over") if pk else None
    sys_thresh = sys_params.get(f"{pk}_cyl_threshold") if pk else None

    default_base = Decimal(str(sys_base)) if sys_base else (policy.default_sale_price_le if policy else Decimal("75.00"))
    default_over = Decimal(str(sys_over)) if sys_over else (policy.default_sale_price_gt if policy else Decimal("95.00"))
    default_thresh = Decimal(str(sys_thresh)) if sys_thresh else (policy.degree_threshold if policy else Decimal("2.00"))

    is_generic_price = (obj_in.sale_price is None or obj_in.sale_price == Decimal("75.00"))
    is_generic_over = (obj_in.sale_price_over_threshold is None or obj_in.sale_price_over_threshold == Decimal("95.00"))
    is_generic_thresh = (obj_in.degree_threshold is None or obj_in.degree_threshold == Decimal("2.00"))

    sale_le = obj_in.sale_price if (not is_generic_price and obj_in.sale_price is not None) else default_base
    sale_gt = obj_in.sale_price_over_threshold if (not is_generic_over and obj_in.sale_price_over_threshold is not None) else default_over
    deg_threshold = obj_in.degree_threshold if (not is_generic_thresh and obj_in.degree_threshold is not None) else default_thresh

    db_obj = LensModel(
        code=code_in,
        name=getattr(obj_in, "name", None) or obj_in.brand,
        brand=obj_in.brand,
        material=obj_in.material,
        refractive_index=obj_in.refractive_index,
        treatment=obj_in.treatment,
        diameter=obj_in.diameter,
        matrix_type=getattr(obj_in, "matrix_type", None) or "LP_GRADE",
        production_route=getattr(obj_in, "production_route", None) or "EXPRESSA_FACETAMENTO",
        cost_price=obj_in.cost_price,
        sale_price=sale_le,
        degree_threshold=deg_threshold,
        sale_price_over_threshold=sale_gt
    )
    db.add(db_obj)
    await db.flush()  # Gera o id do LensModel no banco
    
    # Cria o correspondente Product faturável no catálogo comercial
    idx_str = f"{db_obj.refractive_index:.2f}"
    brand_val = (db_obj.brand or "").strip()
    treat_val = (db_obj.treatment or "").strip()
    name_parts = ["Lente", brand_val, treat_val, idx_str]
    prod_name = " ".join(part for part in name_parts if part)
    
    code_in = getattr(obj_in, "code", None)
    brand_slug = brand_val[:3].upper() if brand_val else "LNT"
    treat_slug = treat_val[:3].upper() if treat_val else "INC"
    idx_slug = idx_str.replace(".", "")
    rand_id = str(db_obj.id)[:4].upper()
    default_sku = f"L-{brand_slug}-{treat_slug}-{idx_slug}-{rand_id}"

    sku_code = default_sku
    if code_in:
        existing_sku = (await db.execute(select(Product).where(Product.sku == code_in))).scalars().first()
        if not existing_sku:
            sku_code = code_in
    
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
        start_date=datetime.now(timezone.utc),
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
    from datetime import datetime, timezone

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
        name_parts = ["Lente", (db_obj.brand or "").strip(), (db_obj.treatment or "").strip(), idx_str]
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
                start_date=datetime.now(timezone.utc),
                change_reason="Atualizacao de preco da lente (unificacao)"
            )
            db.add(price_hist)
        else:
            db.add(prod)
            
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_lens_model(db: AsyncSession, model_id: uuid.UUID) -> bool:
    from backend.app.models.financial_catalog import Product, PriceHistory
    from backend.app.models.lens import LensInventoryGrade, DegreePricingPolicyRange
    from sqlalchemy import delete, and_

    db_obj = await get_lens_model(db, model_id)
    if not db_obj:
        return False
        
    # 1. Remove os correspondentes Products comerciais do catálogo e seus históricos de preço
    p_query = select(Product).where(Product.lens_model_id == db_obj.id)
    p_result = await db.execute(p_query)
    prods = p_result.scalars().all()
    for prod in prods:
        await db.execute(
            delete(PriceHistory).where(
                and_(
                    PriceHistory.entity_type == "product",
                    PriceHistory.entity_id == prod.id
                )
            )
        )
        await db.delete(prod)
        
    # 2. Deleta explicitamente a grade de estoque (dioptrias/itens) vinculada a esta lente
    await db.execute(delete(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == db_obj.id))

    # 3. Deleta políticas de preço por grau vinculadas
    await db.execute(delete(DegreePricingPolicyRange).where(DegreePricingPolicyRange.lens_model_id == db_obj.id))

    # 4. Remove o modelo da lente
    await db.delete(db_obj)
    await db.commit()
    return True

async def delete_inventory_item(db: AsyncSession, item_id: uuid.UUID) -> bool:
    inventory_item = await get_inventory_item(db, item_id)
    if not inventory_item:
        return False
    await db.delete(inventory_item)
    await db.commit()
    return True

async def get_lens_model_by_attributes(
    db: AsyncSession, brand: Optional[str] = None, material: Optional[str] = None, refractive_index: Optional[Decimal] = None, treatment: Optional[str] = None, diameter: Optional[int] = None, matrix_type: Optional[str] = None
) -> Optional[LensModel]:
    from sqlalchemy import func
    filters = []
    if brand:
        filters.append(func.lower(LensModel.brand) == func.lower(brand.strip()))
    if material:
        filters.append(func.lower(LensModel.material) == func.lower(material.strip()))
    if refractive_index is not None:
        filters.append(LensModel.refractive_index == refractive_index)
    if treatment:
        filters.append(func.lower(LensModel.treatment) == func.lower(treatment.strip()))
    if diameter is not None:
        filters.append(LensModel.diameter == diameter)
    if matrix_type:
        filters.append(LensModel.matrix_type == matrix_type)
        
    if not filters:
        return None
        
    query = select(LensModel).where(*filters)
    result = await db.execute(query)
    return result.scalars().first()


# --- LENS INVENTORY GRADE CRUD ---

async def get_inventory_by_barcode(db: AsyncSession, barcode: str) -> Optional[LensInventoryGrade]:
    query = select(LensInventoryGrade).where(LensInventoryGrade.barcode == barcode).options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalars().first()

async def get_inventory_by_dioptria(
    db: AsyncSession, 
    lens_model_id: uuid.UUID, 
    spherical: Optional[Decimal] = Decimal("0.00"), 
    cylindrical: Optional[Decimal] = Decimal("0.00"),
    base_curve: Optional[Decimal] = None,
    addition: Optional[Decimal] = None,
    eye: Optional[str] = None
) -> Optional[LensInventoryGrade]:
    query = select(LensInventoryGrade).where(
        LensInventoryGrade.lens_model_id == lens_model_id
    )
    
    # Se for multifocal ou bloco (possui base_curve, addition ou eye)
    if base_curve is not None or addition is not None or eye is not None:
        if base_curve is not None:
            query = query.where(LensInventoryGrade.base_curve == base_curve)
        if addition is not None:
            query = query.where(LensInventoryGrade.addition == addition)
        if eye is not None:
            query = query.where(LensInventoryGrade.eye == eye)
    else:
        # Lentes padrão de grade esférico/cilíndrico (LP_GRADE / GRADE_167)
        if spherical is not None:
            query = query.where(LensInventoryGrade.spherical == spherical)
        else:
            query = query.where(LensInventoryGrade.spherical.is_(None))

        if cylindrical is not None:
            query = query.where(LensInventoryGrade.cylindrical == cylindrical)
        else:
            query = query.where(LensInventoryGrade.cylindrical.is_(None))

    query = query.options(selectinload(LensInventoryGrade.lens_model))
    result = await db.execute(query)
    return result.scalars().first()

async def create_inventory_item(db: AsyncSession, obj_in: LensInventoryGradeCreate) -> LensInventoryGrade:
    db_obj = LensInventoryGrade(
        lens_model_id=obj_in.lens_model_id,
        spherical=obj_in.spherical,
        cylindrical=obj_in.cylindrical,
        base_curve=getattr(obj_in, "base_curve", None),
        addition=getattr(obj_in, "addition", None),
        eye=getattr(obj_in, "eye", None),
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

async def get_inventory_grid(
    db: AsyncSession, 
    lens_model_id: Optional[uuid.UUID] = None,
    matrix_type: Optional[str] = None
) -> List[LensInventoryGrade]:
    query = select(LensInventoryGrade).join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id).options(selectinload(LensInventoryGrade.lens_model))
    if lens_model_id is not None:
        query = query.where(LensInventoryGrade.lens_model_id == lens_model_id)
    if matrix_type is not None:
        query = query.where(LensModel.matrix_type == matrix_type)
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

