import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.crud import crud_block
from backend.app.schemas.block import (
    BlockModelCreate,
    BlockModelUpdate,
    BlockModelResponse,
    BlockGridItemResponse,
    BlockGridItemUpdate,
    BlockBipIncrementRequest
)

router = APIRouter()

@router.get("/models", response_model=List[BlockModelResponse])
async def list_block_models(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todos os modelos de blocos cadastrados no sistema.
    """
    return await crud_block.get_block_models(db, active_only=active_only)

@router.post("/models", response_model=BlockModelResponse, status_code=status.HTTP_201_CREATED)
async def create_block_model(
    payload: BlockModelCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Cadastra um novo modelo de bloco com especificações financeiras e de curva/adição.
    """
    return await crud_block.create_block_model(db, payload)

@router.put("/models/{model_id}", response_model=BlockModelResponse)
async def update_block_model(
    model_id: uuid.UUID,
    payload: BlockModelUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza dados cadastrais, financeiros e de curvas/adição de um modelo de bloco.
    """
    updated = await crud_block.update_block_model(db, model_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Modelo de bloco não encontrado.")
    return updated

@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Exclui permanentemente um modelo de bloco.
    """
    success = await crud_block.delete_block_model(db, model_id)
    if not success:
        raise HTTPException(status_code=404, detail="Modelo de bloco não encontrado.")
    return None

@router.get("/grid/{block_model_id}", response_model=Dict[str, Any])
async def get_block_grid_matrix(
    block_model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a matriz de células formatada para renderização no frontend.
    """
    model = await crud_block.get_block_model_by_id(db, block_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo de bloco não encontrado.")
    
    return await crud_block.get_grid_matrix_data(db, block_model_id)

@router.post("/generate-grid/{block_model_id}", response_model=List[BlockGridItemResponse])
async def generate_grid(
    block_model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Gera/reinicializa as células da matriz para o modelo de bloco especificado.
    """
    model = await crud_block.get_block_model_by_id(db, block_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modelo de bloco não encontrado.")
    
    return await crud_block.generate_grid_for_model(db, block_model_id)

@router.put("/grid-item/{item_id}", response_model=BlockGridItemResponse)
async def update_grid_item(
    item_id: uuid.UUID,
    payload: BlockGridItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza dados de uma célula da grade de blocos (quantidade disponível, estoque mínimo, código de barras).
    """
    updated = await crud_block.update_grid_item(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Item da grade de blocos não encontrado.")
    return updated

@router.post("/bip-increment", response_model=BlockGridItemResponse)
async def bip_increment(
    payload: BlockBipIncrementRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Incrementa a quantidade disponível de uma célula da grade através do código de barras bipado via USB.
    """
    updated = await crud_block.increment_by_barcode(db, payload.barcode, payload.quantity)
    if not updated:
        raise HTTPException(status_code=404, detail="Código de barras de bloco não localizado na grade.")
    return updated
