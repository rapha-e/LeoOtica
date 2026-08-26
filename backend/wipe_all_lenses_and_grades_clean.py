import asyncio
import sys
import os
from sqlalchemy import select, delete

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import (
    LensModel, LensInventoryGrade, DegreePricingPolicyRange,
    BlindInventorySession, BlindInventoryItem
)
from backend.app.models.block import BlockModel, BlockGridItem
from backend.app.models.financial_catalog import Product, PriceHistory
from backend.app.models.movement import StockMovement

async def main():
    print("Iniciando limpeza total e remoção de vestígios dos cadastros de lentes e grades...")
    async with AsyncSessionLocal() as db:
        # 1. Movimentações de estoque de lentes
        res_mov = await db.execute(delete(StockMovement))
        print(f" - Movimentações de estoque excluídas: {res_mov.rowcount}")

        # 2. Sessões de inventário cego
        res_bitem = await db.execute(delete(BlindInventoryItem))
        res_bsess = await db.execute(delete(BlindInventorySession))
        print(f" - Itens/Sessões de inventário cego excluídos: {res_bitem.rowcount + res_bsess.rowcount}")

        # 3. Políticas de preço por grau vinculadas
        res_deg = await db.execute(delete(DegreePricingPolicyRange))
        print(f" - Regras de preço por faixa de grau excluídas: {res_deg.rowcount}")

        # 4. Grade de dioptrias de estoque de lentes (lens_inventory_grade)
        res_grade = await db.execute(delete(LensInventoryGrade))
        print(f" - Registros da grade de estoque de lentes (dioptrias) excluídos: {res_grade.rowcount}")

        # 5. Histórico de preços do catálogo
        res_ph = await db.execute(delete(PriceHistory))
        print(f" - Históricos de preço excluídos: {res_ph.rowcount}")

        # 6. Produtos do catálogo financeiro vinculados a lentes
        res_prod = await db.execute(delete(Product))
        print(f" - Produtos do catálogo financeiro excluídos: {res_prod.rowcount}")

        # 7. Modelos comerciais de lentes (lens_models)
        res_lm = await db.execute(delete(LensModel))
        print(f" - Modelos comerciais de lentes excluídos: {res_lm.rowcount}")

        # 8. Modelos e itens da grade de blocos
        res_bg = await db.execute(delete(BlockGridItem))
        res_bm = await db.execute(delete(BlockModel))
        print(f" - Modelos e itens de grade de blocos excluídos: {res_bg.rowcount + res_bm.rowcount}")

        await db.commit()
        print("\n✅ Limpeza concluída com sucesso! Todos os registros e vestígios de lentes e grades foram completamente apagados do sistema.")

if __name__ == "__main__":
    asyncio.run(main())
