import asyncio
import sys
import os

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from datetime import datetime, timedelta
import random
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from backend.app.core.database import Base
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash

from backend.app.models.user import User, Role, Permission
from backend.app.models.optical_store import OpticalStore
from backend.app.models.partner import PartnerShop, PartnerApiKey
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.movement import StockMovement
from backend.app.models.os import ServiceOrder, OSWorkflowHistory, OSStatus, ServiceOrderItem, OSCQInspection
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService, PriceHistory

from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable, CostCenter, FinancialCategory
from backend.app.models.system_parameter import SystemParameter
from backend.app.models.supplier_order import SupplierOrder, SupplierOrderItem


DATABASE_URL = settings.DATABASE_URL

async def seed_data():
    print("Iniciando Semeadura Completa do Banco de Dados Nova Lab (Todas as Funcionalidades)...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        print("Recriando estrutura limpa das tabelas...")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

        
    async with async_session() as session:
        # ==========================================
        # 0. PERFIS E USUÁRIOS PADRÃO
        # ==========================================
        print("1/8. Gerando Perfis de Acesso e Usuários Padrões...")
        role_admin = Role(name="Administrador", description="Acesso total às telas gerenciais, financeiras e operacionais")
        role_op = Role(name="Operador", description="Acesso operacional às bancadas de produção e expedição")
        session.add_all([role_admin, role_op])
        await session.flush()

        user_suporte_1 = User(
            name="Suporte Técnico Nova Lab",
            email="suporte",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        user_suporte_2 = User(
            name="Suporte Técnico Nova Lab",
            email="suporte@novalab.com.br",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        user_admin = User(
            name="Administrador Master",
            email="admin@novalab.com.br",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        user_op = User(
            name="Operador Bento Silva",
            email="operador@novalab.com.br",
            hashed_password=get_password_hash("operador123"),
            role_id=role_op.id,
            is_active=True,
            must_change_password=False
        )
        session.add_all([user_suporte_1, user_suporte_2, user_admin, user_op])
        await session.flush()

        # ==========================================
        # 1. PARÂMETROS DO SISTEMA
        # ==========================================
        print("2/8. Inicializando Parâmetros Globais do Sistema...")
        from backend.app.crud.crud_system_parameters import seed_default_parameters
        await seed_default_parameters(session)

        # ==========================================
        # 2. ÓTICAS COMERCIAIS & LOJAS PARCEIRAS
        # ==========================================
        print("3/8. Criando Óticas Comerciais e Canais Parceiros...")
        store1 = OpticalStore(
            corporate_name="Óticas Alfa S.A.",
            trade_name="Óticas Alfa",
            cnpj="11.111.111/0001-11",
            is_active=True,
            address="Av. Central, 100 - Centro, Brasília DF",
            credit_limit=Decimal("5000.00")
        )
        store2 = OpticalStore(
            corporate_name="Óticas Beta Ltda",
            trade_name="Óticas Beta",
            cnpj="22.222.222/0001-22",
            is_active=True,
            address="Rua das Flores, 50 - Jd. América, Brasília DF",
            credit_limit=Decimal("10000.00")
        )
        store3 = OpticalStore(
            corporate_name="Óticas Gama Visão Eireli",
            trade_name="Óticas Gama",
            cnpj="33.333.333/0001-33",
            is_active=True,
            address="Alameda Shopping, Loja 12, Taguatinga DF",
            credit_limit=Decimal("3000.00")
        )
        store4 = OpticalStore(
            corporate_name="Óticas Delta Premium Ltda",
            trade_name="Óticas Delta",
            cnpj="44.444.444/0001-44",
            is_active=True,
            address="Park Shopping, Piso 2, Brasília DF",
            credit_limit=Decimal("15000.00")
        )
        session.add_all([store1, store2, store3, store4])
        await session.flush()

        partner1 = PartnerShop(
            corporate_name="Loja Virtual Óticas Alfa Matriz S.A.",
            trade_name="Loja Virtual Óticas Alfa",
            cnpj="99.999.999/0001-99",
            is_active=True
        )

        session.add(partner1)
        await session.flush()

        # ==========================================
        # 3. CATÁLOGO FINANCEIRO, PREÇOS E SERVIÇOS
        # ==========================================
        print("4/8. Criando Modelos de Lentes, Produtos e Serviços Técnicos...")
        models = [
            LensModel(
                brand="Essilor",
                material="Resina CR-39",
                refractive_index=Decimal("1.56"),
                treatment="Antirreflexo Crizal Easy",
                diameter=70,
                cost_price=Decimal("35.00"),
                sale_price=Decimal("120.00")
            ),
            LensModel(
                brand="Hoya",
                material="Policarbonato",
                refractive_index=Decimal("1.59"),
                treatment="BlueControl Filtro Azul",
                diameter=65,
                cost_price=Decimal("55.00"),
                sale_price=Decimal("210.00")
            ),
            LensModel(
                brand="Zeiss",
                material="Alto Índice",
                refractive_index=Decimal("1.67"),
                treatment="DuraVision Platinum",
                diameter=70,
                cost_price=Decimal("120.00"),
                sale_price=Decimal("450.00")
            ),
            LensModel(
                brand="Nova Lab Própria",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Incolor",
                diameter=70,
                cost_price=Decimal("12.00"),
                sale_price=Decimal("75.00")
            )
        ]
        session.add_all(models)
        await session.flush()

        prod1 = Product(
            name="Lente Essilor Crizal 1.56",
            description="Lente monofocal antirreflexo de resina",
            sku="L-ESS-CR-156",
            cost_price=35.00,
            sale_price=120.00,
            lens_model_id=models[0].id,
            is_active=True,
            current_version=1
        )
        prod2 = Product(
            name="Lente Hoya BlueControl 1.59",
            description="Lente monofocal policarbonato filtro azul",
            sku="L-HOY-BC-159",
            cost_price=55.00,
            sale_price=210.00,
            lens_model_id=models[1].id,
            is_active=True,
            current_version=1
        )
        prod3 = Product(
            name="Lente Zeiss 1.67 DuraVision",
            description="Lente ultra fina alto índice com antirreflexo premium",
            sku="L-ZEI-DV-167",
            cost_price=120.00,
            sale_price=450.00,
            lens_model_id=models[2].id,
            is_active=True,
            current_version=1
        )
        session.add_all([prod1, prod2, prod3])
        await session.flush()

        srv_montagem = TechnicalService(name="Montagem Simples", description="Serviço técnico em armação fechada", price=30.00, is_active=True, current_version=1)
        srv_nylon = TechnicalService(name="Montagem Fio de Nylon", description="Serviço em armação com fio de nylon", price=40.00, is_active=True, current_version=1)
        srv_tingimento = TechnicalService(name="Tingimento Solar G15", description="Coloração verde G15 total ou degradê", price=45.00, is_active=True, current_version=1)
        srv_hardcoat = TechnicalService(name="Tratamento Hard Coat", description="Camada verniz protetora anti-risco", price=35.00, is_active=True, current_version=1)
        trt1 = Treatment(name="Antirreflexo Crizal Easy", description="Tratamento antirreflexo e lipofóbico", price=75.00, is_active=True, current_version=1)
        trt2 = Treatment(name="Filtro Azul BlueControl", description="Proteção contra luz azul de telas digitais", price=90.00, is_active=True, current_version=1)
        session.add_all([srv_montagem, srv_nylon, srv_tingimento, srv_hardcoat, trt1, trt2])
        await session.flush()



        # ==========================================
        # 4. GRADE DE ESTOQUE (MOTOR PREDITIVO ACIONADO)
        # ==========================================
        print("5/8. Populando Grade de Estoque de Lentes (Status: Normal, Baixo, Crítico e Ruptura)...")
        sphericals = [Decimal(f"{s:.2f}") for s in [4.0, 2.0, 0.0, -2.0, -4.0]]
        cylindricals = [Decimal(f"{c:.2f}") for c in [0.0, -1.0, -2.0]]
        
        barcode_counter = 7891000000000
        inventory_items_map = {}

        for idx, model in enumerate(models):
            inventory_items_map[model.id] = {}
            for sph in sphericals:
                for cyl in cylindricals:
                    barcode_counter += 1
                    barcode = str(barcode_counter)
                    location_tag = f"GAVETA-{'A' if sph >= 0 else 'B'}{abs(int(sph)) + 1}-L{abs(int(cyl)) + 1}"
                    
                    # Varia a quantidade para testar os alertas do Motor Preditivo de Estoque
                    if sph == Decimal("0.00") and cyl == Decimal("0.00"):
                        qty = 0  # Ruptura
                    elif sph == Decimal("-2.00") and cyl == Decimal("-1.00"):
                        qty = 1  # Crítico
                    elif sph == Decimal("-4.00"):
                        qty = 4  # Baixo
                    else:
                        qty = 25 # Normal
                    
                    grade_item = LensInventoryGrade(
                        lens_model_id=model.id,
                        spherical=sph,
                        cylindrical=cyl,
                        barcode=barcode,
                        quantity_available=qty,
                        location_tag=location_tag
                    )
                    session.add(grade_item)
                    await session.flush()
                    inventory_items_map[model.id][(sph, cyl)] = grade_item.id

                    session.add(StockMovement(
                        lens_inventory_id=grade_item.id,
                        movement_type="AUDIT",
                        quantity=qty,
                        reason="Inventário Inicial Nova Lab"
                    ))
        await session.commit()

        # ==========================================
        # 5. ORDENS DE SERVIÇO (TODAS AS ETAPAS MES)
        # ==========================================
        print("6/8. Gerando Ordens de Serviço em TODAS as 15 etapas do Workflow MES...")
        
        os_list = [
            # (OS_num, Cliente, Status, Store, Sfh, Cyl)
            ("OS-2026-0001", "João Medeiros", OSStatus.RECEBIDA, store1, Decimal("-2.00"), Decimal("-1.00")),
            ("OS-2026-0002", "Mariana Costa", OSStatus.TRIAGEM, store2, Decimal("2.00"), Decimal("0.00")),
            ("OS-2026-0003", "Carlos Eduardo", OSStatus.SEPARACAO, store1, Decimal("0.00"), Decimal("-1.00")),
            ("OS-2026-0004", "Beatriz Ramos", OSStatus.SURFACAGEM, store3, Decimal("-4.00"), Decimal("-2.00")),
            ("OS-2026-0005", "Fernando Dias", OSStatus.INSP_BRUTA, store2, Decimal("4.00"), Decimal("0.00")),
            ("OS-2026-0006", "Camila Nogueira", OSStatus.TINGIMENTO, store4, Decimal("-2.00"), Decimal("0.00")),
            ("OS-2026-0007", "Luciana Prado", OSStatus.ENDURECIMENTO, store1, Decimal("1.50"), Decimal("-0.50")),
            ("OS-2026-0008", "Rodrigo Martins", OSStatus.INSP_POS, store2, Decimal("-1.00"), Decimal("-1.00")),
            ("OS-2026-0009", "Patricia Gomes", OSStatus.FACETAMENTO, store3, Decimal("0.00"), Decimal("0.00")),
            ("OS-2026-0010", "Gabriel Vasconcelos", OSStatus.INSP_FACETA, store4, Decimal("-3.00"), Decimal("-1.50")),
            ("OS-2026-0011", "Helena Siqueira", OSStatus.MONTAGEM, store1, Decimal("2.50"), Decimal("-1.00")),
            ("OS-2026-0012", "Marcelo Andrade", OSStatus.CQ_FINAL, store2, Decimal("-2.00"), Decimal("-1.00")),
            ("OS-2026-0013", "Vanessa Lopes", OSStatus.EXPEDICAO, store1, Decimal("0.00"), Decimal("0.00")),
            ("OS-2026-0014", "Roberto Paiva", OSStatus.AGUARDANDO_LIBERACAO, store1, Decimal("-2.50"), Decimal("-1.00")),
            ("OS-2026-0015", "Fabiana Castro", OSStatus.BLOQUEADA_FINANCEIRO, store1, Decimal("-5.00"), Decimal("-2.00")),
            ("OS-2026-0016", "Marcia Albuquerque", OSStatus.CANCELADA, store2, Decimal("-3.50"), Decimal("-1.00")),
        ]

        created_os_objs = []
        for os_num, client, status_val, store_obj, sph, cyl in os_list:
            os_item = ServiceOrder(
                os_number=os_num,
                client_name=client,
                doctor_name="Dr. Arnaldo Oftalmologista",
                optical_store_id=store_obj.id,
                status=status_val.value if hasattr(status_val, 'value') else status_val,
                od_spherical=sph,
                od_cylindrical=cyl,
                od_axis=90,
                od_dnp=Decimal("31.50"),
                oe_spherical=sph,
                oe_cylindrical=cyl,
                oe_axis=90,
                oe_dnp=Decimal("31.50"),
                frame_a=Decimal("52.00"),
                frame_bridge=Decimal("18.00"),
                frame_ed=Decimal("54.00"),
                total_amount=150.00,
                created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
            )
            
            # Se for bloqueada por inadimplência, preenche a auditoria
            if status_val in [OSStatus.AGUARDANDO_LIBERACAO, OSStatus.BLOQUEADA_FINANCEIRO]:
                os_item.financial_validation_date = datetime.utcnow()
                os_item.financial_policy_applied = "POLICY_BLOCK" if status_val == OSStatus.BLOQUEADA_FINANCEIRO else "POLICY_AUTHORIZE"
                os_item.financial_overdue_amount = 150.00
                os_item.financial_overdue_count = 1
                os_item.financial_max_overdue_days = 5

            session.add(os_item)
            await session.flush()
            created_os_objs.append(os_item)

            # Grava o histórico inicial no Workflow
            session.add(OSWorkflowHistory(
                service_order_id=os_item.id,
                previous_status=None,
                new_status=status_val.value if hasattr(status_val, 'value') else status_val,
                operator_notes=f"OS iniciada no sistema com status {os_val_str(status_val)}.",
                changed_at=os_item.created_at,
                operator_id=user_op.id,
                sector="Triagem/Recepção"
            ))

            # Adiciona item de serviço
            session.add(ServiceOrderItem(
                service_order_id=os_item.id, entity_type="product", entity_id=prod1.id,
                quantity=1, unit_price=120.00, total_price=120.00, original_price=120.00
            ))
            session.add(ServiceOrderItem(
                service_order_id=os_item.id, entity_type="service", entity_id=srv_montagem.id,
                quantity=1, unit_price=30.00, total_price=30.00, original_price=30.00
            ))

        # Registro de Inspeção de CQ na OS-2026-0013 (Aprovada) e OS-2026-0016 (Reprovada/Quebra)
        session.add(OSCQInspection(
            service_order_id=created_os_objs[12].id, # OS 13
            operator_id=user_op.id,
            check_grau=True,
            check_eixo=True,
            check_acabamento=True,
            result="APROVADO",
            notes="Qualidade óptica e bisel validados sem inconformidades.",
            created_at=datetime.utcnow() - timedelta(hours=2)
        ))
        session.add(OSCQInspection(
            service_order_id=created_os_objs[15].id, # OS 16
            operator_id=user_op.id,
            check_grau=True,
            check_eixo=False,
            check_acabamento=False,
            result="RETRABALHO",

            rework_destination="Separação",
            notes="Reprovado no CQ por fissura no bisel. Registrado para refazimento.",
            created_at=datetime.utcnow() - timedelta(hours=1)
        ))


        await session.commit()

        # ==========================================
        # 6. MÓDULO FINANCEIRO CORPORATIVO (CONTAS A PAGAR/RECEBER & FLUXO DE CAIXA)
        # ==========================================
        print("7/8. Gerando Contas a Pagar, Contas a Receber e Centros de Custo...")
        cc_prod = CostCenter(name="Produção & Insumos", code="CC-001")
        cc_adm = CostCenter(name="Administrativo", code="CC-002")
        cc_com = CostCenter(name="Comercial", code="CC-003")
        session.add_all([cc_prod, cc_adm, cc_com])
        await session.flush()

        cat_lentes = FinancialCategory(name="Fornecedores de Lentes", type="DESPESA")
        cat_energia = FinancialCategory(name="Energia & Utilidades", type="DESPESA")
        cat_faturamento = FinancialCategory(name="Faturamento de Óticas", type="RECEITA")
        session.add_all([cat_lentes, cat_energia, cat_faturamento])
        await session.flush()

        # Contas a Pagar
        pay1 = AccountsPayable(
            supplier_name="Essilor Brasil Distribuidora",
            description="Compra de Bloco de Lentes Resina 1.56",
            amount=Decimal("1200.00"),
            due_date=datetime.utcnow() + timedelta(days=15),
            status="PENDENTE",
            cost_center_id=cc_prod.id,
            category_id=cat_lentes.id
        )
        pay2 = AccountsPayable(
            supplier_name="Companhia Elétrica Brasília",
            description="Fatura de Energia Elétrica do Parque Fabril",
            amount=Decimal("850.00"),
            due_date=datetime.utcnow() - timedelta(days=3),
            status="PAGO",
            amount_paid=Decimal("850.00"),
            payment_date=datetime.utcnow() - timedelta(days=3),
            cost_center_id=cc_adm.id,
            category_id=cat_energia.id
        )
        session.add_all([pay1, pay2])


        # Fechamentos Financeiros de Lojas (BillingCycle)
        cycle_paid = BillingCycle(
            optical_store_id=store1.id,
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow() - timedelta(days=15),
            due_date=datetime.utcnow() - timedelta(days=5),
            total_amount=Decimal("450.00"),
            status="PAGO"
        )
        cycle_pending = BillingCycle(
            optical_store_id=store2.id,
            start_date=datetime.utcnow() - timedelta(days=15),
            end_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=10),
            total_amount=Decimal("300.00"),
            status="FECHADO"
        )
        cycle_overdue = BillingCycle(
            optical_store_id=store1.id,
            start_date=datetime.utcnow() - timedelta(days=25),
            end_date=datetime.utcnow() - timedelta(days=10),
            due_date=datetime.utcnow() - timedelta(days=2), # Vencido para acionar a Central de Alertas Financeiros
            total_amount=Decimal("150.00"),
            status="FECHADO"
        )
        session.add_all([cycle_paid, cycle_pending, cycle_overdue])
        await session.flush()

        session.add(BillingItem(billing_cycle_id=cycle_paid.id, service_order_id=created_os_objs[10].id, amount=Decimal("450.00")))
        session.add(BillingItem(billing_cycle_id=cycle_pending.id, service_order_id=created_os_objs[11].id, amount=Decimal("300.00")))
        session.add(BillingItem(billing_cycle_id=cycle_overdue.id, service_order_id=created_os_objs[12].id, amount=Decimal("150.00")))
        await session.flush()

        # Sincroniza faturas para Contas a Receber Corporativas
        from backend.app.crud import crud_financial_corp
        await crud_financial_corp.sync_billing_cycles_to_receivables(session)

        # Semeadura de Pedidos no Fornecedor (Custo x Revenda)
        sup_order1 = SupplierOrder(
            order_number="PED-FORN-2026-0001",
            supplier_name="Distribuidora de Lentes Matriz",
            status="RECEBIDO",
            total_cost=Decimal("700.00"),
            total_estimated_resale=Decimal("2800.00"),
            gross_margin_amount=Decimal("2100.00"),
            gross_margin_percent=Decimal("75.00"),
            notes="Pedido de ressuprimento inicial para estoque matriz"
        )
        session.add(sup_order1)
        await session.flush()

        sup_item1 = SupplierOrderItem(
            supplier_order_id=sup_order1.id,
            lens_model_id=models[0].id,
            model_name="Lente Essilor Crizal Easy 1.56",

            dioptria="Sph -2.00 / Cyl -1.00",
            quantity=20,
            unit_cost_price=Decimal("35.00"),
            total_cost_price=Decimal("700.00"),
            unit_resale_price=Decimal("140.00"),
            total_resale_price=Decimal("2800.00")
        )
        session.add(sup_item1)
        await session.flush()

        # Semeadura da Grade de Blocos
        print("Adicionando Modelos de Blocos Semiacabados Padrão...")
        from backend.app.crud import crud_block
        from backend.app.schemas.block import BlockModelCreate
        from backend.app.models.block import BlockGridItem
        bm1 = await crud_block.create_block_model(session, BlockModelCreate(brand="Essilor", name="Bloco Freeform 1.56", material="CR-39", refractive_index=1.56, cost_price=35.00, sale_price=95.00, base_curves_config="2.00, 4.00, 6.00, 8.00", additions_config="0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00"))
        bm2 = await crud_block.create_block_model(session, BlockModelCreate(brand="Hoya", name="Bloco Surfaçado 1.50", material="CR-39", refractive_index=1.50, cost_price=28.00, sale_price=80.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00"))
        
        grid_res = await session.execute(select(BlockGridItem).where(BlockGridItem.block_model_id == bm1.id))
        for item in grid_res.scalars().all():
            if float(item.base_curve) == 4.00 and float(item.addition) == 2.00:
                item.quantity_available = 8
            elif float(item.base_curve) == 2.00 and float(item.addition) == 1.50:
                item.quantity_available = 4
            elif float(item.base_curve) == 6.00 and float(item.addition) == 3.00:
                item.quantity_available = 1

        # Semeadura de Pedidos Comerciais de Venda (Óticas -> Fábrica)
        print("Adicionando Pedidos Comerciais de Venda de Exemplo...")
        from backend.app.models.commercial_order import CommercialOrder, CommercialOrderItem
        co1 = CommercialOrder(
            order_number="PED-2026-0001",
            optical_store_id=store1.id,
            client_name="João Pedro Oliveira",
            doctor_name="Dr. Fernando Souza",
            frame_type="METAL",
            payment_terms="30_DIAS",
            od_spherical=Decimal("-2.00"),
            od_cylindrical=Decimal("-1.00"),
            od_axis=90,
            od_addition=Decimal("2.00"),
            oe_spherical=Decimal("-2.25"),
            oe_cylindrical=Decimal("-0.75"),
            oe_axis=85,
            oe_addition=Decimal("2.00"),
            status="EM_PRODUCAO",
            subtotal=Decimal("280.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("280.00"),
            notes="Pedido prioritário para evento de ótica parceira"
        )
        session.add(co1)
        await session.flush()

        co_item1 = CommercialOrderItem(
            order_id=co1.id,
            item_type="LENTE_ACABADA",
            item_name="Lente Essilor Crizal Easy 1.56",
            quantity=2,
            unit_price=Decimal("140.00"),
            total_price=Decimal("280.00")
        )
        session.add(co_item1)

        await session.commit()
        print("8/8. Semeadura de Contas a Pagar, Receber, Fechamentos, Pedidos no Fornecedor, Grade de Blocos e Pedidos Comerciais Concluída com Sucesso!")


    print("\n========================================================================")
    print("BANCO DE DADOS NOVA LAB 100% POPULADO E PRONTO PARA TESTES COMPLETOS!")
    print("========================================================================")
    print("CREDENCIAIS DE ACESSO DISPONIVEIS:")
    print("   1. Administrador (Login Direto): suporte  | Senha:  Dio@sup.2203")
    print("   2. Administrador (E-mail):       admin@novalab.com.br | Senha: Dio@sup.2203")
    print("   3. Operador de Fábrica:          operador@novalab.com.br | Senha: operador123")
    print("========================================================================\n")


def os_val_str(val):
    return val.value if hasattr(val, 'value') else str(val)

if __name__ == "__main__":
    asyncio.run(seed_data())
