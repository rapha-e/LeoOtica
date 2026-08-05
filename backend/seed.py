import asyncio
import sys
import os
from datetime import datetime, timedelta
import random
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Garante o PYTHONPATH
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

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

def os_val_str(val):
    return val.value if hasattr(val, 'value') else str(val)

async def seed_data():
    print("========================================================================")
    print("INICIANDO SEMEADURA EXPANDIDA E COMPLETA DO BANCO DE DADOS NOVA LAB")
    print("========================================================================")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        print("Recriando estrutura limpa de todas as tabelas...")
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
        user_op2 = User(
            name="Operadora Carla Mendes",
            email="carla@novalab.com.br",
            hashed_password=get_password_hash("operador123"),
            role_id=role_op.id,
            is_active=True,
            must_change_password=False
        )
        session.add_all([user_suporte_1, user_suporte_2, user_admin, user_op, user_op2])
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
        print("3/8. Criando Óticas Comerciais e Lojas Parceiras...")
        stores_data = [
            ("Óticas Alfa S.A.", "Óticas Alfa", "11.111.111/0001-11", "Av. Central, 100 - Centro, Brasília DF", Decimal("10000.00")),
            ("Óticas Beta Ltda", "Óticas Beta", "22.222.222/0001-22", "Rua das Flores, 50 - Jd. América, Brasília DF", Decimal("15000.00")),
            ("Óticas Gama Visão Eireli", "Óticas Gama", "33.333.333/0001-33", "Alameda Shopping, Loja 12, Taguatinga DF", Decimal("8000.00")),
            ("Óticas Delta Premium Ltda", "Óticas Delta", "44.444.444/0001-44", "Park Shopping, Piso 2, Brasília DF", Decimal("25000.00")),
            ("Óticas Visão Real Centro", "Visão Real", "55.555.555/0001-55", "Quadra 5, Bloco C - Sobradinho DF", Decimal("6000.00")),
            ("Óticas Paris Shopping", "Óticas Paris", "66.666.666/0001-66", "Boulevard Shopping, Loja 45, Brasília DF", Decimal("18000.00")),
            ("Óticas EuroVisão Ltda", "EuroVisão", "77.777.777/0001-77", "Av. Comercial, 302 - Taguatinga DF", Decimal("12000.00")),
            ("Óticas Brasil Asa Sul", "Óticas Brasil", "88.888.888/0001-88", "CLS 308, Bloco B, Asa Sul, Brasília DF", Decimal("20000.00")),
            ("Óticas Cristal Águas Claras", "Óticas Cristal", "99.111.222/0001-99", "Rua 36 Norte, Loja 3, Águas Claras DF", Decimal("14000.00")),
            ("Óticas Safira Premium", "Safira Vision", "12.345.678/0001-90", "Shopping Conjunto Nacional, Piso 1, Brasília DF", Decimal("30000.00")),
        ]
        stores = []
        for corp, trade, cnpj, addr, limit in stores_data:
            st = OpticalStore(
                corporate_name=corp,
                trade_name=trade,
                cnpj=cnpj,
                is_active=True,
                address=addr,
                credit_limit=limit
            )
            session.add(st)
            stores.append(st)
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
        # 3. MODELOS DE LENTES (VARIADOS TRATAMENTOS E MARCAS)
        # ==========================================
        print("4/8. Cadastrando Ampla Variedade de Modelos de Lentes (Filtro Azul, Antirreflexo, Transitions, etc)...")
        lens_models_defs = [
            # ESSILOR
            {"brand": "Essilor", "material": "Resina CR-39", "refractive_index": Decimal("1.56"), "treatment": "Antirreflexo Crizal Easy", "diameter": 70, "cost_price": Decimal("35.00"), "sale_price": Decimal("120.00")},
            {"brand": "Essilor", "material": "Policarbonato", "refractive_index": Decimal("1.59"), "treatment": "Antirreflexo Crizal Sapphire HR", "diameter": 65, "cost_price": Decimal("60.00"), "sale_price": Decimal("240.00")},
            {"brand": "Essilor", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Filtro Azul Crizal Prevencia", "diameter": 70, "cost_price": Decimal("50.00"), "sale_price": Decimal("190.00")},
            {"brand": "Essilor", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Transitions Gen 8 Crizal AR", "diameter": 70, "cost_price": Decimal("110.00"), "sale_price": Decimal("380.00")},
            {"brand": "Essilor", "material": "Resina 1.60", "refractive_index": Decimal("1.60"), "treatment": "Antirreflexo Crizal Easy", "diameter": 72, "cost_price": Decimal("140.00"), "sale_price": Decimal("520.00")},

            # HOYA
            {"brand": "Hoya", "material": "Policarbonato", "refractive_index": Decimal("1.59"), "treatment": "BlueControl Filtro Azul", "diameter": 65, "cost_price": Decimal("55.00"), "sale_price": Decimal("210.00")},
            {"brand": "Hoya", "material": "Resina CR-39", "refractive_index": Decimal("1.56"), "treatment": "BlueControl Filtro Azul", "diameter": 70, "cost_price": Decimal("45.00"), "sale_price": Decimal("175.00")},
            {"brand": "Hoya", "material": "Alto Índice 1.67", "refractive_index": Decimal("1.67"), "treatment": "Hi-Vision LongLife Antirreflexo", "diameter": 70, "cost_price": Decimal("130.00"), "sale_price": Decimal("480.00")},
            {"brand": "Hoya", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Sensity 2 Fotocromática", "diameter": 70, "cost_price": Decimal("95.00"), "sale_price": Decimal("340.00")},

            # ZEISS
            {"brand": "Zeiss", "material": "Resina 1.60", "refractive_index": Decimal("1.60"), "treatment": "BlueGuard Filtro Azul", "diameter": 70, "cost_price": Decimal("85.00"), "sale_price": Decimal("320.00")},
            {"brand": "Zeiss", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "BlueGuard Filtro Azul", "diameter": 70, "cost_price": Decimal("48.00"), "sale_price": Decimal("185.00")},
            {"brand": "Zeiss", "material": "Alto Índice 1.67", "refractive_index": Decimal("1.67"), "treatment": "DuraVision Platinum AR", "diameter": 70, "cost_price": Decimal("120.00"), "sale_price": Decimal("450.00")},
            {"brand": "Zeiss", "material": "Policarbonato", "refractive_index": Decimal("1.59"), "treatment": "PhotoFusion X Fotocromática", "diameter": 65, "cost_price": Decimal("115.00"), "sale_price": Decimal("410.00")},
            {"brand": "Zeiss", "material": "Ultra Alto Índice 1.74", "refractive_index": Decimal("1.74"), "treatment": "DuraVision Platinum AR", "diameter": 70, "cost_price": Decimal("210.00"), "sale_price": Decimal("790.00")},

            # KODAK
            {"brand": "Kodak", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Kodak BlueProtect Filtro Azul", "diameter": 70, "cost_price": Decimal("42.00"), "sale_price": Decimal("160.00")},
            {"brand": "Kodak", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Kodak No-Reflect AR", "diameter": 70, "cost_price": Decimal("32.00"), "sale_price": Decimal("115.00")},
            {"brand": "Kodak", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Kodak CitySens Fotocromática", "diameter": 70, "cost_price": Decimal("78.00"), "sale_price": Decimal("280.00")},

            # SHAMIR
            {"brand": "Shamir", "material": "Resina 1.60", "refractive_index": Decimal("1.60"), "treatment": "Shamir Blue Zero Filtro Azul", "diameter": 70, "cost_price": Decimal("75.00"), "sale_price": Decimal("290.00")},

            # MARCA PRÓPRIA NOVA LAB
            {"brand": "Nova Lab Própria", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Blue Shield Filtro Azul", "diameter": 70, "cost_price": Decimal("22.00"), "sale_price": Decimal("95.00")},
            {"brand": "Nova Lab Própria", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "Ultra Clean AR", "diameter": 70, "cost_price": Decimal("18.00"), "sale_price": Decimal("80.00")},
            {"brand": "Nova Lab Própria", "material": "Resina 1.56", "refractive_index": Decimal("1.56"), "treatment": "SunTech Fotocromática", "diameter": 70, "cost_price": Decimal("45.00"), "sale_price": Decimal("180.00")},
            {"brand": "Nova Lab Própria", "material": "Resina CR-39", "refractive_index": Decimal("1.50"), "treatment": "Incolor Standard", "diameter": 70, "cost_price": Decimal("10.00"), "sale_price": Decimal("55.00")},

            # YOUNGER OPTICS
            {"brand": "Younger Optics", "material": "Resina CR-39", "refractive_index": Decimal("1.50"), "treatment": "NuPolar Polarizada Cinza", "diameter": 75, "cost_price": Decimal("65.00"), "sale_price": Decimal("250.00")},
        ]

        models = []
        for m_def in lens_models_defs:
            lm = LensModel(**m_def)
            session.add(lm)
            models.append(lm)
        await session.flush()

        # Produtos no Catálogo Financeiro vinculados às lentes
        products = []
        for idx, lm in enumerate(models):
            sku_clean = f"L-{lm.brand[:3].upper()}-{idx+1:03d}-{str(lm.refractive_index).replace('.', '')}"
            prod = Product(
                name=f"Lente {lm.brand} {lm.treatment} {lm.refractive_index}",
                description=f"Lente {lm.material} índice {lm.refractive_index} com tratamento {lm.treatment}",
                sku=sku_clean,
                cost_price=float(lm.cost_price),
                sale_price=float(lm.sale_price),
                lens_model_id=lm.id,
                is_active=True,
                current_version=1
            )
            session.add(prod)
            products.append(prod)
        await session.flush()

        # Serviços Técnicos e Tratamentos
        srv_montagem = TechnicalService(name="Montagem Simples", description="Montagem em armação fechada", price=30.00, is_active=True, current_version=1)
        srv_nylon = TechnicalService(name="Montagem Fio de Nylon", description="Montagem em armação fio de nylon", price=40.00, is_active=True, current_version=1)
        srv_parafuso = TechnicalService(name="Montagem Parafusada (Bisel V)", description="Montagem em armação sem aro / parafusada", price=55.00, is_active=True, current_version=1)
        srv_surfacagem = TechnicalService(name="Surfaçagem Digital Freeform HD", description="Usinagem digital de precisão micronizada", price=85.00, is_active=True, current_version=1)
        srv_tingimento = TechnicalService(name="Tingimento Solar G15 / Total", description="Coloração verde G15 total ou degradê", price=45.00, is_active=True, current_version=1)
        srv_hardcoat = TechnicalService(name="Tratamento Hard Coat Anti-Risco", description="Camada de verniz protetor anti-risco", price=35.00, is_active=True, current_version=1)
        srv_polimento = TechnicalService(name="Polimento de Bordas Cristalino", description="Polimento em bordas de lentes alto índice", price=25.00, is_active=True, current_version=1)
        
        trt_ar = Treatment(name="Antirreflexo Crizal Sapphire HR", description="Antirreflexo de altíssima transparência e durabilidade", price=120.00, is_active=True, current_version=1)
        trt_blue = Treatment(name="Filtro Azul BlueControl / BlueGuard", description="Proteção contra luz azul nociva de monitores e celulares", price=95.00, is_active=True, current_version=1)
        trt_trans = Treatment(name="Tratamento Fotocromático Transitions Gen 8", description="Tecnologia fotocromática de escurecimento rápido", price=180.00, is_active=True, current_version=1)
        trt_hidro = Treatment(name="Camada Hidrofóbica e Oleofóbica", description="Repelente de água, sujeira e impressões digitais", price=40.00, is_active=True, current_version=1)
        
        session.add_all([srv_montagem, srv_nylon, srv_parafuso, srv_surfacagem, srv_tingimento, srv_hardcoat, srv_polimento, trt_ar, trt_blue, trt_trans, trt_hidro])
        await session.flush()

        # ==========================================
        # 4. GRADE DE ESTOQUE DE LENTES (COMPLETA E VARIADA)
        # ==========================================
        print("5/8. Populando Grade Dióptrica de Estoque (Grade Óptica Tridimensional)...")
        sphericals = [Decimal(f"{s:.2f}") for s in [6.0, 4.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -3.0, -4.0, -5.0, -6.0]]
        cylindricals = [Decimal(f"{c:.2f}") for c in [0.0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0]]
        
        barcode_counter = 7891000000000
        inventory_items_map = {}

        for idx, model in enumerate(models):
            inventory_items_map[model.id] = {}
            for sph in sphericals:
                for cyl in cylindricals:
                    barcode_counter += 1
                    barcode = str(barcode_counter)
                    section = "A" if sph >= 0 else "B"
                    row = abs(int(sph)) + 1
                    col = abs(int(cyl * 2)) + 1
                    location_tag = f"GAVETA-{section}{row}-L{col}"
                    
                    # Variações realistas de estoque para acionar Motor Preditivo, alertas de ruptura e críticos
                    if sph == Decimal("-2.00") and cyl == Decimal("-1.00"):
                        # Grau super comum: em algumas marcas coloca ruptura ou crítico para testar reposição!
                        if "Essilor" in model.brand or "Hoya" in model.brand:
                            qty = 0 # Ruptura
                        elif "Zeiss" in model.brand:
                            qty = 1 # Crítico
                        else:
                            qty = 15
                    elif sph == Decimal("0.00") and cyl == Decimal("0.00"):
                        if "Nova Lab" in model.brand:
                            qty = 0 # Ruptura
                        else:
                            qty = 2
                    elif sph == Decimal("-4.00") and cyl == Decimal("-2.00"):
                        qty = 3 # Baixo estoque
                    elif abs(sph) >= 5.0 or abs(cyl) >= 2.5:
                        qty = random.choice([2, 4, 5, 8]) # Graus altos
                    else:
                        qty = random.choice([12, 18, 24, 30]) # Graus padrão
                    
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

                    if qty > 0:
                        session.add(StockMovement(
                            lens_inventory_id=grade_item.id,
                            movement_type="AUDIT",
                            quantity=qty,
                            reason="Inventário Inicial de Carga Geral"
                        ))
        await session.commit()

        # ==========================================
        # 5. SEMEADURA COMPLETA DA GRADE DE BLOCOS SEMIACABADOS
        # ==========================================
        print("6/8. Populando Grade de Blocos Semiacabados (Bases x Adições com Estoque Real)...")
        from backend.app.crud import crud_block
        from backend.app.schemas.block import BlockModelCreate
        from backend.app.models.block import BlockGridItem, BlockModel

        block_models_data = [
            BlockModelCreate(brand="Essilor", name="Bloco Freeform 1.56 Incolor", material="CR-39", refractive_index=1.56, cost_price=35.00, sale_price=95.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Essilor", name="Bloco Transitions Gen8 1.56", material="Resina 1.56", refractive_index=1.56, cost_price=85.00, sale_price=220.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Hoya", name="Bloco Surfaçado 1.50 Antirreflexo", material="CR-39", refractive_index=1.50, cost_price=28.00, sale_price=80.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Hoya", name="Bloco Policarbonato 1.59 Filtro Azul", material="Policarbonato", refractive_index=1.59, cost_price=45.00, sale_price=135.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Zeiss", name="Bloco Alto Índice 1.67 BlueGuard", material="Resina 1.67", refractive_index=1.67, cost_price=95.00, sale_price=280.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Zeiss", name="Bloco Ultra Fino 1.74 Freeform", material="Ultra Alto Índice 1.74", refractive_index=1.74, cost_price=160.00, sale_price=490.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Kodak", name="Bloco Poly 1.59 Antirreflexo", material="Policarbonato", refractive_index=1.59, cost_price=38.00, sale_price=110.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Shamir", name="Bloco Resina 1.60 Freeform HD", material="Resina 1.60", refractive_index=1.60, cost_price=62.00, sale_price=185.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Nova Lab", name="Bloco Próprio CR-39 1.56 Incolor", material="Resina 1.56", refractive_index=1.56, cost_price=18.00, sale_price=65.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Nova Lab", name="Bloco Próprio Filtro Azul 1.56", material="Resina 1.56", refractive_index=1.56, cost_price=24.00, sale_price=85.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
            BlockModelCreate(brand="Younger Optics", name="Bloco NuPolar Polarizado Cinza 1.50", material="CR-39", refractive_index=1.50, cost_price=55.00, sale_price=170.00, base_curves_config="2.00, 4.00, 6.00", additions_config="0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25"),
        ]

        created_block_models = []
        for b_data in block_models_data:
            bm = await crud_block.create_block_model(session, b_data)
            created_block_models.append(bm)

        # Preenche quantidades na matriz de blocos
        block_barcode_counter = 7899000000000
        grid_items_res = await session.execute(select(BlockGridItem))
        all_block_items = grid_items_res.scalars().all()
        for b_item in all_block_items:
            block_barcode_counter += 1
            b_item.barcode = str(block_barcode_counter)
            b_item.location_tag = f"BLOCO-B{int(float(b_item.base_curve))}-A{int(float(b_item.addition)*100)}"
            
            # Popula com quantidades variadas
            base_f = float(b_item.base_curve)
            add_f = float(b_item.addition)
            if base_f in [4.0, 6.0] and add_f in [1.5, 2.0, 2.5]:
                b_item.quantity_available = random.randint(10, 25)
            elif base_f in [2.0, 8.0] and add_f in [1.0, 3.0]:
                b_item.quantity_available = random.randint(2, 6)
            elif add_f == 0.0:
                b_item.quantity_available = random.randint(15, 30)
            else:
                b_item.quantity_available = random.choice([0, 1, 3, 5, 8, 12])
        await session.commit()

        # ==========================================
        # 6. ORDENS DE SERVIÇO (TODAS AS ETAPAS MES DO WORKFLOW)
        # ==========================================
        print("7/8. Gerando Ordens de Serviço em TODAS as 15 etapas do Workflow MES...")
        
        os_seed_definitions = [
            ("OS-2026-0001", "João Medeiros", OSStatus.RECEBIDA, stores[0], Decimal("-2.00"), Decimal("-1.00")),
            ("OS-2026-0002", "Mariana Costa", OSStatus.TRIAGEM, stores[1], Decimal("2.00"), Decimal("0.00")),
            ("OS-2026-0003", "Carlos Eduardo", OSStatus.SEPARACAO, stores[0], Decimal("0.00"), Decimal("-1.00")),
            ("OS-2026-0004", "Beatriz Ramos", OSStatus.SURFACAGEM, stores[2], Decimal("-4.00"), Decimal("-2.00")),
            ("OS-2026-0005", "Fernando Dias", OSStatus.INSP_BRUTA, stores[1], Decimal("4.00"), Decimal("0.00")),
            ("OS-2026-0006", "Camila Nogueira", OSStatus.TINGIMENTO, stores[3], Decimal("-2.00"), Decimal("0.00")),
            ("OS-2026-0007", "Luciana Prado", OSStatus.ENDURECIMENTO, stores[0], Decimal("1.50"), Decimal("-0.50")),
            ("OS-2026-0008", "Rodrigo Martins", OSStatus.INSP_POS, stores[1], Decimal("-1.00"), Decimal("-1.00")),
            ("OS-2026-0009", "Patricia Gomes", OSStatus.FACETAMENTO, stores[2], Decimal("0.00"), Decimal("0.00")),
            ("OS-2026-0010", "Gabriel Vasconcelos", OSStatus.INSP_FACETA, stores[3], Decimal("-3.00"), Decimal("-1.50")),
            ("OS-2026-0011", "Helena Siqueira", OSStatus.MONTAGEM, stores[0], Decimal("2.50"), Decimal("-1.00")),
            ("OS-2026-0012", "Marcelo Andrade", OSStatus.CQ_FINAL, stores[1], Decimal("-2.00"), Decimal("-1.00")),
            ("OS-2026-0013", "Vanessa Lopes", OSStatus.EXPEDICAO, stores[0], Decimal("0.00"), Decimal("0.00")),
            ("OS-2026-0014", "Roberto Paiva", OSStatus.AGUARDANDO_LIBERACAO, stores[4], Decimal("-2.50"), Decimal("-1.00")),
            ("OS-2026-0015", "Fabiana Castro", OSStatus.BLOQUEADA_FINANCEIRO, stores[4], Decimal("-5.00"), Decimal("-2.00")),
            ("OS-2026-0016", "Marcia Albuquerque", OSStatus.CANCELADA, stores[5], Decimal("-3.50"), Decimal("-1.00")),
            ("OS-2026-0017", "Thiago Ribeiro", OSStatus.SURFACAGEM, stores[5], Decimal("1.00"), Decimal("-0.75")),
            ("OS-2026-0018", "Juliana Paes", OSStatus.FACETAMENTO, stores[6], Decimal("-1.50"), Decimal("-0.50")),
            ("OS-2026-0019", "Renato Aragão", OSStatus.MONTAGEM, stores[6], Decimal("3.00"), Decimal("-1.25")),
            ("OS-2026-0020", "Tatiana Lima", OSStatus.CQ_FINAL, stores[7], Decimal("-2.25"), Decimal("-0.75")),
            ("OS-2026-0021", "Felipe Franco", OSStatus.EXPEDICAO, stores[7], Decimal("0.50"), Decimal("0.00")),
            ("OS-2026-0022", "Aline Barros", OSStatus.TRIAGEM, stores[8], Decimal("-3.00"), Decimal("-1.00")),
            ("OS-2026-0023", "Bruno Gagliasso", OSStatus.SEPARACAO, stores[8], Decimal("1.75"), Decimal("-0.50")),
            ("OS-2026-0024", "Giovanna Antonelli", OSStatus.RECEBIDA, stores[9], Decimal("-2.00"), Decimal("-1.50")),
            ("OS-2026-0025", "Caio Castro", OSStatus.EXPEDICAO, stores[9], Decimal("2.00"), Decimal("-1.00")),
        ]

        created_os_objs = []
        for os_num, client, status_val, store_obj, sph, cyl in os_seed_definitions:
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
                total_amount=180.00,
                created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 72))
            )
            
            if status_val in [OSStatus.AGUARDANDO_LIBERACAO, OSStatus.BLOQUEADA_FINANCEIRO]:
                os_item.financial_validation_date = datetime.utcnow()
                os_item.financial_policy_applied = "POLICY_BLOCK" if status_val == OSStatus.BLOQUEADA_FINANCEIRO else "POLICY_AUTHORIZE"
                os_item.financial_overdue_amount = 180.00
                os_item.financial_overdue_count = 1
                os_item.financial_max_overdue_days = 5

            session.add(os_item)
            await session.flush()
            created_os_objs.append(os_item)

            # Histórico do Workflow MES
            session.add(OSWorkflowHistory(
                service_order_id=os_item.id,
                previous_status=None,
                new_status=status_val.value if hasattr(status_val, 'value') else status_val,
                operator_notes=f"OS iniciada no sistema com status {os_val_str(status_val)}.",
                changed_at=os_item.created_at,
                operator_id=user_op.id,
                sector="Triagem/Recepção"
            ))

            # Itens de produto e serviço
            prod_sel = products[random.randint(0, len(products)-1)]
            session.add(ServiceOrderItem(
                service_order_id=os_item.id, entity_type="product", entity_id=prod_sel.id,
                quantity=1, unit_price=prod_sel.sale_price, total_price=prod_sel.sale_price, original_price=prod_sel.sale_price
            ))
            session.add(ServiceOrderItem(
                service_order_id=os_item.id, entity_type="service", entity_id=srv_montagem.id,
                quantity=1, unit_price=30.00, total_price=30.00, original_price=30.00
            ))

        # Inspeções de Qualidade (CQ)
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
        # 7. MÓDULO FINANCEIRO CORPORATIVO & PEDIDOS
        # ==========================================
        print("8/8. Gerando Contas a Pagar, Receber, Fechamentos e Pedidos Comerciais...")
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
            amount=Decimal("3500.00"),
            due_date=datetime.utcnow() + timedelta(days=15),
            status="PENDENTE",
            cost_center_id=cc_prod.id,
            category_id=cat_lentes.id
        )
        pay2 = AccountsPayable(
            supplier_name="Hoya Optical Brasil",
            description="Lote Lentes BlueControl 1.59",
            amount=Decimal("4200.00"),
            due_date=datetime.utcnow() + timedelta(days=20),
            status="PENDENTE",
            cost_center_id=cc_prod.id,
            category_id=cat_lentes.id
        )
        pay3 = AccountsPayable(
            supplier_name="Companhia Elétrica Brasília",
            description="Fatura de Energia Elétrica do Parque Fabril",
            amount=Decimal("1250.00"),
            due_date=datetime.utcnow() - timedelta(days=3),
            status="PAGO",
            amount_paid=Decimal("1250.00"),
            payment_date=datetime.utcnow() - timedelta(days=3),
            cost_center_id=cc_adm.id,
            category_id=cat_energia.id
        )
        session.add_all([pay1, pay2, pay3])

        # Fechamentos Financeiros de Lojas (BillingCycle)
        cycle_paid = BillingCycle(
            optical_store_id=stores[0].id,
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow() - timedelta(days=15),
            due_date=datetime.utcnow() - timedelta(days=5),
            total_amount=Decimal("1450.00"),
            status="PAGO"
        )
        cycle_pending = BillingCycle(
            optical_store_id=stores[1].id,
            start_date=datetime.utcnow() - timedelta(days=15),
            end_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=10),
            total_amount=Decimal("980.00"),
            status="FECHADO"
        )
        cycle_overdue = BillingCycle(
            optical_store_id=stores[4].id,
            start_date=datetime.utcnow() - timedelta(days=25),
            end_date=datetime.utcnow() - timedelta(days=10),
            due_date=datetime.utcnow() - timedelta(days=2),
            total_amount=Decimal("1800.00"),
            status="FECHADO"
        )
        session.add_all([cycle_paid, cycle_pending, cycle_overdue])
        await session.flush()

        session.add(BillingItem(billing_cycle_id=cycle_paid.id, service_order_id=created_os_objs[10].id, amount=Decimal("1450.00")))
        session.add(BillingItem(billing_cycle_id=cycle_pending.id, service_order_id=created_os_objs[11].id, amount=Decimal("980.00")))
        session.add(BillingItem(billing_cycle_id=cycle_overdue.id, service_order_id=created_os_objs[12].id, amount=Decimal("1800.00")))
        await session.flush()

        from backend.app.crud import crud_financial_corp
        await crud_financial_corp.sync_billing_cycles_to_receivables(session)

        # Pedidos no Fornecedor (SupplierOrder)
        sup_order1 = SupplierOrder(
            order_number="PED-FORN-2026-0001",
            supplier_name="Essilor Brasil Distribuidora",
            status="RECEBIDO",
            total_cost=Decimal("1750.00"),
            total_estimated_resale=Decimal("6000.00"),
            gross_margin_amount=Decimal("4250.00"),
            gross_margin_percent=Decimal("70.83"),
            notes="Pedido de ressuprimento inicial para estoque matriz"
        )
        session.add(sup_order1)
        await session.flush()

        sup_item1 = SupplierOrderItem(
            supplier_order_id=sup_order1.id,
            lens_model_id=models[0].id,
            model_name="Lente Essilor Crizal Easy 1.56",
            dioptria="Sph -2.00 / Cyl -1.00",
            quantity=50,
            unit_cost_price=Decimal("35.00"),
            total_cost_price=Decimal("1750.00"),
            unit_resale_price=Decimal("120.00"),
            total_resale_price=Decimal("6000.00")
        )
        session.add(sup_item1)

        # Pedidos Comerciais de Venda (CommercialOrder)
        from backend.app.models.commercial_order import CommercialOrder, CommercialOrderItem
        co1 = CommercialOrder(
            order_number="PED-2026-0001",
            optical_store_id=stores[0].id,
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
            subtotal=Decimal("380.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("380.00"),
            notes="Pedido prioritário para evento de ótica parceira"
        )
        session.add(co1)
        await session.flush()

        co_item1 = CommercialOrderItem(
            order_id=co1.id,
            item_type="LENTE_ACABADA",
            item_name="Lente Essilor Transitions Gen 8 1.56",
            quantity=2,
            unit_price=Decimal("190.00"),
            total_price=Decimal("380.00")
        )
        session.add(co_item1)

        await session.commit()
        print("Finalizada a semeadura de todos os módulos com sucesso!")

    print("\n========================================================================")
    print("BANCO DE DADOS NOVA LAB 100% POPULADO COM VARIADOS REGISTROS!")
    print("========================================================================")
    print("Modelos de Lentes: Filtro Azul, Antirreflexo, Transitions, Incolor, Polarizadas")
    print("Marcas: Essilor, Hoya, Zeiss, Kodak, Shamir, Nova Lab Própria, Younger Optics")
    print("Grade de Blocos: Bases 1.00 a 8.00, Adições 0.00 a 3.50 em 11 modelos de blocos")
    print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(seed_data())
