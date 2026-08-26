import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.customer_price import CustomerPriceTable, CustomerPriceItem
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService
from backend.app.schemas.customer_price import (
    CustomerPriceTableCreate, CustomerPriceTableUpdate,
    CustomerPriceItemCreate, CustomerPriceItemUpdate,
    PriceCalculationResponse
)

# --- 1. CRUD DE TABELAS DE PREÇO ---

async def get_price_table(db: AsyncSession, table_id: uuid.UUID) -> Optional[CustomerPriceTable]:
    query = (
        select(CustomerPriceTable)
        .where(CustomerPriceTable.id == table_id)
        .options(
            selectinload(CustomerPriceTable.optical_store),
            selectinload(CustomerPriceTable.items)
        )
    )
    return (await db.execute(query)).scalars().first()

async def get_price_tables(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    optical_store_id: Optional[uuid.UUID] = None
) -> List[CustomerPriceTable]:
    query = select(CustomerPriceTable)
    if optical_store_id is not None:
        query = query.where(CustomerPriceTable.optical_store_id == optical_store_id)
    
    query = (
        query.order_by(CustomerPriceTable.start_date.desc())
        .offset(skip)
        .limit(limit)
        .options(
            selectinload(CustomerPriceTable.optical_store),
            selectinload(CustomerPriceTable.items)
        )
    )
    return list((await db.execute(query)).scalars().all())

async def create_price_table(
    db: AsyncSession,
    table_in: CustomerPriceTableCreate
) -> CustomerPriceTable:
    db_table = CustomerPriceTable(
        name=table_in.name,
        optical_store_id=table_in.optical_store_id,
        discount_percent=table_in.discount_percent,
        start_date=table_in.start_date,
        end_date=table_in.end_date,
        is_active=table_in.is_active if table_in.is_active is not None else True
    )
    db.add(db_table)
    await db.commit()
    return await get_price_table(db, db_table.id)


async def update_price_table(
    db: AsyncSession,
    table_id: uuid.UUID,
    table_in: CustomerPriceTableUpdate
) -> Optional[CustomerPriceTable]:
    db_table = await get_price_table(db, table_id)
    if not db_table:
        return None
        
    update_data = table_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(db_table, field, val)
        
    db.add(db_table)
    await db.commit()
    await db.refresh(db_table)
    return db_table

async def delete_price_table(db: AsyncSession, table_id: uuid.UUID) -> bool:
    db_table = await get_price_table(db, table_id)
    if not db_table:
        return False
        
    await db.delete(db_table)
    await db.commit()
    return True


# --- 2. CRUD DE ITENS DE PREÇO ESPECÍFICO ---

async def get_price_item(db: AsyncSession, item_id: uuid.UUID) -> Optional[CustomerPriceItem]:
    return (await db.execute(select(CustomerPriceItem).where(CustomerPriceItem.id == item_id))).scalars().first()

async def get_price_items_for_table(db: AsyncSession, table_id: uuid.UUID) -> List[CustomerPriceItem]:
    query = select(CustomerPriceItem).where(CustomerPriceItem.price_table_id == table_id)
    return list((await db.execute(query)).scalars().all())

async def create_price_item(
    db: AsyncSession,
    table_id: uuid.UUID,
    item_in: CustomerPriceItemCreate
) -> CustomerPriceItem:
    # Remove duplicidade do mesmo item de catálogo na mesma tabela de preço
    existing_query = select(CustomerPriceItem).where(
        and_(
            CustomerPriceItem.price_table_id == table_id,
            CustomerPriceItem.entity_type == item_in.entity_type,
            CustomerPriceItem.entity_id == item_in.entity_id
        )
    )
    existing = (await db.execute(existing_query)).scalars().first()
    if existing:
        existing.custom_price = item_in.custom_price
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        return existing
        
    db_item = CustomerPriceItem(
        price_table_id=table_id,
        entity_type=item_in.entity_type,
        entity_id=item_in.entity_id,
        custom_price=item_in.custom_price
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def update_price_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    item_in: CustomerPriceItemUpdate
) -> Optional[CustomerPriceItem]:
    db_item = await get_price_item(db, item_id)
    if not db_item:
        return None
        
    db_item.custom_price = item_in.custom_price
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def delete_price_item(db: AsyncSession, item_id: uuid.UUID) -> bool:
    db_item = await get_price_item(db, item_id)
    if not db_item:
        return False
        
    await db.delete(db_item)
    await db.commit()
    return True


