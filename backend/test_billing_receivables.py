import unittest
import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.crud import billing as crud_billing
from backend.app.crud import os as crud_os
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate
from backend.app.models.financial_catalog import Product

class TestBillingReceivables(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            self.store = OpticalStore(
                corporate_name="Optica Recebiveis Ltda",
                trade_name="Leo Otica Recebiveis",
                cnpj="55.555.555/0001-55",
                is_active=True
            )
            session.add(self.store)
            
            self.product = Product(
                name="Lente Teste Recebivel",
                sku="L-TEST-REC",
                cost_price=10.00,
                sale_price=150.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            await session.commit()
            
            await session.refresh(self.store)
            await session.refresh(self.product)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _create_os(self, session, amount):
        os_in = ServiceOrderCreate(
            client_name="Cliente Recebivel",
            optical_store_id=self.store.id
        )
        db_os = await crud_os.create_service_order(session, os_in)
        item_in = ServiceOrderItemCreate(
            entity_type="product",
            entity_id=self.product.id,
            quantity=1
        )
        item = await crud_os.add_item_to_service_order(session, db_os.id, item_in)
        
        # Força valor
        item.unit_price = amount
        item.total_price = amount
        session.add(item)
        db_os.total_amount = amount
        session.add(db_os)
        await session.flush()
        
        # Move para expedição
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "S")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "P")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.MONTAGEM, "M")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.CQ, "Q")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "E")
        return db_os

    async def test_overdue_property_and_kpis(self):
        """Valida que a propriedade is_overdue e o cálculo de KPIs agrupados funcionam perfeitamente."""
        async with self.async_session() as session:
            # OS 1 para Fatura Paga (R$ 100.00)
            os1 = await self._create_os(session, 100.00)
            # OS 2 para Fatura Pendente no prazo (R$ 200.00)
            os2 = await self._create_os(session, 200.00)
            # OS 3 para Fatura Atrasada / Inadimplente (R$ 300.00)
            os3 = await self._create_os(session, 300.00)
            
            # 1. Cria Fatura 1 (Paga) - Vencimento futuro, marcada como PAGO
            cycle_paid = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.utcnow() - timedelta(days=5),
                end_date=datetime.utcnow(),
                service_order_ids=[os1.id],
                due_date=datetime.utcnow() + timedelta(days=5)
            )
            await crud_billing.pay_billing_cycle(session, cycle_paid.id)
            
            # 2. Cria Fatura 2 (Pendente) - Vencimento futuro (em aberto)
            cycle_pending = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.utcnow() - timedelta(days=5),
                end_date=datetime.utcnow(),
                service_order_ids=[os2.id],
                due_date=datetime.utcnow() + timedelta(days=5)
            )
            
            # 3. Cria Fatura 3 (Atrasada) - Vencimento passado (em aberto)
            cycle_overdue = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.utcnow() - timedelta(days=5),
                end_date=datetime.utcnow(),
                service_order_ids=[os3.id],
                due_date=datetime.utcnow() - timedelta(days=1)  # Venceu ontem
            )
            
            # Valida propriedade is_overdue no banco
            loaded_paid = await crud_billing.get_billing_cycle(session, cycle_paid.id)
            loaded_pending = await crud_billing.get_billing_cycle(session, cycle_pending.id)
            loaded_overdue = await crud_billing.get_billing_cycle(session, cycle_overdue.id)
            
            self.assertFalse(loaded_paid.is_overdue)      # PAGO não fica atrasado
            self.assertFalse(loaded_pending.is_overdue)   # Prazo futuro
            self.assertTrue(loaded_overdue.is_overdue)    # Vencido
            
            # Valida KPIs consolidados de contas a receber
            kpis = await crud_billing.get_receivables_kpis(session)
            
            self.assertEqual(kpis["total_paid"], 100.00)
            self.assertEqual(kpis["count_paid"], 1)
            self.assertEqual(kpis["total_pending"], 200.00)
            self.assertEqual(kpis["count_pending"], 1)
            self.assertEqual(kpis["total_overdue"], 300.00)
            self.assertEqual(kpis["count_overdue"], 1)

if __name__ == "__main__":
    unittest.main()
