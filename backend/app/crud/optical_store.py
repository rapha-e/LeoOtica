import uuid
from typing import List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.optical_store import OpticalStore
from backend.app.schemas.optical_store import OpticalStoreCreate, OpticalStoreUpdate

async def get_optical_store(db: AsyncSession, store_id: uuid.UUID) -> Optional[OpticalStore]:
    """
    Busca uma ótica pelo seu ID único.
    """
    query = select(OpticalStore).where(OpticalStore.id == store_id)
    result = await db.execute(query)
    return result.scalars().first()

async def get_optical_store_by_cnpj(db: AsyncSession, cnpj: str) -> Optional[OpticalStore]:
    """
    Busca uma ótica pelo CNPJ (para validação de duplicidade).
    """
    query = select(OpticalStore).where(OpticalStore.cnpj == cnpj)
    result = await db.execute(query)
    return result.scalars().first()

async def get_optical_stores(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[OpticalStore]:
    """
    Lista as óticas cadastradas com paginação, filtro de status e busca textual.
    A busca textual pesquisa por termos na razão social, nome fantasia e CNPJ.
    """
    sql_query = select(OpticalStore)
    conditions = []
    
    # Filtro de status ativo/inativo
    if is_active is not None:
        conditions.append(OpticalStore.is_active == is_active)
        
    # Busca textual (busca por razão social, nome fantasia ou CNPJ)
    if query:
        search_term = f"%{query}%"
        conditions.append(
            or_(
                OpticalStore.corporate_name.ilike(search_term),
                OpticalStore.trade_name.ilike(search_term),
                OpticalStore.cnpj.ilike(search_term)
            )
        )
        
    if conditions:
        sql_query = sql_query.where(and_(*conditions))
        
    # Ordena por nome fantasia alfabeticamente
    sql_query = sql_query.order_by(OpticalStore.trade_name.asc()).offset(skip).limit(limit)
    
    result = await db.execute(sql_query)
    return list(result.scalars().all())

async def create_optical_store(db: AsyncSession, store_in: OpticalStoreCreate) -> OpticalStore:
    """
    Cadastra uma nova ótica comercial.
    """
    db_store = OpticalStore(
        corporate_name=store_in.corporate_name,
        trade_name=store_in.trade_name,
        cnpj=store_in.cnpj,
        ie=store_in.ie,
        telephone=store_in.telephone,
        email=store_in.email,
        address=store_in.address,
        is_active=store_in.is_active if store_in.is_active is not None else True
    )
    db.add(db_store)
    await db.commit()
    await db.refresh(db_store)
    return db_store

async def update_optical_store(
    db: AsyncSession,
    store_id: uuid.UUID,
    store_in: OpticalStoreUpdate
) -> Optional[OpticalStore]:
    """
    Atualiza os dados cadastrais de uma ótica.
    """
    db_store = await get_optical_store(db, store_id)
    if not db_store:
        return None
        
    update_data = store_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(db_store, field, val)
        
    db.add(db_store)
    await db.commit()
    await db.refresh(db_store)
    return db_store

async def delete_optical_store(db: AsyncSession, store_id: uuid.UUID) -> bool:
    """
    Exclui permanentemente uma ótica do sistema.
    """
    db_store = await get_optical_store(db, store_id)
    if not db_store:
        return False
        
    await db.delete(db_store)
    await db.commit()
    return True