# --- 3. INTELIGÊNCIA DE CÁLCULO DE PREÇOS (FALLBACK & VIGÊNCIA) ---

async def calculate_customer_price(
    db: AsyncSession,
    optical_store_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID
) -> PriceCalculationResponse:
    """
    Calcula o preço final de venda com base nas vigências, descontos e preços específicos por ótica comercial.
    """
    # 1. Obtém o preço padrão do catálogo
    original_price = 0.00
    if entity_type == "product":
        prod = (await db.execute(select(Product).where(Product.id == entity_id))).scalars().first()
        if not prod:
            raise ValueError("Produto não encontrado no catálogo.")
        original_price = float(prod.sale_price)
    elif entity_type == "treatment":
        treat = (await db.execute(select(Treatment).where(Treatment.id == entity_id))).scalars().first()
        if not treat:
            raise ValueError("Tratamento não encontrado no catálogo.")
        original_price = float(treat.price)
    elif entity_type == "service":
        serv = (await db.execute(select(TechnicalService).where(TechnicalService.id == entity_id))).scalars().first()
        if not serv:
            raise ValueError("Serviço técnico não encontrado no catálogo.")
        original_price = float(serv.price)
    else:
        raise ValueError("Tipo de entidade do catálogo inválido.")

    # 2. Localiza tabela de preços ativa e vigente para a ótica na data/hora atuais
    now = datetime.now(timezone.utc)
    table_query = (
        select(CustomerPriceTable)
        .where(
            and_(
                CustomerPriceTable.optical_store_id == optical_store_id,
                CustomerPriceTable.is_active == True,
                CustomerPriceTable.start_date <= now,
                or_(
                    CustomerPriceTable.end_date.is_(None),
                    CustomerPriceTable.end_date >= now
                )
            )
        )
        .order_by(CustomerPriceTable.start_date.desc())
        .limit(1)
    )
    active_table = (await db.execute(table_query)).scalars().first()

    # Se não houver tabela de preços ativa, retorna preço padrão de catálogo
    if not active_table:
        return PriceCalculationResponse(
            optical_store_id=optical_store_id,
            entity_type=entity_type,
            entity_id=entity_id,
            original_price=original_price,
            calculated_price=original_price,
            rule_applied="default_catalog_price",
            price_table_id=None,
            discount_applied=0.00
        )

    # 3. Procura se existe preço específico cadastrado na tabela de preços
    item_query = select(CustomerPriceItem).where(
        and_(
            CustomerPriceItem.price_table_id == active_table.id,
            CustomerPriceItem.entity_type == entity_type,
            CustomerPriceItem.entity_id == entity_id
        )
    )
    specific_item = (await db.execute(item_query)).scalars().first()

    if specific_item:
        custom_price = float(specific_item.custom_price)
        discount_val = max(0.00, original_price - custom_price)
        return PriceCalculationResponse(
            optical_store_id=optical_store_id,
            entity_type=entity_type,
            entity_id=entity_id,
            original_price=original_price,
            calculated_price=custom_price,
            rule_applied="specific_customer_price",
            price_table_id=active_table.id,
            discount_applied=discount_val
        )

    # 4. Caso contrário, verifica se a tabela ativa possui desconto geral por cliente
    if active_table.discount_percent > 0:
        disc_percent = float(active_table.discount_percent)
        discount_val = round(original_price * (disc_percent / 100.0), 2)
        calculated_price = round(original_price - discount_val, 2)
        
        return PriceCalculationResponse(
            optical_store_id=optical_store_id,
            entity_type=entity_type,
            entity_id=entity_id,
            original_price=original_price,
            calculated_price=calculated_price,
            rule_applied="customer_general_discount",
            price_table_id=active_table.id,
            discount_applied=discount_val
        )

    # 5. Fallback final para preço padrão do catálogo
    return PriceCalculationResponse(
        optical_store_id=optical_store_id,
        entity_type=entity_type,
        entity_id=entity_id,
        original_price=original_price,
        calculated_price=original_price,
        rule_applied="default_catalog_price",
        price_table_id=active_table.id,
        discount_applied=0.00
    )
