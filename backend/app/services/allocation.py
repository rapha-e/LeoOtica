import uuid
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.crud import movement as crud_movement
from backend.app.schemas.movement import StockMovementCreate

async def allocate_and_deduct_inventory(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    lens_model_id: uuid.UUID, 
    rx_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Algoritmo de matching de alocação de estoque por matriz (LP_GRADE, GRADE_167, MF_ACB, MF_BLOCO, BLOCO_VS)
    e baixa física automática.
    """
    model_res = await db.execute(select(LensModel).where(LensModel.id == lens_model_id))
    lens_model = model_res.scalars().first()
    if not lens_model:
        raise ValueError("Modelo de lente não encontrado.")

    os_res = await db.execute(select(ServiceOrder).where(ServiceOrder.id == os_id).with_for_update())
    os_obj = os_res.scalar_one_or_none()
    if not os_obj:
        raise ValueError("Ordem de Serviço não encontrada.")

    matrix_type = lens_model.matrix_type or MatrixType.LP_GRADE

    allocated_items = {}

    for side in [s for s in ['OD', 'OE'] if s in rx_data and rx_data[s]]:
        eye_rx = rx_data.get(side, {})
        sph = float(eye_rx.get('esferico', eye_rx.get('spherical', 0.0)))
        cyl = float(eye_rx.get('cilindrico', eye_rx.get('cylindrical', 0.0)))
        add = float(eye_rx.get('adicao', eye_rx.get('addition', 0.0)))
        base_curve = float(eye_rx.get('curva_base', eye_rx.get('base_curve', 0.0)))

        query = select(LensInventoryGrade).where(
            LensInventoryGrade.lens_model_id == lens_model.id,
            (LensInventoryGrade.quantity_available - LensInventoryGrade.reserved_quantity) > 0
        ).order_by(LensInventoryGrade.quantity_available.desc()).with_for_update()

        # Matching específico por Tipo de Matriz
        if matrix_type in [MatrixType.LP_GRADE, MatrixType.GRADE_167]:
            # Transposição de Cilíndrico Positivo para Negativo
            if cyl > 0:
                sph, cyl = sph + cyl, -cyl

            sph_val = round(float(sph), 2)
            cyl_val = round(float(cyl), 2)

            # 1. Verifica se a dioptria existe na grade cadastrada deste modelo
            exist_check = await db.execute(
                select(LensInventoryGrade).where(
                    LensInventoryGrade.lens_model_id == lens_model.id,
                    LensInventoryGrade.spherical.in_([Decimal(str(sph_val)), Decimal(f"{sph_val:.2f}"), sph_val]),
                    LensInventoryGrade.cylindrical.in_([Decimal(str(cyl_val)), Decimal(f"{cyl_val:.2f}"), cyl_val])
                )
            )
            degree_item = exist_check.scalars().first()
            if not degree_item:
                raise ValueError(
                    f"O grau do Olho {side} (Esférico {sph_val:+.2f} / Cilíndrico {cyl_val:+.2f}) não existe na grade cadastrada para a lente '{lens_model.name or lens_model.brand}'."
                )

            # 2. Se existe na grade, verifica disponibilidade de saldo
            query = query.where(
                LensInventoryGrade.spherical.in_([Decimal(str(sph_val)), Decimal(f"{sph_val:.2f}"), sph_val]),
                LensInventoryGrade.cylindrical.in_([Decimal(str(cyl_val)), Decimal(f"{cyl_val:.2f}"), cyl_val])
            )

        elif matrix_type in [MatrixType.MF_ACB, MatrixType.MF_BLOCO]:
            add_val = round(float(add), 2)
            side_options = [side, 'D' if side == 'OD' else 'E', 'AMB', 'OD_OE']
            exist_check_stmt = select(LensInventoryGrade).where(
                LensInventoryGrade.lens_model_id == lens_model.id,
                LensInventoryGrade.addition.in_([Decimal(str(add_val)), Decimal(f"{add_val:.2f}"), add_val]),
                or_(LensInventoryGrade.eye.in_(side_options), LensInventoryGrade.eye.is_(None))
            )
            if base_curve > 0:
                base_val = round(float(base_curve), 2)
                exist_check_stmt = exist_check_stmt.where(
                    LensInventoryGrade.base_curve.in_([Decimal(str(base_val)), Decimal(f"{base_val:.2f}"), base_val])
                )
            exist_check = await db.execute(exist_check_stmt)
            degree_item = exist_check.scalars().first()
            if not degree_item:
                raise ValueError(
                    f"A adição do Olho {side} (Adição {add_val:+.2f}) não existe na grade cadastrada para a lente '{lens_model.name or lens_model.brand}'."
                )

            query = query.where(
                LensInventoryGrade.addition.in_([Decimal(str(add_val)), Decimal(f"{add_val:.2f}"), add_val]),
                or_(LensInventoryGrade.eye.in_(side_options), LensInventoryGrade.eye.is_(None))
            )
            if base_curve > 0:
                base_val = round(float(base_curve), 2)
                query = query.where(
                    LensInventoryGrade.base_curve.in_([Decimal(str(base_val)), Decimal(f"{base_val:.2f}"), base_val])
                )

        elif matrix_type == MatrixType.BLOCO_VS:
            if base_curve > 0:
                base_val = round(float(base_curve), 2)
                query = query.where(
                    LensInventoryGrade.base_curve.in_([Decimal(str(base_val)), Decimal(f"{base_val:.2f}"), base_val])
                )

        res = await db.execute(query)
        item = res.scalars().first()

        available_stock = (item.quantity_available - item.reserved_quantity) if item else 0

        if item and available_stock >= 1:
            # Baixa física real no estoque da grade (-1 no saldo disponível)
            movement_out = StockMovementCreate(
                lens_inventory_id=item.id,
                movement_type="OUT",
                quantity=1,
                reason=f"Baixa Física de Estoque para OS {os_obj.os_number} ({side})"
            )
            await crud_movement.create_stock_movement(db, movement_out)
            allocated_items[side] = item
        elif item:
            # Item existe na grade mas sem saldo livre no momento (continua em produção/surfaçagem)
            allocated_items[side] = item
        else:
            # Grau não cadastrado - se a rota for expressa facetamento exige cadastro, caso contrário segue surfaçagem
            if lens_model.production_route == ProductionRoute.EXPRESSA_FACETAMENTO:
                raise ValueError(
                    f"Ruptura de Estoque na Matriz {matrix_type}: Grau do Olho {side} (Esférico {sph:+.2f} / Cilíndrico {cyl:+.2f}) não possui saldo em estoque para entrega expressa."
                )

    # Associa os IDs de lentes alocadas à OS
    if 'OD' in allocated_items:
        os_obj.od_lens_inventory_id = allocated_items['OD'].id
    if 'OE' in allocated_items:
        os_obj.oe_lens_inventory_id = allocated_items['OE'].id
        
    os_obj.status = OSStatus.SEPARACAO.value if hasattr(OSStatus.SEPARACAO, 'value') else OSStatus.SEPARACAO

    await db.flush()
    return {
        "status": "SUCCESS", 
        "os_id": str(os_obj.id),
        "os_number": os_obj.os_number,
        "matrix_type": matrix_type,
        "production_route": lens_model.production_route
    }
