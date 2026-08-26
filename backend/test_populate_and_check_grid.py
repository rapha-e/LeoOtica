import asyncio
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from decimal import Decimal
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.schemas.lens import RegisterFallbackRequest
from backend.app.api.endpoints.inventory import register_fallback
from backend.app.crud.lens import get_inventory_grid
from backend.app.models.user import User

async def run():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User))).scalars().first()

        print("1. Cadastrando Lente LP Incolor 1.50 (ESF: -2.00 | CIL: -1.00 | Qty: 15) no estoque...")
        req = RegisterFallbackRequest(
            barcode="7890000000001",
            brand="LP Incolor 1.50",
            material="CR-39",
            refractive_index=Decimal("1.50"),
            treatment="Incolor",
            diameter=70,
            matrix_type="LP_GRADE",
            spherical=Decimal("-2.00"),
            cylindrical=Decimal("-1.00"),
            quantity=15,
            quantity_available=15,
            location_tag="GAVETA-01"
        )
        item = await register_fallback(payload=req, current_user=user, db=db)
        print(f"Lente inserida: Barcode={item.barcode}, Qty={item.quantity_available}")

        print("\n2. Consultando a grade de estoque (/inventory/grid)...")
        grid = await get_inventory_grid(matrix_type="LP_GRADE", db=db)
        print(f"Total de itens retornados na grade: {len(grid)}")
        for g in grid:
            print(f" - Lente: {g.lens_model.brand} | ESF: {g.spherical} | CIL: {g.cylindrical} | Saldo: {g.quantity_available} un")

if __name__ == "__main__":
    asyncio.run(run())
