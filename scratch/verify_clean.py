import asyncio
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from backend.app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        users = (await conn.execute(text("SELECT email, name FROM users"))).fetchall()
        os_count = (await conn.execute(text("SELECT COUNT(*) FROM service_orders"))).scalar()
        stores_count = (await conn.execute(text("SELECT COUNT(*) FROM optical_stores"))).scalar()
        lenses_count = (await conn.execute(text("SELECT COUNT(*) FROM lens_models"))).scalar()
        
        print("=== VERIFICAÇÃO DO BANCO DE DADOS ===")
        print("Usuários no banco:", users)
        print("Ordens de Serviço:", os_count)
        print("Óticas/Clientes:", stores_count)
        print("Modelos de Lentes:", lenses_count)

if __name__ == "__main__":
    asyncio.run(main())
