import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.financial_catalog import Product, Treatment, TechnicalService, PriceHistory
from backend.app.schemas.financial_catalog import (
    ProductCreate, ProductUpdate, 
    TreatmentCreate, TreatmentUpdate, 
    TechnicalServiceCreate, TechnicalServiceUpdate
)

# --- 1. PRODUTOS ---

async def get_product(db: AsyncSession, product_id: uuid.UUID) -> Optional[Product]:
    return (await db.execute(select(Product).where(Product.id == product_id))).scalars().first()

async def get_product_by_sku(db: AsyncSession, sku: str) -> Optional[Product]:
    return (await db.execute(select(Product).where(Product.sku == sku))).scalars().first()

async def get_products(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[Product]:
    sql_query = select(Product)
    conditions = []
    
    if is_active is not None:
        conditions.append(Product.is_active == is_active)
    if query:
        search_term = f"%{query}%"
        conditions.append(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term)
            )
        )
    if conditions:
        sql_query = sql_query.where(and_(*conditions))
        
    sql_query = sql_query.order_by(Product.name.asc()).offset(skip).limit(limit)
    products = list((await db.execute(sql_query)).scalars().all())
    
    # Sincroniza dinamicamente o SKU dos produtos com o campo 'barcode' das lentes de estoque e atributos de grade
    from backend.app.models.lens import LensInventoryGrade, LensModel
    needs_commit = False
    for p in products:
        if p.lens_model_id:
            m_stmt = select(LensModel).where(LensModel.id == p.lens_model_id)
            lens_m = (await db.execute(m_stmt)).scalars().first()
            
            g_stmt = select(LensInventoryGrade).where(
                LensInventoryGrade.lens_model_id == p.lens_model_id
            )
            g_items = list((await db.execute(g_stmt)).scalars().all())

            if lens_m:
                if not p.matrix_type and lens_m.matrix_type:
                    p.matrix_type = lens_m.matrix_type
                    needs_commit = True

            if g_items:
                first_g = g_items[0]
                if first_g.barcode and p.sku != first_g.barcode:
                    clean_sku = first_g.barcode.removesuffix("-OD").removesuffix("-OE")
                    if p.sku != clean_sku and p.sku != first_g.barcode:
                        p.sku = clean_sku
                        db.add(p)
                        needs_commit = True

                if p.base_curve is None and first_g.base_curve is not None:
                    p.base_curve = float(first_g.base_curve)
                    needs_commit = True
                if p.addition is None and first_g.addition is not None:
                    p.addition = float(first_g.addition)
                    needs_commit = True
                if p.spherical is None and first_g.spherical is not None:
                    p.spherical = float(first_g.spherical)
                    needs_commit = True
                if p.cylindrical is None and first_g.cylindrical is not None:
                    p.cylindrical = float(first_g.cylindrical)
                    needs_commit = True

    if needs_commit:
        await db.commit()
        
    return products

