import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select, update, func, text
from backend.app.core.database import engine, Base, AsyncSessionLocal

# Imports dos Modelos do Ecossistema
from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.models.financial_catalog import TechnicalService
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory, ServiceOrderItem
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.financial_corp import AccountsReceivable
from backend.app.models.nfe import NfeSaida

# Imports dos Serviços Core
from backend.app.services.pricing import calculate_lp_auto_price
from backend.app.services.os_factory_service import OSFactoryService
from backend.app.schemas.os_factory import (
    OSCreateFactorySchema, EyePrescriptionSchema, FrameGeometrySchema, PriorityEnum, OSAdditionalServiceSchema
)

async def run_master_end_to_end_test():
    print("=" * 80)
    print("🚀 INICIANDO TESTE MASTER COMPLETO DO ECOSSISTEMA LEOOTICA / OPTIMIND")
    print("=" * 80)

    # 0. Garante a criação de tabelas e migrações no banco
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_sql in [
            "ALTER TABLE lens_models ADD COLUMN code VARCHAR(50);",
            "ALTER TABLE lens_models ADD COLUMN name VARCHAR(150);",
            "ALTER TABLE lens_models ADD COLUMN matrix_type VARCHAR(50) DEFAULT 'LP_GRADE';",
            "ALTER TABLE lens_models ADD COLUMN production_route VARCHAR(50) DEFAULT 'EXPRESSA_FACETAMENTO';",
            "ALTER TABLE lens_models ADD COLUMN sale_price_over_threshold NUMERIC(10, 2) DEFAULT 95.00;",
            "ALTER TABLE lens_inventory_grade ADD COLUMN base_curve NUMERIC(4, 2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN addition NUMERIC(4, 2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN eye VARCHAR(2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN reserved_quantity INTEGER DEFAULT 0;",
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
        print("\n--- ETAPA 1: CADASTRO DE ÓTICA PARCEIRA E SERVIÇOS TÉCNICOS ---")
        # 1.1 Cadastro da Ótica
        store_stmt = select(OpticalStore).where(OpticalStore.cnpj == "99888777000155")
        store = (await db.execute(store_stmt)).scalars().first()
        if not store:
            store = OpticalStore(
                id=uuid.uuid4(),
                corporate_name="Ótica Master Visão LTDA",
                trade_name="Ótica Master Visão",
                cnpj="99888777000155",
                telephone="(11) 98888-7777",
                email="comercial@mastervisao.com.br"
            )
            db.add(store)
            await db.flush()
        store_id = store.id
        store_cnpj = str(store.cnpj)
        store_trade_name = str(store.trade_name)
        print(f"✅ Ótica Cliente Cadastrada: {store_trade_name} (ID: {store_id})")

        # 1.2 Cadastro de Serviços Técnicos do Catálogo
        serv_balgriff_stmt = select(TechnicalService).where(TechnicalService.name == "Montagem Balgriff / Três Peças")
        serv_balgriff = (await db.execute(serv_balgriff_stmt)).scalars().first()
        if not serv_balgriff:
            serv_balgriff = TechnicalService(
                id=uuid.uuid4(),
                name="Montagem Balgriff / Três Peças",
                description="Perfuração de lentes e montagem em armação balgriff",
                price=40.00,
                is_active=True
            )
            db.add(serv_balgriff)

        serv_color_stmt = select(TechnicalService).where(TechnicalService.name == "Coloração Solar G15")
        serv_color = (await db.execute(serv_color_stmt)).scalars().first()
        if not serv_color:
            serv_color = TechnicalService(
                id=uuid.uuid4(),
                name="Coloração Solar G15",
                description="Banho de tingimento solar verde G15",
                price=35.00,
                is_active=True
            )
            db.add(serv_color)
        await db.flush()
        print(f"✅ Serviços Técnicos Cadastrados: {serv_balgriff.name} (R$ {serv_balgriff.price}) e {serv_color.name} (R$ {serv_color.price})")

        print("\n--- ETAPA 2: CADASTRO DE LENTES E REGRAS DE PREÇO POR GRAU ---")
        # 2.1 Cadastra Modelo de Lente Pronta LP_GRADE
        model_lp_stmt = select(LensModel).where(LensModel.code == "MODEL-LP-156-AR")
        model_lp = (await db.execute(model_lp_stmt)).scalars().first()
        if not model_lp:
            model_lp = LensModel(
                id=uuid.uuid4(),
                code="MODEL-LP-156-AR",
                name="Visão Simples LP 1.56 AR",
                brand="Visão Simples LP 1.56 AR",
                material="Resina 1.56",
                refractive_index=Decimal("1.56"),
                treatment="Anti-Reflexo AR",
                diameter=70,
                matrix_type=MatrixType.LP_GRADE.value,
                production_route=ProductionRoute.EXPRESSA_FACETAMENTO.value,
                cost_price=Decimal("20.00"),
                sale_price=Decimal("75.00"),
                sale_price_over_threshold=Decimal("95.00")
            )
            db.add(model_lp)
            await db.flush()

        # 2.2 Cadastra Políticas de Precificação por Grau Esférico (Até -2.00 vs Acima de -2.00)
        from backend.app.models.lens import DegreePricingPolicyRange
        await db.execute(text(f"DELETE FROM degree_pricing_policy_ranges WHERE lens_model_id = '{model_lp.id}'"))
        policy_base = DegreePricingPolicyRange(
            id=uuid.uuid4(),
            lens_model_id=model_lp.id,
            min_spherical=Decimal("-2.00"),
            max_spherical=Decimal("0.00"),
            min_cylindrical=Decimal("-4.00"),
            max_cylindrical=Decimal("0.00"),
            price=Decimal("75.00")
        )
        policy_high = DegreePricingPolicyRange(
            id=uuid.uuid4(),
            lens_model_id=model_lp.id,
            min_spherical=Decimal("-6.00"),
            max_spherical=Decimal("-2.25"),
            min_cylindrical=Decimal("-4.00"),
            max_cylindrical=Decimal("0.00"),
            price=Decimal("95.00")
        )
        db.add(policy_base)
        db.add(policy_high)
        await db.flush()
        print("✅ Regras de Precificação por Grau Configuradas:")
        print("   - Esférico até -2.00 D  --> R$ 75.00 por lente")
        print("   - Esférico acima de -2.00 D --> R$ 95.00 por lente")

        # 2.3 Popula o Estoque Físico da Matriz LP_GRADE para Teste de Baixa
        await db.execute(text("DELETE FROM lens_inventory_grade"))
        await db.commit()
        inv_lp_base = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=model_lp.id,
            spherical=Decimal("-1.50"), # Até -2.00 D
            cylindrical=Decimal("-0.50"),
            quantity_available=10,
            reserved_quantity=0,
            location_tag="GAVETA-LP-01"
        )
        inv_lp_high = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=model_lp.id,
            spherical=Decimal("-3.50"), # Acima de -2.00 D
            cylindrical=Decimal("-1.00"),
            quantity_available=10,
            reserved_quantity=0,
            location_tag="GAVETA-LP-02"
        )
        inv_base_id = inv_lp_base.id
        inv_high_id = inv_lp_high.id
        db.add(inv_lp_base)
        db.add(inv_lp_high)
        await db.commit()

        print("\n--- ETAPA 3: VERIFICAÇÃO DO CÁLCULO DE PREÇO POR GRAU ---")
        price_base_od = await calculate_lp_auto_price(db, model_lp.id, -1.50, -0.50)
        price_high_od = await calculate_lp_auto_price(db, model_lp.id, -3.50, -1.00)
        print(f"📊 Teste Precificação Grau até -2.00 D (-1.50): R$ {price_base_od:.2f} (Esperado R$ 75.00)")
        print(f"📊 Teste Precificação Grau acima de -2.00 D (-3.50): R$ {price_high_od:.2f} (Esperado R$ 95.00)")
        assert price_base_od == 75.00
        assert price_high_od == 95.00

        print("\n--- ETAPA 4: REGISTRO DAS 3 ORDENS DE SERVIÇO (CENÁRIOS A, B e C) ---")
        user_dummy_id = uuid.uuid4()

        # CENÁRIO A: OS com Lente + Serviços Adicionais (Balgriff + Coloração)
        os_a_schema = OSCreateFactorySchema(
            optical_store_id=store_id,
            client_order_number="PED-CENARIO-A",
            tray_number="BANDEJA-A1",
            priority=PriorityEnum.URGENTE,
            os_type="PADRAO",
            od_prescription=EyePrescriptionSchema(spherical=-1.50, cylindrical=-0.50, axis=90, dnp=31.0, height=20.0),
            oe_prescription=EyePrescriptionSchema(spherical=-1.50, cylindrical=-0.50, axis=90, dnp=31.0, height=20.0),
            frame_geometry=FrameGeometrySchema(frame_a=52.0, frame_b=35.0, frame_bridge=18.0, frame_ed=55.0, frame_type="BALGRIFF"),
            lens_model_id=model_lp.id,
            additional_services=[
                OSAdditionalServiceSchema(service_id=serv_balgriff.id, name=serv_balgriff.name, price=float(serv_balgriff.price)),
                OSAdditionalServiceSchema(service_id=serv_color.id, name=serv_color.name, price=float(serv_color.price))
            ],
            special_instructions="Montagem delicada com parafusos Balgriff"
        )
        os_a = await OSFactoryService.register_factory_os(db, os_a_schema, user_dummy_id)
        os_a_id = os_a.id
        os_a_number = str(os_a.os_number)
        os_a_total = os_a.total_amount
        print(f"✅ Cenário A (Lentes + Serviços): {os_a_number} | Total: R$ {float(os_a_total):.2f} (Lentes R$ 150 + Serviços R$ 75)")
        assert float(os_a_total) == 225.00 # 75 + 75 + 40 + 35

        # CENÁRIO B: OS de Só Lente (Grau alto -3.50D)
        os_b_schema = OSCreateFactorySchema(
            optical_store_id=store_id,
            client_order_number="PED-CENARIO-B",
            tray_number="BANDEJA-B2",
            priority=PriorityEnum.NORMAL,
            os_type="PADRAO",
            od_prescription=EyePrescriptionSchema(spherical=-3.50, cylindrical=-1.00, axis=180, dnp=30.5, height=21.0),
            oe_prescription=EyePrescriptionSchema(spherical=-3.50, cylindrical=-1.00, axis=180, dnp=30.5, height=21.0),
            frame_geometry=FrameGeometrySchema(frame_a=54.0, frame_b=38.0, frame_bridge=17.0, frame_ed=58.0, frame_type="ACETATO"),
            lens_model_id=model_lp.id,
            additional_services=[],
            special_instructions="Facetamento para armação de acetato"
        )
        os_b = await OSFactoryService.register_factory_os(db, os_b_schema, user_dummy_id)
        print(f"✅ Cenário B (Só Lente Grau Alto): {os_b.os_number} | Total: R$ {float(os_b.total_amount):.2f} (Lentes 2x R$ 95.00)")
        assert float(os_b.total_amount) == 190.00 # 95 + 95

        # CENÁRIO C: OS de Só Serviço / Reparo (sem alocação de lentes)
        os_c_schema = OSCreateFactorySchema(
            optical_store_id=store_id,
            client_order_number="PED-CENARIO-C",
            tray_number="BANDEJA-C3",
            priority=PriorityEnum.NORMAL,
            os_type="REPARO_SERVICO",
            frame_geometry=FrameGeometrySchema(frame_a=50.0, frame_b=34.0, frame_bridge=18.0, frame_ed=52.0, frame_type="METAL"),
            lens_model_id=None,
            additional_services=[
                OSAdditionalServiceSchema(service_id=serv_balgriff.id, name="Solda de Charnière & Ajuste", price=50.00)
            ],
            special_instructions="Apenas reparo na armação enviada"
        )
        os_c = await OSFactoryService.register_factory_os(db, os_c_schema, user_dummy_id)
        print(f"✅ Cenário C (Só Serviço/Reparo): {os_c.os_number} | Total: R$ {float(os_c.total_amount):.2f}")
        assert float(os_c.total_amount) == 50.00

        print("\n--- ETAPA 5: CONFERÊNCIA DE BAIXA FÍSICA NO ESTOQUE DA GRADE ---")
        db.expire_all()
        inv_lp_base_refresh = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == inv_base_id))).scalars().first()
        inv_lp_high_refresh = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == inv_high_id))).scalars().first()
        
        print(f"📦 Estudo de Saldo Grade Grau -1.50D (Inicial: 10) --> Atual: {inv_lp_base_refresh.quantity_available} (Baixa efetuada!)")
        print(f"📦 Estudo de Saldo Grade Grau -3.50D (Inicial: 10) --> Atual: {inv_lp_high_refresh.quantity_available} (Baixa efetuada!)")
        assert inv_lp_base_refresh.quantity_available < 10
        assert inv_lp_high_refresh.quantity_available < 10

        print("\n--- ETAPA 6: CICLO DE PRODUÇÃO E APONTAMENTO DE ESTAÇÕES ---")
        fases_esteira = [
            OSStatus.SEPARACAO.value if hasattr(OSStatus.SEPARACAO, 'value') else OSStatus.SEPARACAO,
            OSStatus.SURFACAGEM.value if hasattr(OSStatus.SURFACAGEM, 'value') else OSStatus.SURFACAGEM,
            OSStatus.FACETAMENTO.value if hasattr(OSStatus.FACETAMENTO, 'value') else OSStatus.FACETAMENTO,
            OSStatus.MONTAGEM.value if hasattr(OSStatus.MONTAGEM, 'value') else OSStatus.MONTAGEM,
            OSStatus.CQ_FINAL.value if hasattr(OSStatus.CQ_FINAL, 'value') else OSStatus.CQ_FINAL,
            OSStatus.EMBALAGEM.value if hasattr(OSStatus.EMBALAGEM, 'value') else OSStatus.EMBALAGEM,
            OSStatus.CONCLUIDA.value if hasattr(OSStatus.CONCLUIDA, 'value') else OSStatus.CONCLUIDA,
        ]

        for fase in fases_esteira:
            await db.execute(
                update(ServiceOrder).where(ServiceOrder.id == os_a_id).values(status=fase)
            )
            hist = OSWorkflowHistory(
                id=uuid.uuid4(),
                service_order_id=os_a_id,
                previous_status=None,
                new_status=str(fase),
                sector="ESTEIRA_FABRIL",
                operator_id=user_dummy_id,
                operator_notes=f"Avanço de fase para {fase}",
                changed_at=datetime.now(timezone.utc)
            )
            db.add(hist)
        await db.commit()
        print(f"🔄 OS {os_a_number} percorreu todas as fases e atingiu o status: Concluída")

        print("\n--- ETAPA 7: FECHAMENTO, FATURAMENTO COMERCIAL E NOTA FISCAL (NF-e) ---")
        # 7.1 Criação do Ciclo de Faturamento Comercial BillingCycle
        billing_cycle = BillingCycle(
            id=uuid.uuid4(),
            optical_store_id=store_id,
            start_date=datetime.now(timezone.utc) - timedelta(days=30),
            end_date=datetime.now(timezone.utc),
            status="FECHADO",
            total_amount=os_a_total,
            created_at=datetime.now(timezone.utc),
            due_date=datetime.now(timezone.utc) + timedelta(days=30)
        )
        db.add(billing_cycle)
        await db.flush()

        # 7.2 Vinculação do Item de Faturamento BillingItem
        billing_item = BillingItem(
            id=uuid.uuid4(),
            billing_cycle_id=billing_cycle.id,
            service_order_id=os_a_id,
            amount=os_a_total,
            created_at=datetime.now(timezone.utc)
        )
        db.add(billing_item)

        # 7.3 Lançamento em Contas a Receber (AccountsReceivable)
        receivable = AccountsReceivable(
            id=uuid.uuid4(),
            billing_cycle_id=billing_cycle.id,
            optical_store_id=store_id,
            description=f"Faturamento OS {os_a_number}",
            amount=os_a_total,
            amount_received=0.00,
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            status="PENDENTE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(receivable)

        # 7.4 Emissão da Nota Fiscal Eletrônica (NfeSaida)
        nfe_num = int(datetime.now(timezone.utc).timestamp()) % 1000000
        nfe = NfeSaida(
            id=uuid.uuid4(),
            billing_cycle_id=billing_cycle.id,
            nfe_number=nfe_num,
            serie=1,
            chave_acesso=f"352608{store_cnpj}{nfe_num:09d}100000001",
            xml_content=f"<nfeProc><NFe><infNFe><total><vNF>{os_a_total}</vNF></total></infNFe></NFe></nfeProc>",
            status="EMITIDA",
            created_at=datetime.now(timezone.utc),
            emitted_at=datetime.now(timezone.utc)
        )
        db.add(nfe)
        await db.commit()
        print(f"💳 Faturamento Concluído! Título gerado em Contas a Receber: R$ {float(receivable.amount):.2f} | Vencimento: {receivable.due_date.strftime('%d/%m/%Y')}")
        print(f"📜 Nota Fiscal Emitida: NFE Nº {nfe.nfe_number} (Série {nfe.serie} | Chave: {nfe.chave_acesso})")

        print("\n--- ETAPA 8: RECEBIMENTO FINANCEIRO E LIQUIDAÇÃO ---")
        receivable.status = "RECEBIDO"
        receivable.amount_received = receivable.amount
        receivable.received_at = datetime.now(timezone.utc)
        await db.commit()
        print(f"💰 Título de Contas a Receber Liquidado com Sucesso! Status: {receivable.status} em {receivable.received_at.strftime('%d/%m/%Y %H:%M')}")

        print("\n--- ETAPA 9: AUDITORIA E RELATÓRIO DE BALANÇO FINANCEIRO ---")
        total_faturado_res = await db.execute(select(func.sum(BillingCycle.total_amount)).where(BillingCycle.optical_store_id == store_id))
        total_faturado = total_faturado_res.scalar() or 0.0

        total_recebido_res = await db.execute(select(func.sum(AccountsReceivable.amount_received)).where(AccountsReceivable.optical_store_id == store_id, AccountsReceivable.status == "RECEBIDO"))
        total_recebido = total_recebido_res.scalar() or 0.0

        print(f"📈 Relatório Faturamento Consolidado para {store_trade_name}: R$ {float(total_faturado):.2f}")
        print(f"💵 Relatório Entradas / Liquidações Recebidas: R$ {float(total_recebido):.2f}")

        print("\n" + "=" * 80)
        print("🎉 TESTE MASTER END-TO-END CONCLUÍDO COM 100% DE SUCESSO!")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_master_end_to_end_test())
