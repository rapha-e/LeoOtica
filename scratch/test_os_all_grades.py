import asyncio
import os
import sys
from decimal import Decimal

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.app.core.config import settings
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.crud import lens as crud_lens
from backend.app.crud import os as crud_os
from backend.app.services.allocation import allocate_and_deduct_inventory

async def validate_isolation_and_os():
    print("=========================================================================")
    print("INICIANDO VALIDAÇÃO DE ISOLAMENTO E ABERTURA DE OS PARA TODAS AS GRADES")
    print("=========================================================================")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)

    matrix_types = [
        ("LP_GRADE", "LP Incolor 1.50", 1.50, -2.00, -1.00, None, None, None),
        ("GRADE_167", "1.67 AR Pronta", 1.67, -4.00, -1.50, None, None, None),
        ("MF_ACB", "Multifocal Acabado AR", 1.56, 0.00, 0.00, Decimal("2.00"), Decimal("2.50"), "OD"),
        ("BLOCO_VS", "Bloco Visao Simples 1.56", 1.56, 0.00, 0.00, Decimal("4.00"), None, None),
        ("MF_BLOCO", "Bloco Multifocal 1.50", 1.50, 0.00, 0.00, Decimal("6.00"), Decimal("2.00"), "OD"),
    ]

    async with async_session() as session:
        created_models = {}

        # 1. Garantir que cada modelo exista e tenha estoque cadastrado
        for m_type, name, idx, sph, cyl, base, add, eye in matrix_types:
            model = await crud_lens.get_lens_model_by_attributes(
                session,
                brand=name,
                material="Resina",
                refractive_index=Decimal(str(idx)),
                treatment="Incolor",
                diameter=70,
                matrix_type=m_type
            )
            if not model:
                from backend.app.schemas.lens import LensModelCreate
                model = await crud_lens.create_lens_model(session, LensModelCreate(
                    brand=name,
                    name=name,
                    material="Resina",
                    refractive_index=Decimal(str(idx)),
                    treatment="Incolor",
                    diameter=70,
                    matrix_type=m_type,
                    production_route="EXPRESSA_FACETAMENTO",
                    cost_price=Decimal("25.00"),
                    sale_price=Decimal("75.00")
                ))
            created_models[m_type] = model

            # Adiciona item de inventário na dioptria/parâmetro
            inv_item = await crud_lens.get_inventory_by_dioptria(
                session,
                lens_model_id=model.id,
                spherical=Decimal(str(sph)) if sph is not None else None,
                cylindrical=Decimal(str(cyl)) if cyl is not None else None,
                base_curve=base,
                addition=add,
                eye=eye
            )
            if not inv_item:
                from backend.app.schemas.lens import LensInventoryGradeCreate
                inv_item = await crud_lens.create_inventory_item(session, LensInventoryGradeCreate(
                    lens_model_id=model.id,
                    spherical=Decimal(str(sph)) if sph is not None else None,
                    cylindrical=Decimal(str(cyl)) if cyl is not None else None,
                    base_curve=base,
                    addition=add,
                    eye=eye,
                    barcode=f"TEST-{m_type}-OD",
                    quantity_available=10,
                    location_tag="GAVETA-TESTE"
                ))
            else:
                inv_item.quantity_available = max(inv_item.quantity_available, 10)
                session.add(inv_item)

            if m_type in ["MF_ACB", "MF_BLOCO"]:
                # Também adiciona OE
                inv_oe = await crud_lens.get_inventory_by_dioptria(
                    session,
                    lens_model_id=model.id,
                    spherical=Decimal(str(sph)) if sph is not None else None,
                    cylindrical=Decimal(str(cyl)) if cyl is not None else None,
                    base_curve=base,
                    addition=add,
                    eye="OE"
                )
                if not inv_oe:
                    from backend.app.schemas.lens import LensInventoryGradeCreate
                    inv_oe = await crud_lens.create_inventory_item(session, LensInventoryGradeCreate(
                        lens_model_id=model.id,
                        spherical=Decimal(str(sph)) if sph is not None else None,
                        cylindrical=Decimal(str(cyl)) if cyl is not None else None,
                        base_curve=base,
                        addition=add,
                        eye="OE",
                        barcode=f"TEST-{m_type}-OE",
                        quantity_available=10,
                        location_tag="GAVETA-TESTE"
                    ))
                else:
                    inv_oe.quantity_available = max(inv_oe.quantity_available, 10)
                    session.add(inv_oe)

        await session.commit()
        print("\n[OK] Modelos e estoque para as 5 grades preparados no banco de dados!")

    # 2. Testar Isolamento de Consulta por Tipo de Matriz
    async with async_session() as session:
        for m_type in ["LP_GRADE", "GRADE_167", "MF_ACB", "BLOCO_VS", "MF_BLOCO"]:
            items = await crud_lens.get_inventory_grid(session, matrix_type=m_type)
            # Verifica que TODOS os itens retornados possuem exatamente a matrix_type solicitada
            for it in items:
                assert it.lens_model.matrix_type == m_type, f"ERRO DE ISOLAMENTO: Matriz {it.lens_model.matrix_type} vazou na consulta da matriz {m_type}"
            print(f"[OK] Consulta SQL para Matriz '{m_type}': {len(items)} item(ns) retornado(s) estritamente isolado(s).")

    # 3. Testar Abertura de OS e Alocação de Lentes para cada uma das 5 grades
    async with async_session() as session:
        for m_type, name, idx, sph, cyl, base, add, eye in matrix_types:
            model = created_models[m_type]
            
            # Cria OS de Teste
            os_number = f"OS-TEST-{m_type}"
            existing_os = (await session.execute(
                ServiceOrder.__table__.select().where(ServiceOrder.os_number == os_number)
            )).fetchone()

            if not existing_os:
                from backend.app.schemas.os import ServiceOrderCreate
                os_data = ServiceOrderCreate(
                    os_number=os_number,
                    client_name=f"Cliente Teste {m_type}",
                    od_esferico=sph,
                    od_cilindrico=cyl,
                    od_adicao=float(add) if add else 0.0,
                    od_curva_base=float(base) if base else 0.0,
                    oe_esferico=sph,
                    oe_cilindrico=cyl,
                    oe_adicao=float(add) if add else 0.0,
                    oe_curva_base=float(base) if base else 0.0,
                    lens_model_id=model.id
                )
                os_obj = await crud_os.create_service_order(session, os_data)
            else:
                os_obj = await crud_os.get_service_order(session, existing_os.id)

            rx_data = {
                "OD": {"esferico": sph, "cilindrico": cyl, "adicao": float(add) if add else 0.0, "curva_base": float(base) if base else 0.0},
                "OE": {"esferico": sph, "cilindrico": cyl, "adicao": float(add) if add else 0.0, "curva_base": float(base) if base else 0.0}
            }

            res = await allocate_and_deduct_inventory(session, os_obj.id, model.id, rx_data)
            await session.commit()
            print(f"[OK] Alocação de OS para Matriz '{m_type}' ({name}): STATUS={res['status']} | Rota={res['production_route']}")

    print("\n=========================================================================")
    print("TODAS AS VALIDAÇÕES DE ISOLAMENTO E ABERTURA DE OS FORAM BEM-SUCEDIDAS!")
    print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(validate_isolation_and_os())
