import uuid
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.customer_price import (
    CustomerPriceTableCreate, CustomerPriceTableUpdate, CustomerPriceTableResponse,
    CustomerPriceItemCreate, CustomerPriceItemUpdate, CustomerPriceItemResponse,
    PriceCalculationRequest, PriceCalculationResponse
)
from backend.app.crud import customer_price as crud_price
from backend.app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()

# --- 1. ENDPOINTS PARA TABELAS DE PREÇO (CABEÇALHO) ---

@router.post("/", response_model=CustomerPriceTableResponse, status_code=status.HTTP_201_CREATED)
async def create_price_table_endpoint(
    payload: CustomerPriceTableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Cria uma nova tabela de preços para uma ótica comercial específica.
    """
    return await crud_price.create_price_table(db, payload)

@router.get("/", response_model=List[CustomerPriceTableResponse])
async def list_price_tables_endpoint(
    skip: int = 0,
    limit: int = 100,
    optical_store_id: Optional[uuid.UUID] = Query(None, description="Filtrar tabelas por ótica específica"),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista tabelas de preço de clientes cadastradas no sistema.
    """
    return await crud_price.get_price_tables(db, skip=skip, limit=limit, optical_store_id=optical_store_id)

@router.get("/{table_id}", response_model=CustomerPriceTableResponse)
async def get_price_table_endpoint(
    table_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtém detalhes completos de uma tabela de preços incluindo seus itens de preço.
    """
    db_table = await crud_price.get_price_table(db, table_id)
    if not db_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tabela de preços não encontrada."
        )
    return db_table

@router.put("/{table_id}", response_model=CustomerPriceTableResponse)
async def update_price_table_endpoint(
    table_id: uuid.UUID,
    payload: CustomerPriceTableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Atualiza cabeçalho, datas de vigência ou descontos gerais da tabela de preços.
    """
    updated = await crud_price.update_price_table(db, table_id, payload)
    if not updated:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tabela de preços não encontrada."
        )
    return updated

@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_table_endpoint(
    table_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Remove permanentemente a tabela de preços e seus itens customizados. Apenas administradores.
    """
    success = await crud_price.delete_price_table(db, table_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tabela de preços não encontrada."
        )
    return


# --- 2. ENDPOINTS PARA ITENS DE PREÇO ESPECÍFICO ---

@router.post("/{table_id}/items/", response_model=CustomerPriceItemResponse, status_code=status.HTTP_201_CREATED)
async def create_price_item_endpoint(
    table_id: uuid.UUID,
    payload: CustomerPriceItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Adiciona ou substitui o preço customizado de um item específico na tabela de preços.
    """
    table = await crud_price.get_price_table(db, table_id)
    if not table:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tabela de preços não encontrada."
        )
    return await crud_price.create_price_item(db, table_id, payload)

@router.get("/{table_id}/items/", response_model=List[CustomerPriceItemResponse])
async def list_price_items_endpoint(
    table_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todos os itens de preço customizado associados a uma tabela de preços.
    """
    table = await crud_price.get_price_table(db, table_id)
    if not table:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tabela de preços não encontrada."
        )
    return await crud_price.get_price_items_for_table(db, table_id)

@router.put("/{table_id}/items/{item_id}", response_model=CustomerPriceItemResponse)
async def update_price_item_endpoint(
    table_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: CustomerPriceItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Edita o valor cobrado do item customizado.
    """
    updated = await crud_price.update_price_item(db, item_id, payload)
    if not updated:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de preço não encontrado."
        )
    return updated

@router.delete("/{table_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_item_endpoint(
    table_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Remove a regra de preço específica do item, retornando-o às regras normais/padrão.
    """
    success = await crud_price.delete_price_item(db, item_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de preço não encontrado."
        )
    return


# --- 3. ENDPOINT DE SIMULAÇÃO / CÁLCULO DE VALOR DE VENDA ---

@router.post("/calculate", response_model=PriceCalculationResponse)
async def calculate_price_endpoint(
    payload: PriceCalculationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calcula dinamicamente qual preço final cobrar de um item do catálogo (produto, tratamento ou serviço)
    para um cliente (ótica), aplicando vigências, descontos ou fallback.
    """
    try:
        return await crud_price.calculate_customer_price(
            db,
            optical_store_id=payload.optical_store_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
