import uuid
from decimal import Decimal
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator
from backend.app.schemas.lens import (
    ScanRequest, ScanResponse, RegisterFallbackRequest, LensInventoryGradeResponse, LensInventoryGradeCreate, LensInventoryGradeUpdate
)
from backend.app.schemas.movement import StockMovementCreate
from backend.app.crud import lens as crud_lens
from backend.app.crud import movement as crud_movement
from pydantic import BaseModel
from backend.app.models.user import User
from backend.app.models.lens import BlindInventorySession, BlindInventoryItem, LensInventoryGrade
from backend.app.schemas.lens import LensModelCreate



router = APIRouter()

@router.get("/grid", response_model=List[LensInventoryGradeResponse])
async def get_inventory_grid_view(
    lens_model_id: Optional[uuid.UUID] = None,
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a matriz de grade de estoque para visualização geral das lentes.
    Pode ser filtrada por modelo de lente específico.
    """
    return await crud_lens.get_inventory_grid(db, lens_model_id)

@router.get("/predictive-report")
async def get_predictive_inventory_report_endpoint(
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o relatório executivo do Motor Preditivo de Estoque.
    """
    return await crud_lens.get_predictive_inventory_report(db)


@router.post("/scan", response_model=ScanResponse)
async def scan_barcode(
    payload: ScanRequest,
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Bipa um código de barras.
    Se o código já existir, incrementa (+1) o estoque e registra como 'AUDIT'.
    Se for inédito, retorna found=False para abrir a tela de cadastro (fallback).
    """
    inventory_item = await crud_lens.get_inventory_by_barcode(db, payload.barcode)
    
    if inventory_item:
        # Incrementa estoque e registra a movimentação AUDIT
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=1,
            reason="Bipagem Mobile Rápida"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        
        # O updated_movement já atualizou e carregou o inventory_item
        return ScanResponse(
            found=True,
            message="Bipagem registrada com sucesso. Estoque incrementado.",
            item=LensInventoryGradeResponse.model_validate(updated_movement.lens_inventory)
        )
    
    return ScanResponse(
        found=False,
        message="Código de barras inédito. Por favor, registre os detalhes da lente.",
        item=None
    )

@router.post("/register-fallback", response_model=LensInventoryGradeResponse, status_code=status.HTTP_201_CREATED)
async def register_fallback(
    payload: RegisterFallbackRequest,
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra uma lente inédita bipada no fluxo de fallback manual.
    Cria ou vincula ao modelo de lente e insere a dioptria na grade de estoque.
    """
    # 1. Determina ou cria o modelo de lente
    model_id = payload.lens_model_id
    if not model_id:
        if not (payload.brand and payload.material and payload.refractive_index is not None and payload.treatment and payload.diameter is not None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para criar um novo modelo de lente, informe Marca, Material, Índice de Refração, Tratamento e Diâmetro."
            )
        
        # Tenta achar um modelo idêntico existente
        existing_model = await crud_lens.get_lens_model_by_attributes(
            db,
            brand=payload.brand,
            material=payload.material,
            refractive_index=payload.refractive_index,
            treatment=payload.treatment,
            diameter=payload.diameter
        )
        if existing_model:
            model_id = existing_model.id
        else:
            # Cria novo modelo
            new_model_data = LensModelCreate(
                brand=payload.brand,
                material=payload.material,
                refractive_index=payload.refractive_index,
                treatment=payload.treatment,
                diameter=payload.diameter,
                cost_price=payload.cost_price or Decimal("25.00")
            )
            new_model = await crud_lens.create_lens_model(db, new_model_data)
            model_id = new_model.id

    # 2. Verifica se a dioptria (esférico/cilíndrico) já existe para esse modelo
    inventory_item = await crud_lens.get_inventory_by_dioptria(
        db, lens_model_id=model_id, spherical=payload.spherical, cylindrical=payload.cylindrical
    )
    
    if inventory_item:
        # Se a dioptria já existia mas sem o barcode (ou outro barcode), atualiza o barcode
        # e incrementa a quantidade
        inventory_item.barcode = payload.barcode
        inventory_item.location_tag = payload.location_tag if payload.location_tag else None
            
        # Registra a movimentação de entrada/ajuste inicial
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=payload.quantity_available,
            reason="Associação de Código de Barras e Ajuste de Estoque"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        return updated_movement.lens_inventory
    else:
        # Cria a dioptria/item de inventário do zero
        new_inventory_data = LensInventoryGradeCreate(
            lens_model_id=model_id,
            spherical=payload.spherical,
            cylindrical=payload.cylindrical,
            barcode=payload.barcode,
            quantity_available=0, # Inicia com 0 para a movimentação adicionar corretamente
            location_tag=payload.location_tag
        )
        inventory_item = await crud_lens.create_inventory_item(db, new_inventory_data)
        
        # Cria a movimentação inicial
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=payload.quantity_available,
            reason="Inventário Inicial (Cadastro Fallback)"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        return updated_movement.lens_inventory

@router.put("/{item_id}", response_model=LensInventoryGradeResponse)
async def update_inventory_item(
    item_id: uuid.UUID,
    payload: LensInventoryGradeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza manualmente as propriedades de uma lente específica (quantidade, localização ou código de barras).
    Se a quantidade for alterada, registra a movimentação de estoque correspondente.
    """
    inventory_item = await crud_lens.get_inventory_item(db, item_id)
    if not inventory_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de inventário não encontrado."
        )

    # Verifica duplicidade de código de barras se estiver mudando
    if payload.barcode is not None and payload.barcode != inventory_item.barcode:
        existing = await crud_lens.get_inventory_by_barcode(db, payload.barcode)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código de barras já cadastrado em outra lente."
            )
        inventory_item.barcode = payload.barcode

    # Atualiza localização (permite limpar se vier nulo ou string vazia no JSON)
    if "location_tag" in payload.model_fields_set:
        inventory_item.location_tag = payload.location_tag if payload.location_tag else None

    # Atualiza quantidade e registra movimentação se houver diferença
    if payload.quantity_available is not None and payload.quantity_available != inventory_item.quantity_available:
        diff = payload.quantity_available - inventory_item.quantity_available
        movement_type = "IN" if diff > 0 else "OUT"
        quantity = abs(diff)
        
        # Salva o estado atual de barcode/location no banco primeiro para evitar conflitos
        db.add(inventory_item)
        await db.commit()

        # Cria a movimentação de estoque
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type=movement_type,
            quantity=quantity,
            reason="Ajuste manual de estoque"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        return updated_movement.lens_inventory
    else:
        # Se a quantidade não mudou, apenas salva os outros campos
        db.add(inventory_item)
        await db.commit()
        await db.refresh(inventory_item)
        return inventory_item



