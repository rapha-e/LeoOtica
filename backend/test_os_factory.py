import sys
import os
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import uuid
import pytest
from decimal import Decimal
from pydantic import ValidationError
from backend.app.core.database import engine, Base, AsyncSessionLocal
from backend.app.schemas.os_factory import EyePrescriptionSchema, FrameGeometrySchema, OSCreateFactorySchema, PriorityEnum
from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensModel, MatrixType, ProductionRoute
from backend.app.services.os_factory_service import OSFactoryService
from sqlalchemy import select, text

@pytest.mark.asyncio
async def test_os_factory_creation():
    print("[Test OS Factory] Inicializando teste fabril...")

    # 1. Validação Pydantic de Eixo Obrigatório para Cilíndrico Negativo
    try:
        EyePrescriptionSchema(
            spherical=-2.00,
            cylindrical=-1.00,
            axis=0, # Inválido se cylindrical < 0
            dnp=30.0,
            height=20.0
        )
        assert False, "Deveria ter falhado pois eixo = 0 com cilíndrico negativo é inválido."
    except ValidationError:
        print("[Test OS Factory] Passou! Validação de Eixo Obrigatório funcionou.")

    # 2. Validação Pydantic de Justificativa Obrigatória para Preço Manual
    try:
        OSCreateFactorySchema(
            optical_store_id=uuid.uuid4(),
            client_order_number="PED-100",
            tray_number="TRAY-01",
            priority=PriorityEnum.NORMAL,
            od_prescription=EyePrescriptionSchema(spherical=-2.00, cylindrical=-1.00, axis=90, dnp=30.0, height=20.0),
            oe_prescription=EyePrescriptionSchema(spherical=-2.00, cylindrical=0.00, axis=0, dnp=30.0, height=20.0),
            frame_geometry=FrameGeometrySchema(frame_a=52.0, frame_b=35.0, frame_bridge=18.0, frame_ed=55.0, frame_type="METAL"),
            lens_model_id=uuid.uuid4(),
            manual_price_override=150.00,
            price_override_reason=None # Inválido sem justificativa
        )
        assert False, "Deveria ter falhado pois justificativa de preço manual não foi informada."
    except ValidationError:
        print("[Test OS Factory] Passou! Validação de Justificativa de Preço Manual funcionou.")

    # 3. Setup de Banco e Teste de Fluxo Completo
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_sql in [
            "ALTER TABLE service_orders ADD COLUMN client_order_number VARCHAR(100);",
            "ALTER TABLE service_orders ADD COLUMN tray_number VARCHAR(50);",
            "ALTER TABLE service_orders ADD COLUMN priority VARCHAR(20) DEFAULT 'NORMAL';",
            "ALTER TABLE service_orders ADD COLUMN lens_model_id CHAR(36);",
            "ALTER TABLE service_orders ADD COLUMN custom_price_applied BOOLEAN DEFAULT 0;",
            "ALTER TABLE service_orders ADD COLUMN price_override_reason VARCHAR(255);",
            "ALTER TABLE service_orders ADD COLUMN special_instructions VARCHAR(500);"
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass

    async with AsyncSessionLocal() as db:
        # Garante uma Ótica de teste
        store_res = await db.execute(select(OpticalStore))
        store = store_res.scalars().first()
        if not store:
            store = OpticalStore(
                id=uuid.uuid4(),
                cnpj="12345678000199",
                trade_name="Ótica Teste Fabril",
                corporate_name="Ótica Teste LTDA"
            )
            db.add(store)
            await db.flush()

        # Garante um Modelo de Lente de teste
        model_res = await db.execute(select(LensModel))
        lens_model = model_res.scalars().first()
        if not lens_model:
            lens_model = LensModel(
                id=uuid.uuid4(),
                code="PRST-TEST-LP",
                name="LP AR 1.56 Teste",
                brand="LP AR 1.56 Teste",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="AR",
                diameter=70,
                matrix_type=MatrixType.LP_GRADE.value,
                production_route=ProductionRoute.EXPRESSA_FACETAMENTO.value,
                cost_price=Decimal("25.00"),
                sale_price=Decimal("75.00")
            )
            db.add(lens_model)
            await db.flush()

        # Cria estoque de teste para a dioptria da receita (OD: -1.00/-1.00 após transposição de -2.00/+1.00)
        from backend.app.models.lens import LensInventoryGrade
        od_inventory = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=lens_model.id,
            spherical=Decimal("-1.00"),
            cylindrical=Decimal("-1.00"),
            quantity_available=10,
            reserved_quantity=0,
            location_tag="GAV-OD"
        )
        oe_inventory = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=lens_model.id,
            spherical=Decimal("-3.50"),
            cylindrical=Decimal("-0.75"),
            quantity_available=10,
            reserved_quantity=0,
            location_tag="GAV-OE"
        )
        db.add(od_inventory)
        db.add(oe_inventory)
        await db.flush()

        # Instancia schema válido
        valid_schema = OSCreateFactorySchema(
            optical_store_id=store.id,
            client_order_number="PED-TESTE-999",
            tray_number="BANDEJA-42",
            priority=PriorityEnum.URGENTE,
            od_prescription=EyePrescriptionSchema(spherical=-2.00, cylindrical=+1.00, axis=45, dnp=31.0, height=22.0), # Testa transposição
            oe_prescription=EyePrescriptionSchema(spherical=-3.50, cylindrical=-0.75, axis=110, dnp=30.5, height=22.0),
            frame_geometry=FrameGeometrySchema(frame_a=54.0, frame_b=38.0, frame_bridge=17.0, frame_ed=58.0, frame_type="ACETATO"),
            lens_model_id=lens_model.id,
            manual_price_override=None,
            special_instructions="Bisel em V suave para armação de acetato grosso"
        )

        dummy_user_id = uuid.uuid4()
        created_os = await OSFactoryService.register_factory_os(
            db=db,
            schema=valid_schema,
            current_user_id=dummy_user_id
        )

        assert created_os.id is not None
        assert created_os.os_number.startswith("OS-")
        assert created_os.tray_number == "BANDEJA-42"
        assert created_os.priority == "URGENTE"
        assert float(created_os.total_amount) > 0.0

        print(f"[Test OS Factory] Sucesso! OS Padrão Criada: {created_os.os_number} | Status: {created_os.status} | Total: R$ {float(created_os.total_amount):.2f}")

        # 4. Teste de Criação de OS de Apenas Reparo (sem modelo de lente)
        repair_schema = OSCreateFactorySchema(
            optical_store_id=store.id,
            client_order_number="REPARO-001",
            tray_number="BD-REP-01",
            priority=PriorityEnum.NORMAL,
            os_type="REPARO_SERVICO",
            frame_geometry=FrameGeometrySchema(frame_a=50.0, frame_b=34.0, frame_bridge=18.0, frame_ed=52.0, frame_type="METAL"),
            lens_model_id=None,
            manual_price_override=45.00,
            price_override_reason="Solda de charnière e troca de plaquetas",
            special_instructions="Armação delicada enviada pelo cliente"
        )

        repair_os = await OSFactoryService.register_factory_os(
            db=db,
            schema=repair_schema,
            current_user_id=dummy_user_id
        )

        assert repair_os.id is not None
        assert repair_os.os_type == "REPARO_SERVICO"
        assert repair_os.lens_model_id is None
        assert float(repair_os.total_amount) == 45.00

        print(f"[Test OS Factory] Sucesso! OS de Reparo Criada: {repair_os.os_number} | Status: {repair_os.status} | Total: R$ {float(repair_os.total_amount):.2f}")

        # 5. Teste de Criação de OS Padrão com Lentes + Serviços Adicionais (Balgriff + Coloração)
        from backend.app.schemas.os_factory import OSAdditionalServiceSchema
        with_services_schema = OSCreateFactorySchema(
            optical_store_id=store.id,
            client_order_number="PED-PLUS-555",
            tray_number="BANDEJA-88",
            priority=PriorityEnum.URGENTE,
            os_type="PADRAO",
            od_prescription=EyePrescriptionSchema(spherical=-1.00, cylindrical=-1.00, axis=90, dnp=31.0, height=22.0),
            oe_prescription=EyePrescriptionSchema(spherical=-3.50, cylindrical=-0.75, axis=110, dnp=30.5, height=22.0),
            frame_geometry=FrameGeometrySchema(frame_a=54.0, frame_b=38.0, frame_bridge=17.0, frame_ed=58.0, frame_type="BALGRIFF"),
            lens_model_id=lens_model.id,
            additional_services=[
                OSAdditionalServiceSchema(service_id=uuid.uuid4(), name="Montagem Balgriff / Três Peças", price=40.00),
                OSAdditionalServiceSchema(service_id=uuid.uuid4(), name="Coloração Solar G15", price=35.00)
            ],
            manual_price_override=100.00, # Lentes R$ 100 + Serviços R$ 75 = R$ 175.00
            price_override_reason="Preço especial de promoção",
            special_instructions="Furos precisos de 1.4mm para parafusos Balgriff"
        )

        with_services_os = await OSFactoryService.register_factory_os(
            db=db,
            schema=with_services_schema,
            current_user_id=dummy_user_id
        )

        assert with_services_os.id is not None
        assert float(with_services_os.total_amount) == 175.00 # R$ 100 (lentes) + R$ 40 + R$ 35 (serviços)

        print(f"[Test OS Factory] Sucesso! OS Lentes + Serviços Adicionais Criada: {with_services_os.os_number} | Total: R$ {float(with_services_os.total_amount):.2f}")

if __name__ == "__main__":
    asyncio.run(test_os_factory_creation())
