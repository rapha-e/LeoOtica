import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, delete, text
from backend.app.core.database import Base, engine, AsyncSessionLocal
from backend.app.core.security import get_password_hash

# Modelos
from backend.app.models.user import User, Role, Permission
from backend.app.models.laboratory import Laboratory
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_catalog import TechnicalService, Treatment, Product
from backend.app.models.customer_price import CustomerPriceTable, CustomerPriceItem
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.models.degree_policy import DegreePricingPolicy
from backend.app.models.os import ServiceOrder, ServiceOrderItem, OSWorkflowHistory, OSStatus
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.nfe import NfeSaida
from backend.app.models.financial_corp import AccountsReceivable
from backend.app.models.system_parameter import SystemParameter

async def seed_full_demo_database():
    print("=" * 80)
    print("🌱 INICIANDO POVOAMENTO COMPLETO DA BASE DE DADOS (DEMO END-TO-END)")
    print("=" * 80)

    # Garante a criação de todas as tabelas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # -------------------------------------------------------------------------
        # 1. PERFIS E USUÁRIOS
        # -------------------------------------------------------------------------
        print("\n[1/10] Configurando Perfis e Usuários...")
        admin_role = (await db.execute(select(Role).where(Role.name == "Administrador"))).scalars().first()
        if not admin_role:
            admin_role = Role(id=uuid.uuid4(), name="Administrador", description="Acesso completo ao sistema")
            db.add(admin_role)

        op_role = (await db.execute(select(Role).where(Role.name == "Operador"))).scalars().first()
        if not op_role:
            op_role = Role(id=uuid.uuid4(), name="Operador", description="Acesso a operacao fabril")
            db.add(op_role)

        await db.flush()

        # Usuario Admin
        admin_user = (await db.execute(select(User).where(User.email == "admin@nova.com.br"))).scalars().first()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                name="Raphael Administrador",
                email="admin@nova.com.br",
                hashed_password=get_password_hash("admin123"),
                role_id=admin_role.id,
                is_active=True
            )
            db.add(admin_user)
        else:
            admin_user.hashed_password = get_password_hash("admin123")

        # Usuario Operador
        op_user = (await db.execute(select(User).where(User.email == "operador@nova.com.br"))).scalars().first()
        if not op_user:
            op_user = User(
                id=uuid.uuid4(),
                name="Carlos Operador Fabril",
                email="operador@nova.com.br",
                hashed_password=get_password_hash("op123"),
                role_id=op_role.id,
                is_active=True
            )
            db.add(op_user)
        else:
            op_user.hashed_password = get_password_hash("op123")

        await db.commit()
        print("  ✅ Usuários configurados: admin@nova.com.br (admin123) / operador@nova.com.br (op123)")

        # -------------------------------------------------------------------------
        # 2. PERFIL DO LABORATORIO
        # -------------------------------------------------------------------------
        print("\n[2/10] Configurando Perfil do Laboratório...")
        lab = (await db.execute(select(Laboratory))).scalars().first()
        if not lab:
            lab = Laboratory(
                id=uuid.uuid4(),
                name="Nova LAB - Surfaçagem e Montagem",
                cnpj="58.032.958/0001-44",
                telephone="61 99266-7281",
                email="comercial@novalab.com.br",
                cep="71572-302",
                address="Avenida transversal quadra 23 conjunto B lote 27"
            )
            db.add(lab)
            await db.commit()
        print(f"  ✅ Laboratório configurado: {lab.name}")

        # -------------------------------------------------------------------------
        # 3. ÓTICAS CLIENTE / PARCEIRAS
        # -------------------------------------------------------------------------
        print("\n[3/10] Cadastrando Óticas Cliente Parceiras...")
        stores_data = [
            {
                "corporate_name": "Ótica Visão Real LTDA",
                "trade_name": "Ótica Visão Real",
                "cnpj": "11.222.333/0001-44",
                "telephone": "(11) 97777-1111",
                "email": "contato@visaoreal.com.br",
                "pipeline_stage": "ATIVO"
            },
            {
                "corporate_name": "Ótica Master Visão LTDA",
                "trade_name": "Ótica Master Visão",
                "cnpj": "99.888.777/0001-55",
                "telephone": "(11) 98888-7777",
                "email": "comercial@mastervisao.com.br",
                "pipeline_stage": "ATIVO"
            },
            {
                "corporate_name": "Ótica Prime Lenses EIRELI",
                "trade_name": "Ótica Prime Lenses (Inadimplente)",
                "cnpj": "44.555.666/0001-77",
                "telephone": "(21) 99999-4444",
                "email": "financeiro@primelenses.com.br",
                "pipeline_stage": "INATIVO"
            }
        ]

        stores_dict = {}
        for s_data in stores_data:
            st = (await db.execute(select(OpticalStore).where(OpticalStore.cnpj == s_data["cnpj"]))).scalars().first()
            if not st:
                st = OpticalStore(
                    id=uuid.uuid4(),
                    corporate_name=s_data["corporate_name"],
                    trade_name=s_data["trade_name"],
                    cnpj=s_data["cnpj"],
                    telephone=s_data["telephone"],
                    email=s_data["email"],
                    pipeline_stage=s_data["pipeline_stage"]
                )
                db.add(st)
                await db.commit()
            else:
                st.pipeline_stage = s_data["pipeline_stage"]
                await db.commit()
            stores_dict[s_data["trade_name"]] = st
            print(f"  ✅ Ótica Cadastrada/Atualizada: {st.trade_name} (Estágio: {st.pipeline_stage})")

        # -------------------------------------------------------------------------
        # 4. CATÁLOGO FINANCEIRO (SERVIÇOS TÉCNICOS E TRATAMENTOS)
        # -------------------------------------------------------------------------
        print("\n[4/10] Populando Catálogo Financeiro de Serviços e Tratamentos...")
        services_data = [
            ("Montagem Balgriff / Três Peças", "Montagem delicada com furação e parafusos", 40.00),
            ("Coloração Solar G15 / Total", "Banho de tinta solar verde G15 ou marrom", 35.00),
            ("Polimento de Bordas Bisotadas", "Polimento brilhante em bordas de lentes", 25.00),
            ("Solda de Charnière & Ajuste", "Reparo técnico de solda em armação de metal", 50.00),
            ("Facetamento Especial Acetato", "Facetamento com bisel rebaixado para acetato", 30.00)
        ]

        services_dict = {}
        for name, desc, price in services_data:
            serv = (await db.execute(select(TechnicalService).where(TechnicalService.name == name))).scalars().first()
            if not serv:
                serv = TechnicalService(id=uuid.uuid4(), name=name, description=desc, price=Decimal(str(price)), is_active=True)
                db.add(serv)
                await db.commit()
            services_dict[name] = serv
            print(f"  ✅ Serviço Técnico: {name} (R$ {price:.2f})")

        treatments_data = [
            ("Anti-Reflexo AR Premium", "Tratamento multicoating anti-reflexo", 45.00),
            ("Filtro de Luz Azul BlueCut", "Proteção contra telas digitais e luz azul", 60.00),
            ("Fotocromático Transitions", "Escurecimento automático no sol", 90.00)
        ]
        for name, desc, price in treatments_data:
            tr = (await db.execute(select(Treatment).where(Treatment.name == name))).scalars().first()
            if not tr:
                tr = Treatment(id=uuid.uuid4(), name=name, description=desc, price=Decimal(str(price)), is_active=True)
                db.add(tr)
                await db.commit()

        # -------------------------------------------------------------------------
        # 5. MODELOS DE LENTES (NAS 5 MATRIZES ÓPTICAS)
        # -------------------------------------------------------------------------
        print("\n[5/10] Cadastrando Modelos nas 5 Matrizes Ópticas...")
        models_data = [
            {
                "code": "LP-156-AR",
                "name": "Visão Simples LP 1.56 AR",
                "brand": "NovaLab LP",
                "material": "Resina",
                "refractive_index": Decimal("1.56"),
                "treatment": "Anti-Reflexo AR",
                "diameter": 70,
                "matrix_type": MatrixType.LP_GRADE.value,
                "production_route": ProductionRoute.EXPRESSA_FACETAMENTO.value,
                "sale_price": Decimal("75.00"),
                "degree_threshold": Decimal("2.00"),
                "sale_price_over_threshold": Decimal("95.00")
            },
            {
                "code": "GRADE-167-AS",
                "name": "Grade 1.67 Asférica AR NovaLab",
                "brand": "NovaLab HighIndex",
                "material": "1.67 High Index",
                "refractive_index": Decimal("1.67"),
                "treatment": "Anti-Reflexo AR Premium",
                "diameter": 72,
                "matrix_type": MatrixType.GRADE_167.value,
                "production_route": ProductionRoute.EXPRESSA_FACETAMENTO.value,
                "sale_price": Decimal("150.00"),
                "degree_threshold": Decimal("2.00"),
                "sale_price_over_threshold": Decimal("180.00")
            },
            {
                "code": "MF-ACB-PROG",
                "name": "Multifocal Acabado Prog AR",
                "brand": "NovaLab Multifocal",
                "material": "Resina",
                "refractive_index": Decimal("1.56"),
                "treatment": "Anti-Reflexo AR",
                "diameter": 72,
                "matrix_type": MatrixType.MF_ACB.value,
                "production_route": ProductionRoute.SURFACAGEM_CNC.value,
                "sale_price": Decimal("220.00")
            },
            {
                "code": "MF-BLOCO-SEMI",
                "name": "Multifocal Bloco Semi-Acabado",
                "brand": "NovaLab Bloco",
                "material": "Resina CR39",
                "refractive_index": Decimal("1.50"),
                "treatment": "Sem Tratamento",
                "diameter": 75,
                "matrix_type": MatrixType.MF_BLOCO.value,
                "production_route": ProductionRoute.SURFACAGEM_CNC.value,
                "sale_price": Decimal("140.00")
            },
            {
                "code": "BLOCO-VS-SURF",
                "name": "Bloco Visão Simples Surfaçado",
                "brand": "NovaLab Bloco VS",
                "material": "Resina CR39",
                "refractive_index": Decimal("1.50"),
                "treatment": "Sem Tratamento",
                "diameter": 75,
                "matrix_type": MatrixType.BLOCO_VS.value,
                "production_route": ProductionRoute.SURFACAGEM_CNC.value,
                "sale_price": Decimal("90.00")
            }
        ]

        models_dict = {}
        for m_data in models_data:
            lm = (await db.execute(select(LensModel).where(LensModel.code == m_data["code"]))).scalars().first()
            if not lm:
                lm = LensModel(id=uuid.uuid4(), **m_data)
                db.add(lm)
                await db.commit()
            models_dict[m_data["code"]] = lm
            print(f"  ✅ Modelo Cadastrado: {lm.name} ({lm.matrix_type})")

        # -------------------------------------------------------------------------
        # 6. ESTOQUE FÍSICO DE GRADE (POPULANDO DIOPTRIAS E CÓDIGOS DE BARRAS)
        # -------------------------------------------------------------------------
        print("\n[6/10] Populando Saldo Físico de Estoque nas Grades...")

        # Clear existing stock
        await db.execute(delete(LensInventoryGrade))
        await db.commit()

        # Grade LP_GRADE
        model_lp = models_dict["LP-156-AR"]
        lp_items = [
            (Decimal("0.00"), Decimal("0.00"), "789100010001", "GAVETA-LP-01", 25),
            (Decimal("-0.50"), Decimal("-0.25"), "789100010002", "GAVETA-LP-01", 20),
            (Decimal("-1.00"), Decimal("-0.50"), "789100010003", "GAVETA-LP-01", 20),
            (Decimal("-1.50"), Decimal("-0.50"), "789100010004", "GAVETA-LP-02", 18),
            (Decimal("-2.00"), Decimal("-0.75"), "789100010005", "GAVETA-LP-02", 15),
            (Decimal("-2.50"), Decimal("-1.00"), "789100010006", "GAVETA-LP-03", 15),
            (Decimal("-3.00"), Decimal("-1.00"), "789100010007", "GAVETA-LP-03", 12),
            (Decimal("-3.50"), Decimal("-1.25"), "789100010008", "GAVETA-LP-04", 10),
            (Decimal("-4.00"), Decimal("-1.50"), "789100010009", "GAVETA-LP-04", 10),
        ]
        for sph, cyl, bar, loc, qty in lp_items:
            db.add(LensInventoryGrade(
                id=uuid.uuid4(), lens_model_id=model_lp.id, spherical=sph, cylindrical=cyl,
                barcode=bar, location_tag=loc, quantity_available=qty, reserved_quantity=0
            ))

        # Grade 1.67
        model_167 = models_dict["GRADE-167-AS"]
        items_167 = [
            (Decimal("-2.00"), Decimal("-0.50"), "789167010001", "GAVETA-167-01", 15),
            (Decimal("-3.00"), Decimal("-1.00"), "789167010002", "GAVETA-167-01", 15),
            (Decimal("-4.00"), Decimal("-1.50"), "789167010003", "GAVETA-167-02", 12),
            (Decimal("-5.00"), Decimal("-2.00"), "789167010004", "GAVETA-167-02", 10),
            (Decimal("-6.00"), Decimal("-2.00"), "789167010005", "GAVETA-167-03", 8),
        ]
        for sph, cyl, bar, loc, qty in items_167:
            db.add(LensInventoryGrade(
                id=uuid.uuid4(), lens_model_id=model_167.id, spherical=sph, cylindrical=cyl,
                barcode=bar, location_tag=loc, quantity_available=qty, reserved_quantity=0
            ))

        # Multifocal Acabado MF_ACB
        model_mf_acb = models_dict["MF-ACB-PROG"]
        bases = [Decimal("4.00"), Decimal("6.00")]
        additions = [Decimal("1.50"), Decimal("2.00"), Decimal("2.50"), Decimal("3.00")]
        for b_val in bases:
            for a_val in additions:
                for side in ["OD", "OE"]:
                    db.add(LensInventoryGrade(
                        id=uuid.uuid4(), lens_model_id=model_mf_acb.id,
                        spherical=Decimal("0.00"), cylindrical=Decimal("0.00"),
                        base_curve=b_val, addition=a_val, eye=side,
                        location_tag="ESTANTE-MF-ACB", quantity_available=10, reserved_quantity=0
                    ))

        # Multifocal Bloco MF_BLOCO
        model_mf_bloco = models_dict["MF-BLOCO-SEMI"]
        for b_val in bases:
            for a_val in additions:
                for side in ["OD", "OE"]:
                    db.add(LensInventoryGrade(
                        id=uuid.uuid4(), lens_model_id=model_mf_bloco.id,
                        spherical=Decimal("0.00"), cylindrical=Decimal("0.00"),
                        base_curve=b_val, addition=a_val, eye=side,
                        location_tag="ESTANTE-MF-BLOCO", quantity_available=10, reserved_quantity=0
                    ))

        # Bloco Visão Simples BLOCO_VS
        model_bloco_vs = models_dict["BLOCO-VS-SURF"]
        vs_bases = [Decimal("2.25"), Decimal("4.25"), Decimal("6.25"), Decimal("8.25")]
        for b_val in vs_bases:
            db.add(LensInventoryGrade(
                id=uuid.uuid4(), lens_model_id=model_bloco_vs.id,
                spherical=Decimal("0.00"), cylindrical=Decimal("0.00"),
                base_curve=b_val, location_tag="PALETE-BLOCO-VS", quantity_available=20, reserved_quantity=0
            ))

        await db.commit()
        print("  ✅ Saldo de estoque inserido com sucesso em TODAS as 5 grades!")

        # -------------------------------------------------------------------------
        # 7. POLÍTICA DE PRECIFICAÇÃO POR GRAU & PARÂMETROS
        # -------------------------------------------------------------------------
        print("\n[7/10] Ajustando Regras Globais de Precificação por Grau...")
        await db.execute(delete(DegreePricingPolicy))
        policy = DegreePricingPolicy(
            id=uuid.uuid4(),
            degree_threshold=Decimal("2.00"),
            default_sale_price_le=Decimal("75.00"),
            default_sale_price_gt=Decimal("95.00"),
            is_active=True
        )
        db.add(policy)

        # Tabela de Preço Especial para Ótica Visão Real (10% desconto)
        store_visao_real = stores_dict["Ótica Visão Real"]
        price_table = CustomerPriceTable(
            id=uuid.uuid4(),
            name="Tabela VIP - Ótica Visão Real",
            optical_store_id=store_visao_real.id,
            discount_percent=Decimal("10.00"),
            is_active=True
        )
        db.add(price_table)
        await db.commit()
        print("  ✅ Regra de precificação ativa: Até -2.00D = R$ 75.00 | Acima = R$ 95.00")

        # -------------------------------------------------------------------------
        # 8. ORDENS DE SERVIÇO EM DIVERSOS ESTÁGIOS DA ESTEIRA FABRIL
        # -------------------------------------------------------------------------
        print("\n[8/10] Gerando Ordens de Serviço em Diferentes Fases da Esteira Fabril...")

        store_master = stores_dict["Ótica Master Visão"]
        store_prime = stores_dict["Ótica Prime Lenses (Inadimplente)"]

        # OS 1: Concluída (Lentes + Serviços)
        os1 = ServiceOrder(
            id=uuid.uuid4(),
            os_number="OS-2026-1001",
            optical_store_id=store_visao_real.id,
            client_order_number="PED-VISAOREAL-01",
            tray_number="BANDEJA-101",
            priority="NORMAL",
            os_type="PADRAO",
            status=OSStatus.CONCLUIDA.value if hasattr(OSStatus.CONCLUIDA, 'value') else OSStatus.CONCLUIDA,
            od_spherical=Decimal("-1.50"), od_cylindrical=Decimal("-0.50"), od_axis=90, od_dnp=31.0, od_height=20.0,
            oe_spherical=Decimal("-1.50"), oe_cylindrical=Decimal("-0.50"), oe_axis=90, oe_dnp=31.0, oe_height=20.0,
            frame_a=52.0, frame_bridge=18.0, frame_ed=55.0,
            lens_model_id=model_lp.id,
            total_amount=Decimal("225.00"),
            special_instructions="Montagem delicada Balgriff com parafusos de silicone",
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(os1)
        await db.flush()

        # Itens adicionais da OS 1
        db.add(ServiceOrderItem(id=uuid.uuid4(), service_order_id=os1.id, entity_type="service", entity_id=services_dict["Montagem Balgriff / Três Peças"].id, quantity=1, unit_price=Decimal("40.00"), total_price=Decimal("40.00")))
        db.add(ServiceOrderItem(id=uuid.uuid4(), service_order_id=os1.id, entity_type="service", entity_id=services_dict["Coloração Solar G15 / Total"].id, quantity=1, unit_price=Decimal("35.00"), total_price=Decimal("35.00")))

        # Histórico da OS 1
        for st_name in ["RECEBIDA", "SEPARACAO", "SURFACAGEM", "FACETAMENTO", "MONTAGEM", "CQ_FINAL", "EMBALAGEM", "CONCLUIDA"]:
            db.add(OSWorkflowHistory(id=uuid.uuid4(), service_order_id=os1.id, new_status=st_name, sector="FABRICA", operator_id=admin_user.id, changed_at=datetime.utcnow() - timedelta(hours=12)))

        # OS 2: Em Facetamento (Grade 1.67 Asférica)
        os2 = ServiceOrder(
            id=uuid.uuid4(),
            os_number="OS-2026-1002",
            optical_store_id=store_master.id,
            client_order_number="PED-MASTER-02",
            tray_number="BANDEJA-102",
            priority="URGENTE",
            os_type="PADRAO",
            status=OSStatus.FACETAMENTO.value if hasattr(OSStatus.FACETAMENTO, 'value') else OSStatus.FACETAMENTO,
            od_spherical=Decimal("-4.00"), od_cylindrical=Decimal("-1.50"), od_axis=180, od_dnp=30.5, od_height=21.0,
            oe_spherical=Decimal("-4.00"), oe_cylindrical=Decimal("-1.50"), oe_axis=180, oe_dnp=30.5, oe_height=21.0,
            frame_a=54.0, frame_bridge=17.0, frame_ed=58.0,
            lens_model_id=model_167.id,
            total_amount=Decimal("390.00"),
            special_instructions="Facetamento especial em acetato com bisel ajustado",
            created_at=datetime.utcnow() - timedelta(hours=5)
        )
        db.add(os2)
        await db.flush()
        db.add(ServiceOrderItem(id=uuid.uuid4(), service_order_id=os2.id, entity_type="service", entity_id=services_dict["Facetamento Especial Acetato"].id, quantity=1, unit_price=Decimal("30.00"), total_price=Decimal("30.00")))

        # OS 3: Só Serviço / Reparo (Solda + Ajuste)
        os3 = ServiceOrder(
            id=uuid.uuid4(),
            os_number="OS-2026-1003",
            optical_store_id=store_visao_real.id,
            client_order_number="PED-REPARO-03",
            tray_number="BANDEJA-103",
            priority="NORMAL",
            os_type="REPARO_SERVICO",
            status=OSStatus.CQ_FINAL.value if hasattr(OSStatus.CQ_FINAL, 'value') else OSStatus.CQ_FINAL,
            frame_a=50.0, frame_bridge=18.0, frame_ed=52.0,
            lens_model_id=None,
            total_amount=Decimal("50.00"),
            special_instructions="Solda na haste esquerda e troca de plaquetas de silicone",
            created_at=datetime.utcnow() - timedelta(hours=3)
        )
        db.add(os3)
        await db.flush()
        db.add(ServiceOrderItem(id=uuid.uuid4(), service_order_id=os3.id, entity_type="service", entity_id=services_dict["Solda de Charnière & Ajuste"].id, quantity=1, unit_price=Decimal("50.00"), total_price=Decimal("50.00")))

        # OS 4: Bloqueada por Inadimplência Financeira (Fila de Ordens Retidas)
        os4 = ServiceOrder(
            id=uuid.uuid4(),
            os_number="OS-2026-1004",
            optical_store_id=store_prime.id,
            client_order_number="PED-PRIME-RETIDA",
            tray_number="BANDEJA-RETIDA",
            priority="NORMAL",
            os_type="PADRAO",
            status="BLOQUEADA_FINANCEIRO",
            od_spherical=Decimal("-2.00"), od_cylindrical=Decimal("-0.50"), od_axis=90, od_dnp=31.0, od_height=20.0,
            oe_spherical=Decimal("-2.00"), oe_cylindrical=Decimal("-0.50"), oe_axis=90, oe_dnp=31.0, oe_height=20.0,
            frame_a=52.0, frame_bridge=18.0, frame_ed=55.0,
            lens_model_id=model_lp.id,
            total_amount=Decimal("150.00"),
            special_instructions="Ordem retida temporariamente aguardando quitação de fatura em atraso",
            created_at=datetime.utcnow() - timedelta(hours=1)
        )
        db.add(os4)

        await db.commit()
        print("  ✅ Ordens de Serviço inseridas em múltiplos estágios da esteira!")

        # -------------------------------------------------------------------------
        # 9. FATURAMENTO COMERCIAL, CONTAS A RECEBER E NOTA FISCAL (NF-e)
        # -------------------------------------------------------------------------
        print("\n[9/10] Gerando Ciclos de Faturamento, Contas a Receber e NF-e...")

        # Ciclo de Faturamento 1 (Fechado e Liquidado para Ótica Visão Real)
        billing1 = BillingCycle(
            id=uuid.uuid4(),
            optical_store_id=store_visao_real.id,
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            status="FECHADO",
            total_amount=Decimal("225.00"),
            due_date=datetime.utcnow() + timedelta(days=15),
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(billing1)
        await db.flush()

        db.add(BillingItem(id=uuid.uuid4(), billing_cycle_id=billing1.id, service_order_id=os1.id, amount=Decimal("225.00")))

        # Contas a Receber (Liquidado/Recebido)
        rec1 = AccountsReceivable(
            id=uuid.uuid4(),
            billing_cycle_id=billing1.id,
            optical_store_id=store_visao_real.id,
            description=f"Faturamento Quitado OS {os1.os_number}",
            amount=Decimal("225.00"),
            amount_received=Decimal("225.00"),
            status="RECEBIDO",
            due_date=datetime.utcnow() + timedelta(days=15),
            received_at=datetime.utcnow()
        )
        db.add(rec1)

        # Nota Fiscal Emitida para OS 1
        nfe1 = NfeSaida(
            id=uuid.uuid4(),
            billing_cycle_id=billing1.id,
            nfe_number=100101,
            serie=1,
            chave_acesso=f"352608{store_visao_real.cnpj}00100101100000001",
            xml_content="<nfeProc><NFe><infNFe><total><vNF>225.00</vNF></total></infNFe></NFe></nfeProc>",
            status="EMITIDA",
            created_at=datetime.utcnow() - timedelta(days=1),
            emitted_at=datetime.utcnow() - timedelta(days=1)
        )
        db.add(nfe1)

        # Ciclo de Faturamento 2 (Pendente para Ótica Master Visão)
        billing2 = BillingCycle(
            id=uuid.uuid4(),
            optical_store_id=store_master.id,
            start_date=datetime.utcnow() - timedelta(days=15),
            end_date=datetime.utcnow(),
            status="ABERTO",
            total_amount=Decimal("390.00"),
            due_date=datetime.utcnow() + timedelta(days=30),
            created_at=datetime.utcnow()
        )
        db.add(billing2)
        await db.flush()

        db.add(BillingItem(id=uuid.uuid4(), billing_cycle_id=billing2.id, service_order_id=os2.id, amount=Decimal("390.00")))

        rec2 = AccountsReceivable(
            id=uuid.uuid4(),
            billing_cycle_id=billing2.id,
            optical_store_id=store_master.id,
            description=f"Faturamento Pendente OS {os2.os_number}",
            amount=Decimal("390.00"),
            amount_received=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.utcnow() + timedelta(days=30)
        )
        db.add(rec2)

        await db.commit()
        print("  ✅ Faturamento, Títulos Financeiros e Notas Fiscais gerados!")

        # -------------------------------------------------------------------------
        # 10. AUDITORIA FINAL DOS DADOS POVOADOS
        # -------------------------------------------------------------------------
        print("\n[10/10] Resumo da Base Povoada para Testes End-to-End:")
        print(f"  🏢 Óticas Cliente: 3 cadastradas (Visão Real, Master Visão, Prime Lenses)")
        print(f"  👓 Modelos de Lentes: 5 modelos cadastrados cobrindo as 5 Matrizes Ópticas")
        print(f"  📦 Registros de Grade com Estoque Físico: Múltiplas dioptrias com código de barras")
        print(f"  🛠️ Serviços Técnicos no Catálogo: 5 serviços disponíveis para acoplamento em OS")
        print(f"  📄 Ordens de Serviço: 4 OSs em estágios distintos (Concluída, Facetamento, CQ, Bloqueada)")
        print(f"  💳 Finanças & Fiscal: Títulos em aberto/quitados e NF-e emitidas")

    print("\n" + "=" * 80)
    print("🎉 POVOAMENTO CONCLUÍDO COM SUCESSO! A BASE ESTÁ PRONTA PARA TESTES COMPLETOS!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(seed_full_demo_database())
