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
from backend.app.schemas.lens import RegisterFallbackRequest, LensModelCreate
from backend.app.api.endpoints.inventory import register_fallback
from backend.app.crud import lens as crud_lens
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.models.user import User

async def run_test():
    print("=== TESTANDO CRIAÇÃO DE MODELO DIFERENTE COM MESMO CÓDIGO DE BARRAS ===")
    async with AsyncSessionLocal() as db:
        user_stmt = select(User)
        user = (await db.execute(user_stmt)).scalars().first()

        barcode_test = "2279710000000"

        # 1. Cria um modelo inicial com o codigo 2279710000000
        m1 = LensModelCreate(
            code=barcode_test,
            brand="LP Incolor 1.50",
            name="LP Incolor 1.50",
            material="CR-39",
            refractive_index=Decimal("1.50"),
            treatment="Incolor",
            diameter=70,
            matrix_type="LP_GRADE",
            cost_price=Decimal("25.00"),
            sale_price=Decimal("75.00")
        )
        created_m1 = await crud_lens.create_lens_model(db, m1)
        print(f"Modelo 1 criado: ID={created_m1.id}, Code={created_m1.code}")

        # 2. Agora tenta criar um MODELO DIFERENTE (LP PHOTO FILTRO AZUL AR 1.56) com o MESMO código de barras 2279710000000
        m2 = LensModelCreate(
            code=barcode_test,
            brand="LP PHOTO FILTRO AZUL AR 1.56",
            name="LP PHOTO FILTRO AZUL AR 1.56",
            material="Resina",
            refractive_index=Decimal("1.56"),
            treatment="Photo Filtro Azul AR",
            diameter=70,
            matrix_type="LP_GRADE",
            cost_price=Decimal("25.00"),
            sale_price=Decimal("215.00")
        )
        created_m2 = await crud_lens.create_lens_model(db, m2)
        print(f"Modelo 2 criado com SUCESSO: ID={created_m2.id}, Code={created_m2.code}")
        print("✅ NENHUM ERRO 500 / UNIQUE constraint error ocorreu!")

        # Limpeza
        await db.delete(created_m1)
        await db.delete(created_m2)
        await db.commit()

if __name__ == "__main__":
    asyncio.run(run_test())
