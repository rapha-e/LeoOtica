import asyncio
import sys
import os
from sqlalchemy import select

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.financial_catalog import Product
from backend.app.models.lens import LensModel, LensInventoryGrade

async def main():
    async with AsyncSessionLocal() as db:
        prods = (await db.execute(select(Product))).scalars().all()
        print("--- PRODUTOS DO CATÁLOGO FINANCEIRO ---")
        for p in prods:
            # Busca barcode na grade de estoque
            bcode = None
            if p.lens_model_id:
                g_query = select(LensInventoryGrade.barcode).where(
                    LensInventoryGrade.lens_model_id == p.lens_model_id,
                    LensInventoryGrade.barcode.isnot(None),
                    LensInventoryGrade.barcode != ''
                )
                bcode = (await db.execute(g_query)).scalars().first()
                
            print(f"Produto: [{p.name}]")
            print(f"  SKU atual do Produto: {p.sku}")
            print(f"  LensModelID: {p.lens_model_id}")
            print(f"  Barcode encontrado na grade (lens_inventory_grade.barcode): {bcode}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