async def create_product(
    db: AsyncSession,
    product_in: ProductCreate,
    user_id: Optional[uuid.UUID] = None
) -> Product:
    target_matrix = product_in.matrix_type or "MF_ACB"
    db_product = Product(
        name=product_in.name,
        description=product_in.description,
        sku=product_in.sku,
        cost_price=product_in.cost_price,
        sale_price=product_in.sale_price,
        is_active=product_in.is_active if product_in.is_active is not None else True,
        current_version=1,
        # Campos físicos de lente
        is_lens=product_in.is_lens if product_in.is_lens is not None else False,
        brand=product_in.brand,
        material=product_in.material,
        refractive_index=product_in.refractive_index,
        treatment=product_in.treatment,
        diameter=product_in.diameter,
        matrix_type=target_matrix if product_in.is_lens else None,
        quantity=product_in.quantity if product_in.quantity is not None else 1,
        eye_side=product_in.eye_side,
        base_curve=product_in.base_curve,
        addition=product_in.addition,
        spherical=product_in.spherical,
        cylindrical=product_in.cylindrical,
    )
    
    # Se for uma lente, cria ou vincula o LensModel
    if db_product.is_lens:
        from backend.app.models.lens import LensModel, LensInventoryGrade
        from decimal import Decimal
        target_matrix = product_in.matrix_type or "MF_ACB"
        lens_model = LensModel(
            code=db_product.sku,
            name=db_product.name,
            brand=db_product.brand or "Lente",
            material=db_product.material or "Resina",
            refractive_index=Decimal(str(db_product.refractive_index or "1.56")),
            treatment=db_product.treatment or "Incolor",
            diameter=db_product.diameter or 70,
            cost_price=Decimal(str(db_product.cost_price or "25.00")),
            sale_price=Decimal(str(db_product.sale_price or "75.00")),
            matrix_type=target_matrix
        )
        db.add(lens_model)
        await db.flush()
        db_product.lens_model_id = lens_model.id

        # Cria a dioptria / item de estoque físico na grade
        if target_matrix in ["MF_ACB", "MF_BLOCO"]:
            target_eyes = ["OD", "OE"] if (not product_in.eye_side or product_in.eye_side == "AMBOS") else [product_in.eye_side]
            for side in target_eyes:
                side_barcode = f"{db_product.sku}-{side}" if not db_product.sku.endswith(f"-{side}") else db_product.sku
                inv_item = LensInventoryGrade(
                    lens_model_id=lens_model.id,
                    spherical=Decimal(str(product_in.spherical)) if product_in.spherical is not None else Decimal("0.00"),
                    cylindrical=Decimal(str(product_in.cylindrical)) if product_in.cylindrical is not None else Decimal("0.00"),
                    base_curve=Decimal(str(product_in.base_curve)) if product_in.base_curve is not None else None,
                    addition=Decimal(str(product_in.addition)) if product_in.addition is not None else None,
                    eye=side,
                    barcode=side_barcode,
                    quantity_available=product_in.quantity or 1
                )
                db.add(inv_item)
        else:
            inv_item = LensInventoryGrade(
                lens_model_id=lens_model.id,
                spherical=Decimal(str(product_in.spherical)) if product_in.spherical is not None else Decimal("0.00"),
                cylindrical=Decimal(str(product_in.cylindrical)) if product_in.cylindrical is not None else Decimal("0.00"),
                base_curve=Decimal(str(product_in.base_curve)) if (target_matrix == "BLOCO_VS" and product_in.base_curve is not None) else None,
                addition=None,
                eye=None,
                barcode=db_product.sku,
                quantity_available=product_in.quantity or 1
            )
            db.add(inv_item)

    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    
    # Adiciona a versão inicial ao histórico de preços
    price_hist = PriceHistory(
        entity_type="product",
        entity_id=db_product.id,
        price=db_product.sale_price,
        cost_price=db_product.cost_price,
        version=1,
        start_date=datetime.now(timezone.utc),
        changed_by_id=user_id,
        change_reason=product_in.change_reason or "Cadastro inicial do produto"
    )
    db.add(price_hist)
    await db.commit()
    return db_product

