import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import select, delete, text
from backend.app.core.database import engine, Base, AsyncSessionLocal

from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.services.os_factory_service import OSFactoryService
from backend.app.schemas.os_factory import (
    OSCreateFactorySchema, EyePrescriptionSchema, FrameGeometrySchema, PriorityEnum
)

async def test_all_matrices_stock_deduction():
    print("=" * 80)
    print("🧪 INICIANDO TESTE DE BAIXA FÍSICA DE ESTOQUE NAS 5 MATRIZES ÓPTICAS")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        # 1. Garante Ótica Cliente cadastrada
        store_stmt = select(OpticalStore).where(OpticalStore.cnpj == "99888777000155")
        store = (await db.execute(store_stmt)).scalars().first()
        if not store:
            store = OpticalStore(
                id=uuid.uuid4(),
                corporate_name="Ótica Teste Matrizes LTDA",
                trade_name="Ótica Teste Matrizes",
                cnpj="99888777000155"
            )
            db.add(store)
            await db.commit()
        store_id = store.id

        user_id = uuid.uuid4()

        # Definição das 5 Matrizes
        matrices = [
            {
                "matrix_type": MatrixType.LP_GRADE,
                "code": "TEST-LP-GRADE",
                "name": "Lente Pronta LP 1.56",
                "route": ProductionRoute.EXPRESSA_FACETAMENTO,
                "sph": -2.00, "cyl": -0.50, "base": 0.0, "add": 0.0,
                "inv_kwargs": {"spherical": Decimal("-2.00"), "cylindrical": Decimal("-0.50"), "quantity_available": 10}
            },
            {
                "matrix_type": MatrixType.GRADE_167,
                "code": "TEST-GRADE-167",
                "name": "Grade 1.67 Asférica",
                "route": ProductionRoute.EXPRESSA_FACETAMENTO,
                "sph": -4.00, "cyl": -1.50, "base": 0.0, "add": 0.0,
                "inv_kwargs": {"spherical": Decimal("-4.00"), "cylindrical": Decimal("-1.50"), "quantity_available": 10}
            },
            {
                "matrix_type": MatrixType.MF_ACB,
                "code": "TEST-MF-ACB",
                "name": "Multifocal Acabado Prog",
                "route": ProductionRoute.SURFACAGEM_CNC,
                "sph": 0.0, "cyl": 0.0, "base": 4.00, "add": 2.00,
                "inv_kwargs_od": {"spherical": Decimal("0.00"), "cylindrical": Decimal("0.00"), "base_curve": Decimal("4.00"), "addition": Decimal("2.00"), "eye": "OD", "quantity_available": 10},
                "inv_kwargs_oe": {"spherical": Decimal("0.00"), "cylindrical": Decimal("0.00"), "base_curve": Decimal("4.00"), "addition": Decimal("2.00"), "eye": "OE", "quantity_available": 10}
            },
            {
                "matrix_type": MatrixType.MF_BLOCO,
                "code": "TEST-MF-BLOCO",
                "name": "Multifocal Bloco Semi-Acabado",
                "route": ProductionRoute.SURFACAGEM_CNC,
                "sph": 0.0, "cyl": 0.0, "base": 6.00, "add": 2.50,
                "inv_kwargs_od": {"spherical": Decimal("0.00"), "cylindrical": Decimal("0.00"), "base_curve": Decimal("6.00"), "addition": Decimal("2.50"), "eye": "OD", "quantity_available": 10},
                "inv_kwargs_oe": {"spherical": Decimal("0.00"), "cylindrical": Decimal("0.00"), "base_curve": Decimal("6.00"), "addition": Decimal("2.50"), "eye": "OE", "quantity_available": 10}
            },
            {
                "matrix_type": MatrixType.BLOCO_VS,
                "code": "TEST-BLOCO-VS",
                "name": "Bloco Visão Simples Surfaçado",
                "route": ProductionRoute.SURFACAGEM_CNC,
                "sph": 0.0, "cyl": 0.0, "base": 4.25, "add": 0.0,
                "inv_kwargs": {"spherical": Decimal("0.00"), "cylindrical": Decimal("0.00"), "base_curve": Decimal("4.25"), "quantity_available": 10}
            }
        ]

        for m_info in matrices:
            m_type = m_info["matrix_type"]
            m_type_str = m_type.value if hasattr(m_type, 'value') else str(m_type)
            print(f"\n--- TESTANDO MATRIZ: {m_type_str} ({m_info['name']}) ---")

            # 1. Carrega ou cria o modelo
            model_stmt = select(LensModel).where(LensModel.code == m_info["code"])
            model = (await db.execute(model_stmt)).scalars().first()
            if not model:
                model = LensModel(
                    id=uuid.uuid4(),
                    code=m_info["code"],
                    name=m_info["name"],
                    brand=m_info["name"],
                    material="Resina",
                    refractive_index=Decimal("1.56"),
                    treatment="Anti-Reflexo AR",
                    diameter=70,
                    matrix_type=m_type_str,
                    production_route=m_info["route"].value if hasattr(m_info["route"], 'value') else str(m_info["route"]),
                    sale_price=Decimal("120.00")
                )
                db.add(model)
                await db.commit()

            model_id = model.id

            # Limpa estoques antigos para esse modelo
            await db.execute(delete(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == model_id))
            await db.commit()

            # Popula estoque
            inv_ids = []
            if "inv_kwargs_od" in m_info:
                inv_od = LensInventoryGrade(id=uuid.uuid4(), lens_model_id=model_id, **m_info["inv_kwargs_od"])
                inv_oe = LensInventoryGrade(id=uuid.uuid4(), lens_model_id=model_id, **m_info["inv_kwargs_oe"])
                db.add(inv_od)
                db.add(inv_oe)
                await db.commit()
                inv_ids = [inv_od.id, inv_oe.id]
            else:
                inv_item = LensInventoryGrade(id=uuid.uuid4(), lens_model_id=model_id, **m_info["inv_kwargs"])
                db.add(inv_item)
                await db.commit()
                inv_ids = [inv_item.id]

            # 2. Cria Ordem de Serviço Fabril vinculada a esta Matriz
            os_schema = OSCreateFactorySchema(
                optical_store_id=store_id,
                client_order_number=f"PED-{m_type_str}",
                tray_number="BANDEJA-TEST",
                priority=PriorityEnum.NORMAL,
                os_type="PADRAO",
                od_prescription=EyePrescriptionSchema(
                    spherical=m_info["sph"], cylindrical=m_info["cyl"], axis=90,
                    addition=m_info["add"], dnp=31.0, height=20.0
                ),
                oe_prescription=EyePrescriptionSchema(
                    spherical=m_info["sph"], cylindrical=m_info["cyl"], axis=90,
                    addition=m_info["add"], dnp=31.0, height=20.0
                ),
                frame_geometry=FrameGeometrySchema(frame_a=52.0, frame_b=35.0, frame_bridge=18.0, frame_ed=55.0, frame_type="ACETATO"),
                lens_model_id=model_id,
                special_instructions=f"Teste de baixa automatica na matriz {m_type_str}"
            )

            # Define curva base caso a prescrição Pydantic receba via extra
            if m_info["base"] > 0:
                os_schema.od_prescription.prism_value = 0.0
                # Injeta curva_base no payload do serviço
                os_schema.special_instructions += f" [Curva Base: {m_info['base']}]"

            created_os = await OSFactoryService.register_factory_os(db, os_schema, user_id)
            print(f"  OS Registrada com sucesso: {created_os.os_number} | Matriz: {m_type_str}")

            # 3. Verifica se a baixa física ocorreu (quantity_available diminuiu de 10)
            db.expire_all()
            for inv_id in inv_ids:
                inv_refreshed = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == inv_id))).scalars().first()
                avail = inv_refreshed.quantity_available - inv_refreshed.reserved_quantity
                print(f"  📦 Estoque Item ID {inv_id} (Físico: {inv_refreshed.quantity_available}, Reservado: {inv_refreshed.reserved_quantity}) --> Saldo Livre: {avail}")
                assert avail < 10 or inv_refreshed.reserved_quantity > 0, f"Falha na reserva de estoque da matriz {m_type_str}"
                print(f"  ✅ Reserva Confirmada na Matriz {m_type_str}!")

    print("\n" + "=" * 80)
    print("🎉 SUCESSO! BAIXA DE ESTOQUE CONFIRMADA EM TODAS AS 5 MATRIZES ÓPTICAS!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_all_matrices_stock_deduction())
