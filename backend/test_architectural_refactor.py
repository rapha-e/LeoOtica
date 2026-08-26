import sys
import os
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
from decimal import Decimal
from backend.app.core.database import engine, Base, AsyncSessionLocal
from backend.app.seed_presets import seed_preset_products
from backend.app.models.lens import LensModel, MatrixType, ProductionRoute
from backend.app.services.pricing import calculate_lp_auto_price
from backend.app.services.allocation import allocate_and_deduct_inventory
from sqlalchemy import select, text

async def test_seed_and_pricing_refactor():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_sql in [
            "ALTER TABLE lens_models ADD COLUMN code VARCHAR(50);",
            "ALTER TABLE lens_models ADD COLUMN name VARCHAR(150);",
            "ALTER TABLE lens_models ADD COLUMN matrix_type VARCHAR(50) DEFAULT 'LP_GRADE';",
            "ALTER TABLE lens_models ADD COLUMN production_route VARCHAR(50) DEFAULT 'EXPRESSA_FACETAMENTO';",
            "ALTER TABLE lens_inventory_grade ADD COLUMN base_curve NUMERIC(4, 2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN addition NUMERIC(4, 2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN eye VARCHAR(2);",
            "ALTER TABLE lens_inventory_grade ADD COLUMN reserved_quantity INTEGER DEFAULT 0;"
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass

    # 1. Executa o seed de presets
    await seed_preset_products()

    async with AsyncSessionLocal() as db:
        # 2. Verifica se os modelos pré-configurados foram gravados
        stmt = select(LensModel).where(LensModel.matrix_type == "LP_GRADE")
        res = await db.execute(stmt)
        models = res.scalars().all()
        assert len(models) >= 7

        lp_ar_model = next((m for m in models if m.name and "LP AR 1.56" in m.name), models[0])
        assert lp_ar_model.matrix_type == "LP_GRADE"
        assert lp_ar_model.production_route == "EXPRESSA_FACETAMENTO"

        # 3. Testa a função de calculador de preço por grau com transposição
        price_standard = await calculate_lp_auto_price(db, lp_ar_model.id, spherical=-2.00, cylindrical=-1.00)
        assert price_standard > 0

        # Testa transposição (+ para -)
        price_transposed = await calculate_lp_auto_price(db, lp_ar_model.id, spherical=+1.00, cylindrical=+0.50)
        assert price_transposed > 0

        print(f"[Test Refactor] Sucesso! Modelo: {lp_ar_model.name}, Preço Calculado: R$ {price_standard:.2f}")

if __name__ == "__main__":
    asyncio.run(test_seed_and_pricing_refactor())