async def update_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    product_in: ProductUpdate,
    user_id: Optional[uuid.UUID] = None
) -> Optional[Product]:
    db_product = await get_product(db, product_id)
    if not db_product:
        return None
        
    # Verifica se houve alteração no preço de custo ou de venda
    price_changed = False
    if product_in.cost_price is not None and product_in.cost_price != db_product.cost_price:
        price_changed = True
    if product_in.sale_price is not None and product_in.sale_price != db_product.sale_price:
        price_changed = True
        
    if price_changed:
        # 1. Encerra a validade do histórico de preço anterior
        hist_query = select(PriceHistory).where(
            and_(
                PriceHistory.entity_type == "product",
                PriceHistory.entity_id == product_id,
                PriceHistory.end_date.is_(None)
            )
        )
        last_hist = (await db.execute(hist_query)).scalars().first()
        if last_hist:
            last_hist.end_date = datetime.now(timezone.utc)
            db.add(last_hist)
            
        # 2. Incrementa a versão
        new_version = db_product.current_version + 1
        db_product.current_version = new_version
        
        # 3. Cria o novo registro de histórico
        new_cost = product_in.cost_price if product_in.cost_price is not None else db_product.cost_price
        new_sale = product_in.sale_price if product_in.sale_price is not None else db_product.sale_price
        
        price_hist = PriceHistory(
            entity_type="product",
            entity_id=product_id,
            price=new_sale,
            cost_price=new_cost,
            version=new_version,
            start_date=datetime.now(timezone.utc),
            changed_by_id=user_id,
            change_reason=product_in.change_reason or f"Reajuste de preço (v.{new_version})"
        )
        db.add(price_hist)
        
    # Atualiza demais campos
    update_data = product_in.model_dump(exclude_unset=True)
    update_data.pop("change_reason", None)
    for field, val in update_data.items():
        setattr(db_product, field, val)
        
    # Sincroniza com o LensModel correspondente e Parâmetros do Sistema se for uma lente
    if db_product.is_lens:
        from backend.app.models.lens import LensModel
        from backend.app.crud.crud_system_parameters import get_preset_key_for_lens
        from backend.app.models.system_parameter import SystemParameter
        from decimal import Decimal

        if db_product.lens_model_id:
            lens_model = (await db.execute(select(LensModel).where(LensModel.id == db_product.lens_model_id))).scalars().first()
            if lens_model:
                lens_model.name = db_product.name
                lens_model.brand = db_product.brand or db_product.name
                lens_model.material = db_product.material or "Resina"
                lens_model.refractive_index = Decimal(str(db_product.refractive_index or "1.56"))
                lens_model.treatment = db_product.treatment or "Incolor"
                lens_model.diameter = db_product.diameter or 70
                lens_model.cost_price = Decimal(str(db_product.cost_price or "25.00"))
                lens_model.sale_price = Decimal(str(db_product.sale_price or "75.00"))
                if product_in.matrix_type:
                    lens_model.matrix_type = product_in.matrix_type
                db.add(lens_model)

                # Sincroniza também a grade de estoque físico (LensInventoryGrade)
                from backend.app.models.lens import LensInventoryGrade
                target_m = lens_model.matrix_type or "MF_ACB"
                inv_base = Decimal(str(db_product.base_curve)) if (target_m in ["BLOCO_VS", "MF_ACB", "MF_BLOCO"] and db_product.base_curve is not None) else None
                inv_add = Decimal(str(db_product.addition)) if (target_m in ["MF_ACB", "MF_BLOCO"] and db_product.addition is not None) else None
                inv_sph = Decimal(str(db_product.spherical)) if db_product.spherical is not None else Decimal("0.00")
                inv_cyl = Decimal(str(db_product.cylindrical)) if db_product.cylindrical is not None else Decimal("0.00")

                inv_stmt = select(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == lens_model.id)
                inv_items = (await db.execute(inv_stmt)).scalars().all()

                if target_m in ["MF_ACB", "MF_BLOCO"]:
                    target_eyes = ["OD", "OE"] if (not db_product.eye_side or db_product.eye_side == "AMBOS") else [db_product.eye_side]
                    by_eye = {item.eye: item for item in inv_items if item.eye in ["OD", "OE"]}

                    # Remove itens de olhos não selecionados se o lado foi alterado
                    for item in inv_items:
                        if item.eye not in target_eyes:
                            await db.delete(item)

                    for side in target_eyes:
                        clean_sku = db_product.sku.removesuffix("-OD").removesuffix("-OE")
                        side_barcode = f"{clean_sku}-{side}"
                        if side in by_eye:
                            inv = by_eye[side]
                            inv.barcode = side_barcode
                            if db_product.quantity is not None:
                                inv.quantity_available = db_product.quantity
                            inv.spherical = inv_sph
                            inv.cylindrical = inv_cyl
                            inv.base_curve = inv_base
                            inv.addition = inv_add
                            inv.eye = side
                            db.add(inv)
                        else:
                            new_inv = LensInventoryGrade(
                                lens_model_id=lens_model.id,
                                spherical=inv_sph,
                                cylindrical=inv_cyl,
                                base_curve=inv_base,
                                addition=inv_add,
                                eye=side,
                                barcode=side_barcode,
                                quantity_available=db_product.quantity or 1
                            )
                            db.add(new_inv)
                else:
                    if inv_items:
                        for inv in inv_items:
                            inv.barcode = db_product.sku
                            if db_product.quantity is not None:
                                inv.quantity_available = db_product.quantity
                            inv.spherical = inv_sph
                            inv.cylindrical = inv_cyl
                            inv.base_curve = inv_base
                            inv.addition = None
                            inv.eye = None
                            db.add(inv)
                    else:
                        new_inv = LensInventoryGrade(
                            lens_model_id=lens_model.id,
                            spherical=inv_sph,
                            cylindrical=inv_cyl,
                            base_curve=inv_base,
                            addition=None,
                            eye=None,
                            barcode=db_product.sku,
                            quantity_available=db_product.quantity or 1
                        )
                        db.add(new_inv)

                # Re-sincroniza a descrição do parâmetro do sistema se houver chave correspondente
                pk = get_preset_key_for_lens(
                    brand=lens_model.brand,
                    name=lens_model.name,
                    refractive_index=lens_model.refractive_index,
                    treatment=lens_model.treatment,
                    material=lens_model.material
                )
                if pk:
                    p_stmt = select(SystemParameter).where(SystemParameter.key.like(f"{pk}_%"))
                    params = (await db.execute(p_stmt)).scalars().all()
                    for param in params:
                        if "Limite Cilíndrico" in (param.description or ""):
                            param.description = f"Limite Cilíndrico {db_product.name}"
                        elif "Preço Base" in (param.description or ""):
                            param.description = f"Preço Base (Sph 0-6 | Cyl 0-4) {db_product.name}"
                        elif "Preço Ajustado" in (param.description or ""):
                            param.description = f"Preço Ajustado (Cyl > 2.00D) {db_product.name}"
                        db.add(param)
        else:
            lens_model = LensModel(
                code=db_product.sku,
                name=db_product.name,
                brand=db_product.brand or db_product.name,
                material=db_product.material or "Resina",
                refractive_index=Decimal(str(db_product.refractive_index or "1.56")),
                treatment=db_product.treatment or "Incolor",
                diameter=db_product.diameter or 70,
                cost_price=Decimal(str(db_product.cost_price or "25.00")),
                sale_price=Decimal(str(db_product.sale_price or "75.00"))
            )
            db.add(lens_model)
            await db.flush()
            db_product.lens_model_id = lens_model.id
            
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product

