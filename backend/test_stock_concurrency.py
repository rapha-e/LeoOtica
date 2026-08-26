import sys
import os
import asyncio
import uuid
import unittest
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.database import Base
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.services.allocation import allocate_and_deduct_inventory


class TestStockConcurrency(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Banco em memória para testes de concorrência
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Prepara a massa inicial de teste: 1 Modelo de Lente com 2 unidades em estoque
        async with self.async_session() as session:
            self.store_id = uuid.uuid4()
            store = OpticalStore(
                id=self.store_id, corporate_name="Ótica Concorrência", trade_name="Ótica Concorrência", cnpj="11222333000144"
            )
            session.add(store)

            self.lens_model_id = uuid.uuid4()
            lens_model = LensModel(
                id=self.lens_model_id,
                code="CONC-LENS-01",
                name="Lente Concorrência 1.56",
                brand="Essilor",
                material="CR-39",
                refractive_index=Decimal("1.56"),
                treatment="Incolor",
                matrix_type=MatrixType.LP_GRADE,
                production_route=ProductionRoute.EXPRESSA_FACETAMENTO,
                cost_price=Decimal("20.00"),
                sale_price=Decimal("100.00")
            )
            session.add(lens_model)

            self.grade_item_id = uuid.uuid4()
            grade_item = LensInventoryGrade(
                id=self.grade_item_id,
                lens_model_id=self.lens_model_id,
                spherical=Decimal("-2.00"),
                cylindrical=Decimal("-1.00"),
                quantity_available=2,  # Apenas 2 pares disponíveis!
                reserved_quantity=0,
                location_tag="GAV-CONC-01"
            )
            session.add(grade_item)
            await session.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_concurrent_allocation_stock_limit(self):
        """
        Tenta alocar 5 requisições concorrentes para um estoque com apenas 2 unidades.
        Garante integridade e que o estoque final nunca fique negativo.
        """
        async def try_allocate_os():
            async with self.async_session() as db:
                os_id = uuid.uuid4()
                new_os = ServiceOrder(
                    id=os_id,
                    os_number=f"OS-CONC-{os_id.hex[:6]}",
                    optical_store_id=self.store_id,
                    status=OSStatus.SURFACAGEM.value if hasattr(OSStatus.SURFACAGEM, 'value') else "SURFACAGEM",
                    lens_model_id=self.lens_model_id,
                    total_amount=Decimal("100.00")
                )
                db.add(new_os)
                await db.commit()

                rx_data = {
                    "OD": {"esferico": -2.00, "cilindrico": -1.00},
                    "OE": None
                }

                try:
                    await allocate_and_deduct_inventory(
                        db=db,
                        os_id=os_id,
                        lens_model_id=self.lens_model_id,
                        rx_data=rx_data
                    )
                    return True
                except Exception:
                    return False

        # Dispara 5 requisições concorrentes simultaneamente
        results = await asyncio.gather(*[try_allocate_os() for _ in range(5)])

        successful_allocations = sum(1 for r in results if r is True)
        
        # Verifica o estoque final no banco de dados
        async with self.async_session() as session:
            stmt = select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_item_id)
            item = (await session.execute(stmt)).scalars().first()
            
            # O estoque não pode ter ficado negativo
            self.assertGreaterEqual(item.quantity_available, 0)
            self.assertLessEqual(successful_allocations, 2)


if __name__ == "__main__":
    unittest.main()
