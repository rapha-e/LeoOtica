import asyncio
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.crud.crud_system_parameters import get_all_parameters, sync_system_parameters_to_lens_models
from backend.app.models.financial_catalog import Product

async def main():
    async with AsyncSessionLocal() as db:
        print("Sincronizando Parâmetros do Sistema com os produtos do Catálogo Financeiro...")
        params = await get_all_parameters(db)
        await sync_system_parameters_to_lens_models(db, params)
        await db.commit()
        
        prods = (await db.execute(select(Product))).scalars().all()
        print("\nPreços Atualizados no Catálogo Financeiro:")
        for p in prods:
            print(f" - [{p.name}] -> Preço Custo: R$ {p.cost_price:.2f} | Preço Venda: R$ {p.sale_price:.2f} | SKU: {p.sku}")

if __name__ == "__main__":
    from sqlalchemy import select
    asyncio.run(main())
