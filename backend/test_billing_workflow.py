import unittest
from decimal import Decimal
import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_catalog import Product
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.crud import os as crud_os
from backend.app.crud import billing as crud_billing
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate

class TestBillingWorkflow(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # 1. Cadastra Óticas de teste
            self.store1 = OpticalStore(
                corporate_name="Optica Leo Comercial 1 Ltda",
                trade_name="Leo Otica Centro",
                cnpj="11.111.111/0001-11",
                is_active=True
            )
            self.store2 = OpticalStore(
                corporate_name="Optica Leo Comercial 2 Ltda",
                trade_name="Leo Otica Shopping",
                cnpj="22.222.222/0002-22",
                is_active=True
            )
            session.add_all([self.store1, self.store2])
            await session.flush()

            # 2. Cadastra Produto no Catálogo
            self.product = Product(
                name="Lente CR39 B",
                sku="L-CR39-B",
                cost_price=10.00,
                sale_price=100.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            await session.commit()
            
            await session.refresh(self.store1)
            await session.refresh(self.store2)
            await session.refresh(self.product)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _create_expedition_os(self, session, store_id, amount=100.00):
        """Helper para criar uma OS na expedição com valor faturado."""
        os_in = ServiceOrderCreate(
            client_name="Cliente de Teste",
            optical_store_id=store_id
        )
        db_os = await crud_os.create_service_order(session, os_in)
        
        # Adiciona item para dar valor
        item_in = ServiceOrderItemCreate(
            entity_type="product",
            entity_id=self.product.id,
            quantity=1
        )
        item = await crud_os.add_item_to_service_order(session, db_os.id, item_in)
        
        # Se for um valor customizado, força atualização
        if amount != 100.00:
            # Substitui valor do item
            item.unit_price = amount
            item.total_price = amount
            session.add(item)
            # Atualiza total da OS
            db_os.total_amount = amount
            session.add(db_os)
            await session.flush()
            
        # Transiciona para Expedição
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "Separacao")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "Produção")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.MONTAGEM, "Montagem")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.CQ, "Qualidade")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "Pronto para faturar")
        return db_os

    async def test_pending_billing_groups(self):
        """Valida que a agregação e detalhamento das OSs elegíveis estão funcionando."""
        async with self.async_session() as session:
            # Criando OSs elegíveis
            os_s1_1 = await self._create_expedition_os(session, self.store1.id, 150.00)
            os_s1_2 = await self._create_expedition_os(session, self.store1.id, 250.00)
            os_s2 = await self._create_expedition_os(session, self.store2.id, 300.00)
            
            # Criando OS não elegível (não está em expedição)
            os_not_eligible = ServiceOrderCreate(
                client_name="Não Elegível",
                optical_store_id=self.store1.id
            )
            await crud_os.create_service_order(session, os_not_eligible)
            
            # Listar grupos pendentes
            groups = await crud_billing.get_pending_billing_groups(session)
            
            # Devem haver dois grupos
            self.assertEqual(len(groups), 2)
            
            # Achar grupo da store1
            g1 = next(g for g in groups if g["optical_store_id"] == self.store1.id)
            self.assertEqual(g1["pending_os_count"], 2)
            self.assertEqual(g1["estimated_total_amount"], 400.00)
            self.assertEqual(g1["optical_store_name"], "Leo Otica Centro")
            
            # Achar grupo da store2
            g2 = next(g for g in groups if g["optical_store_id"] == self.store2.id)
            self.assertEqual(g2["pending_os_count"], 1)
            self.assertEqual(g2["estimated_total_amount"], 300.00)
            
            # Buscar OSs pendentes por loja
            pending_s1 = await crud_billing.get_pending_orders_by_store(session, self.store1.id)
            self.assertEqual(len(pending_s1), 2)
            self.assertEqual({os.id for os in pending_s1}, {os_s1_1.id, os_s1_2.id})

    async def test_create_and_pay_billing_cycle(self):
        """Valida a criação e quitação do ciclo de faturamento."""
        async with self.async_session() as session:
            os1 = await self._create_expedition_os(session, self.store1.id, 120.00)
            os2 = await self._create_expedition_os(session, self.store1.id, 180.00)
            
            # Criar ciclo
            cycle = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store1.id,
                start_date=datetime.utcnow() - timedelta(days=7),
                end_date=datetime.utcnow(),
                service_order_ids=[os1.id, os2.id]
            )
            
            self.assertIsNotNone(cycle.id)
            self.assertEqual(cycle.status, "FECHADO")
            self.assertEqual(cycle.total_amount, 300.00)
            self.assertEqual(len(cycle.items), 2)
            self.assertEqual(cycle.optical_store_name, "Leo Otica Centro")
            
            # Verificar se os itens carregam os dados da OS
            item_os_numbers = {item.os_number for item in cycle.items}
            self.assertIn(os1.os_number, item_os_numbers)
            self.assertIn(os2.os_number, item_os_numbers)
            
            # Verificar se as OSs agora não constam mais nos pendentes
            groups = await crud_billing.get_pending_billing_groups(session)
            # A store1 não deve mais estar na listagem pendente
            self.assertFalse(any(g["optical_store_id"] == self.store1.id for g in groups))
            
            # Quitar cobrança
            paid_cycle = await crud_billing.pay_billing_cycle(session, cycle.id)
            self.assertEqual(paid_cycle.status, "PAGO")
            self.assertIsNotNone(paid_cycle.paid_at)

    async def test_billing_cycle_constraints(self):
        """Garante que as restrições de faturamento único e status elegível são aplicadas."""
        async with self.async_session() as session:
            # OS na loja 1
            os_store1 = await self._create_expedition_os(session, self.store1.id, 100.00)
            # OS na loja 2
            os_store2 = await self._create_expedition_os(session, self.store2.id, 150.00)
            
            # OS não finalizada (status Recebida)
            os_received_in = ServiceOrderCreate(
                client_name="Cliente Recebido",
                optical_store_id=self.store1.id
            )
            os_received = await crud_os.create_service_order(session, os_received_in)
            
            # Restrição 1: Tentar criar ciclo misturando lojas
            with self.assertRaises(ValueError) as context:
                await crud_billing.create_billing_cycle(
                    session,
                    optical_store_id=self.store1.id,
                    start_date=datetime.utcnow() - timedelta(days=1),
                    end_date=datetime.utcnow(),
                    service_order_ids=[os_store1.id, os_store2.id]
                )
            self.assertIn("pertence a outra ótica", str(context.exception))
            
            # Restrição 2: Tentar faturar OS não elegível (status incorreto)
            with self.assertRaises(ValueError) as context:
                await crud_billing.create_billing_cycle(
                    session,
                    optical_store_id=self.store1.id,
                    start_date=datetime.utcnow() - timedelta(days=1),
                    end_date=datetime.utcnow(),
                    service_order_ids=[os_store1.id, os_received.id]
                )
            self.assertIn("não está no status de Expedição", str(context.exception))
            
            # Criar um faturamento válido para os_store1
            cycle = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store1.id,
                start_date=datetime.utcnow() - timedelta(days=1),
                end_date=datetime.utcnow(),
                service_order_ids=[os_store1.id]
            )
            self.assertIsNotNone(cycle)
            
            # Restrição 3: Tentar faturar a mesma OS de novo
            with self.assertRaises(ValueError) as context:
                await crud_billing.create_billing_cycle(
                    session,
                    optical_store_id=self.store1.id,
                    start_date=datetime.utcnow() - timedelta(days=1),
                    end_date=datetime.utcnow(),
                    service_order_ids=[os_store1.id]
                )
            self.assertIn("já foi faturada em outro ciclo", str(context.exception))

if __name__ == "__main__":
    unittest.main()
