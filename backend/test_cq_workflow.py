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
from backend.app.models.os import ServiceOrder, OSStatus, OSCQInspection
from backend.app.models.user import User, Role
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.crud import os as crud_os
from backend.app.schemas.os import ServiceOrderCreate, AllocateRequest, CQInspectionCreate


class TestCQWorkflowAndInspections(unittest.IsolatedAsyncioTestCase):

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
                email="operator_cq@leootica.com.br",
                hashed_password="hashed_password",
                name="Inspetor Qualidade",
                role=role_operador,
                is_active=True
            )
            session.add(self.operator)

            # 2. Cadastra modelo de lente e item de estoque para teste de perda
            self.model = LensModel(
                brand="Essilor Test CQ",
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
                barcode="987654321",
                quantity_available=10,
                location_tag="CQ-GAVETA"
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

    async def _setup_os_in_cq_state(self, session) -> uuid.UUID:
        """Helper para criar uma OS, alocar lentes e avançar até o status CQ."""
        os_in = ServiceOrderCreate(
            client_name="Nelson Sargento",
            od_spherical=Decimal("-2.00"),
            od_cylindrical=Decimal("-1.00"),
            oe_spherical=Decimal("-2.00"),
            oe_cylindrical=Decimal("-1.00")
        )
        db_os = await crud_os.create_service_order(session, os_in)
        os_id = db_os.id

        # Aloca lentes (transiciona para Separação)
        alloc_payload = AllocateRequest(
            frame_a=Decimal("52"),
            frame_bridge=Decimal("18"),
            frame_ed=Decimal("54"),
            lens_model_id=self.model.id,
            od_dnp=Decimal("32.0"),
            oe_dnp=Decimal("32.0")
        )
        await crud_os.allocate_lenses_for_os(session, os_id, alloc_payload)

        # Transiciona para CQ
        await crud_os.update_os_status(session, os_id, OSStatus.CQ, "Enviando direto para teste de CQ.", operator_id=self.operator.id, sector="Facetamento")
        return os_id

    async def test_cq_inspection_denied_in_other_status(self):
        """Valida que o sistema impede inspeções em OSs que não estejam na bancada CQ."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(client_name="Adoniran Barbosa")
            db_os = await crud_os.create_service_order(session, os_in)
            os_id = db_os.id

            # A OS está em 'Recebida'
            cq_in = CQInspectionCreate(
                check_grau=True,
                check_eixo=True,
                check_prisma=True,
                check_acabamento=True,
                result="APROVADO",
                notes="Inspeção prematura"
            )
            
            with self.assertRaises(ValueError) as context:
                await crud_os.create_cq_inspection(session, os_id, self.operator.id, cq_in)
            self.assertIn("Apenas Ordens de Serviço na bancada de CQ", str(context.exception))

    async def test_cq_approved_advances_status(self):
        """Valida a aprovação de CQ com checklist completo, mudando status para Expedição."""
        async with self.async_session() as session:
            os_id = await self._setup_os_in_cq_state(session)

            cq_in = CQInspectionCreate(
                check_grau=True,
                check_eixo=True,
                check_prisma=True,
                check_acabamento=True,
                result="APROVADO",
                notes="Montagem perfeita, sem riscos."
            )
            cq_obj, os_loaded = await crud_os.create_cq_inspection(session, os_id, self.operator.id, cq_in)

            # Valida gravação da inspeção
            self.assertEqual(cq_obj.result, "APROVADO")
            self.assertTrue(cq_obj.check_grau)
            self.assertTrue(cq_obj.check_eixo)
            self.assertTrue(cq_obj.check_prisma)
            self.assertTrue(cq_obj.check_acabamento)
            self.assertEqual(cq_obj.operator_id, self.operator.id)

            # Valida avanço da OS
            self.assertEqual(os_loaded.status, OSStatus.EXPEDICAO)

            # Valida histórico de workflow
            history = os_loaded.workflow_history
            last_event = history[-1]
            self.assertEqual(last_event.new_status, OSStatus.EXPEDICAO)
            self.assertEqual(last_event.sector, "Controle de Qualidade")
            self.assertIn("Aprovada no CQ", last_event.operator_notes)

    async def test_cq_rework_returns_status(self):
        """Valida que o retrabalho de CQ exige justificativa e devolve a OS para Montagem ou Produção."""
        async with self.async_session() as session:
            os_id = await self._setup_os_in_cq_state(session)

            # 1. Sem notas (deve falhar)
            cq_in_error = CQInspectionCreate(
                check_grau=False,
                check_eixo=True,
                check_prisma=True,
                check_acabamento=True,
                result="RETRABALHO",
                rework_destination="Montagem",
                notes=""
            )
            with self.assertRaises(ValueError) as context:
                await crud_os.create_cq_inspection(session, os_id, self.operator.id, cq_in_error)
            self.assertIn("Justificativa obrigatória", str(context.exception))

            # 2. Com notas para Montagem (sucesso)
            cq_in_montagem = CQInspectionCreate(
                check_grau=False,
                check_eixo=True,
                check_prisma=True,
                check_acabamento=True,
                result="RETRABALHO",
                rework_destination="Montagem",
                notes="Eixo está fora do tolerado em 5 graus."
            )
            cq_obj, os_loaded = await crud_os.create_cq_inspection(session, os_id, self.operator.id, cq_in_montagem)

            self.assertEqual(os_loaded.status, OSStatus.MONTAGEM)
            self.assertIsNotNone(os_loaded.od_lens_inventory_id) # Mantém as lentes
            
            # Valida histórico de retrabalho
            last_event = os_loaded.workflow_history[-1]
            self.assertEqual(last_event.new_status, OSStatus.MONTAGEM)
            self.assertIn("Retrabalho enviado para Montagem", last_event.operator_notes)
            self.assertIn("Grau: Falhou", last_event.operator_notes)

    async def test_cq_reproved_discards_lenses(self):
        """Valida que a reprovação de CQ exige justificativa, descarta as lentes alocadas e volta a OS para Recebida."""
        async with self.async_session() as session:
            os_id = await self._setup_os_in_cq_state(session)

            # Valida que as lentes estão alocadas inicialmente
            os_before = await crud_os.get_service_order(session, os_id)
            self.assertIsNotNone(os_before.od_lens_inventory_id)

            cq_in = CQInspectionCreate(
                check_grau=True,
                check_eixo=True,
                check_prisma=True,
                check_acabamento=False,
                result="REPROVADO",
                notes="Lente riscou profundamente durante o polimento final de acabamento."
            )
            cq_obj, os_loaded = await crud_os.create_cq_inspection(session, os_id, self.operator.id, cq_in)

            # Valida retorno do status
            self.assertEqual(os_loaded.status, OSStatus.RECEBIDA)
            
            # Valida desalocação/inutilização das lentes
            self.assertIsNone(os_loaded.od_lens_inventory_id)
            self.assertIsNone(os_loaded.oe_lens_inventory_id)

            # Valida histórico
            last_event = os_loaded.workflow_history[-1]
            self.assertEqual(last_event.new_status, OSStatus.RECEBIDA)
            self.assertIn("Reprovada no CQ. Lentes descartadas", last_event.operator_notes)
            # Custo da perda de 2 lentes (R$ 45,00 cada = R$ 90,00)
            self.assertIn("Perda de Custo: R$ 90.00", last_event.operator_notes)
            self.assertIn("Acabamento: Falhou", last_event.operator_notes)


if __name__ == "__main__":
    unittest.main()
