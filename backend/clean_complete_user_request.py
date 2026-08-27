import asyncio
import sys
import os
from sqlalchemy import text

# Garante que o diretório raiz do projeto está no sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import AsyncSessionLocal, engine

TABLES_TO_CLEAN = [
    # Ordens de serviço e historico/inspecoes
    "os_cq_inspections",
    "os_workflow_history",
    "service_order_items",
    "service_orders",
    # Ordens comerciais e fornecedores
    "commercial_order_items",
    "commercial_orders",
    "supplier_order_items",
    "supplier_orders",
    # Faturamento e NFe
    "nfe_saida",
    "billing_items",
    "billing_cycles",
    # Contas a receber/pagar e transacoes financeiras
    "accounts_receivable",
    "accounts_payable",
    "financial_transactions",
    # Movimentacoes de estoque e logs de auditoria
    "stock_movements",
    "audit_logs",
    # Tabelas de preços de clientes
    "customer_price_items",
    "customer_price_tables",
    # Histórico de preços
    "price_history",
    # Produtos e servicos do catálogo financeiro
    "products",
    "treatments",
    "technical_services",
    # Inventário de lentes e grades
    "degree_pricing_policy_ranges",
    "lens_inventory_grade",
    "lens_models",
    "blind_inventory_items",
    "blind_inventory_sessions",
    "block_inventory_grades",
    "block_models"
]

async def clean_database():
    print("Iniciando limpeza total de registros operacionais e de catálogo...")
    async with AsyncSessionLocal() as session:
        dialect_name = engine.dialect.name
        print(f"Dialeto detectado: {dialect_name}")

        try:
            if dialect_name == "postgresql":
                await session.execute(text("SET session_replication_role = 'replica';"))
                for table in TABLES_TO_CLEAN:
                    try:
                        print(f"Limpando tabela: {table}...")
                        await session.execute(text(f'TRUNCATE TABLE "{table}" CASCADE;'))
                    except Exception as te:
                        print(f"Aviso ao limpar {table}: {te}")
                await session.execute(text("SET session_replication_role = 'origin';"))
            else:
                await session.execute(text("PRAGMA foreign_keys = OFF;"))
                for table in TABLES_TO_CLEAN:
                    try:
                        print(f"Limpando tabela: {table}...")
                        await session.execute(text(f'DELETE FROM "{table}";'))
                    except Exception as te:
                        print(f"Aviso ao limpar {table}: {te}")
                await session.execute(text("PRAGMA foreign_keys = ON;"))

            await session.commit()
            print("[OK] Limpeza de dados concluida com sucesso!")
        except Exception as e:
            await session.rollback()
            print(f"[ERRO] Falha durante a limpeza do banco: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(clean_database())
