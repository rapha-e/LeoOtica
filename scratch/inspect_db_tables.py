import sys
import os
sys.path.insert(0, os.path.abspath('.'))
import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def list_tables_and_counts():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
        tables = [r[0] for r in res.fetchall() if not r[0].startswith('sqlite_')]
        
        print("=== CONTAGEM DE REGISTROS POR TABELA ===")
        for t in sorted(tables):
            c_res = await db.execute(text(f"SELECT COUNT(*) FROM `{t}`;"))
            cnt = c_res.scalar()
            print(f"- {t}: {cnt} registros")

if __name__ == "__main__":
    asyncio.run(list_tables_and_counts())
