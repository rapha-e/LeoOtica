import asyncio
import os
import shutil
import sys
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Configuração de encoding UTF-8 no Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings

async def main():
    print("=" * 70)
    print("INICIANDO LIMPEZA COMPLETA: OPERACIONAL, LENTES, GRADES E FINANCEIRO")
    print("=" * 70)

    # 1. Backup de segurança do banco de dados SQLite caso exista
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    db_file = os.path.join(backend_dir, "Nova Lab.db")
    backups_dir = os.path.join(backend_dir, "backups")
    os.makedirs(backups_dir, exist_ok=True)

    if os.path.exists(db_file):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_pre_wipe_{timestamp}.db"
        backup_path = os.path.join(backups_dir, backup_filename)
        shutil.copy2(db_file, backup_path)
        print(f"📦 Backup de segurança gerado com sucesso em:\n   -> {backup_path}\n")

    # 2. Conectar ao banco
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    # Tabelas a serem limpas
    tables_to_wipe = [
        # Operacional - Ordens de Serviço e CQ
        "os_cq_inspections",
        "service_order_items",
        "os_workflow_history",
        "service_orders",
        
        # Operacional - Pedidos Comerciais e Fornecedores
        "commercial_order_items",
        "commercial_orders",
        "supplier_order_items",
        "supplier_orders",
        
        # Estoque e Movimentações
        "stock_movements",
        "blind_inventory_items",
        "blind_inventory_sessions",
        
        # Financeiro e Contas
        "financial_transactions",
        "accounts_payable",
        "accounts_receivable",
        "billing_items",
        "billing_cycles",
        "nfe_saida",
        "price_history",
        
        # Lentes, Grades e Catálogo
        "degree_pricing_policy_ranges",
        "lens_inventory_grade",
        "products",
        "lens_models",
        "block_grid_items",
        "block_models",
        
        # Logs
        "audit_logs"
    ]

    async with engine.begin() as conn:
        is_postgres = conn.dialect.name == 'postgresql'
        
        if is_postgres:
            print("Executando em PostgreSQL...")
            await conn.execute(text("SET CONSTRAINTS ALL DEFERRED;"))
            for table in tables_to_wipe:
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Tabela '{table}' não pôde ser truncada: {e}")
        else:
            print("Executando em SQLite...")
            await conn.execute(text("PRAGMA foreign_keys = OFF;"))
            for table in tables_to_wipe:
                try:
                    await conn.execute(text(f"DELETE FROM {table};"))
                    try:
                        await conn.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}';"))
                    except Exception:
                        pass
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Tabela '{table}' não pôde ser excluída: {e}")
            await conn.execute(text("PRAGMA foreign_keys = ON;"))

    # 3. Verificação pós-limpeza
    print("\n" + "-" * 70)
    print("VERIFICAÇÃO PÓS-LIMPEZA DAS TABELAS:")
    print("-" * 70)
    
    async with engine.connect() as conn:
        for table in tables_to_wipe:
            try:
                res = await conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
                count = res.scalar()
                status = "✅ ZERADO (0)" if count == 0 else f"⚠️ {count} registros"
                print(f"  - {table.ljust(32)}: {status}")
            except Exception as e:
                print(f"  - {table.ljust(32)}: ℹ️ Não encontrada ou não aplicável")

        print("\n" + "-" * 70)
        print("CONFERÊNCIA DOS CADASTROS PRESERVADOS:")
        print("-" * 70)
        preserved_tables = [
            "users",
            "roles",
            "permissions",
            "optical_stores",
            "partner_shops",
            "cost_centers",
            "financial_categories",
            "laboratories",
            "system_parameters"
        ]
        for table in preserved_tables:
            try:
                res = await conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
                count = res.scalar()
                print(f"  - {table.ljust(32)}: {count} registros preservados")
            except Exception as e:
                print(f"  - {table.ljust(32)}: ℹ️ {e}")

    await engine.dispose()
    print("\n" + "=" * 70)
    print("✅ PROCESSO CONCLUÍDO COM SUCESSO!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
