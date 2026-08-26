import sys
import os
sys.path.insert(0, os.path.abspath('.'))
import asyncio
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade
from sqlalchemy import select

async def check_inventory():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(LensModel).where(LensModel.name.like("%MF INCOLOR%")))
        model = res.scalars().first()
        if not model:
            print("Model not found!")
            return
        print(f"Found model: {model.id} - {model.name} - matrix_type: {model.matrix_type}")
        
        grades_res = await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.lens_model_id == model.id))
        grades = grades_res.scalars().all()
        print(f"Total grades found: {len(grades)}")
        for g in grades:
            print(f"- Grade id={g.id}: base={g.base_curve}, add={g.addition}, eye='{g.eye}', qty_avail={g.quantity_available}")

if __name__ == "__main__":
    asyncio.run(check_inventory())
