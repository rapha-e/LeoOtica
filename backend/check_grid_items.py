import asyncio
import sys
import os
from sqlalchemy import select
from sqlalchemy.orm import selectinload

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(LensInventoryGrade).options(selectinload(LensInventoryGrade.lens_model))
        items = (await db.execute(stmt)).scalars().all()
        print(f"Total de itens na grade de estoque (LensInventoryGrade): {len(items)}")
        for item in items:
            lm = item.lens_model
            print(f" - ID: {item.id}")
            print(f"   LensModel: {lm.brand if lm else 'N/A'} (ID: {item.lens_model_id}, MatrixType: {lm.matrix_type if lm else 'N/A'})")
            print(f"   ESF: {item.spherical} | CIL: {item.cylindrical} | Qty: {item.quantity_available} | Barcode: {item.barcode}")

        m_stmt = select(LensModel)
        models = (await db.execute(m_stmt)).scalars().all()
        print(f"\nTotal de modelos (LensModel): {len(models)}")
        for m in models:
            print(f" - Modelo ID: {m.id} | Brand: {m.brand} | MatrixType: {m.matrix_type} | RefractiveIndex: {m.refractive_index}")

if __name__ == "__main__":
    asyncio.run(main())
