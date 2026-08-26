import asyncio
import sys
import os
from sqlalchemy import select, func

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.financial_catalog import Product, PriceHistory
from backend.app.models.movement import StockMovement

async def main():
    async with AsyncSessionLocal() as db:
        lm_c = (await db.execute(select(func.count(LensModel.id)))).scalar()
        g_c = (await db.execute(select(func.count(LensInventoryGrade.id)))).scalar()
        p_c = (await db.execute(select(func.count(Product.id)))).scalar()
        m_c = (await db.execute(select(func.count(StockMovement.id)))).scalar()
        ph_c = (await db.execute(select(func.count(PriceHistory.id)))).scalar()

        print("=== STATUS ATUAL DAS TABELAS NO BANCO DE DADOS ===")
        print(f"Modelos de Lentes (LensModel): {lm_c}")
        print(f"Grade de Estoque / Dioptrias (LensInventoryGrade): {g_c}")
        print(f"Produtos do Catálogo (Product): {p_c}")
        print(f"Históricos de Preço (PriceHistory): {ph_c}")
        print(f"Movimentações de Estoque (StockMovement): {m_c}")

if __name__ == "__main__":
    asyncio.run(main())
