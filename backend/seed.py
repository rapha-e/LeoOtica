import asyncio
import sys
import os
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Garante o PYTHONPATH
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.database import Base
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, Role

DATABASE_URL = settings.DATABASE_URL

async def seed_data():
    print("========================================================================")
    print("INICIANDO REINICIALIZAÇÃO ZERADA DO BANCO DE DADOS NOVA LAB")
    print("========================================================================")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        print("Recriando estrutura limpa de todas as tabelas...")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        # ==========================================
        # 1. PERFIS E USUÁRIO SUPORTE EXCLUSIVO
        # ==========================================
        print("1/4. Cadastrando Usuário Suporte Exclusivo (suporte / Dio@sup.2203)...")
        role_admin = Role(name="Administrador", description="Acesso total às telas gerenciais, financeiras e operacionais")
        role_op = Role(name="Operador", description="Acesso operacional às bancadas de produção e expedição")
        session.add_all([role_admin, role_op])
        await session.flush()

        user_suporte = User(
            name="Suporte Técnico Nova Lab",
            email="suporte",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        session.add(user_suporte)
        await session.flush()

        # ==========================================
        # 2. POLÍTICA GLOBAL DE PRECIFICAÇÃO POR GRAU
        # ==========================================
        print("2/4. Inicializando Política Global de Precificação por Grau...")
        from backend.app.models.degree_policy import DegreePricingPolicy
        default_policy = DegreePricingPolicy(
            degree_threshold=Decimal("2.00"),
            default_sale_price_le=Decimal("75.00"),
            default_sale_price_gt=Decimal("95.00"),
            is_active=True
        )
        session.add(default_policy)

        # ==========================================
        # 3. PARÂMETROS GLOBAIS DO SISTEMA
        # ==========================================
        print("3/4. Inicializando Parâmetros Globais do Sistema...")
        from backend.app.crud.crud_system_parameters import seed_default_parameters
        await seed_default_parameters(session)

        # ==========================================
        # 4. PERFIL INSTITUCIONAL DO LABORATORIO
        # ==========================================
        print("4/6. Configurando Perfil do Laboratório Nova LAB...")
        from backend.app.models.laboratory import Laboratory
        lab = Laboratory(
            name="Nova LAB",
            address="Avenida transversal quadra 23 conjunto B lote 27 apartamento 201",
            cep="71572-302",
            telephone="61 99266-7281",
            cnpj="58.032.958/0001-44"
        )
        session.add(lab)

        # ==========================================
        # 5. MODELOS E GRADE DE ESTOQUE 1.67 E VISÃO SIMPLES
        # ==========================================
        print("5/6. Populado Modelos e Dioptrias de Estoque (Lentes 1.67 e Visão Simples)...")
        from backend.app.models.lens import LensModel, LensInventoryGrade
        from backend.app.models.financial_catalog import Product, Treatment, TechnicalService
        from backend.app.models.block import BlockModel

        model_167_ar = LensModel(
            brand="NovaLab 1.67 High Index",
            material="1.67 High Index",
            refractive_index=Decimal("1.67"),
            treatment="Anti-Reflexo Premium",
            diameter=70,
            cost_price=Decimal("45.00"),
            sale_price=Decimal("150.00"),
            degree_threshold=Decimal("2.00"),
            sale_price_over_threshold=Decimal("180.00")
        )
        model_167_fa = LensModel(
            brand="NovaLab 1.67 Filtro Azul",
            material="1.67 High Index",
            refractive_index=Decimal("1.67"),
            treatment="Filtro Azul AR",
            diameter=70,
            cost_price=Decimal("55.00"),
            sale_price=Decimal("180.00"),
            degree_threshold=Decimal("2.00"),
            sale_price_over_threshold=Decimal("210.00")
        )
        model_vs_ar = LensModel(
            brand="NovaLab Visão Simples 1.56",
            material="1.56",
            refractive_index=Decimal("1.56"),
            treatment="Anti-Reflexo",
            diameter=70,
            cost_price=Decimal("25.00"),
            sale_price=Decimal("75.00"),
            degree_threshold=Decimal("2.00"),
            sale_price_over_threshold=Decimal("95.00")
        )
        session.add_all([model_167_ar, model_167_fa, model_vs_ar])
        await session.flush()

        # Cadastra dioptrias padrão para a grade de LENTES 1.67 (Esférico 0 a -12, Cilíndrico 0 a -4)
        diopters = []
        for sph_int in range(0, -1225, -50):
            sph = Decimal(f"{sph_int / 100:.2f}")
            for cyl_int in range(0, -425, -50):
                cyl = Decimal(f"{cyl_int / 100:.2f}")
                
                # Dioptria para 1.67 AR
                diopters.append(
                    LensInventoryGrade(
                        lens_model_id=model_167_ar.id,
                        spherical=sph,
                        cylindrical=cyl,
                        barcode=f"789167AR{abs(sph_int):04d}{abs(cyl_int):04d}",
                        quantity_available=10,
                        location_tag=f"GAVETA-167-A{(abs(sph_int)//200)+1}"
                    )
                )
                # Dioptria para 1.67 FA
                diopters.append(
                    LensInventoryGrade(
                        lens_model_id=model_167_fa.id,
                        spherical=sph,
                        cylindrical=cyl,
                        barcode=f"789167FA{abs(sph_int):04d}{abs(cyl_int):04d}",
                        quantity_available=8,
                        location_tag=f"GAVETA-167-B{(abs(sph_int)//200)+1}"
                    )
                )
        session.add_all(diopters)

        # ==========================================
        # 6. ITENS DO CATÁLOGO FINANCEIRO (LENTES, BLOCOS, TRATAMENTOS E SERVIÇOS)
        # ==========================================
        print("6/6. Populando Produtos, Blocos Semiacabados, Tratamentos e Serviços no Catálogo...")
        prod1 = Product(
            name="Lente 1.67 High Index AR Premium",
            description="Lente acabada de alto índice 1.67 com tratamento anti-reflexo",
            sku="LEN-167-AR",
            cost_price=Decimal("45.00"),
            sale_price=Decimal("150.00"),
            is_active=True,
            lens_model_id=model_167_ar.id
        )
        prod2 = Product(
            name="Lente 1.67 Filtro Azul Protect",
            description="Lente acabada 1.67 com filtro azul e anti-reflexo",
            sku="LEN-167-FA",
            cost_price=Decimal("55.00"),
            sale_price=Decimal("180.00"),
            is_active=True,
            lens_model_id=model_167_fa.id
        )
        prod3 = Product(
            name="Lente Visão Simples 1.56 AR",
            description="Lente visão simples padrão 1.56 com anti-reflexo",
            sku="LEN-VS-156",
            cost_price=Decimal("25.00"),
            sale_price=Decimal("75.00"),
            is_active=True,
            lens_model_id=model_vs_ar.id
        )
        session.add_all([prod1, prod2, prod3])

        block1 = BlockModel(
            name="Bloco Semiacabado 1.67 Visão Simples",
            brand="NovaLab",
            material="1.67 High Index",
            refractive_index=Decimal("1.67"),
            cost_price=Decimal("35.00"),
            sale_price=Decimal("95.00"),
            is_active=True
        )
        block2 = BlockModel(
            name="Bloco Semiacabado CR-39 Incolor",
            brand="NovaLab",
            material="CR-39",
            refractive_index=Decimal("1.50"),
            cost_price=Decimal("18.00"),
            sale_price=Decimal("55.00"),
            is_active=True
        )
        session.add_all([block1, block2])

        treat1 = Treatment(
            name="Tratamento Anti-Reflexo Cobre",
            description="Revestimento anti-reflexo de alta durabilidade",
            price=Decimal("40.00"),
            is_active=True
        )
        treat2 = Treatment(
            name="Filtro Azul BlueProtect",
            description="Proteção contra luz azul de telas digitais",
            price=Decimal("60.00"),
            is_active=True
        )
        session.add_all([treat1, treat2])

        serv1 = TechnicalService(
            name="Montagem em Armação de Fio de Nylon",
            description="Serviço técnico de corte e montagem em armações de nylon",
            price=Decimal("25.00"),
            is_active=True
        )
        serv2 = TechnicalService(
            name="Surfaçagem Digital Freeform",
            description="Processamento digital de lentes de prescrição personalizada",
            price=Decimal("50.00"),
            is_active=True
        )
        session.add_all([serv1, serv2])

        await session.commit()
        print("========================================================================")
        print("BANCO DE DADOS POPULADO COM DADOS DE TESTE E MODELOS 1.67!")
        print("Usuário exclusivo de suporte: suporte / Dio@sup.2203")
        print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(seed_data())
