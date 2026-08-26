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

async def main():
    async with AsyncSessionLocal() as db:
        print("Limpando registros de dioptrias corrompidas (ESF > 50 ou ESF < -50)...")
        stmt = delete(LensInventoryGrade).where(
            (LensInventoryGrade.spherical > 50) | (LensInventoryGrade.spherical < -50) |
            (LensInventoryGrade.cylindrical > 50) | (LensInventoryGrade.cylindrical < -50)
        )
        res = await db.execute(stmt)
        await db.commit()
        print(f"Linhas corrompidas removidas: {res.rowcount}")

        # Corrigir dioptria positiva/transposição se necessário
        stmt_all = select(LensInventoryGrade)
        items = (await db.execute(stmt_all)).scalars().all()
        print("\nItens válidos na grade de estoque:")
        for item in items:
            # Se a dioptria cilíndrica for positiva (ex: +3.00), converte para a forma cilíndrica negativa padrão (transposição óptica)
            if item.cylindrical > 0:
                old_sph = item.spherical
                old_cyl = item.cylindrical
                item.spherical = old_sph + old_cyl
                item.cylindrical = -old_cyl
                db.add(item)
                print(f"  [Transposição] Item {item.id}: ESF {old_sph:.2f} / CIL {old_cyl:.2f} -> ESF {item.spherical:.2f} / CIL {item.cylindrical:.2f}")
            else:
                print(f"  Item {item.id}: ESF {item.spherical:.2f} / CIL {item.cylindrical:.2f} | Qty: {item.quantity_available}")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(main())
