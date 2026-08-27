import uuid
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.financial_catalog import (
    ProductCreate, ProductUpdate, ProductResponse,
    TreatmentCreate, TreatmentUpdate, TreatmentResponse,
    TechnicalServiceCreate, TechnicalServiceUpdate, TechnicalServiceResponse,
    PriceHistoryResponse
)
from backend.app.crud import financial_catalog as crud_catalog
from backend.app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()

# --- 1. ENDPOINTS DE PRODUTOS ---

@router.post("/products/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product_endpoint(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Cadastra um novo produto no catálogo financeiro da fábrica.
    """
    if payload.matrix_type == "LP_GRADE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lentes cadastradas via Catálogo Financeiro não podem participar da política de preços por grau e não podem ser cadastradas na grade Visão Simples LP."
        )
    existing = await crud_catalog.get_product_by_sku(db, sku=payload.sku)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um produto cadastrado com este SKU."
        )
    return await crud_catalog.create_product(db, payload, user_id=current_user.id)

@router.get("/products/", response_model=List[ProductResponse])
async def list_products_endpoint(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = Query(None, description="Busca textual por nome ou SKU"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista os produtos do catálogo com paginação e busca.
    """
    return await crud_catalog.get_products(
        db, skip=skip, limit=limit, query=query, is_active=is_active
    )

@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product_endpoint(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    db_prod = await crud_catalog.get_product(db, product_id)
    if not db_prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )
    return db_prod

@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product_endpoint(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Atualiza as informações de um produto. Se o preço for alterado, gera versão no histórico.
    """
    db_prod = await crud_catalog.get_product(db, product_id)
    if not db_prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    if payload.matrix_type == "LP_GRADE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lentes cadastradas via Catálogo Financeiro não podem participar da política de preços por grau e não podem ser cadastradas na grade Visão Simples LP."
        )

    # Bloqueia alteração de preço de venda manual apenas para lentes da grade especial Visão Simples LP
    if db_prod.lens_model_id:
        from backend.app.models.lens import LensModel
        from sqlalchemy import select
        m_res = await db.execute(select(LensModel).where(LensModel.id == db_prod.lens_model_id))
        lens_m = m_res.scalar_one_or_none()
        if lens_m and lens_m.matrix_type == "LP_GRADE":
            if payload.sale_price is not None and abs(float(payload.sale_price) - float(db_prod.sale_price)) > 0.001:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Os preços das lentes da grade Visão Simples LP são regidos pelos Parâmetros Globais do Sistema. Altere o valor na tela de Parâmetros do Sistema."
                )

    if payload.sku is not None and db_prod.sku != payload.sku:
        existing = await crud_catalog.get_product_by_sku(db, sku=payload.sku)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe outro produto cadastrado com este SKU."
            )
                
    updated = await crud_catalog.update_product(db, product_id, payload, user_id=current_user.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )
    return updated

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_endpoint(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Remove permanentemente o produto e seus históricos de reajuste. Apenas administradores.
    """
    success = await crud_catalog.delete_product(db, product_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )
    return

@router.get("/products/{product_id}/price-history", response_model=List[PriceHistoryResponse])
async def get_product_price_history(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o histórico cronológico de preços (controle de versões) do produto.
    """
    # Verifica existência do produto primeiro
    prod = await crud_catalog.get_product(db, product_id)
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )
    return await crud_catalog.get_price_history_for_entity(db, "product", product_id)


# --- 2. ENDPOINTS DE TRATAMENTOS ---

@router.post("/treatments/", response_model=TreatmentResponse, status_code=status.HTTP_201_CREATED)
async def create_treatment_endpoint(
    payload: TreatmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    return await crud_catalog.create_treatment(db, payload, user_id=current_user.id)

@router.get("/treatments/", response_model=List[TreatmentResponse])
async def list_treatments_endpoint(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = Query(None, description="Busca textual por nome"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    db: AsyncSession = Depends(get_db)
):
    return await crud_catalog.get_treatments(db, skip=skip, limit=limit, query=query, is_active=is_active)

@router.get("/treatments/{treatment_id}", response_model=TreatmentResponse)
async def get_treatment_endpoint(
    treatment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    db_treat = await crud_catalog.get_treatment(db, treatment_id)
    if not db_treat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tratamento não encontrado."
        )
    return db_treat

@router.put("/treatments/{treatment_id}", response_model=TreatmentResponse)
async def update_treatment_endpoint(
    treatment_id: uuid.UUID,
    payload: TreatmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    updated = await crud_catalog.update_treatment(db, treatment_id, payload, user_id=current_user.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tratamento não encontrado."
        )
    return updated

@router.delete("/treatments/{treatment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_treatment_endpoint(
    treatment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    success = await crud_catalog.delete_treatment(db, treatment_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tratamento não encontrado."
        )
    return

@router.get("/treatments/{treatment_id}/price-history", response_model=List[PriceHistoryResponse])
async def get_treatment_price_history(
    treatment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    treat = await crud_catalog.get_treatment(db, treatment_id)
    if not treat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tratamento não encontrado."
        )
    return await crud_catalog.get_price_history_for_entity(db, "treatment", treatment_id)


# --- 3. ENDPOINTS DE SERVIÇOS TÉCNICOS ---

@router.post("/technical-services/", response_model=TechnicalServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service_endpoint(
    payload: TechnicalServiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    return await crud_catalog.create_technical_service(db, payload, user_id=current_user.id)

@router.get("/technical-services/", response_model=List[TechnicalServiceResponse])
async def list_services_endpoint(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = Query(None, description="Busca textual por nome"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    db: AsyncSession = Depends(get_db)
):
    return await crud_catalog.get_technical_services(db, skip=skip, limit=limit, query=query, is_active=is_active)

@router.get("/technical-services/{service_id}", response_model=TechnicalServiceResponse)
async def get_service_endpoint(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    db_serv = await crud_catalog.get_technical_service(db, service_id)
    if not db_serv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serviço técnico não encontrado."
        )
    return db_serv

@router.put("/technical-services/{service_id}", response_model=TechnicalServiceResponse)
async def update_service_endpoint(
    service_id: uuid.UUID,
    payload: TechnicalServiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    updated = await crud_catalog.update_technical_service(db, service_id, payload, user_id=current_user.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serviço técnico não encontrado."
        )
    return updated

@router.delete("/technical-services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_endpoint(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    success = await crud_catalog.delete_technical_service(db, service_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serviço técnico não encontrado."
        )
    return

@router.get("/technical-services/{service_id}/price-history", response_model=List[PriceHistoryResponse])
async def get_service_price_history(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    serv = await crud_catalog.get_technical_service(db, service_id)
    if not serv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serviço técnico não encontrado."
        )
    return await crud_catalog.get_price_history_for_entity(db, "service", service_id)
