from typing import List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.services.nfe_parser import parse_nfe_xml
from backend.app.crud import lens as crud_lens
from backend.app.crud import movement as crud_movement
from backend.app.schemas.movement import StockMovementCreate

router = APIRouter()

@router.post("/import", status_code=status.HTTP_200_OK)
async def import_nfe_xml(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe o arquivo XML da NF-e (Nota Fiscal Eletrônica).
    Lê o código de barras (<cEAN>) de cada produto e atualiza o estoque em lote.
    Retorna a lista de itens importados com sucesso e os itens não encontrados (para reconciliação).
    """
    # Valida tipo de arquivo
    if not file.filename.endswith(".xml"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo enviado deve ser no formato XML."
        )
        
    try:
        content = await file.read()
        nfe_number, products = await parse_nfe_xml(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Falha ao processar o arquivo XML: {str(e)}"
        )
        
    imported = []
    unmapped = []
    
    for prod in products:
        barcode = prod["barcode"]
        quantity = prod["quantity"]
        description = prod["description"]
        
        if not barcode or quantity <= 0:
            unmapped.append({
                "barcode": barcode or "SEM GTIN",
                "quantity": quantity,
                "description": description,
                "reason": "Sem código de barras ou quantidade zerada"
            })
            continue
            
        # Busca no estoque pelo código de barras
        inventory_item = await crud_lens.get_inventory_by_barcode(db, barcode)
        
        if inventory_item:
            # Registra a entrada de estoque em lote
            movement_in = StockMovementCreate(
                lens_inventory_id=inventory_item.id,
                movement_type="IN",
                quantity=quantity,
                reason=f"Entrada NF-e {nfe_number}"
            )
            await crud_movement.create_stock_movement(db, movement_in)
            
            imported.append({
                "barcode": barcode,
                "quantity": quantity,
                "description": description,
                "location_tag": inventory_item.location_tag,
                "spherical": float(inventory_item.spherical),
                "cylindrical": float(inventory_item.cylindrical),
                "brand": inventory_item.lens_model.brand
            })
        else:
            unmapped.append({
                "barcode": barcode,
                "quantity": quantity,
                "description": description,
                "reason": "Código de barras não cadastrado no estoque"
            })
            
    return {
        "nfe_number": nfe_number,
        "imported_count": len(imported),
        "unmapped_count": len(unmapped),
        "imported": imported,
        "unmapped": unmapped
    }
