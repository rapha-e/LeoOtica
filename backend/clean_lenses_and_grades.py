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

async def clean_lenses_and_grades():
    print("========================================================================")
    print("LIMPANDO GRADES E CADASTRO DE LENTES DO SISTEMA NOVA LAB")
    print("========================================================================")
    print(f"Conectando ao banco de dados: {settings.DATABASE_URL}")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    # Tabelas relativas às grades, modelos de lentes, blocos e inventários cegos
    tables_to_clear = [
        "blind_inventory_items",
        "blind_inventory_sessions",
        "degree_pricing_policy_ranges",
        "lens_inventory_grade",
        "lens_models",
        "block_inventory_grades",
        "block_models"
    ]
    
    async with engine.begin() as conn:
        is_postgres = conn.dialect.name == 'postgresql'
        
        if is_postgres:
            print("Executando limpeza em banco PostgreSQL...")
            await conn.execute(text("SET CONSTRAINTS ALL DEFERRED;"))
            for table in tables_to_clear:
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                    print(f"  [OK] Tabela '{table}' limpa.")
                except Exception as e:
                    print(f"  [AVISO] Nao foi possivel limpar {table}: {e}")
        else:
            print("Executando limpeza em banco SQLite...")
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
    print("GRADES E CADASTRO DE LENTES LIMPOS COM SUCESSO!")
    print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(clean_lenses_and_grades())
