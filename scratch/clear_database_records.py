import sys
import os
sys.path.insert(0, os.path.abspath('.'))
import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy import text
import shutil

async def clear_database_records():
    tables_to_clear = [
        "service_order_items",
        "os_workflow_history",
        "os_cq_inspections",
        "os_traceability",
        "mes_stage_logs",
        "service_orders",
        "stock_movements",
        "lens_inventory_grade",
        "lens_models",
        "block_grid_items",
        "block_models",
        "customer_price_items",
        "customer_price_tables",
        "store_documents",
        "store_interactions",
        "partner_api_keys",
        "partner_shops",
        "optical_stores",
        "price_history",
        "products",
        "technical_services",
        "treatments",
        "billing_items",
        "billing_cycles",
        "accounts_receivable",
        "accounts_payable",
        "commercial_order_items",
        "commercial_orders",
        "supplier_order_items",
        "supplier_orders",
        "nfe_saida",
        "audit_logs"
    ]

    async with AsyncSessionLocal() as db:
        print("=== INICIANDO LIMPEZA DE REGISTROS DO BANCO DE DADOS ===")
        # Desativa chaves estrangeiras durante o TRUNCATE/DELETE
        await db.execute(text("PRAGMA foreign_keys = OFF;"))
        
        for table in tables_to_clear:
            try:
                res = await db.execute(text(f"DELETE FROM `{table}`;"))
                print(f"[OK] Tabela `{table}` limpa com sucesso ({res.rowcount} registros removidos).")
            except Exception as e:
                print(f"[ERRO] Falha ao limpar tabela `{table}`: {e}")

        # Finaliza com commit das alterações
        await db.execute(text("PRAGMA foreign_keys = ON;"))
        await db.commit()
        print("=== BANCO DE DADOS LIMPO E ZERADO COM SUCESSO ===")

    # Copia o banco de dados zerado para a pasta dist (se existir)
    backend_dir = os.path.abspath("backend")
    db_source = os.path.join(backend_dir, "leootica.db")
    db_dest = os.path.join(backend_dir, "dist", "leootica.db")
    if os.path.exists(os.path.dirname(db_dest)) and os.path.exists(db_source):
        print(f"Copiando banco de dados zerado para a distribuicao: {db_dest}")
        shutil.copy2(db_source, db_dest)

if __name__ == "__main__":
    asyncio.run(clear_database_records())
