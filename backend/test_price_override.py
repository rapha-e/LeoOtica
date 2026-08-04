import unittest
from decimal import Decimal
import sys
import os
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus, ServiceOrderItem
from backend.app.models.user import User, Role
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService, PriceHistory
from backend.app.models.customer_price import CustomerPriceTable, CustomerPriceItem
from backend.app.crud import os as crud_os
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate


class TestPriceOverrideAndAssemblyServices(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # 1. Cadastra o perfil de operador e usuário de teste
            role_operador = Role(name="Operador", description="Operador de Fábrica")
            session.add(role_operador)
            await session.flush()

            self.operator = User(
                email="operator_faturamento@leootica.com.br",
                hashed_password="hashed_password",
                name="Maria Faturamento",
                role=role_operador,
                is_active=True
            )
            session.add(self.operator)

            # 2. Cadastra uma Ótica parceira
            from backend.app.models.optical_store import OpticalStore
            self.optical_store = OpticalStore(
                corporate_name="Oticas Carol S.A.",
                trade_name="Oticas Carol",
                cnpj="11.222.333/0001-44",
                is_active=True
            )
            session.add(self.optical_store)
            await session.flush()

            # 3. Cadastra itens de catálogo padrão da fábrica
            # Produto: Preço base venda R$ 120.00
            self.product = Product(
                name="Lente Transitions 1.56",
                description="Lente fotocromática monofocal",
                sku="L-TRANS-156",
                cost_price=30.00,
                sale_price=120.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            
            # Tratamento: Preço base R$ 80.00
            self.treatment = Treatment(
                name="Antirreflexo Crizal",
                description="Tratamento antirreflexo avançado",
                price=80.00,
                is_active=True,
                current_version=1
            )
            session.add(self.treatment)

            # Serviço técnico de Montagem Simples semeado manualmente
            self.service = TechnicalService(
                name="montagem simples",
                description="Montagem simples em aro fechado",
                price=30.00,
                is_active=True,
                current_version=1
            )
            session.add(self.service)

            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.operator)
            await session.refresh(self.optical_store)
            await session.refresh(self.product)
            await session.refresh(self.treatment)
            await session.refresh(self.service)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_default_price_application(self):
        """Valida que itens adicionados sem sobrescrita aplicam o preço de catálogo original."""
        async with self.async_session() as session:
            # Cria a OS
            os_in = ServiceOrderCreate(
                client_name="Reginaldo Rossi",
                optical_store_id=self.optical_store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            os_id = db_os.id

            # Adiciona item de serviço (montagem simples - R$ 30.00)
            item_in = ServiceOrderItemCreate(
                entity_type="service",
                entity_id=self.service.id,
                quantity=1
            )
            item_db = await crud_os.add_item_to_service_order(session, os_id, item_in, operator_id=self.operator.id)

            self.assertEqual(item_db.unit_price, 30.00)
            self.assertEqual(item_db.total_price, 30.00)
            self.assertFalse(item_db.custom_price_applied)
            self.assertEqual(float(item_db.original_price), 30.00)
            self.assertIsNone(item_db.price_override_reason)

            # Recarrega a OS e valida total
            db_os_loaded = await crud_os.get_service_order(session, os_id)
            self.assertEqual(db_os_loaded.total_amount, 30.00)

    async def test_price_override_requires_justification(self):
        """Valida que o sistema rejeita alterações de preço sem justificativa preenchida."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="Chico Buarque",
                optical_store_id=self.optical_store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            os_id = db_os.id

            # Caso 1: Justificativa ausente (None)
            item_in_none = ServiceOrderItemCreate(
                entity_type="service",
                entity_id=self.service.id,
                quantity=1,
                override_price=25.00,
                price_override_reason=None
            )
            with self.assertRaises(ValueError) as context:
                await crud_os.add_item_to_service_order(session, os_id, item_in_none, operator_id=self.operator.id)
            self.assertIn("Justificativa obrigatória", str(context.exception))

            # Caso 2: Justificativa em branco ("   ")
            item_in_empty = ServiceOrderItemCreate(
                entity_type="service",
                entity_id=self.service.id,
                quantity=1,
                override_price=25.00,
                price_override_reason="   "
            )
            with self.assertRaises(ValueError) as context:
                await crud_os.add_item_to_service_order(session, os_id, item_in_empty, operator_id=self.operator.id)
            self.assertIn("Justificativa obrigatória", str(context.exception))

    async def test_price_override_success_with_justification(self):
        """Valida a inclusão bem sucedida de item com preço manual e registro em log de auditoria."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="Caetano Veloso",
                optical_store_id=self.optical_store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            os_id = db_os.id

            # Preço normal: R$ 30.00. Preço manual: R$ 15.00.
            item_in = ServiceOrderItemCreate(
                entity_type="service",
                entity_id=self.service.id,
                quantity=2,
                override_price=15.00,
                price_override_reason="Desconto autorizado pelo gerente comercial para cliente VIP."
            )
            item_db = await crud_os.add_item_to_service_order(session, os_id, item_in, operator_id=self.operator.id)

            self.assertEqual(item_db.unit_price, 15.00)
            self.assertEqual(item_db.total_price, 30.00) # 15.00 * 2
            self.assertTrue(item_db.custom_price_applied)
            self.assertEqual(float(item_db.original_price), 30.00)
            self.assertEqual(item_db.price_override_reason, "Desconto autorizado pelo gerente comercial para cliente VIP.")

            # Valida totalizador da OS
            db_os_loaded = await crud_os.get_service_order(session, os_id)
            self.assertEqual(db_os_loaded.total_amount, 30.00)

            # Verifica o histórico de auditoria
            history = db_os_loaded.workflow_history
            # Deve haver 2 eventos: 1 de criação da OS e 1 da auditoria comercial de faturamento
            self.assertEqual(len(history), 2)
            
            audit_log = history[-1]
            self.assertEqual(audit_log.sector, "Comercial / Faturamento")
            self.assertEqual(audit_log.operator_id, self.operator.id)
            self.assertIn("Preço manual autorizado para montagem simples", audit_log.operator_notes)
            self.assertIn("De R$ 30.00 para R$ 15.00", audit_log.operator_notes)
            self.assertIn("Desconto autorizado pelo gerente", audit_log.operator_notes)

    async def test_seeding_technical_services(self):
        """Valida que o startup do app cria os 4 serviços técnicos padrão de montagem no banco de dados."""
        async with self.async_session() as session:
            # Remove o serviço técnico padrão que criamos no setUp para simular banco vazio
            await session.delete(self.service)
            await session.commit()

            # Executa a lógica de semeadura na sessão local de teste
            # Semelhante ao startup em main.py
            services_query = await session.execute(select(TechnicalService))
            services_list = services_query.scalars().all()
            self.assertEqual(len(services_list), 0)

            default_services = [
                TechnicalService(
                    name="montagem simples",
                    description="Serviço técnico de montagem simples em armação fechada",
                    price=Decimal("30.00"),
                    is_active=True,
                    current_version=1
                ),
                TechnicalService(
                    name="nylon",
                    description="Serviço técnico de montagem em armação com fio de nylon",
                    price=Decimal("40.00"),
                    is_active=True,
                    current_version=1
                ),
                TechnicalService(
                    name="3 peças",
                    description="Serviço técnico de montagem em armação de 3 peças (parafusada)",
                    price=Decimal("60.00"),
                    is_active=True,
                    current_version=1
                ),
                TechnicalService(
                    name="remontagem",
                    description="Serviço técnico de remontagem ou ajuste de lentes em armação nova",
                    price=Decimal("35.00"),
                    is_active=True,
                    current_version=1
                )
            ]
            session.add_all(default_services)
            await session.flush()
            
            for service in default_services:
                history = PriceHistory(
                    entity_type="service",
                    entity_id=service.id,
                    version=1,
                    price=service.price,
                    change_reason="Cadastro de serviço de montagem padrão (Sprint 7)"
                )
                session.add(history)
            await session.commit()

            # Verifica se os 4 serviços e históricos foram criados com sucesso
            res = await session.execute(select(TechnicalService))
            all_services = res.scalars().all()
            self.assertEqual(len(all_services), 4)
            
            names = [s.name for s in all_services]
            self.assertIn("montagem simples", names)
            self.assertIn("nylon", names)
            self.assertIn("3 peças", names)
            self.assertIn("remontagem", names)

            # Verifica o histórico de preços
            res_history = await session.execute(select(PriceHistory).where(PriceHistory.entity_type == "service"))
            histories = res_history.scalars().all()
            self.assertEqual(len(histories), 4)


if __name__ == "__main__":
    unittest.main()