async def delete_product(db: AsyncSession, product_id: uuid.UUID) -> bool:
    db_product = await get_product(db, product_id)
    if not db_product:
        return False
        
    lens_model_id = db_product.lens_model_id
    db_product.lens_model_id = None
    db.add(db_product)
    await db.flush()

    # Remove também o LensModel e a grade de estoque associada se for uma lente
    if lens_model_id:
        from backend.app.crud.lens import delete_lens_model
        await delete_lens_model(db, lens_model_id)

    # Remove também os históricos de preços associados ao produto comercial
    await db.execute(
        PriceHistory.__table__.delete().where(
            and_(
                PriceHistory.entity_type == "product",
                PriceHistory.entity_id == product_id
            )
        )
    )

    existing_p = await get_product(db, product_id)
    if existing_p:
        await db.delete(existing_p)

    await db.commit()
    return True


# --- 2. TRATAMENTOS ---

async def get_treatment(db: AsyncSession, treatment_id: uuid.UUID) -> Optional[Treatment]:
    return (await db.execute(select(Treatment).where(Treatment.id == treatment_id))).scalars().first()

async def get_treatments(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[Treatment]:
    sql_query = select(Treatment)
    conditions = []
    
    if is_active is not None:
        conditions.append(Treatment.is_active == is_active)
    if query:
        conditions.append(Treatment.name.ilike(f"%{query}%"))
        
    if conditions:
        sql_query = sql_query.where(and_(*conditions))
        
    sql_query = sql_query.order_by(Treatment.name.asc()).offset(skip).limit(limit)
    return list((await db.execute(sql_query)).scalars().all())

async def create_treatment(
    db: AsyncSession,
    treatment_in: TreatmentCreate,
    user_id: Optional[uuid.UUID] = None
) -> Treatment:
    db_treatment = Treatment(
        name=treatment_in.name,
        description=treatment_in.description,
        price=treatment_in.price,
        is_active=treatment_in.is_active if treatment_in.is_active is not None else True,
        current_version=1
    )
    db.add(db_treatment)
    await db.commit()
    await db.refresh(db_treatment)
    
    price_hist = PriceHistory(
        entity_type="treatment",
        entity_id=db_treatment.id,
        price=db_treatment.price,
        version=1,
        start_date=datetime.now(timezone.utc),
        changed_by_id=user_id,
        change_reason=treatment_in.change_reason or "Cadastro inicial do tratamento"
    )
    db.add(price_hist)
    await db.commit()
    return db_treatment

async def update_treatment(
    db: AsyncSession,
    treatment_id: uuid.UUID,
    treatment_in: TreatmentUpdate,
    user_id: Optional[uuid.UUID] = None
) -> Optional[Treatment]:
    db_treatment = await get_treatment(db, treatment_id)
    if not db_treatment:
        return None
        
    price_changed = False
    if treatment_in.price is not None and treatment_in.price != db_treatment.price:
        price_changed = True
        
    if price_changed:
        # Encerra versão antiga
        hist_query = select(PriceHistory).where(
            and_(
                PriceHistory.entity_type == "treatment",
                PriceHistory.entity_id == treatment_id,
                PriceHistory.end_date.is_(None)
            )
        )
        last_hist = (await db.execute(hist_query)).scalars().first()
        if last_hist:
            last_hist.end_date = datetime.now(timezone.utc)
            db.add(last_hist)
            
        new_version = db_treatment.current_version + 1
        db_treatment.current_version = new_version
        
        price_hist = PriceHistory(
            entity_type="treatment",
            entity_id=treatment_id,
            price=treatment_in.price,
            version=new_version,
            start_date=datetime.now(timezone.utc),
            changed_by_id=user_id,
            change_reason=treatment_in.change_reason or f"Reajuste de preço (v.{new_version})"
        )
        db.add(price_hist)
        
    update_data = treatment_in.model_dump(exclude_unset=True)
    update_data.pop("change_reason", None)
    for field, val in update_data.items():
        setattr(db_treatment, field, val)
        
    db.add(db_treatment)
    await db.commit()
    await db.refresh(db_treatment)
    return db_treatment

async def delete_treatment(db: AsyncSession, treatment_id: uuid.UUID) -> bool:
    db_treatment = await get_treatment(db, treatment_id)
    if not db_treatment:
        return False
        
    await db.execute(
        PriceHistory.__table__.delete().where(
            and_(
                PriceHistory.entity_type == "treatment",
                PriceHistory.entity_id == treatment_id
            )
        )
    )
    await db.delete(db_treatment)
    await db.commit()
    return True


# --- 3. SERVIÇOS TÉCNICOS ---

async def get_technical_service(db: AsyncSession, service_id: uuid.UUID) -> Optional[TechnicalService]:
    return (await db.execute(select(TechnicalService).where(TechnicalService.id == service_id))).scalars().first()

async def get_technical_services(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[TechnicalService]:
    sql_query = select(TechnicalService)
    conditions = []
    
    if is_active is not None:
        conditions.append(TechnicalService.is_active == is_active)
    if query:
        conditions.append(TechnicalService.name.ilike(f"%{query}%"))
        
    if conditions:
        sql_query = sql_query.where(and_(*conditions))
        
    sql_query = sql_query.order_by(TechnicalService.name.asc()).offset(skip).limit(limit)
    return list((await db.execute(sql_query)).scalars().all())

async def create_technical_service(
    db: AsyncSession,
    service_in: TechnicalServiceCreate,
    user_id: Optional[uuid.UUID] = None
) -> TechnicalService:
    db_service = TechnicalService(
        name=service_in.name,
        description=service_in.description,
        price=service_in.price,
        is_active=service_in.is_active if service_in.is_active is not None else True,
        current_version=1
    )
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    
    price_hist = PriceHistory(
        entity_type="service",
        entity_id=db_service.id,
        price=db_service.price,
        version=1,
        start_date=datetime.now(timezone.utc),
        changed_by_id=user_id,
        change_reason=service_in.change_reason or "Cadastro inicial do serviço técnico"
    )
    db.add(price_hist)
    await db.commit()
    return db_service

async def update_technical_service(
    db: AsyncSession,
    service_id: uuid.UUID,
    service_in: TechnicalServiceUpdate,
    user_id: Optional[uuid.UUID] = None
) -> Optional[TechnicalService]:
    db_service = await get_technical_service(db, service_id)
    if not db_service:
        return None
        
    price_changed = False
    if service_in.price is not None and service_in.price != db_service.price:
        price_changed = True
        
    if price_changed:
        # Encerra versão antiga
        hist_query = select(PriceHistory).where(
            and_(
                PriceHistory.entity_type == "service",
                PriceHistory.entity_id == service_id,
                PriceHistory.end_date.is_(None)
            )
        )
        last_hist = (await db.execute(hist_query)).scalars().first()
        if last_hist:
            last_hist.end_date = datetime.now(timezone.utc)
            db.add(last_hist)
            
        new_version = db_service.current_version + 1
        db_service.current_version = new_version
        
        price_hist = PriceHistory(
            entity_type="service",
            entity_id=service_id,
            price=service_in.price,
            version=new_version,
            start_date=datetime.now(timezone.utc),
            changed_by_id=user_id,
            change_reason=service_in.change_reason or f"Reajuste de preço (v.{new_version})"
        )
        db.add(price_hist)
        
    update_data = service_in.model_dump(exclude_unset=True)
    update_data.pop("change_reason", None)
    for field, val in update_data.items():
        setattr(db_service, field, val)
        
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service

async def delete_technical_service(db: AsyncSession, service_id: uuid.UUID) -> bool:
    db_service = await get_technical_service(db, service_id)
    if not db_service:
        return False
        
    await db.execute(
        PriceHistory.__table__.delete().where(
            and_(
                PriceHistory.entity_type == "service",
                PriceHistory.entity_id == service_id
            )
        )
    )
    await db.delete(db_service)
    await db.commit()
    return True


# --- 4. HISTÓRICO DE PREÇOS ---

async def get_price_history_for_entity(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID
) -> List[PriceHistory]:
    """
    Retorna todo o histórico de preços de uma entidade específica, ordenado pela versão decrescente.
    """
    query = (
        select(PriceHistory)
        .where(
            and_(
                PriceHistory.entity_type == entity_type,
                PriceHistory.entity_id == entity_id
            )
        )
        .options(selectinload(PriceHistory.changed_by))
        .order_by(PriceHistory.version.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())
