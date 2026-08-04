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
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.crud.os import update_os_status, reprocess_broken_lenses
from backend.app.api.endpoints.factory import os_bip_bancada
from backend.app.schemas.os import BipBancadaRequest, ReprocessRequest


class TestFactoryWorkflow(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)
        
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with self.async_session() as session:
            # Cadastra modelo de lente e item de estoque para teste
            self.model = LensModel(
                brand="Essilor Test",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Antirreflexo",
                diameter=70,
                cost_price=Decimal("50.00")
            )
            session.add(self.model)
            await session.flush()
            
            self.lens_inventory = LensInventoryGrade(
                lens_model_id=self.model.id,
                spherical=Decimal("-2.00"),
                cylindrical=Decimal("-1.00"),
                barcode="123456789",
                quantity_available=10,
                location_tag="TEST-GAVETA"
            )
            session.add(self.lens_inventory)
            await session.flush()
            
            # Cadastra ordens de serviço de teste
            # 1. OS Recebida (antiga Triagem)
            self.os_triagem = ServiceOrder(
                os_number="OS-TEST-RECEBIDA",
                client_name="Paciente Recebido",
                status=OSStatus.RECEBIDA,
                od_spherical=Decimal("-2.00"),
                od_cylindrical=Decimal("-1.00"),
                oe_spherical=Decimal("-2.00"),
                oe_cylindrical=Decimal("-1.00")
            )
            session.add(self.os_triagem)
            
            # 2. OS Em Separação (com Lentes Alocadas)
            self.os_reservada = ServiceOrder(
                os_number="OS-TEST-EMPRODUCAO",
                client_name="Paciente Em Producao",
                status=OSStatus.SEPARACAO,
                od_lens_inventory_id=self.lens_inventory.id,
                oe_lens_inventory_id=self.lens_inventory.id,
                od_spherical=Decimal("-2.00"),
                od_cylindrical=Decimal("-1.00"),
                oe_spherical=Decimal("-2.00"),
                oe_cylindrical=Decimal("-1.00")
            )
            session.add(self.os_reservada)
            
            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.model)
            await session.refresh(self.lens_inventory)
            await session.refresh(self.os_triagem)
            await session.refresh(self.os_reservada)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_update_os_status_valid(self):
        """Valida que o status da OS pode ser atualizado e histórico é gravado."""
        async with self.async_session() as session:
            os_obj = await update_os_status(session, self.os_triagem.id, OSStatus.SEPARACAO, "Lentes alocadas manualmente.")
            self.assertIsNotNone(os_obj)
            self.assertEqual(os_obj.status, OSStatus.SEPARACAO)
            
            # Verifica o histórico
            query_hist = select(OSWorkflowHistory).where(OSWorkflowHistory.service_order_id == self.os_triagem.id)
            res_hist = await session.execute(query_hist)
            history = res_hist.scalars().all()
            self.assertTrue(len(history) >= 1)
            self.assertEqual(history[-1].new_status, OSStatus.SEPARACAO)

    async def test_reprocess_broken_lenses(self):
        """Valida registro de quebra de lentes em OS EM PRODUÇÃO e retorno para RECEBIDA."""
        async with self.async_session() as session:
            # Registra quebra
            success, message, os_obj = await reprocess_broken_lenses(
                session, self.os_reservada.id, "Lente riscou ao cortar"
            )
            self.assertTrue(success)
            self.assertEqual(os_obj.status, OSStatus.RECEBIDA)
            self.assertIsNone(os_obj.od_lens_inventory_id)
            self.assertIsNone(os_obj.oe_lens_inventory_id)

            # Verifica se gerou notas de perda no histórico
            query_hist = select(OSWorkflowHistory).where(OSWorkflowHistory.service_order_id == self.os_reservada.id)
            res_hist = await session.execute(query_hist)
            history = res_hist.scalars().all()
            self.assertTrue(any("Custo Perda" in (h.operator_notes or "") for h in history))

if __name__ == "__main__":
    unittest.main()
