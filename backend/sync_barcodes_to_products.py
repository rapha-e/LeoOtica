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
        print("Sincronizando campo 'barcode' das dioptrias de estoque para o campo 'sku' do Catálogo Financeiro...")
        
        prods = (await db.execute(select(Product))).scalars().all()
        updated_count = 0
        
        for p in prods:
            bcode = None
            if p.lens_model_id:
                # 1. Busca código de barras no estoque físico (lens_inventory_grade.barcode)
                g_query = select(LensInventoryGrade.barcode).where(
                    LensInventoryGrade.lens_model_id == p.lens_model_id,
                    LensInventoryGrade.barcode.isnot(None),
                    LensInventoryGrade.barcode != ""
                )
                bcode = (await db.execute(g_query)).scalars().first()
                
                # 2. Se não houver no estoque físico, busca o code do LensModel
                if not bcode:
                    m_query = select(LensModel.code).where(
                        LensModel.id == p.lens_model_id,
                        LensModel.code.isnot(None),
                        LensModel.code != ""
                    )
                    bcode = (await db.execute(m_query)).scalars().first()

            if bcode:
                p.sku = bcode
                db.add(p)
                updated_count += 1
                print(f"  [OK] Produto '{p.name}' -> SKU atualizado para o Barcode: '{bcode}'")
            elif p.sku.startswith("L-"):
                # Se não havia barcode e o SKU era um slug interno genérico tipo L-LP-AR-156-92C6, cria um código EAN/Interno padrão limpo
                # ex: 7891000 + sufixo numerico
                clean_code = "7891000" + str(abs(hash(p.name)))[:6].zfill(6)
                p.sku = clean_code
                db.add(p)
                
                # Também atualiza no LensModel se existir
                if p.lens_model_id:
                    lm = (await db.execute(select(LensModel).where(LensModel.id == p.lens_model_id))).scalar_one_or_none()
                    if lm and not lm.code:
                        lm.code = clean_code
                        db.add(lm)
                        
                updated_count += 1
                print(f"  [OK] Produto '{p.name}' -> Código de Barras gerado e atribuído: '{clean_code}'")

        await db.commit()
        print(f"\nTotal de produtos atualizados com o Código de Barras (barcode): {updated_count}")

if __name__ == "__main__":
    asyncio.run(main())
