import unittest
from decimal import Decimal
import sys
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.exc import IntegrityError

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.block import BlockModel, BlockGridItem
from backend.app.schemas.block import BlockModelCreate, BlockGridItemUpdate
from backend.app.crud import crud_block


class TestBlockGrid(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Banco SQLite em memória isolado para testes
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_create_block_model_generates_30_cells(self):
        """Valida se ao criar um modelo de bloco são geradas exatamente 30 células de matriz (3 bases x 10 adições)."""
        async with self.async_session() as session:
            payload = BlockModelCreate(
                brand="Essilor",
                name="Bloco Freeform Teste",
                material="CR-39",
                refractive_index=1.56
            )
            model = await crud_block.create_block_model(session, payload)
            self.assertIsNotNone(model.id)

            # Verifica total de células geradas
            res = await session.execute(
                select(BlockGridItem).where(BlockGridItem.block_model_id == model.id)
            )
            items = res.scalars().all()
            self.assertEqual(len(items), 30)

            # Verifica se cobre exatamente as curvas base 2.00, 4.00, 6.00
            bases = sorted(list(set(float(i.base_curve) for i in items)))
            self.assertEqual(bases, [2.00, 4.00, 6.00])

            # Verifica se cobre exatamente as 10 adições
            adds = sorted(list(set(float(i.addition) for i in items)))
            self.assertEqual(adds, [0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00])

    async def test_update_grid_item(self):
        """Valida atualização de quantidade física, estoque mínimo, localização e código de barras de uma célula."""
        async with self.async_session() as session:
            payload = BlockModelCreate(brand="Hoya", name="Bloco Surfaçado Teste", material="CR-39", refractive_index=1.50)
            model = await crud_block.create_block_model(session, payload)

            # Busca célula Base 4.00 / Adição +2.00
            res = await session.execute(
                select(BlockGridItem).where(
                    BlockGridItem.block_model_id == model.id,
                    BlockGridItem.base_curve == Decimal("4.00"),
                    BlockGridItem.addition == Decimal("2.00")
                )
            )
            item = res.scalars().first()
            self.assertIsNotNone(item)

            # Atualiza saldo e localização
            updated = await crud_block.update_grid_item(
                session, item.id, BlockGridItemUpdate(
                    quantity_available=7,
                    min_stock=3,
                    location_tag="GAV-B01",
                    barcode="7891234567890"
                )
            )
            self.assertEqual(updated.quantity_available, 7)
            self.assertEqual(updated.min_stock, 3)
            self.assertEqual(updated.location_tag, "GAV-B01")
            self.assertEqual(updated.barcode, "7891234567890")

    async def test_bip_increment_by_barcode(self):
        """Valida incremento de saldo por bipagem USB utilizando código de barras."""
        async with self.async_session() as session:
            payload = BlockModelCreate(brand="Zeiss", name="Bloco Precision Teste", material="CR-39", refractive_index=1.60)
            model = await crud_block.create_block_model(session, payload)

            res = await session.execute(
                select(BlockGridItem).where(BlockGridItem.block_model_id == model.id)
            )
            item = res.scalars().first()
            item.barcode = "7899999999999"
            item.quantity_available = 2
            session.add(item)
            await session.commit()

            # Incrementa 3 unidades via bipagem
            incremented = await crud_block.increment_by_barcode(session, "7899999999999", quantity=3)
            self.assertIsNotNone(incremented)
            self.assertEqual(incremented.quantity_available, 5)


if __name__ == "__main__":
    unittest.main()
