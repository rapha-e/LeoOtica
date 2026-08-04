import unittest
from decimal import Decimal
import sys
import os
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.user import User, Role
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService, PriceHistory
from backend.app.crud import financial_catalog as crud_catalog
from backend.app.schemas.financial_catalog import (
    ProductCreate, ProductUpdate,
    TreatmentCreate, TreatmentUpdate,
    TechnicalServiceCreate, TechnicalServiceUpdate
)


class TestFinancialCatalog(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # Cadastra o perfil de operador
            role_operador = Role(
                name="Operador",
                description="Operador de Fábrica"
            )
            session.add(role_operador)
            await session.flush()

            # Cadastra um usuário para associar às alterações de preço
            self.user = User(
                email="operador@leootica.com.br",
                hashed_password="hashed_password",
                name="Operador Financeiro",
                role=role_operador,
                is_active=True
            )
            session.add(self.user)
            await session.commit()
            await session.refresh(self.user)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_product_lifecycle_with_price_versions(self):
        """Valida criação, atualizações comuns, reajustes de preço e versionamento de um Produto."""
        async with self.async_session() as session:
            # 1. Criação do Produto
            prod_in = ProductCreate(
                name="Lente Monofocal CR39",
                description="Lente monofocal comum CR39 sem AR",
                sku="L-CR39-MONO",
                cost_price=12.50,
                sale_price=35.00,
                is_active=True,
                change_reason="Cadastro de novos produtos da grade"
            )
            db_product = await crud_catalog.create_product(session, prod_in, user_id=self.user.id)
            self.assertIsNotNone(db_product.id)
            self.assertEqual(db_product.current_version, 1)
            self.assertEqual(db_product.sale_price, 35.00)

            # Verifica histórico inicial v1
            history = await crud_catalog.get_price_history_for_entity(session, "product", db_product.id)
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0].version, 1)
            self.assertEqual(history[0].price, 35.00)
            self.assertEqual(history[0].cost_price, 12.50)
            self.assertIsNone(history[0].end_date)
            self.assertEqual(history[0].changed_by_id, self.user.id)
            self.assertEqual(history[0].change_reason, "Cadastro de novos produtos da grade")

            # 2. Atualização que NÃO altera preço (apenas nome/descrição)
            update_in = ProductUpdate(
                name="Lente Monofocal CR39 Básica",
                description="Lente monofocal comum CR39 básica sem AR"
            )
            db_product = await crud_catalog.update_product(session, db_product.id, update_in, user_id=self.user.id)
            self.assertEqual(db_product.name, "Lente Monofocal CR39 Básica")
            self.assertEqual(db_product.current_version, 1) # Não deve mudar

            # O histórico deve permanecer idêntico com apenas 1 versão
            history = await crud_catalog.get_price_history_for_entity(session, "product", db_product.id)
            self.assertEqual(len(history), 1)

            # 3. Atualização de preço (Reajuste financeiro)
            reajuste_in = ProductUpdate(
                sale_price=42.00,
                change_reason="Ajuste inflacionário de custos de importação"
            )
            db_product = await crud_catalog.update_product(session, db_product.id, reajuste_in, user_id=self.user.id)
            self.assertEqual(db_product.sale_price, 42.00)
            self.assertEqual(db_product.current_version, 2) # Versionamento incrementado

            # Verifica se o histórico contém 2 versões e se a v1 foi encerrada
            history = await crud_catalog.get_price_history_for_entity(session, "product", db_product.id)
            self.assertEqual(len(history), 2)
            
            # Ordenados de forma decrescente (v2 primeiro)
            hist_v2 = history[0]
            hist_v1 = history[1]
            
            self.assertEqual(hist_v2.version, 2)
            self.assertEqual(hist_v2.price, 42.00)
            self.assertEqual(hist_v2.cost_price, 12.50) # manteve antigo
            self.assertIsNone(hist_v2.end_date)
            self.assertEqual(hist_v2.change_reason, "Ajuste inflacionário de custos de importação")

            self.assertEqual(hist_v1.version, 1)
            self.assertEqual(hist_v1.price, 35.00)
            self.assertIsNotNone(hist_v1.end_date) # encerrou vigência

            # 4. Remoção física do produto
            deleted = await crud_catalog.delete_product(session, db_product.id)
            self.assertTrue(deleted)
            
            # Verifica se deletou o produto
            prod_check = await crud_catalog.get_product(session, db_product.id)
            self.assertIsNone(prod_check)
            
            # Verifica se limpou o histórico
            history_check = await crud_catalog.get_price_history_for_entity(session, "product", db_product.id)
            self.assertEqual(len(history_check), 0)

    async def test_treatment_lifecycle_with_price_versions(self):
        """Valida criação, reajuste de preço e remoção de um Tratamento de lente."""
        async with self.async_session() as session:
            # 1. Criação
            treat_in = TreatmentCreate(
                name="Antirreflexo Crizal Easy",
                description="Tratamento antirreflexo básico Crizal",
                price=120.00,
                change_reason="Lançamento do tratamento no laboratório"
            )
            db_treat = await crud_catalog.create_treatment(session, treat_in, user_id=self.user.id)
            self.assertIsNotNone(db_treat.id)
            self.assertEqual(db_treat.current_version, 1)

            # Verifica histórico inicial
            history = await crud_catalog.get_price_history_for_entity(session, "treatment", db_treat.id)
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0].price, 120.00)

            # 2. Reajuste
            reajuste_in = TreatmentUpdate(
                price=145.00,
                change_reason="Aumento na tabela de preços do fornecedor Essilor"
            )
            db_treat = await crud_catalog.update_treatment(session, db_treat.id, reajuste_in, user_id=self.user.id)
            self.assertEqual(db_treat.price, 145.00)
            self.assertEqual(db_treat.current_version, 2)

            # Histórico
            history = await crud_catalog.get_price_history_for_entity(session, "treatment", db_treat.id)
            self.assertEqual(len(history), 2)
            self.assertEqual(history[0].version, 2)
            self.assertEqual(history[0].price, 145.00)
            self.assertEqual(history[1].version, 1)
            self.assertEqual(history[1].price, 120.00)
            self.assertIsNotNone(history[1].end_date)

            # 3. Remoção
            deleted = await crud_catalog.delete_treatment(session, db_treat.id)
            self.assertTrue(deleted)

            history_check = await crud_catalog.get_price_history_for_entity(session, "treatment", db_treat.id)
            self.assertEqual(len(history_check), 0)

    async def test_technical_service_lifecycle_with_price_versions(self):
        """Valida criação, reajuste de preço e remoção de um Serviço Técnico."""
        async with self.async_session() as session:
            # 1. Criação
            serv_in = TechnicalServiceCreate(
                name="Montagem de Meio Aro",
                description="Serviço laboratorial de montagem em armações fio de nylon",
                price=25.00,
                change_reason="Precificação base de montagem"
            )
            db_service = await crud_catalog.create_technical_service(session, serv_in, user_id=self.user.id)
            self.assertIsNotNone(db_service.id)
            self.assertEqual(db_service.current_version, 1)

            # Verifica histórico
            history = await crud_catalog.get_price_history_for_entity(session, "service", db_service.id)
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0].price, 25.00)

            # 2. Reajuste
            reajuste_in = TechnicalServiceUpdate(
                price=30.00,
                change_reason="Margem de reajuste devido à energia e insumos"
            )
            db_service = await crud_catalog.update_technical_service(session, db_service.id, reajuste_in, user_id=self.user.id)
            self.assertEqual(db_service.price, 30.00)
            self.assertEqual(db_service.current_version, 2)

            # Histórico
            history = await crud_catalog.get_price_history_for_entity(session, "service", db_service.id)
            self.assertEqual(len(history), 2)
            self.assertEqual(history[0].version, 2)
            self.assertEqual(history[0].price, 30.00)
            self.assertEqual(history[1].version, 1)
            self.assertEqual(history[1].price, 25.00)
            self.assertIsNotNone(history[1].end_date)

            # 3. Remoção
            deleted = await crud_catalog.delete_technical_service(session, db_service.id)
            self.assertTrue(deleted)

            history_check = await crud_catalog.get_price_history_for_entity(session, "service", db_service.id)
            self.assertEqual(len(history_check), 0)


if __name__ == "__main__":
    unittest.main()
