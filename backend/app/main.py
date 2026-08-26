import asyncio
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import uuid
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, and_, or_, text
from sqlalchemy.orm import selectinload
from backend.app.core.config import settings
from backend.app.core.database import engine, Base
from backend.app.api.router import api_router
from backend.app.models import * # Garante que os modelos estão registrados na Base

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API de controle de estoque e grade óptica da fábrica Nova Lab.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuração de CORS — define as origens permitidas via variável de ambiente.
# Em desenvolvimento: ALLOWED_ORIGINS=http://localhost:5173
# Em produção: ALLOWED_ORIGINS=https://novaLab.com.br,https://app.novalab.com.br
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




import asyncio
from backend.app.services.backup_service import create_backup

async def auto_backup_loop():
    """
    Loop em segundo plano que executa backup automático do banco de dados a cada 6 horas.
    """
    while True:
        await asyncio.sleep(6 * 3600)
        try:
            res = create_backup()
            print(f"[BACKUP AUTOMÁTICO] {res['filename']} gerado com sucesso! ({res['size_mb']} MB)")
        except Exception as e:
            print(f"[ERRO BACKUP AUTOMÁTICO] {e}")

# Cria as tabelas do banco no startup e inicia backups automáticos
@app.on_event("startup")
async def startup_event():
    try:
        # Gera backup automático inicial no startup
        try:
            b_info = create_backup()
            print(f"[BACKUP AUTOMÁTICO] Backup inicial do banco criado com sucesso: {b_info['filename']}")
        except Exception as b_err:
            print(f"[BACKUP AUTOMÁTICO] Aviso: {b_err}")
            
        asyncio.create_task(auto_backup_loop())

        async with engine.begin() as conn:

            # Cria as tabelas do banco de dados assincronamente se não existirem
            await conn.run_sync(Base.metadata.create_all)
            
            # Adiciona coluna sale_price na tabela lens_models se ela não existir
            try:
                await conn.execute(text(
                    "ALTER TABLE lens_models ADD COLUMN sale_price NUMERIC(10, 2) DEFAULT 75.00;"
                ))
            except Exception:
                pass

            try:
                await conn.execute(text(
                    "ALTER TABLE lens_models ADD COLUMN degree_threshold NUMERIC(4, 2) DEFAULT 2.00;"
                ))
            except Exception:
                pass

            try:
                await conn.execute(text(
                    "ALTER TABLE lens_models ADD COLUMN sale_price_over_threshold NUMERIC(10, 2) DEFAULT 95.00;"
                ))
            except Exception:
                pass

            # Migrações da Refatoração de Matrizes e Presets
            for col_sql in [
                "ALTER TABLE lens_models ADD COLUMN code VARCHAR(50);",
                "ALTER TABLE lens_models ADD COLUMN name VARCHAR(150);",
                "ALTER TABLE lens_models ADD COLUMN matrix_type VARCHAR(50) DEFAULT 'LP_GRADE';",
                "ALTER TABLE lens_models ADD COLUMN production_route VARCHAR(50) DEFAULT 'EXPRESSA_FACETAMENTO';",
                "ALTER TABLE lens_models ADD COLUMN average_cost_price NUMERIC(10, 2) DEFAULT 25.00;",
                "ALTER TABLE lens_models ADD COLUMN last_purchase_price NUMERIC(10, 2) DEFAULT 25.00;",
                "ALTER TABLE lens_inventory_grade ADD COLUMN base_curve NUMERIC(4, 2);",
                "ALTER TABLE lens_inventory_grade ADD COLUMN addition NUMERIC(4, 2);",
                "ALTER TABLE lens_inventory_grade ADD COLUMN eye VARCHAR(2);",
                "ALTER TABLE lens_inventory_grade ADD COLUMN reserved_quantity INTEGER DEFAULT 0;",
                "ALTER TABLE lens_inventory_grade ADD COLUMN quantity_reserved INTEGER DEFAULT 0;",
                "ALTER TABLE lens_inventory_grade ADD COLUMN average_cost_price NUMERIC(10, 2);",
                "ALTER TABLE lens_inventory_grade ADD COLUMN last_purchase_price NUMERIC(10, 2);",
                "ALTER TABLE block_models ADD COLUMN average_cost_price NUMERIC(10, 2) DEFAULT 35.00;",
                "ALTER TABLE block_models ADD COLUMN last_purchase_price NUMERIC(10, 2) DEFAULT 35.00;",
                "ALTER TABLE block_grid_items ADD COLUMN average_cost_price NUMERIC(10, 2);",
                "ALTER TABLE block_grid_items ADD COLUMN last_purchase_price NUMERIC(10, 2);",
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

            # Adiciona coluna doctor_name se ela não existir no SQLite/Postgres legados
            try:
                await conn.execute(text(
                    "ALTER TABLE service_orders ADD COLUMN doctor_name VARCHAR(150);"
                ))
            except Exception:
                pass
            
            # Adiciona coluna must_change_password se ela não existir no SQLite/Postgres legados
            try:
                await conn.execute(text(
                    "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;"
                ))
            except Exception:
                pass
            
            # Adiciona colunas do incremento de OS se elas não existirem no SQLite/Postgres legados
            try:
                await conn.execute(text(
                    "ALTER TABLE service_orders ADD COLUMN clinical_notes VARCHAR(500);"
                ))
            except Exception:
                pass
            
            try:
                await conn.execute(text(
                    "ALTER TABLE service_orders ADD COLUMN clinical_embedding TEXT;"
                ))
            except Exception:
                pass
                
            try:
                await conn.execute(text(
                    "ALTER TABLE service_orders ADD COLUMN cancellation_reason VARCHAR(255);"
                ))
            except Exception:
                pass

            try:
                await conn.execute(text(
                    "ALTER TABLE service_orders ADD COLUMN is_rework BOOLEAN DEFAULT 0;"
                ))
            except Exception:
                pass

            # Migração de status antigos para nomes do MES
            try:
                await conn.execute(text("UPDATE service_orders SET status = 'Surfaçagem' WHERE status = 'Produção';"))
                await conn.execute(text("UPDATE service_orders SET status = 'CQ Final' WHERE status = 'CQ';"))
                await conn.execute(text("UPDATE os_workflow_history SET previous_status = 'Surfaçagem' WHERE previous_status = 'Produção';"))
                await conn.execute(text("UPDATE os_workflow_history SET new_status = 'Surfaçagem' WHERE new_status = 'Produção';"))
                await conn.execute(text("UPDATE os_workflow_history SET previous_status = 'CQ Final' WHERE previous_status = 'CQ';"))
                await conn.execute(text("UPDATE os_workflow_history SET new_status = 'CQ Final' WHERE new_status = 'CQ';"))
            except Exception:
                pass
            
            # Adiciona colunas de especificação de lentes físicas para a tabela products
            columns_to_add = [
                ("is_lens", "BOOLEAN DEFAULT 0"),
                ("brand", "VARCHAR(100)"),
                ("material", "VARCHAR(50)"),
                ("refractive_index", "NUMERIC(3, 2)"),
                ("treatment", "VARCHAR(100)"),
                ("diameter", "INTEGER"),
                ("lens_model_id", "VARCHAR(36)")
            ]
            for col_name, col_type in columns_to_add:
                try:
                    await conn.execute(text(f"ALTER TABLE products ADD COLUMN {col_name} {col_type};"))
                except Exception:
                    pass
            
            # Adiciona colunas de lote e validade na tabela lens_inventory_grade
            lens_cols = [
                ("batch_number", "VARCHAR(50)"),
                ("expiration_date", "TIMESTAMP")
            ]
            for col_name, col_type in lens_cols:
                try:
                    await conn.execute(text(f"ALTER TABLE lens_inventory_grade ADD COLUMN {col_name} {col_type};"))
                except Exception:
                    pass

            # Adiciona colunas do CRM (Fase 3) para a tabela optical_stores
            crm_columns = [

                ("credit_limit", "NUMERIC(10, 2) DEFAULT 0.00"),
                ("sales_representative", "VARCHAR(100)"),
                ("rep_whatsapp", "VARCHAR(30)"),
                ("pipeline_stage", "VARCHAR(50) DEFAULT 'ATIVO'"),
                ("price_table_id", "VARCHAR(36)"),
                ("notes", "VARCHAR(500)"),
                ("next_contact_date", "TIMESTAMP"),
                ("next_contact_type", "VARCHAR(50)"),
                ("next_contact_notes", "VARCHAR(255)")
            ]
            for col_name, col_type in crm_columns:
                try:
                    await conn.execute(text(f"ALTER TABLE optical_stores ADD COLUMN {col_name} {col_type};"))
                except Exception:
                    pass

            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_movements_date_type ON stock_movements(movement_date, movement_type);"
            ))
            
            # Detecta se o dialeto é PostgreSQL para criação condicional de Materialized Views e indexadores
            is_postgres = conn.dialect.name == 'postgresql'
            
            if is_postgres:
                # PostgreSQL - Materialized View
                view_ddl = """
                CREATE MATERIALIZED VIEW IF NOT EXISTS mv_lens_consumption_velocity AS
                SELECT
                    lig.id AS lens_inventory_id,
                    lm.brand,
                    lm.material,
                    lm.refractive_index,
                    lm.treatment,
                    lm.diameter,
                    lig.spherical,
                    lig.cylindrical,
                    lig.quantity_available,
                    lig.location_tag,
                    lig.barcode,
                    COALESCE(SUM(sm.quantity), 0) AS units_consumed_30_days,
                    ROUND(COALESCE(SUM(sm.quantity), 0) / 30.0, 4) AS daily_burn_rate
                FROM lens_inventory_grade lig
                JOIN lens_models lm ON lig.lens_model_id = lm.id
                LEFT JOIN stock_movements sm ON sm.lens_inventory_id = lig.id
                    AND sm.movement_type = 'OUT'
                    AND sm.movement_date >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                GROUP BY lig.id, lm.brand, lm.material, lm.refractive_index, lm.treatment, lm.diameter, lig.spherical, lig.cylindrical, lig.quantity_available, lig.location_tag, lig.barcode;
                """
                await conn.execute(text(view_ddl))
                
                # Cria o indexador HNSW para busca vetorial de cosseno de alta performance no pgvector
                try:
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS idx_face_visagism_embedding ON face_visagism_sessions USING hnsw (face_embedding vector_cosine_ops);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS idx_os_clinical_embedding ON service_orders USING hnsw (clinical_embedding vector_cosine_ops);"
                    ))
                except Exception as e:
                    print(f"[AVISO] Nao foi possivel criar o indexador HNSW vetorial no PostgreSQL: {e}")
            else:
                # SQLite - View convencional
                view_ddl = """
                CREATE VIEW IF NOT EXISTS mv_lens_consumption_velocity AS
                SELECT
                    lig.id AS lens_inventory_id,
                    lm.brand,
                    lm.material,
                    lm.refractive_index,
                    lm.treatment,
                    lm.diameter,
                    lig.spherical,
                    lig.cylindrical,
                    lig.quantity_available,
                    lig.location_tag,
                    lig.barcode,
                    COALESCE(SUM(sm.quantity), 0) AS units_consumed_30_days,
                    ROUND(COALESCE(SUM(sm.quantity), 0) / 30.0, 4) AS daily_burn_rate
                FROM lens_inventory_grade lig
                JOIN lens_models lm ON lig.lens_model_id = lm.id
                LEFT JOIN stock_movements sm ON sm.lens_inventory_id = lig.id
                    AND sm.movement_type = 'OUT'
                    AND sm.movement_date >= datetime('now', '-30 days')
                GROUP BY lig.id, lm.brand, lm.material, lm.refractive_index, lm.treatment, lm.diameter, lig.spherical, lig.cylindrical, lig.quantity_available, lig.location_tag, lig.barcode;
                """
                await conn.execute(text(view_ddl))

        # Inicializa dados padrão de segurança (Roles e Admin)
        from sqlalchemy import select
        from backend.app.core.database import AsyncSessionLocal
        from backend.app.models.user import Role, User
        from backend.app.core.security import get_password_hash
        
        async with AsyncSessionLocal() as session:
            # 1. Verifica/cria as roles
            role_admin_query = await session.execute(select(Role).where(Role.name == "Administrador"))
            role_admin = role_admin_query.scalars().first()
            if not role_admin:
                role_admin = Role(name="Administrador", description="Perfil com acesso irrestrito ao sistema.")
                session.add(role_admin)
                
            role_op_query = await session.execute(select(Role).where(Role.name == "Operador"))
            role_op = role_op_query.scalars().first()
            if not role_op:
                role_op = Role(name="Operador", description="Perfil com acesso a operação e movimentação de estoque.")
                session.add(role_op)
                
            await session.commit()
            await session.refresh(role_admin)
            await session.refresh(role_op)
            
            # 2. Verifica/cria o usuário suporte padrão (login 'suporte', senha 'Dio@sup.2203')
            suporte_user_query = await session.execute(select(User).where(User.email == "suporte"))
            suporte_user = suporte_user_query.scalars().first()
            if not suporte_user:
                suporte_user = User(
                    name="Suporte Técnico Nova Lab",
                    email="suporte",
                    hashed_password=get_password_hash("Dio@sup.2203"),
                    is_active=True,
                    must_change_password=False,
                    role_id=role_admin.id
                )
                session.add(suporte_user)
                await session.commit()
                print("[INFO] Usuario Suporte padrao (suporte / Dio@sup.2203) criado com sucesso.")

            # 4. Semeia a Política Global de Precificação por Grau se não existir
            from backend.app.models.degree_policy import DegreePricingPolicy
            policy_query = await session.execute(select(DegreePricingPolicy).where(DegreePricingPolicy.is_active == True))
            existing_policy = policy_query.scalars().first()
            if not existing_policy:
                default_policy = DegreePricingPolicy(
                    degree_threshold=Decimal("2.00"),
                    default_sale_price_le=Decimal("75.00"),
                    default_sale_price_gt=Decimal("95.00"),
                    is_active=True
                )
                session.add(default_policy)
                await session.commit()
                print("[INFO] Política Global de Precificação por Grau semeada por padrão.")
                

                
            # Semeia ou atualiza o laboratório padrão (Nova LAB)
            from backend.app.models.laboratory import Laboratory
            lab_query = await session.execute(select(Laboratory))
            lab = lab_query.scalars().first()
            
            new_name = "Nova LAB"
            new_address = "Avenida transversal quadra 23 conjunto B lote 27 apartamento 201"
            new_cep = "71572-302"
            new_telephone = "61 99266-7281"
            new_cnpj = "58.032.958/0001-44"

            if not lab:
                lab = Laboratory(
                    name=new_name,
                    address=new_address,
                    cep=new_cep,
                    telephone=new_telephone,
                    cnpj=new_cnpj
                )
                session.add(lab)
                await session.commit()
                print("[INFO] Perfil do Laboratorio padrão (Nova LAB) semeado.")
            else:
                if lab.name in ["Nova Lab", "Nova LAB"] or lab.address == "Área Especial, Lote 1, Brasília - DF":

                    lab.name = new_name
                    lab.address = new_address
                    lab.cep = new_cep
                    lab.telephone = new_telephone
                    lab.cnpj = new_cnpj
                    session.add(lab)
                    await session.commit()
                    print("[INFO] Perfil do Laboratorio padrão atualizado para Nova LAB.")

            # 5. Correção Retroativa de Ordens de Serviço sem faturamento mas com lentes alocadas
            from backend.app.models.os import ServiceOrder, ServiceOrderItem
            from backend.app.crud.os import add_item_to_service_order, update_os_total_amount
            from backend.app.schemas.os import ServiceOrderItemCreate
            from backend.app.models.lens import LensInventoryGrade
            from sqlalchemy import or_
            
            # Busca todas as OSs que possuem lentes alocadas
            os_query = await session.execute(
                select(ServiceOrder)
                .where(
                    or_(
                        ServiceOrder.od_lens_inventory_id.isnot(None),
                        ServiceOrder.oe_lens_inventory_id.isnot(None)
                    )
                )
                .options(
                    selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
                    selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
                    selectinload(ServiceOrder.items)
                )
            )
            orders = os_query.scalars().all()
            
            for os_obj in orders:
                # Verifica se ela já possui algum item do tipo 'product' cadastrado
                has_product_item = any(item.entity_type == "product" for item in os_obj.items)
                if not has_product_item:
                    print(f"[INFO] Corrigindo faturamento retroativo da OS {os_obj.os_number}...")
                    
                    # Função de correspondência de produto comercial
                    async def find_matching_product(lens_model):
                        if not lens_model:
                            return None
                        p_query = select(Product).where(
                            and_(
                                Product.is_active == True,
                                Product.lens_model_id == lens_model.id
                            )
                        )
                        prod = (await session.execute(p_query)).scalars().first()
                        if not prod:
                            idx_clean = f"{lens_model.refractive_index:.2f}"
                            p_query = select(Product).where(
                                and_(
                                    Product.is_active == True,
                                    Product.name.ilike(f"%{lens_model.brand}%"),
                                    Product.name.like(f"%{idx_clean}%")
                                )
                            )
                            prod = (await session.execute(p_query)).scalars().first()
                        if not prod:
                            p_query = select(Product).where(
                                and_(
                                    Product.is_active == True,
                                    Product.name.ilike(f"%{lens_model.brand}%")
                                )
                            )
                            prod = (await session.execute(p_query)).scalars().first()
                        if not prod:
                            p_query = select(Product).where(Product.is_active == True).limit(1)
                            prod = (await session.execute(p_query)).scalars().first()
                        return prod

                    od_model = os_obj.od_lens_inventory.lens_model if os_obj.od_lens_inventory else None
                    oe_model = os_obj.oe_lens_inventory.lens_model if os_obj.oe_lens_inventory else None
                    
                    od_prod = await find_matching_product(od_model)
                    oe_prod = await find_matching_product(oe_model)
                    
                    if od_prod and oe_prod:
                        if od_prod.id == oe_prod.id:
                            item_in = ServiceOrderItemCreate(
                                entity_type="product",
                                entity_id=od_prod.id,
                                quantity=2
                            )
                            await add_item_to_service_order(session, os_obj.id, item_in)
                        else:
                            item_in_od = ServiceOrderItemCreate(
                                entity_type="product",
                                entity_id=od_prod.id,
                                quantity=1
                            )
                            await add_item_to_service_order(session, os_obj.id, item_in_od)
                            
                            item_in_oe = ServiceOrderItemCreate(
                                entity_type="product",
                                entity_id=oe_prod.id,
                                quantity=1
                            )
                            await add_item_to_service_order(session, os_obj.id, item_in_oe)
                        
                        # Recalcula o total acumulado da OS e salva
                        await update_os_total_amount(session, os_obj)
                        await session.commit()
                        
                        # Também precisamos atualizar o BillingItem e o BillingCycle se esta OS estiver faturada!
                        from backend.app.models.billing import BillingItem, BillingCycle
                        bi_query = await session.execute(select(BillingItem).where(BillingItem.service_order_id == os_obj.id))
                        bi_obj = bi_query.scalars().first()
                        if bi_obj:
                            # Atualiza o valor cobrado do item de faturamento
                            bi_obj.amount = float(os_obj.total_amount)
                            session.add(bi_obj)
                            await session.flush()
                            
                            # Recalcula o total do ciclo de faturamento
                            cycle_query = await session.execute(
                                select(BillingCycle)
                                .where(BillingCycle.id == bi_obj.billing_cycle_id)
                                .options(selectinload(BillingCycle.items))
                            )
                            cycle_obj = cycle_query.scalars().first()
                            if cycle_obj:
                                cycle_obj.total_amount = sum(float(item.amount) for item in cycle_obj.items)
                                session.add(cycle_obj)
                                await session.commit()
                                print(f"[INFO] Faturamento consolidado do ciclo {cycle_obj.id} atualizado para R$ {cycle_obj.total_amount:.2f}")

            # 6. Sincronização Retroativa de Lentes da Grade para o Catálogo Financeiro
            print("[INFO] Sincronizando lentes da grade de estoque para o Catálogo Financeiro...")
            from backend.app.models.lens import LensModel
            from backend.app.models.financial_catalog import Product, PriceHistory
            
            # Seleciona todos os modelos de lentes existentes
            lens_models_query = await session.execute(select(LensModel))
            lens_models = lens_models_query.scalars().all()
            active_lm_ids = {lm.id for lm in lens_models}
            
            # Remove produtos órfãos de lentes
            p_lens_stmt = select(Product).where(Product.is_lens == True)
            existing_lens_prods = (await session.execute(p_lens_stmt)).scalars().all()
            for p_item in existing_lens_prods:
                if p_item.lens_model_id not in active_lm_ids:
                    await session.delete(p_item)
            await session.flush()

            for lm in lens_models:
                p_query = await session.execute(
                    select(Product).where(Product.lens_model_id == lm.id)
                )
                existing_product = p_query.scalars().first()
                
                idx_str = f"{float(lm.refractive_index):.2f}"
                name_parts = ["Lente", lm.brand.strip(), lm.treatment.strip(), idx_str]
                prod_name = " ".join(part for part in name_parts if part)
                cost_val = float(lm.cost_price or 25.0)
                sale_val = float(lm.sale_price) if (lm.sale_price and float(lm.sale_price) > 0) else max(cost_val * 3.0, 50.0)

                if existing_product:
                    existing_product.name = prod_name
                    existing_product.brand = lm.brand
                    existing_product.material = lm.material
                    existing_product.refractive_index = float(lm.refractive_index)
                    existing_product.treatment = lm.treatment
                    existing_product.diameter = lm.diameter
                    existing_product.cost_price = cost_val
                    existing_product.sale_price = sale_val
                    existing_product.is_active = True
                    session.add(existing_product)
                else:
                    brand_slug = lm.brand[:3].upper() if lm.brand else "LNT"
                    treat_slug = lm.treatment[:3].upper() if lm.treatment else "INC"
                    idx_slug = idx_str.replace(".", "")
                    rand_id = str(lm.id)[:4].upper()
                    sku_code = f"L-{brand_slug}-{treat_slug}-{idx_slug}-{rand_id}"
                    
                    new_prod = Product(
                        name=prod_name,
                        description=f"Lente física de estoque importada automaticamente para faturamento. Material: {lm.material}, Diâmetro: {lm.diameter}mm.",
                        sku=sku_code,
                        cost_price=cost_val,
                        sale_price=sale_val,
                        is_active=True,
                        is_lens=True,
                        brand=lm.brand,
                        material=lm.material,
                        refractive_index=float(lm.refractive_index),
                        treatment=lm.treatment,
                        diameter=lm.diameter,
                        lens_model_id=lm.id,
                        current_version=1
                    )
                    session.add(new_prod)
                    await session.flush()
                    
                    price_hist = PriceHistory(
                        entity_type="product",
                        entity_id=new_prod.id,
                        price=new_prod.sale_price,
                        cost_price=new_prod.cost_price,
                        version=1,
                        start_date=datetime.now(timezone.utc),
                        change_reason="Importação automática da grade de estoque (unificação)"
                    )
                    session.add(price_hist)
            await session.commit()
            print("[INFO] Sincronização de lentes concluída com sucesso.")

    except Exception as e:
        print(f"\n[AVISO] Nao foi possivel conectar ao banco de dados durante a inicializacao: {e}")
        print("[AVISO] O servidor FastAPI continuara executando, mas operacoes de banco de dados irao falhar.")
        print("[AVISO] Use a interface em modo Offline ou configure o Docker PostgreSQL na porta 5432.\n")

    # Abre o navegador automaticamente após a inicialização do app no executável compilado
    import webbrowser
    
    async def open_browser():
        await asyncio.sleep(1.5)  # Aguarda 1.5s para o servidor carregar completamente
        try:
            webbrowser.open("http://localhost:8000/")
            print("[INFO] Navegador aberto automaticamente em http://localhost:8000/")
        except Exception as err:
            print(f"[AVISO] Nao foi possivel abrir o navegador automaticamente: {err}")
            
    asyncio.create_task(open_browser())


