import asyncio
import sys
import os
from sqlalchemy import select

sys.path.insert(0, r'c:\Users\rapha\Documents\LeoOtica')

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.financial_catalog import Product
from backend.app.models.lens import LensModel

async def main():
    async with AsyncSessionLocal() as db:
        prods = (await db.execute(select(Product))).scalars().all()
        models = (await db.execute(select(LensModel))).scalars().all()
        print(f"Produtos no catálogo: {len(prods)}")
        for p in prods:
            print(f" - Nome: '{p.name}' | SKU: '{p.sku}' | LensModelID: {p.lens_model_id}")
        print(f"Modelos de Lente: {len(models)}")

if __name__ == "__main__":
    asyncio.run(main())
