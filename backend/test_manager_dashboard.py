import unittest
from decimal import Decimal
import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.movement import StockMovement
from backend.app.crud.analytics import get_manager_dashboard_data
from backend.app.api.endpoints.analytics import get_manager_dashboard


class TestManagerDashboard(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Cria a view mv_lens_consumption_velocity conforme o main.py
            view_ddl = """
            CREATE VIEW IF NOT EXISTS mv_lens_consumption_velocity AS
            SELECT
                lig.id AS lens_inventory_id,
                lm.brand,
                lm.material,
                lm.refractive_index,
                lm.treatment,
                lm.diameter,
                lig.spherical,
                lig.cylindrical,
                lig.quantity_available,
                lig.location_tag,
                lig.barcode,
                COALESCE(SUM(sm.quantity), 0) AS units_consumed_30_days,
                ROUND(COALESCE(SUM(sm.quantity), 0) / 30.0, 4) AS daily_burn_rate
            FROM lens_inventory_grade lig
            JOIN lens_models lm ON lig.lens_model_id = lm.id
            LEFT JOIN stock_movements sm ON sm.lens_inventory_id = lig.id
                AND sm.movement_type = 'OUT'
                AND sm.movement_date >= datetime('now', '-30 days')
            GROUP BY lig.id, lm.brand, lm.material, lm.refractive_index, lm.treatment, lm.diameter, lig.spherical, lig.cylindrical, lig.quantity_available, lig.location_tag, lig.barcode;
            """
            await conn.execute(text(view_ddl))

        async with self.async_session() as session:
            # --- 1. ÓTICAS ---
            self.store_active = OpticalStore(
                corporate_name="Optica Ativa Ltda",
                trade_name="Otica Ativa",
                cnpj="11.111.111/0001-11",
                is_active=True
            )
            self.store_inactive = OpticalStore(
                corporate_name="Optica Inativa Ltda",
                trade_name="Otica Inativa",
                cnpj="22.222.222/0001-22",
                is_active=False
            )
            session.add_all([self.store_active, self.store_inactive])
            await session.flush()

            # --- 2. LENTES (ESTOQUE) ---
            self.lens_model = LensModel(
                brand="Essilor Test",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Antirreflexo",
                diameter=70,
                cost_price=Decimal("50.00")
            )
            session.add(self.lens_model)
            await session.flush()

            # Lente 1: Em Ruptura (quantity_available = 0)
            self.lens_rupture = LensInventoryGrade(
                lens_model_id=self.lens_model.id,
                spherical=Decimal("-2.00"),
                cylindrical=Decimal("-1.00"),
                barcode="RUPTURA-001",
                quantity_available=0,
                location_tag="GAVETA-A1"
            )
            # Lente 2: Normal, com estoque e histórico de saídas (para giro)
            self.lens_normal = LensInventoryGrade(
                lens_model_id=self.lens_model.id,
                spherical=Decimal("-3.00"),
                cylindrical=Decimal("-1.50"),
                barcode="NORMAL-001",
                quantity_available=10,
                location_tag="GAVETA-A2"
            )
            session.add_all([self.lens_rupture, self.lens_normal])
            await session.flush()

            # Movimentação do tipo OUT nos últimos 30 dias para Lente 2 (Consumo)
            self.out_movement = StockMovement(
                lens_inventory_id=self.lens_normal.id,
                movement_type="OUT",
                quantity=3,
                reason="Venda/Producao OS",
                movement_date=datetime.utcnow() - timedelta(days=5)
            )
            session.add(self.out_movement)

            # --- 3. ORDENS DE SERVIÇO E WORKFLOW (PRODUÇÃO & SLA) ---
            # OS 1: Aberta (status = RECEBIDA)
            self.os_open = ServiceOrder(
                os_number="OS-ABERTA-001",
                client_name="Paciente Aberto",
                status=OSStatus.RECEBIDA,
                optical_store_id=self.store_active.id,
                created_at=datetime.utcnow() - timedelta(days=10)
            )
            # OS 2: Concluída (status = EXPEDICAO)
            self.os_closed = ServiceOrder(
                os_number="OS-CONCLUIDA-001",
                client_name="Paciente Concluido",
                status=OSStatus.EXPEDICAO,
                optical_store_id=self.store_active.id,
                created_at=datetime.utcnow() - timedelta(days=2) # Criada há 2 dias
            )
            session.add_all([self.os_open, self.os_closed])
            await session.flush()

            # Workflow para a OS Concluída (transição para Expedição)
            self.history_closed = OSWorkflowHistory(
                service_order_id=self.os_closed.id,
                previous_status=OSStatus.CQ,
                new_status=OSStatus.EXPEDICAO,
                operator_notes="Pronto para envio",
                changed_at=datetime.utcnow() # Finalizado hoje. SLA = 2 dias.
            )
            session.add(self.history_closed)

            # --- 4. FECHAMENTO FINANCEIRO (COMERCIAL) ---
            # Ciclo 1: Pago R$ 150.00
            self.billing_paid = BillingCycle(
                optical_store_id=self.store_active.id,
                start_date=datetime.utcnow() - timedelta(days=15),
                end_date=datetime.utcnow(),
                total_amount=Decimal("150.00"),
                status="PAGO"
            )
            # Ciclo 2: Pendente R$ 50.00
            self.billing_pending = BillingCycle(
                optical_store_id=self.store_active.id,
                start_date=datetime.utcnow() - timedelta(days=30),
                end_date=datetime.utcnow() - timedelta(days=15),
                total_amount=Decimal("50.00"),
                status="PENDENTE"
            )
            session.add_all([self.billing_paid, self.billing_pending])
            await session.flush()

            # Itens de Faturamento (Total = 2 itens faturados)
            self.billing_item_1 = BillingItem(
                billing_cycle_id=self.billing_paid.id,
                service_order_id=self.os_closed.id,
                amount=Decimal("150.00")
            )
            self.billing_item_2 = BillingItem(
                billing_cycle_id=self.billing_pending.id,
                service_order_id=self.os_open.id, # Vinculado a OS mesmo que aberta, para simular faturamento
                amount=Decimal("50.00")
            )
            session.add_all([self.billing_item_1, self.billing_item_2])

            await session.commit()

            # Atualiza referências locais
            await session.refresh(self.store_active)
            await session.refresh(self.store_inactive)
            await session.refresh(self.lens_model)
            await session.refresh(self.lens_rupture)
            await session.refresh(self.lens_normal)
            await session.refresh(self.os_open)
            await session.refresh(self.os_closed)
            await session.refresh(self.billing_paid)
            await session.refresh(self.billing_pending)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_get_manager_dashboard_data_calculations(self):
        """Valida se os cálculos dos KPIs do Dashboard Gerencial estão corretos e consistentes."""
        async with self.async_session() as session:
            data = await get_manager_dashboard_data(session)

            # --- Validação Comercial ---
            comercial = data.get("comercial", {})
            self.assertEqual(comercial.get("faturamento"), 200.0) # 150.00 + 50.00
            self.assertEqual(comercial.get("faturamento_pago"), 150.0)
            self.assertEqual(comercial.get("faturamento_pendente"), 50.0)
            self.assertEqual(comercial.get("oticas_ativas"), 1) # Apenas store_active
            self.assertEqual(comercial.get("total_os_faturadas"), 2) # billing_item_1 e 2
            self.assertEqual(comercial.get("ticket_medio"), 100.0) # 200.0 / 2

            # --- Validação Produção ---
            producao = data.get("producao", {})
            self.assertEqual(producao.get("os_abertas"), 1) # os_open (RECEBIDA)
            self.assertEqual(producao.get("os_concluidas"), 1) # os_closed (EXPEDICAO)
            # O SLA deve ser aproximadamente 2.0 dias (diferença entre datetime.utcnow() e datetime.utcnow() - timedelta(days=2))
            self.assertAlmostEqual(producao.get("sla_average_days"), 2.0, places=1)

            # --- Validação Estoque ---
            estoque = data.get("estoque", {})
            self.assertEqual(estoque.get("rupturas"), 1) # lens_rupture (qty = 0)
            self.assertEqual(estoque.get("consumo_30_dias"), 3) # out_movement (qty = 3)
            self.assertEqual(estoque.get("total_stock_qty"), 10) # 0 + 10
            # Giro = consumo / total_stock_qty = 3 / 10 = 0.3
            self.assertEqual(estoque.get("giro"), 0.3)
            # Compras sugeridas (Alertas preditivos ativos): como a lente em ruptura (qty = 0)
            # não tem movimentações registradas para daily_burn_rate (burn rate = 0), a compra sugerida nela
            # será 0 (porque o algoritmo preditivo multiplica daily_burn_rate por dias de cobertura).
            # No entanto, a Lente Normal tem estoque = 10, mas consumo = 3 nos últimos 30 dias (daily_burn_rate = 3 / 30 = 0.1).
            # Para Lente Normal:
            # - daily_rate = 0.1
            # - safety_stock = 0.1 * 5 = 0.5
            # - reorder_point = (0.1 * 7) + 0.5 = 1.2
            # - Como current_stock = 10 > 1.2, ela está NORMAL e sugerida = 0.
            # Portanto, compras sugeridas ativas = 0 no total.
            self.assertEqual(estoque.get("compras"), 0)

    async def test_endpoint_manager_dashboard(self):
        """Valida que o endpoint da API retorna a estrutura de dados correta."""
        async with self.async_session() as session:
            # Chama o endpoint de forma direta
            response = await get_manager_dashboard(db=session)
            
            self.assertIn("comercial", response)
            self.assertIn("producao", response)
            self.assertIn("estoque", response)
            
            comercial = response["comercial"]
            self.assertEqual(comercial["faturamento"], 200.0)
            self.assertEqual(comercial["ticket_medio"], 100.0)
            self.assertEqual(comercial["oticas_ativas"], 1)

            producao = response["producao"]
            self.assertEqual(producao["os_abertas"], 1)
            self.assertEqual(producao["os_concluidas"], 1)
            
            estoque = response["estoque"]
            self.assertEqual(estoque["rupturas"], 1)
            self.assertEqual(estoque["giro"], 0.3)


if __name__ == "__main__":
    unittest.main()
