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
    matrix_type: Optional[str] = None,
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a matriz de grade de estoque para visualização geral das lentes.
    Pode ser filtrada por modelo de lente específico e/ou por tipo de matriz.
    """
    return await crud_lens.get_inventory_grid(db, lens_model_id=lens_model_id, matrix_type=matrix_type)

@router.get("/predictive-report")
async def get_predictive_inventory_report_endpoint(
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o relatório executivo do Motor Preditivo de Estoque.
    """
    return await crud_lens.get_predictive_inventory_report(db)


@router.get("/by-barcode/{barcode}", response_model=LensInventoryGradeResponse)
async def get_inventory_by_barcode_endpoint(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Busca os detalhes de uma lente no estoque pelo código de barras sem incrementar a quantidade.
    Útil para seleção por bipador na tela de cadastro de OS.
    """
    inventory_item = await crud_lens.get_inventory_by_barcode(db, barcode)
    if not inventory_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de barras não encontrado no estoque."
        )
    return inventory_item


@router.post("/scan", response_model=ScanResponse)
async def scan_barcode(
    payload: ScanRequest,
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Bipa um código de barras.
    Se o código já existir, incrementa a quantidade solicitada (padrão +1) no estoque.
    Se for inédito, retorna found=False para abrir a tela de cadastro (fallback).
    """
    inventory_item = await crud_lens.get_inventory_by_barcode(db, payload.barcode)
    
    if inventory_item:
        qty_to_add = payload.quantity if (payload.quantity and payload.quantity > 0) else 1
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=qty_to_add,
            reason=f"Bipagem e Incremento de Estoque (+{qty_to_add})"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        
        return ScanResponse(
            found=True,
            message=f"Bipagem registrada com sucesso. Estoque incrementado em +{qty_to_add} unidade(s).",
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
    # 0. Validação dos limites de dioptria para matriz Visão Simples LP (Esférico -6 a +6 / Cilíndrico 0 a -4)
    target_matrix = payload.matrix_type or "LP_GRADE"
    if payload.lens_model_id and not payload.matrix_type:
        l_model = await crud_lens.get_lens_model(db, payload.lens_model_id)
        if l_model:
            target_matrix = l_model.matrix_type or "LP_GRADE"

    if target_matrix == "LP_GRADE":
        sph_val = float(payload.spherical if payload.spherical is not None else 0.0)
        cyl_val = float(payload.cylindrical if payload.cylindrical is not None else 0.0)

        if cyl_val > 0:
            sph_val = sph_val + cyl_val
            cyl_val = -cyl_val

        if sph_val < -6.00 or sph_val > 6.00:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dioptria Esférica ({sph_val:+.2f}) fora do limite permitido para a grade Visão Simples LP (-6.00D a +6.00D)."
            )

        if cyl_val < -4.00 or cyl_val > 0.00:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dioptria Cilíndrica ({cyl_val:.2f}) fora do limite permitido para a grade Visão Simples LP (0.00D a -4.00D)."
            )

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
            diameter=payload.diameter,
            matrix_type=payload.matrix_type
        )
        if existing_model:
            model_id = existing_model.id
            if payload.matrix_type and existing_model.matrix_type != payload.matrix_type:
                existing_model.matrix_type = payload.matrix_type
                db.add(existing_model)
                await db.commit()
        else:
            # Cria novo modelo
            new_model_data = LensModelCreate(
                brand=payload.brand,
                material=payload.material,
                refractive_index=payload.refractive_index,
                treatment=payload.treatment,
                diameter=payload.diameter,
                matrix_type=payload.matrix_type or "LP_GRADE",
                production_route=payload.production_route or "EXPRESSA_FACETAMENTO",
                cost_price=payload.cost_price or Decimal("25.00"),
                sale_price=payload.sale_price or Decimal("75.00"),
                degree_threshold=payload.degree_threshold or Decimal("2.00"),
                sale_price_over_threshold=payload.sale_price_over_threshold or Decimal("95.00")
            )
            new_model = await crud_lens.create_lens_model(db, new_model_data)
            model_id = new_model.id

    # 2. Verifica se o código de barras já existe em alguma lente
    by_barcode = await crud_lens.get_inventory_by_barcode(db, payload.barcode)
    if by_barcode:
        by_barcode.lens_model_id = model_id
        by_barcode.spherical = payload.spherical
        by_barcode.cylindrical = payload.cylindrical
        by_barcode.location_tag = payload.location_tag if payload.location_tag else None
        if payload.base_curve is not None:
            by_barcode.base_curve = payload.base_curve
        if payload.addition is not None:
            by_barcode.addition = payload.addition
        if payload.eye is not None:
            by_barcode.eye = payload.eye
            
        cost_val = float(payload.cost_price) if payload.cost_price is not None else None
        movement_in = StockMovementCreate(
            lens_inventory_id=by_barcode.id,
            movement_type="AUDIT",
            quantity=payload.quantity_available,
            reason="Atualização por Código de Barras e Ajuste de Estoque"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in, unit_cost=cost_val)
        return updated_movement.lens_inventory

    # 3. Verifica se a dioptria (esférico/cilíndrico) já existe para esse modelo
    inventory_item = await crud_lens.get_inventory_by_dioptria(
        db, 
        lens_model_id=model_id, 
        spherical=payload.spherical, 
        cylindrical=payload.cylindrical,
        base_curve=payload.base_curve,
        addition=payload.addition,
        eye=payload.eye
    )
    
    cost_val = float(payload.cost_price) if payload.cost_price is not None else None
    if inventory_item:
        inventory_item.barcode = payload.barcode
        inventory_item.location_tag = payload.location_tag if payload.location_tag else None
        if payload.base_curve is not None:
            inventory_item.base_curve = payload.base_curve
        if payload.addition is not None:
            inventory_item.addition = payload.addition
        if payload.eye is not None:
            inventory_item.eye = payload.eye
            
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=payload.quantity_available,
            reason="Associação de Código de Barras e Ajuste de Estoque"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in, unit_cost=cost_val)
        return updated_movement.lens_inventory
    else:
        new_inventory_data = LensInventoryGradeCreate(
            lens_model_id=model_id,
            spherical=payload.spherical,
            cylindrical=payload.cylindrical,
            base_curve=payload.base_curve,
            addition=payload.addition,
            eye=payload.eye,
            barcode=payload.barcode,
            quantity_available=0,
            location_tag=payload.location_tag
        )
        inventory_item = await crud_lens.create_inventory_item(db, new_inventory_data)
        
        movement_in = StockMovementCreate(
            lens_inventory_id=inventory_item.id,
            movement_type="AUDIT",
            quantity=payload.quantity_available,
            reason="Inventário Inicial (Cadastro Fallback)"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in, unit_cost=cost_val)

        # Sincroniza o SKU no produto correspondente no catálogo financeiro
        if model_id and payload.barcode:
            from backend.app.models.financial_catalog import Product
            from sqlalchemy import select
            p_query = select(Product).where(Product.lens_model_id == model_id)
            p_result = await db.execute(p_query)
            prod = p_result.scalar_one_or_none()
            if prod and prod.sku != payload.barcode:
                existing_sku = (await db.execute(select(Product).where(Product.sku == payload.barcode))).scalars().first()
                if not existing_sku:
                    prod.sku = payload.barcode
                    db.add(prod)
                    await db.commit()

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
        return inventory_item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item_endpoint(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Remove uma dioptria/célula específica da grade de estoque de lentes.
    """
    success = await crud_lens.delete_inventory_item(db, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de inventário não encontrado."
        )
    return




