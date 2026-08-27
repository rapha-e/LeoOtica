import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Garantir UTF-8 no stdout do Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Garantir PYTHONPATH
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings

async def clean_operational_records():
    print("========================================================================")
    print("LIMPANDO REGISTROS OPERACIONAIS DO SISTEMA NOVA LAB")
    print("========================================================================")
    print(f"Conectando ao banco de dados: {settings.DATABASE_URL}")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    # Tabelas operacionais a serem completamente limpas (movimentações, OS, faturamento, auditoria, etc.)
    operational_tables = [
        "os_cq_inspections",
        "service_order_items",
        "os_workflow_history",
        "service_orders",
        "stock_movements",
        "audit_logs",
        "billing_items",
        "billing_cycles",
        "nfe_saida",
        "financial_transactions",
        "accounts_payable",
        "accounts_receivable",
        "commercial_order_items",
        "commercial_orders",
        "supplier_order_items",
        "supplier_orders",
        "price_history"
    ]
    
    async with engine.begin() as conn:
        is_postgres = conn.dialect.name == 'postgresql'
        
        if is_postgres:
            print("Executando limpeza em banco PostgreSQL...")
            await conn.execute(text("SET CONSTRAINTS ALL DEFERRED;"))
            for table in operational_tables:
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Nao foi possivel limpar {table}: {e}")
        else:
            print("Executando limpeza em banco SQLite...")
            await conn.execute(text("PRAGMA foreign_keys = OFF;"))
            for table in operational_tables:
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

        # Zerar saldos físicos e reservados nas grades mantendo a estrutura de modelos e dioptrias
        print("\nZerando quantidades de estoque nas dioptrias da grade de lentes...")
        try:
            await conn.execute(text("UPDATE lens_inventory_grade SET quantity_available = 0, reserved_quantity = 0;"))
            print("  [OK] Saldos de estoque da grade de lentes foram zerados (0 unidades).")
        except Exception as e:
            print(f"  [AVISO] Erro ao zerar estoque de lentes: {e}")

        try:
            await conn.execute(text("UPDATE block_inventory_grades SET quantity_available = 0, reserved_quantity = 0;"))
            print("  [OK] Saldos de estoque da grade de blocos foram zerados (0 unidades).")
        except Exception as e:
            pass

    print("\n========================================================================")
    print("REGISTROS OPERACIONAIS LIMPOS COM SUCESSO!")
    print("Regras, Cadastros, Usuarios e Estrutura de Catalogo Mantidos Intactos.")
    print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(clean_operational_records())
