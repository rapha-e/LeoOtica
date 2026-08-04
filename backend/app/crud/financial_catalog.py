import uuid
from datetime import datetime
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
    return list((await db.execute(sql_query)).scalars().all())

async def create_product(
    db: AsyncSession,
    product_in: ProductCreate,
    user_id: Optional[uuid.UUID] = None
) -> Product:
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
    )
    
    # Se for uma lente, cria ou vincula o LensModel
    if db_product.is_lens:
        from backend.app.models.lens import LensModel
        from decimal import Decimal
        lens_model = LensModel(
            brand=db_product.brand or "Lente",
            material=db_product.material or "Resina",
            refractive_index=Decimal(str(db_product.refractive_index or "1.56")),
            treatment=db_product.treatment or "Incolor",
            diameter=db_product.diameter or 70,
            cost_price=Decimal(str(db_product.cost_price or "25.00"))
        )
        db.add(lens_model)
        await db.flush()
        db_product.lens_model_id = lens_model.id

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
        start_date=datetime.utcnow(),
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
            last_hist.end_date = datetime.utcnow()
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
            start_date=datetime.utcnow(),
            changed_by_id=user_id,
            change_reason=product_in.change_reason or f"Reajuste de preço (v.{new_version})"
        )
        db.add(price_hist)
        
    # Atualiza demais campos
    update_data = product_in.model_dump(exclude_unset=True)
    update_data.pop("change_reason", None)
    for field, val in update_data.items():
        setattr(db_product, field, val)
        
    # Sincroniza com o LensModel correspondente se for uma lente
    if db_product.is_lens:
        from backend.app.models.lens import LensModel
        from decimal import Decimal
        if db_product.lens_model_id:
            lens_model = (await db.execute(select(LensModel).where(LensModel.id == db_product.lens_model_id))).scalars().first()
            if lens_model:
                lens_model.brand = db_product.brand or "Lente"
                lens_model.material = db_product.material or "Resina"
                lens_model.refractive_index = Decimal(str(db_product.refractive_index or "1.56"))
                lens_model.treatment = db_product.treatment or "Incolor"
                lens_model.diameter = db_product.diameter or 70
                lens_model.cost_price = Decimal(str(db_product.cost_price or "25.00"))
                db.add(lens_model)
        else:
            lens_model = LensModel(
                brand=db_product.brand or "Lente",
                material=db_product.material or "Resina",
                refractive_index=Decimal(str(db_product.refractive_index or "1.56")),
                treatment=db_product.treatment or "Incolor",
                diameter=db_product.diameter or 70,
                cost_price=Decimal(str(db_product.cost_price or "25.00"))
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
        
    # Remove também o LensModel associado se houver
    if db_product.lens_model_id:
        from backend.app.models.lens import LensModel
        try:
            await db.execute(LensModel.__table__.delete().where(LensModel.id == db_product.lens_model_id))
        except Exception:
            pass # mantém o LensModel se tiver chaves de inventário associadas para integridade histórica
            
    # Remove também os históricos de preços associados
    await db.execute(
        PriceHistory.__table__.delete().where(
            and_(
                PriceHistory.entity_type == "product",
                PriceHistory.entity_id == product_id
            )
        )
    )
    await db.delete(db_product)
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
        start_date=datetime.utcnow(),
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
            last_hist.end_date = datetime.utcnow()
            db.add(last_hist)
            
        new_version = db_treatment.current_version + 1
        db_treatment.current_version = new_version
        
        price_hist = PriceHistory(
            entity_type="treatment",
            entity_id=treatment_id,
            price=treatment_in.price,
            version=new_version,
            start_date=datetime.utcnow(),
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
        start_date=datetime.utcnow(),
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
            last_hist.end_date = datetime.utcnow()
            db.add(last_hist)
            
        new_version = db_service.current_version + 1
        db_service.current_version = new_version
        
        price_hist = PriceHistory(
            entity_type="service",
            entity_id=service_id,
            price=service_in.price,
            version=new_version,
            start_date=datetime.utcnow(),
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
