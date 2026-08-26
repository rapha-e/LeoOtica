import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings

async def main():
    print("========================================================================")
    print("EXECUTANDO LIMPEZA GERAL COMPLETA (ÓTICAS, OS, FATURAMENTO, LENTES, GRADES)")
    print("========================================================================")
    print(f"Conectando ao banco de dados: {settings.DATABASE_URL}")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    # Lista ordenada de tabelas a serem completamente limpas
    tables_to_clear = [
        # Inspeções, itens, histórico e OS
        "os_cq_inspections",
        "service_order_items",
        "os_workflow_history",
        "service_orders",
        
        # Faturamento e Contas a Receber
        "billing_items",
        "billing_cycles",
        "nfe_saida",
        "accounts_receivable",
        
        # Pedidos Comerciais e Fornecedores
        "commercial_order_items",
        "commercial_orders",
        "supplier_order_items",
        "supplier_orders",
        
        # Movimentação de estoque, logs e preço
        "stock_movements",
        "audit_logs",
        "price_history",
        
        # Inventário cego e faixas de preço por grau
        "blind_inventory_items",
        "blind_inventory_sessions",
        "degree_pricing_policy_ranges",
        
        # Grades e Modelos de Lentes
        "lens_inventory_grade",
        "lens_models",
        
        # Grades e Modelos de Blocos
        "block_inventory_grades",
        "block_grid_items",
        "block_models",
        
        # Produtos do Catálogo Financeiro
        "products",
        
        # Registros de Óticas (Interações, Documentos e Óticas Cadastradas)
        "store_interactions",
        "store_documents",
        "optical_stores"
    ]
    
    async with engine.begin() as conn:
        is_postgres = conn.dialect.name == 'postgresql'
        
        if is_postgres:
            print("\nExecutando limpeza em banco PostgreSQL...")
            await conn.execute(text("SET CONSTRAINTS ALL DEFERRED;"))
            for table in tables_to_clear:
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Nao foi possivel limpar {table}: {e}")
        else:
            print("\nExecutando limpeza em banco SQLite...")
            await conn.execute(text("PRAGMA foreign_keys = OFF;"))
            for table in tables_to_clear:
                try:
                    await conn.execute(text(f"DELETE FROM {table};"))
                    try:
                        await conn.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}';"))
                    except Exception:
                        pass
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Nao foi possivel limpar {table}: {e}")
            await conn.execute(text("PRAGMA foreign_keys = ON;"))

    print("\n========================================================================")
    print("✅ LIMPEZA GERAL COMPLETA CONCLUÍDA COM SUCESSO!")
    print("Registros de Óticas, Ordens de Serviço (OS), Faturamento, Lentes, Grades, Blocos e Catálogo foram removidos.")
    print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(main())
