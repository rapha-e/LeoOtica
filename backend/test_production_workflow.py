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
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory
from backend.app.models.user import User, Role
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.crud import os as crud_os
from backend.app.schemas.os import ServiceOrderCreate, AllocateRequest


class TestProductionWorkflowAndTraceability(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            # 1. Cadastra o perfil de operador e usuário de teste (operador)
            role_operador = Role(name="Operador", description="Operador de Fábrica")
            session.add(role_operador)
            await session.flush()

            self.operator = User(
                email="operador_esteira@leootica.com.br",
                hashed_password="hashed_password",
                name="José Operador da Esteira",
                role=role_operador,
                is_active=True
            )
            session.add(self.operator)

            # 2. Cadastra modelo de lente e item de estoque para teste
            self.model = LensModel(
                brand="Essilor Test",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Antirreflexo",
                diameter=70,
                cost_price=Decimal("45.00")
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

            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.operator)
            await session.refresh(self.model)
            await session.refresh(self.lens_inventory)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_full_workflow_and_traceability(self):
        """Valida o roteamento pelas 6 colunas de Kanban e auditoria de operador/setor."""
        async with self.async_session() as session:
            # 1. Cria a Ordem de Serviço (inicia em Recebida)
            os_in = ServiceOrderCreate(
                client_name="Rita Lee",
                od_spherical=Decimal("-2.00"),
                od_cylindrical=Decimal("-1.00"),
                oe_spherical=Decimal("-2.00"),
                oe_cylindrical=Decimal("-1.00")
            )
            db_os = await crud_os.create_service_order(session, os_in)
            self.assertEqual(db_os.status, OSStatus.RECEBIDA)

            # 2. Aloca Lentes (deve transicionar para Separação)
            alloc_payload = AllocateRequest(
                frame_a=Decimal("52"),
                frame_bridge=Decimal("18"),
                frame_ed=Decimal("54"),
                lens_model_id=self.model.id,
                od_dnp=Decimal("32.0"),
                oe_dnp=Decimal("32.0")
            )
            success, message, db_os = await crud_os.allocate_lenses_for_os(session, db_os.id, alloc_payload)
            self.assertTrue(success)
            self.assertEqual(db_os.status, OSStatus.SEPARACAO)

            # 3. Transiciona para Produção (Almoxarifado -> Produção)
            db_os = await crud_os.update_os_status(
                session, 
                db_os.id, 
                OSStatus.PRODUCAO, 
                "Separação das lentes concluída no almoxarifado.",
                operator_id=self.operator.id,
                sector="Almoxarifado"
            )
            self.assertEqual(db_os.status, OSStatus.PRODUCAO)

            # 4. Transiciona para Montagem (Produção -> Montagem)
            db_os = await crud_os.update_os_status(
                session, 
                db_os.id, 
                OSStatus.MONTAGEM, 
                "Surfaçagem e blocagem finalizadas.",
                operator_id=self.operator.id,
                sector="Surfaçagem / Produção"
            )
            self.assertEqual(db_os.status, OSStatus.MONTAGEM)

            # 5. Transiciona para CQ (Montagem -> CQ)
            db_os = await crud_os.update_os_status(
                session, 
                db_os.id, 
                OSStatus.CQ, 
                "Corte e montagem no aro concluídos.",
                operator_id=self.operator.id,
                sector="Montagem / Facetamento"
            )
            self.assertEqual(db_os.status, OSStatus.CQ)

            # 6. Transiciona para Expedição (CQ -> Expedição)
            db_os = await crud_os.update_os_status(
                session, 
                db_os.id, 
                OSStatus.EXPEDICAO, 
                "OS aprovada na inspeção visual.",
                operator_id=self.operator.id,
                sector="Controle de Qualidade"
            )
            self.assertEqual(db_os.status, OSStatus.EXPEDICAO)

            # 7. Verifica Rastreabilidade no Histórico
            db_os_loaded = await crud_os.get_service_order(session, db_os.id)
            history = db_os_loaded.workflow_history
            
            # Deve haver o histórico inicial + alocação + 4 transições = 6 registros
            self.assertEqual(len(history), 6)
            
            # Verifica se os campos de operador e setor foram salvos
            # O último histórico deve ser a Expedição com o José Operador
            last_event = history[-1]
            self.assertEqual(last_event.new_status, OSStatus.EXPEDICAO)
            self.assertEqual(last_event.sector, "Controle de Qualidade")
            self.assertEqual(last_event.operator_id, self.operator.id)
            self.assertIsNotNone(last_event.operator)
            self.assertEqual(last_event.operator.name, "José Operador da Esteira")

    async def test_reprocess_in_intermediate_states(self):
        """Valida que o reprocessamento de quebra é permitido nos novos status intermediários."""
        async with self.async_session() as session:
            # Cria OS em Produção
            os_in = ServiceOrderCreate(
                client_name="Rita Lee",
                od_spherical=Decimal("-2.00"),
                od_cylindrical=Decimal("-1.00"),
                oe_spherical=Decimal("-2.00"),
                oe_cylindrical=Decimal("-1.00")
            )
            db_os = await crud_os.create_service_order(session, os_in)
            
            # Aloca lentes (vai para Separação)
            alloc_payload = AllocateRequest(
                frame_a=Decimal("52"),
                frame_bridge=Decimal("18"),
                frame_ed=Decimal("54"),
                lens_model_id=self.model.id,
                od_dnp=Decimal("32.0"),
                oe_dnp=Decimal("32.0")
            )
            await crud_os.allocate_lenses_for_os(session, db_os.id, alloc_payload)
            
            # Avança para Produção
            db_os = await crud_os.update_os_status(
                session, db_os.id, OSStatus.PRODUCAO, "Iniciado na surfaçagem."
            )
            self.assertEqual(db_os.status, OSStatus.PRODUCAO)

            # Tenta registrar quebra no estado Produção (deve aceitar)
            success, msg, db_os = await crud_os.reprocess_broken_lenses(
                session, 
                db_os.id, 
                "Riscou na geradora de curvas",
                operator_id=self.operator.id
            )
            self.assertTrue(success)
            self.assertEqual(db_os.status, OSStatus.RECEBIDA)
            self.assertIsNone(db_os.od_lens_inventory_id)
            self.assertIsNone(db_os.oe_lens_inventory_id)

            # Verifica se gerou o histórico de quebra contendo operador
            db_os = await crud_os.get_service_order(session, db_os.id)
            last_event = db_os.workflow_history[-1]
            self.assertEqual(last_event.new_status, OSStatus.RECEBIDA)
            self.assertEqual(last_event.operator_id, self.operator.id)
            self.assertEqual(last_event.sector, "Reprocessamento")


if __name__ == "__main__":
    unittest.main()
