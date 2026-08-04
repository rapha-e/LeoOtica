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
from backend.app.models.os import ServiceOrder, OSStatus, ServiceOrderItem
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService
from backend.app.models.customer_price import CustomerPriceTable, CustomerPriceItem
from backend.app.crud import os as crud_os
from backend.app.crud import customer_price as crud_customer_price
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate


class TestOSBillingAndStatus(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # 1. Cadastra uma Ótica Comercial de teste
            self.store = OpticalStore(
                corporate_name="Optica Leo Comercial Ltda",
                trade_name="Leo Ótica Comercial",
                cnpj="99.999.999/0001-99",
                is_active=True
            )
            session.add(self.store)
            await session.flush()

            # 2. Cadastra Produto (Lente), Tratamento e Serviço Técnico no Catálogo
            self.product = Product(
                name="Lente Monofocal CR39",
                sku="L-CR39-BASICA",
                cost_price=15.00,
                sale_price=80.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)

            self.treatment = Treatment(
                name="Filtro Antirreflexo Clean",
                description="Camada protetora contra reflexos",
                price=40.00,
                is_active=True,
                current_version=1
            )
            session.add(self.treatment)

            self.service = TechnicalService(
                name="Montagem de Aro Fechado",
                description="Montagem manual em armação de acetato",
                price=30.00,
                is_active=True,
                current_version=1
            )
            session.add(self.service)

            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.store)
            await session.refresh(self.product)
            await session.refresh(self.treatment)
            await session.refresh(self.service)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_os_create_and_billing_calculation(self):
        """Valida a criação de uma OS e que o faturamento soma Lente + Tratamento + Serviço."""
        async with self.async_session() as session:
            # 1. Cria a Ordem de Serviço
            os_in = ServiceOrderCreate(
                client_name="Maria Oliveira",
                doctor_name="Dr. Juliano Costa",
                optical_store_id=self.store.id,
                od_spherical=Decimal("-2.00"),
                od_cylindrical=Decimal("-0.50"),
                od_axis=90,
                od_addition=Decimal("1.50"),
                od_dnp=Decimal("31.50"),
                od_prism="1.0 D Base Out",
                od_height=Decimal("17.50")
            )
            db_os = await crud_os.create_service_order(session, os_in)
            self.assertEqual(db_os.status, OSStatus.RECEBIDA)
            self.assertEqual(db_os.total_amount, 0.00)

            # 2. Adiciona Lente (Produto) ao faturamento da OS
            item1_in = ServiceOrderItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                quantity=1
            )
            item1 = await crud_os.add_item_to_service_order(session, db_os.id, item1_in)
            self.assertEqual(item1.unit_price, 80.00)
            self.assertEqual(item1.total_price, 80.00)

            # Verifica se o total da OS foi atualizado para R$ 80,00
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 80.00)

            # 3. Adiciona Tratamento ao faturamento da OS
            item2_in = ServiceOrderItemCreate(
                entity_type="treatment",
                entity_id=self.treatment.id,
                quantity=1
            )
            item2 = await crud_os.add_item_to_service_order(session, db_os.id, item2_in)
            self.assertEqual(item2.unit_price, 40.00)

            # Verifica se o total da OS foi atualizado para R$ 120,00 (80 + 40)
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 120.00)

            # 4. Adiciona Serviço Técnico ao faturamento da OS
            item3_in = ServiceOrderItemCreate(
                entity_type="service",
                entity_id=self.service.id,
                quantity=1
            )
            item3 = await crud_os.add_item_to_service_order(session, db_os.id, item3_in)
            self.assertEqual(item3.unit_price, 30.00)

            # Verifica se o total final da OS é R$ 150,00 (80 + 40 + 30)
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 150.00)

    async def test_os_billing_with_discount_table(self):
        """Valida que o faturamento automático respeita os descontos contratuais da ótica."""
        async with self.async_session() as session:
            # 1. Cria uma tabela de preços ativa para a ótica com 20% de desconto global
            table = CustomerPriceTable(
                name="Tabela Contratual 20%",
                optical_store_id=self.store.id,
                discount_percent=Decimal("20.00"),
                start_date=datetime.utcnow() - timedelta(hours=1),
                is_active=True
            )
            session.add(table)
            await session.commit()
            await session.refresh(table)

            # 2. Cria a Ordem de Serviço
            os_in = ServiceOrderCreate(
                client_name="Jose Carlos",
                optical_store_id=self.store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)

            # 3. Adiciona Lente (Produto R$ 80.00 -> deve aplicar 20% de desconto = R$ 64.00)
            item_in = ServiceOrderItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                quantity=1
            )
            item = await crud_os.add_item_to_service_order(session, db_os.id, item_in)
            self.assertEqual(item.unit_price, 64.00)

            # Verifica total acumulado
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 64.00)

    async def test_os_status_workflow_transitions(self):
        """Valida a transição de status comercial pelos novos status da Sprint 6."""
        async with self.async_session() as session:
            # 1. Cria a Ordem de Serviço (Status inicial: Recebida)
            os_in = ServiceOrderCreate(
                client_name="Carlos Drummond",
                optical_store_id=self.store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            self.assertEqual(db_os.status, OSStatus.RECEBIDA)

            # 2. Transiciona para Separação
            db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "Iniciado na separação.")
            self.assertEqual(db_os.status, OSStatus.SEPARACAO)

            # 3. Transiciona para Produção
            db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "Iniciado na fábrica.")
            self.assertEqual(db_os.status, OSStatus.PRODUCAO)

            # 4. Transiciona para Montagem
            db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.MONTAGEM, "Lentes cortadas.")
            self.assertEqual(db_os.status, OSStatus.MONTAGEM)

            # 5. Transiciona para CQ
            db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.CQ, "Inspeção final.")
            self.assertEqual(db_os.status, OSStatus.CQ)

            # 6. Transiciona para Expedição
            db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "Pronta para envio.")
            self.assertEqual(db_os.status, OSStatus.EXPEDICAO)

    async def test_os_remove_billing_item(self):
        """Valida que remover um item de faturamento recalcula corretamente o valor total da OS."""
        async with self.async_session() as session:
            # 1. Cria a Ordem de Serviço
            os_in = ServiceOrderCreate(
                client_name="Pedro Silva",
                optical_store_id=self.store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            self.assertEqual(db_os.total_amount, 0.00)

            # 2. Adiciona Lente (Produto R$ 80.00)
            item1_in = ServiceOrderItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                quantity=1
            )
            item1 = await crud_os.add_item_to_service_order(session, db_os.id, item1_in)
            
            # 3. Adiciona Tratamento (Tratamento R$ 40.00)
            item2_in = ServiceOrderItemCreate(
                entity_type="treatment",
                entity_id=self.treatment.id,
                quantity=1
            )
            item2 = await crud_os.add_item_to_service_order(session, db_os.id, item2_in)

            # Verifica total inicial acumulado (80 + 40 = 120)
            session.expunge(db_os)
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 120.00)
            self.assertEqual(len(db_os.items), 2)

            # 4. Remove a Lente (item1) da OS
            success = await crud_os.remove_item_from_service_order(session, db_os.id, item1.id)
            self.assertTrue(success)

            # 5. Verifica total após remoção (deve ser R$ 40.00)
            session.expunge(db_os)
            db_os = await crud_os.get_service_order(session, db_os.id)
            self.assertEqual(db_os.total_amount, 40.00)
            self.assertEqual(len(db_os.items), 1)
            self.assertEqual(db_os.items[0].id, item2.id)


if __name__ == "__main__":
    unittest.main()
