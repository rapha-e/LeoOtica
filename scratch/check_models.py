import asyncio
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from backend.app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        models = (await conn.execute(text("SELECT id, brand, name, matrix_type, refractive_index FROM lens_models"))).fetchall()
        items = (await conn.execute(text("SELECT id, lens_model_id, spherical, cylindrical, base_curve, addition, eye FROM lens_inventory_grade"))).fetchall()
        block_models = (await conn.execute(text("SELECT id, brand, name, refractive_index FROM block_models"))).fetchall()
        block_items = (await conn.execute(text("SELECT id, block_model_id, base_curve, addition, eye_side FROM block_grid_items"))).fetchall()
        
        print("=== LENS MODELS ===")
        for m in models:
            print(m)
            
        print("\n=== LENS INVENTORY GRADE ===")
        for i in items:
            print(i)

        print("\n=== BLOCK MODELS ===")
        for bm in block_models:
            print(bm)

        print("\n=== BLOCK GRID ITEMS ===")
        for bi in block_items:
            print(bi)

if __name__ == "__main__":
    asyncio.run(main())
