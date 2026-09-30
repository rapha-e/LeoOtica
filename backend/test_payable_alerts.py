import unittest
import sys
import os
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.app.core.database import Base
from backend.app.models.financial_corp import AccountsPayable, FinancialCategory, CostCenter
from backend.app.crud import crud_financial_corp

class TestPayableAlerts(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)
        self.db = self.session_factory()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def test_payable_alerts_full_lifecycle(self):
        now = datetime.now(timezone.utc)
        
        # 1. Cria conta a pagar que vence em 2 dias (alerta de 3 dias antes => DEVE DISPARAR)
        due_in_2_days = now + timedelta(days=2)
        payable_data_active = {
            "description": "Fornecedor de Lentes Resina 1.56",
            "supplier_name": "OptiSupplier Brasil",
            "amount": 1500.00,
            "due_date": due_in_2_days,
            "alert_enabled": True,
            "alert_days_before": 3
        }
        p1 = await crud_financial_corp.create_account_payable(self.db, payable_data_active)
        self.assertIsNotNone(p1.id)
        self.assertTrue(p1.alert_enabled)
        self.assertFalse(p1.alert_dismissed)
        self.assertEqual(p1.alert_days_before, 3)
        self.assertIsNone(p1.dismissed_at)

        # 2. Cria conta a pagar que vence em 10 dias (alerta de 3 dias antes => NÃO DEVE DISPARAR AINDA)
        due_in_10_days = now + timedelta(days=10)
        payable_data_future = {
            "description": "Manutenção Preventiva Gerador Freeform",
            "supplier_name": "Satisloh Tech",
            "amount": 3200.00,
            "due_date": due_in_10_days,
            "alert_enabled": True,
            "alert_days_before": 3
        }
        p2 = await crud_financial_corp.create_account_payable(self.db, payable_data_future)

        # 3. Cria conta a pagar já vencida há 1 dia (DEVE DISPARAR)
        due_yesterday = now - timedelta(days=1)
        payable_data_overdue = {
            "description": "Conta de Energia Elétrica Fabril",
            "supplier_name": "Neoenergia",
            "amount": 2400.00,
            "due_date": due_yesterday,
            "alert_enabled": True,
            "alert_days_before": 3
        }
        p3 = await crud_financial_corp.create_account_payable(self.db, payable_data_overdue)

        # 4. Verifica listagem com cálculo de status dos alertas
        payables_list = await crud_financial_corp.get_accounts_payable(self.db)
        self.assertEqual(len(payables_list), 3)

        p1_info = next(p for p in payables_list if p["id"] == p1.id)
        self.assertTrue(p1_info["is_alert_active"])
        self.assertIn("VENCE EM", p1_info["alert_status_text"])

        p2_info = next(p for p in payables_list if p["id"] == p2.id)
        self.assertFalse(p2_info["is_alert_active"])  # Vence em 10 dias, fora da janela de 3 dias

        p3_info = next(p for p in payables_list if p["id"] == p3.id)
        self.assertTrue(p3_info["is_alert_active"])
        self.assertIn("VENCIDO", p3_info["alert_status_text"])

        # 5. Obtém apenas alertas ativos
        active_alerts = await crud_financial_corp.get_active_payable_alerts(self.db)
        active_ids = [a["id"] for a in active_alerts]
        self.assertIn(p1.id, active_ids)
        self.assertIn(p3.id, active_ids)
        self.assertNotIn(p2.id, active_ids)

        # 6. Operador dispensa o alerta de p1 ("Não alertar mais")
        dismissed_p1 = await crud_financial_corp.dismiss_payable_alert(self.db, p1.id)
        self.assertTrue(dismissed_p1.alert_dismissed)
        self.assertIsNotNone(dismissed_p1.dismissed_at)

        # Verifica que p1 não está mais entre os alertas ativos
        active_alerts_after_dismiss = await crud_financial_corp.get_active_payable_alerts(self.db)
        active_ids_after_dismiss = [a["id"] for a in active_alerts_after_dismiss]
        self.assertNotIn(p1.id, active_ids_after_dismiss)
        self.assertIn(p3.id, active_ids_after_dismiss)

        payables_after_dismiss = await crud_financial_corp.get_accounts_payable(self.db)
        p1_after = next(p for p in payables_after_dismiss if p["id"] == p1.id)
        self.assertEqual(p1_after["alert_status_text"], "SILENCIADO")
        self.assertTrue(p1_after["alert_dismissed"])
        self.assertFalse(p1_after["is_alert_active"])

        # 7. Operador reativa o alerta de p1
        reactivated_p1 = await crud_financial_corp.reactivate_payable_alert(self.db, p1.id)
        self.assertFalse(reactivated_p1.alert_dismissed)
        self.assertTrue(reactivated_p1.alert_enabled)
        self.assertIsNone(reactivated_p1.dismissed_at)

        active_alerts_after_reactivate = await crud_financial_corp.get_active_payable_alerts(self.db)
        active_ids_after_reactivate = [a["id"] for a in active_alerts_after_reactivate]
        self.assertIn(p1.id, active_ids_after_reactivate)

        # 8. Efetua o pagamento total de p3
        paid_p3 = await crud_financial_corp.pay_account_payable(self.db, p3.id, 2400.00)
        self.assertEqual(paid_p3.status, "PAGO")

        # Verifica que p3, por estar pago, não é mais um alerta ativo
        active_alerts_final = await crud_financial_corp.get_active_payable_alerts(self.db)
        final_active_ids = [a["id"] for a in active_alerts_final]
        self.assertNotIn(p3.id, final_active_ids)
