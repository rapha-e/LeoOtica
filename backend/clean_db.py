import asyncio
import sys
import os

# Adiciona o diretório pai (raiz do projeto) ao PYTHONPATH para resolver as importações
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from backend.app.core.config import settings

async def clean_database():
    print(f"Conectando ao banco de dados: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    tables_to_clear = [
        "audit_logs",
        "billing_items",
        "billing_cycles",
        "customer_price_items",
        "customer_price_tables",
        "price_history",
        "products",
        "technical_services",
        "treatments",
        "stock_movements",
        "nfe_saida",
        "optical_stores",
        "service_order_items",
        "os_cq_inspections",
        "os_workflow_history",
        "service_orders",
        "partner_api_keys",
        "partner_shops",
        "lens_inventory_grade",
        "lens_models",
        "face_visagism_sessions"
    ]
    
    async with engine.begin() as conn:
        is_postgres = conn.dialect.name == 'postgresql'
        
        if is_postgres:
            print("Configurando deleções em lote para banco PostgreSQL...")
            await conn.execute(text("SET CONSTRAINTS ALL DEFERRED;"))
            for table in tables_to_clear:
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                    print(f"Tabela {table} limpa (Truncate CASCADE).")
                except Exception as e:
                    print(f"Erro ao limpar {table}: {e}")
            
            # Remove usuários que não sejam admin ou teste
            await conn.execute(text("DELETE FROM users WHERE email NOT IN ('admin', 'teste');"))
            print("Usuários que não sejam admin ou teste removidos.")
        else:
            print("Configurando deleções em lote para banco SQLite...")
            await conn.execute(text("PRAGMA foreign_keys = OFF;"))
            for table in tables_to_clear:
                try:
                    await conn.execute(text(f"DELETE FROM {table};"))
                    # Reseta os auto-incrementos no SQLite se houver sequências associadas
                    try:
                        await conn.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}';"))
                    except Exception:
                        pass
                    print(f"Tabela {table} limpa.")
                except Exception as e:
                    print(f"Erro ao limpar {table}: {e}")
            
            # Remove usuários que não sejam admin ou teste
            await conn.execute(text("DELETE FROM users WHERE email NOT IN ('admin', 'teste');"))
            print("Usuários que não sejam admin ou teste removidos.")
            await conn.execute(text("PRAGMA foreign_keys = ON;"))
            
    print("Limpeza do banco de dados concluída com sucesso!")

if __name__ == "__main__":
    asyncio.run(clean_database())
