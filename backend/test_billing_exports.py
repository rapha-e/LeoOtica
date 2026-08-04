import unittest
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.services.pdf_generator import generate_billing_pdf
from backend.app.services.excel_generator import generate_billing_excel
from backend.app.crud import billing as crud_billing
from backend.app.crud import os as crud_os
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate
from backend.app.models.financial_catalog import Product

class TestBillingExports(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # 1. Cadastra Ótica
            self.store = OpticalStore(
                corporate_name="Optica Leo Exportacoes Ltda",
                trade_name="Leo Otica Export",
                cnpj="12.345.678/0001-90",
                email="financeiro@leoexport.com.br",
                address="Av. Das Exportacoes, 123",
                is_active=True
            )
            session.add(self.store)
            
            # 2. Cadastra Produto
            self.product = Product(
                name="Lente CR39 Export",
                sku="L-CR39-EXP",
                cost_price=12.00,
                sale_price=120.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            await session.commit()
            
            await session.refresh(self.store)
            await session.refresh(self.product)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_pdf_and_excel_generation(self):
        """Valida se a geração dos bytes de PDF e Excel do fechamento funciona e possui assinaturas corretas."""
        async with self.async_session() as session:
            # Criar OS elegível
            os_in = ServiceOrderCreate(
                client_name="Maria Exportadora",
                optical_store_id=self.store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            
            item_in = ServiceOrderItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                quantity=1
            )
            await crud_os.add_item_to_service_order(session, db_os.id, item_in)
            
            # Transiciona para Expedição
            await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "Separacao")
            await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "Produção")
            await crud_os.update_os_status(session, db_os.id, OSStatus.MONTAGEM, "Montagem")
            await crud_os.update_os_status(session, db_os.id, OSStatus.CQ, "Qualidade")
            await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "Pronto")
            
            # Cria ciclo
            cycle = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.utcnow() - timedelta(days=15),
                end_date=datetime.utcnow(),
                service_order_ids=[db_os.id]
            )
            
            # Recarrega ciclo com relacionamentos pré-carregados
            cycle_loaded = await crud_billing.get_billing_cycle(session, cycle.id)
            
            # 1. Testar Geração de PDF
            pdf_bytes = generate_billing_pdf(cycle_loaded)
            self.assertIsNotNone(pdf_bytes)
            self.assertTrue(len(pdf_bytes) > 0)
            # Verifica cabeçalho do arquivo PDF
            self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
            
            # 2. Testar Geração de Excel
            excel_bytes = generate_billing_excel(cycle_loaded)
            self.assertIsNotNone(excel_bytes)
            self.assertTrue(len(excel_bytes) > 0)
            # Verifica assinatura do formato ZIP/OpenXML
            self.assertTrue(excel_bytes.startswith(b"PK\x03\x04"))

if __name__ == "__main__":
    unittest.main()
