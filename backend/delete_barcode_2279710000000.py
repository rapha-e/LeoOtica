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
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.models.financial_catalog import Product, PriceHistory

async def main():
    barcode = "2279710000000"
    async with AsyncSessionLocal() as db:
        print(f"Buscando e excluindo registros vinculados ao código de barras '{barcode}'...")
        
        # 1. Remove da grade de estoque (lens_inventory_grade)
        g_stmt = select(LensInventoryGrade).where(LensInventoryGrade.barcode == barcode)
        g_items = (await db.execute(g_stmt)).scalars().all()
        g_count = 0
        model_ids_to_check = set()
        for item in g_items:
            if item.lens_model_id:
                model_ids_to_check.add(item.lens_model_id)
            await db.delete(item)
            g_count += 1
        print(f" - Itens removidos da grade de estoque (lens_inventory_grade): {g_count}")

        # 2. Se houver SKU no catálogo financeiro igual ao barcode, limpa ou remove
        p_stmt = select(Product).where(Product.sku == barcode)
        p_items = (await db.execute(p_stmt)).scalars().all()
        p_count = 0
        for prod in p_items:
            if prod.lens_model_id:
                model_ids_to_check.add(prod.lens_model_id)
            # Remove histórico de preços
            await db.execute(delete(PriceHistory).where(PriceHistory.entity_id == prod.id))
            await db.delete(prod)
            p_count += 1
        print(f" - Produtos removidos do catálogo financeiro (products): {p_count}")

        # 3. Verifica modelos de lentes que tinham esse código
        m_stmt = select(LensModel).where((LensModel.code == barcode) | (LensModel.id.in_(model_ids_to_check)))
        m_items = (await db.execute(m_stmt)).scalars().all()
        m_count = 0
        for lm in m_items:
            # Verifica se o modelo ainda tem outros itens de estoque vinculados
            rem_g = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == lm.id))).scalars().all()
            if len(rem_g) == 0:
                await db.delete(lm)
                m_count += 1
        print(f" - Modelos de lente sem estoque removidos (lens_models): {m_count}")

        await db.commit()
        print(f"\n✅ Exclusão concluída! O código '{barcode}' não existe mais no banco de dados e será reconhecido como novo código ao ser bipado.")

if __name__ == "__main__":
    asyncio.run(main())