# --- Configuração para Servir o Frontend SPA React Estático ---
import os
import sys
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

# Resolve dinamicamente a pasta do build estático do React
if getattr(sys, 'frozen', False):
    # No ambiente empacotado do PyInstaller, os arquivos ficam em sys._MEIPASS/dist
    frontend_dist_dir = os.path.join(sys._MEIPASS, "dist")
else:
    # Em ambiente de desenvolvimento local
    frontend_dist_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend",
        "dist"
    )

@app.get("/", tags=["Status"])
async def root():
    # Se a pasta compilada e o index.html existirem no disco, a raiz "/" deve carregar o React
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(frontend_dist_dir) and os.path.exists(index_file):
        return FileResponse(index_file)
        
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "message": "API de Controle de Estoque de Lentes Nova Lab operacional."
    }

from fastapi import WebSocket, WebSocketDisconnect
from backend.app.core.websocket import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Mantém a conexão aberta. Aguarda mensagens de texto (caso o cliente queira enviar algo),
            # mas o fluxo é majoritariamente broadcast do servidor.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Inclui as rotas do projeto
app.include_router(api_router, prefix=settings.API_V1_STR)

# Se a pasta compilada existir no disco, ativa a entrega integrada
if os.path.exists(frontend_dist_dir):
    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
    @app.get("/{catchall:path}", include_in_schema=False)
    async def serve_react_app(catchall: str):
        # Deixa passar chamadas da API ou documentação para as rotas originais
        if (
            catchall.startswith("api/") or 
            catchall.startswith("docs") or 
            catchall.startswith("redoc") or 
            catchall.startswith("openapi.json") or
            catchall.startswith("ws")
        ):
            raise HTTPException(status_code=404, detail="Not Found")
            
        index_file = os.path.join(frontend_dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Interface visual não encontrada.")


