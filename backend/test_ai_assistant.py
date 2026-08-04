import unittest
from decimal import Decimal
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle
from backend.app.models.movement import StockMovement
from backend.app.services.ai_assistant import (
    get_top_billing_stores,
    get_top_consumed_lenses,
    get_overdue_service_orders,
    ask_assistant
)
from backend.app.api.endpoints.analytics import ask_ai_assistant, AssistantRequest


class TestAIAssistant(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # --- 1. ÓTICAS PARCEIRAS ---
            self.store_a = OpticalStore(
                corporate_name="Otica Alfa S.A.",
                trade_name="Otica Alfa",
                cnpj="11.111.111/0001-11",
                is_active=True
            )
            self.store_b = OpticalStore(
                corporate_name="Otica Beta Ltda",
                trade_name="Otica Beta",
                cnpj="22.222.222/0001-22",
                is_active=True
            )
            session.add_all([self.store_a, self.store_b])
            await session.flush()

            # --- 2. DADOS COMERCIAIS (FECHAMENTO) ---
            # Ciclo da Ótica A: R$ 500.00
            self.billing_a = BillingCycle(
                optical_store_id=self.store_a.id,
                start_date=datetime.utcnow() - timedelta(days=10),
                end_date=datetime.utcnow(),
                total_amount=Decimal("500.00"),
                status="PAGO"
            )
            # Ciclo da Ótica B: R$ 300.00
            self.billing_b = BillingCycle(
                optical_store_id=self.store_b.id,
                start_date=datetime.utcnow() - timedelta(days=15),
                end_date=datetime.utcnow(),
                total_amount=Decimal("300.00"),
                status="PAGO"
            )
            session.add_all([self.billing_a, self.billing_b])

            # --- 3. LENTES E MOVIMENTO (CONSUMO) ---
            self.model_1 = LensModel(
                brand="Essilor Antireflex",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Crizal",
                diameter=70,
                cost_price=Decimal("50.00")
            )
            self.model_2 = LensModel(
                brand="Hoya BlueControl",
                material="Resina",
                refractive_index=Decimal("1.67"),
                treatment="BlueControl",
                diameter=65,
                cost_price=Decimal("80.00")
            )
            session.add_all([self.model_1, self.model_2])
            await session.flush()

            # Dioptrias
            self.grade_1 = LensInventoryGrade(
                lens_model_id=self.model_1.id,
                spherical=Decimal("-2.00"),
                cylindrical=Decimal("-1.00"),
                barcode="BARCODE-E1",
                quantity_available=10
            )
            self.grade_2 = LensInventoryGrade(
                lens_model_id=self.model_2.id,
                spherical=Decimal("-4.00"),
                cylindrical=Decimal("-0.75"),
                barcode="BARCODE-H1",
                quantity_available=15
            )
            session.add_all([self.grade_1, self.grade_2])
            await session.flush()

            # Saídas de estoque (Giro/Consumo) nos últimos 30 dias
            # Lente 1 teve 8 unidades consumidas
            self.mov_1 = StockMovement(
                lens_inventory_id=self.grade_1.id,
                movement_type="OUT",
                quantity=8,
                reason="OS-1234",
                movement_date=datetime.utcnow() - timedelta(days=4)
            )
            # Lente 2 teve 3 unidades consumidas
            self.mov_2 = StockMovement(
                lens_inventory_id=self.grade_2.id,
                movement_type="OUT",
                quantity=3,
                reason="OS-5678",
                movement_date=datetime.utcnow() - timedelta(days=10)
            )
            session.add_all([self.mov_1, self.mov_2])

            # --- 4. ORDENS DE SERVIÇO (PRODUÇÃO & ATRASOS) ---
            # OS 1: Atrasada (Criada há 5 dias e ainda em status RECEBIDA)
            self.os_overdue = ServiceOrder(
                os_number="OS-ATRASADA-999",
                client_name="Paciente Atrasado",
                status=OSStatus.RECEBIDA,
                optical_store_id=self.store_a.id,
                created_at=datetime.utcnow() - timedelta(days=5)
            )
            # OS 2: No prazo (Criada hoje)
            self.os_on_time = ServiceOrder(
                os_number="OS-NOPRAZO-111",
                client_name="Paciente No Prazo",
                status=OSStatus.PRODUCAO,
                optical_store_id=self.store_b.id,
                created_at=datetime.utcnow()
            )
            # OS 3: Concluída e antiga (Status Expedição não deve contar como atrasada mesmo sendo antiga)
            self.os_closed = ServiceOrder(
                os_number="OS-CONCLUIDA-222",
                client_name="Paciente Concluido Antigo",
                status=OSStatus.EXPEDICAO,
                optical_store_id=self.store_a.id,
                created_at=datetime.utcnow() - timedelta(days=10)
            )
            session.add_all([self.os_overdue, self.os_on_time, self.os_closed])

            await session.commit()

            # Atualiza referências locais
            await session.refresh(self.store_a)
            await session.refresh(self.store_b)
            await session.refresh(self.grade_1)
            await session.refresh(self.grade_2)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_get_top_billing_stores(self):
        """Valida que a consulta analítica do faturamento por ótica funciona corretamente."""
        async with self.async_session() as session:
            stores = await get_top_billing_stores(session, limit=5)
            self.assertEqual(len(stores), 2)
            # Otica Alfa faturou 500.00, Otica Beta faturou 300.00
            self.assertEqual(stores[0]["store_name"], "Otica Alfa S.A.")
            self.assertEqual(stores[0]["total_billed"], 500.00)
            self.assertEqual(stores[1]["store_name"], "Otica Beta Ltda")
            self.assertEqual(stores[1]["total_billed"], 300.00)

    async def test_get_top_consumed_lenses(self):
        """Valida que a consulta de maior consumo de lentes do estoque está correta."""
        async with self.async_session() as session:
            lenses = await get_top_consumed_lenses(session, limit=5)
            self.assertEqual(len(lenses), 2)
            # Lente 1 (Essilor) com 8 unids, Lente 2 (Hoya) com 3 unids
            self.assertEqual(lenses[0]["brand"], "Essilor Antireflex")
            self.assertEqual(lenses[0]["total_quantity"], 8)
            self.assertEqual(lenses[1]["brand"], "Hoya BlueControl")
            self.assertEqual(lenses[1]["total_quantity"], 3)

    async def test_get_overdue_service_orders(self):
        """Valida que o filtro de atrasos detecta apenas OSs ativas criadas há mais de 3 dias."""
        async with self.async_session() as session:
            orders = await get_overdue_service_orders(session, limit=10)
            self.assertEqual(len(orders), 1)
            # Apenas os_overdue deve aparecer
            self.assertEqual(orders[0]["os_number"], "OS-ATRASADA-999")
            self.assertEqual(orders[0]["client_name"], "Paciente Atrasado")
            self.assertEqual(orders[0]["store_name"], "Otica Alfa")

    async def test_fallback_ai_assistant_intentions(self):
        """Valida que o motor de fallback local detecta palavras-chave e retorna a formatação Markdown correta."""
        async with self.async_session() as session:
            # 1. Intenção Comercial/Faturamento
            res_billing = await ask_assistant(session, "Quais óticas mais faturaram este mês?")
            self.assertIn("Otica Alfa S.A.", res_billing)
            self.assertIn("R$ 500.00", res_billing)
            self.assertIn("### 🏢 Óticas com Maior Faturamento", res_billing)

            # 2. Intenção Lentes/Estoque/Consumo
            res_lenses = await ask_assistant(session, "Quais lentes tiveram maior consumo?")
            self.assertIn("Essilor Antireflex", res_lenses)
            self.assertIn("8 unids", res_lenses)
            self.assertIn("### 🔍 Lentes com Maior Consumo", res_lenses)

            # 3. Intenção OS Atrasadas
            res_overdue = await ask_assistant(session, "Quais ordens de serviço estão atrasadas na esteira?")
            self.assertIn("OS-ATRASADA-999", res_overdue)
            self.assertIn("Paciente Atrasado", res_overdue)
            self.assertIn("### ⚠️ Ordens de Serviço (OS) Atrasadas", res_overdue)

            # 4. Outras perguntas (Mensagem de ajuda)
            res_help = await ask_assistant(session, "Qual a previsão do tempo para amanhã?")
            self.assertIn("Olá! Sou o **Assistente Operacional**", res_help)
            self.assertIn("Quais lentes tiveram maior consumo?", res_help)

    async def test_endpoint_ai_assistant(self):
        """Valida que o endpoint do FastAPI executa corretamente a chamada do assistente."""
        async with self.async_session() as session:
            req = AssistantRequest(message="Quais OS estão atrasadas?")
            response = await ask_ai_assistant(payload=req, db=session)
            self.assertIn("response", response)
            self.assertIn("OS-ATRASADA-999", response["response"])


if __name__ == "__main__":
    unittest.main()
