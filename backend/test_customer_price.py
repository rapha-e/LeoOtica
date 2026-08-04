import unittest
from decimal import Decimal
import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.user import User, Role
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_catalog import Product, Treatment, PriceHistory
from backend.app.models.customer_price import CustomerPriceTable, CustomerPriceItem
from backend.app.crud import customer_price as crud_price
from backend.app.schemas.customer_price import (
    CustomerPriceTableCreate, CustomerPriceTableUpdate,
    CustomerPriceItemCreate
)


class TestCustomerPriceLogic(unittest.IsolatedAsyncioTestCase):

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

            self.user = User(
                email="operador@leootica.com.br",
                hashed_password="hashed_password",
                name="Operador Financeiro",
                role=role_operador,
                is_active=True
            )
            session.add(self.user)

            # 2. Cadastra uma Ótica comercial parceira
            self.store = OpticalStore(
                corporate_name="Oticas Diniz Ltda",
                trade_name="Oticas Diniz - Centro",
                cnpj="12.345.678/0001-90",
                is_active=True
            )
            session.add(self.store)
            await session.flush()

            # 3. Cadastra itens de catálogo padrão da fábrica
            # Produto: Preço base venda R$ 100.00
            self.product = Product(
                name="Lente Premium CR39 AR",
                description="Lente monofocal antirreflexo",
                sku="L-CR39-AR",
                cost_price=20.00,
                sale_price=100.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            
            # Tratamento: Preço base R$ 50.00
            self.treatment = Treatment(
                name="Filtro Azul Adicional",
                description="Bloqueio de luz azul para computadores",
                price=50.00,
                is_active=True,
                current_version=1
            )
            session.add(self.treatment)

            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.store)
            await session.refresh(self.product)
            await session.refresh(self.treatment)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_price_fallback_to_default_catalog(self):
        """Valida que, sem tabelas de preço associadas à ótica, o cálculo retorna os preços padrão do catálogo."""
        async with self.async_session() as session:
            # Calcula preço do produto
            res_prod = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="product",
                entity_id=self.product.id
            )
            self.assertEqual(res_prod.calculated_price, 100.00)
            self.assertEqual(res_prod.rule_applied, "default_catalog_price")
            self.assertIsNone(res_prod.price_table_id)
            self.assertEqual(res_prod.discount_applied, 0.00)

            # Calcula preço do tratamento
            res_treat = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="treatment",
                entity_id=self.treatment.id
            )
            self.assertEqual(res_treat.calculated_price, 50.00)
            self.assertEqual(res_treat.rule_applied, "default_catalog_price")
            self.assertEqual(res_treat.discount_applied, 0.00)

    async def test_price_with_general_customer_discount(self):
        """Valida a aplicação de desconto geral por cliente cadastrado na tabela de preços ativa."""
        async with self.async_session() as session:
            # 1. Cria uma tabela de preços ativa para a ótica com 15% de desconto global
            table_in = CustomerPriceTableCreate(
                name="Tabela Promocional 15%",
                optical_store_id=self.store.id,
                discount_percent=15.00,
                start_date=datetime.utcnow() - timedelta(hours=1),
                is_active=True
            )
            db_table = await crud_price.create_price_table(session, table_in)

            # 2. Calcula preço do produto (Base 100.00 -> Esperado 85.00 com 15% de desconto)
            res_prod = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="product",
                entity_id=self.product.id
            )
            self.assertEqual(res_prod.calculated_price, 85.00)
            self.assertEqual(res_prod.rule_applied, "customer_general_discount")
            self.assertEqual(res_prod.price_table_id, db_table.id)
            self.assertEqual(res_prod.discount_applied, 15.00)

            # 3. Calcula preço do tratamento (Base 50.00 -> Esperado 42.50 com 15% de desconto)
            res_treat = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="treatment",
                entity_id=self.treatment.id
            )
            self.assertEqual(res_treat.calculated_price, 42.50)
            self.assertEqual(res_treat.rule_applied, "customer_general_discount")
            self.assertEqual(res_treat.discount_applied, 7.50)

    async def test_price_with_specific_price_override(self):
        """Valida que o preço específico cadastrado no item da tabela prevalece sobre o desconto global e preço padrão."""
        async with self.async_session() as session:
            # 1. Cria tabela com 10% de desconto global
            table_in = CustomerPriceTableCreate(
                name="Tabela Contratual Diniz",
                optical_store_id=self.store.id,
                discount_percent=10.00,
                start_date=datetime.utcnow() - timedelta(hours=1),
                is_active=True
            )
            db_table = await crud_price.create_price_table(session, table_in)

            # 2. Cadastra um preço específico para o Produto na tabela por R$ 68.00 (mais barato que 10% desc = R$ 90.00)
            item_in = CustomerPriceItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                custom_price=68.00
            )
            await crud_price.create_price_item(session, db_table.id, item_in)

            # 3. Calcula o preço do produto (deve retornar R$ 68.00)
            res_prod = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="product",
                entity_id=self.product.id
            )
            self.assertEqual(res_prod.calculated_price, 68.00)
            self.assertEqual(res_prod.rule_applied, "specific_customer_price")
            self.assertEqual(res_prod.discount_applied, 32.00) # R$ 100.00 - R$ 68.00

            # 4. Calcula o preço do tratamento (não tem preço específico, deve retornar com 10% desc = R$ 45.00)
            res_treat = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="treatment",
                entity_id=self.treatment.id
            )
            self.assertEqual(res_treat.calculated_price, 45.00)
            self.assertEqual(res_treat.rule_applied, "customer_general_discount")

    async def test_price_table_vigency_boundaries(self):
        """Valida que tabelas expiradas ou agendadas no futuro não são aplicadas, forçando o fallback."""
        async with self.async_session() as session:
            # 1. Tabela EXPIRADA (vigência acabou no passado)
            table_expirada_in = CustomerPriceTableCreate(
                name="Tabela Expirada",
                optical_store_id=self.store.id,
                discount_percent=50.00, # 50% de desconto
                start_date=datetime.utcnow() - timedelta(days=10),
                end_date=datetime.utcnow() - timedelta(days=2),
                is_active=True
            )
            await crud_price.create_price_table(session, table_expirada_in)

            # O preço deve voltar ao valor padrão do catálogo (R$ 100.00)
            res_prod = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="product",
                entity_id=self.product.id
            )
            self.assertEqual(res_prod.calculated_price, 100.00)
            self.assertEqual(res_prod.rule_applied, "default_catalog_price")

            # 2. Tabela AGENDADA (vigência inicia no futuro)
            table_futura_in = CustomerPriceTableCreate(
                name="Tabela Futura",
                optical_store_id=self.store.id,
                discount_percent=50.00,
                start_date=datetime.utcnow() + timedelta(days=2),
                is_active=True
            )
            await crud_price.create_price_table(session, table_futura_in)

            # O preço também deve continuar no fallback do catálogo (R$ 100.00)
            res_prod2 = await crud_price.calculate_customer_price(
                session,
                optical_store_id=self.store.id,
                entity_type="product",
                entity_id=self.product.id
            )
            self.assertEqual(res_prod2.calculated_price, 100.00)
            self.assertEqual(res_prod2.rule_applied, "default_catalog_price")


if __name__ == "__main__":
    unittest.main()
