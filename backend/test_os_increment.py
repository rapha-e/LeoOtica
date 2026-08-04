import unittest
import sys
import os
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Adiciona o path do projeto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.optical_store import OpticalStore
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderUpdate, OSCancelRequest
from backend.app.crud import os as crud_os
from backend.app.crud import movement as crud_movement
from backend.app.schemas.movement import StockMovementCreate

class TestOSIncrement(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        # Banco de dados em memória SQLite
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)
        
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with self.async_session() as session:
            # 1. Cria Ótica Comercial
            self.store = OpticalStore(
                corporate_name="Otica Rio Ltda",
                trade_name="Otica Rio",
                cnpj="11.222.333/0001-44",
                is_active=True
            )
            session.add(self.store)
            
            # 2. Cria Modelo de Lente e Grade no Estoque
            self.lens_model = LensModel(
                brand="Essilor",
                material="Resina",
                refractive_index=Decimal("1.56"),
                treatment="Antirreflexo",
                diameter=70,
                cost_price=Decimal("30.00")
            )
            session.add(self.lens_model)
            await session.flush()
            
            # Olho Direito (-2.50 Esf / -1.00 Cil) e Olho Esquerdo (-3.00 Esf / -0.75 Cil)
            self.grade_od = LensInventoryGrade(
                lens_model_id=self.lens_model.id,
                spherical=Decimal("-2.50"),
                cylindrical=Decimal("-1.00"),
                barcode="OD-BARCODE-123",
                quantity_available=10,
                location_tag="Gaveta A1"
            )
            self.grade_oe = LensInventoryGrade(
                lens_model_id=self.lens_model.id,
                spherical=Decimal("-3.00"),
                cylindrical=Decimal("-0.75"),
                barcode="OE-BARCODE-123",
                quantity_available=10,
                location_tag="Gaveta A2"
            )
            
            # Cria também a lente de transposição para testar alteração
            # Se a OS original for alterada e transposta
            self.grade_transposta = LensInventoryGrade(
                lens_model_id=self.lens_model.id,
                spherical=Decimal("-1.50"), # -2.50 + 1.00 = -1.50
                cylindrical=Decimal("-1.00"),
                barcode="TRANS-BARCODE-123",
                quantity_available=5,
                location_tag="Gaveta B1"
            )
            
            session.add(self.grade_od)
            session.add(self.grade_oe)
            session.add(self.grade_transposta)
            
            await session.commit()
            await session.refresh(self.store)
            await session.refresh(self.lens_model)
            await session.refresh(self.grade_od)
            await session.refresh(self.grade_oe)
            await session.refresh(self.grade_transposta)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_create_service_order_with_automatic_allocation(self):
        """Valida que a OS é criada e as lentes são alocadas automaticamente se dados de armação/lente estiverem presentes."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="Maria Oliveira",
                optical_store_id=self.store.id,
                od_spherical=Decimal("-2.50"),
                od_cylindrical=Decimal("-1.00"),
                od_axis=90,
                od_dnp=Decimal("32.00"),
                oe_spherical=Decimal("-3.00"),
                oe_cylindrical=Decimal("-0.75"),
                oe_axis=85,
                oe_dnp=Decimal("32.50"),
                frame_a=Decimal("50.00"),
                frame_bridge=Decimal("18.00"),
                frame_ed=Decimal("54.00"),
                lens_model_id=self.lens_model.id,
                clinical_notes="Paciente reclama de sensibilidade a luz"
            )
            
            os_obj = await crud_os.create_service_order(session, os_in)
            self.assertIsNotNone(os_obj)
            self.assertEqual(os_obj.client_name, "Maria Oliveira")
            self.assertEqual(os_obj.status, OSStatus.SEPARACAO) # Avança para Separação porque a alocação foi bem-sucedida
            self.assertEqual(os_obj.od_lens_inventory_id, self.grade_od.id)
            self.assertEqual(os_obj.oe_lens_inventory_id, self.grade_oe.id)
            self.assertEqual(os_obj.clinical_notes, "Paciente reclama de sensibilidade a luz")
            self.assertIsNotNone(os_obj.clinical_embedding)
            
            # Verifica se debitou o estoque
            res_od = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_od.id))
            od_grade_db = res_od.scalar_one()
            self.assertEqual(od_grade_db.quantity_available, 9)

    async def test_update_service_order_state_machine_blocks(self):
        """Valida que o sistema impede a alteração de graus técnicos se a OS estiver em produção."""
        async with self.async_session() as session:
            # Cria OS em Recebida
            os_in = ServiceOrderCreate(
                client_name="João Souza",
                optical_store_id=self.store.id,
                od_spherical=Decimal("-2.50"),
                od_cylindrical=Decimal("-1.00")
            )
            os_obj = await crud_os.create_service_order(session, os_in)
            
            # Força o status para PRODUCAO
            os_obj.status = OSStatus.PRODUCAO
            await session.commit()
            
            # Tenta editar a OS
            obj_update = ServiceOrderUpdate(
                od_spherical=Decimal("-4.00")
            )
            with self.assertRaises(ValueError) as ctx:
                await crud_os.update_service_order(session, os_obj.id, obj_update)
            self.assertIn("Não é permitido alterar dados técnicos", str(ctx.exception))

    async def test_update_service_order_recalculates_and_reallocates(self):
        """Valida que ao alterar graus em status RECEBIDA, o estoque é estornado e recalculado."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="João Souza",
                optical_store_id=self.store.id,
                od_spherical=Decimal("-2.50"),
                od_cylindrical=Decimal("-1.00"),
                od_axis=90,
                od_dnp=Decimal("32.00"),
                oe_spherical=Decimal("-3.00"),
                oe_cylindrical=Decimal("-0.75"),
                oe_axis=85,
                oe_dnp=Decimal("32.50"),
                frame_a=Decimal("50.00"),
                frame_bridge=Decimal("18.00"),
                frame_ed=Decimal("54.00"),
                lens_model_id=self.lens_model.id
            )
            os_obj = await crud_os.create_service_order(session, os_in)
            self.assertEqual(os_obj.od_lens_inventory_id, self.grade_od.id)
            
            # Saldo do estoque da OD deve ser 9
            res_od = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_od.id))
            self.assertEqual(res_od.scalar_one().quantity_available, 9)
            
            # Edita a OS com graus que forçam transposição (OD: Grau -2.50 esferico / +1.00 cilindro -> transporá para -1.50 / -1.00)
            obj_update = ServiceOrderUpdate(
                od_spherical=Decimal("-2.50"),
                od_cylindrical=Decimal("1.00"), # Cilindro Positivo forçando transposição
                od_axis=90
            )
            
            updated_os = await crud_os.update_service_order(session, os_obj.id, obj_update)
            
            # Deve ter estornado a lente grade_od (+1) voltando para 10
            res_od_after = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_od.id))
            self.assertEqual(res_od_after.scalar_one().quantity_available, 10)
            
            # Deve ter alocado a lente grade_transposta (-1) caindo de 5 para 4
            self.assertEqual(updated_os.od_lens_inventory_id, self.grade_transposta.id)
            res_trans = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_transposta.id))
            self.assertEqual(res_trans.scalar_one().quantity_available, 4)

    async def test_soft_delete_and_inventory_restoration(self):
        """Valida que a exclusão lógica (Soft Delete) libera as lentes e salva a justificativa."""
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="Pedro Santos",
                optical_store_id=self.store.id,
                od_spherical=Decimal("-2.50"),
                od_cylindrical=Decimal("-1.00"),
                od_axis=90,
                od_dnp=Decimal("32.00"),
                oe_spherical=Decimal("-3.00"),
                oe_cylindrical=Decimal("-0.75"),
                oe_axis=85,
                oe_dnp=Decimal("32.50"),
                frame_a=Decimal("50.00"),
                frame_bridge=Decimal("18.00"),
                frame_ed=Decimal("54.00"),
                lens_model_id=self.lens_model.id
            )
            os_obj = await crud_os.create_service_order(session, os_in)
            self.assertEqual(os_obj.status, OSStatus.SEPARACAO)
            
            # Estoque após alocação
            res_od = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_od.id))
            self.assertEqual(res_od.scalar_one().quantity_available, 9)
            
            # Executa o Soft Delete
            deleted_os = await crud_os.soft_delete_service_order(
                session, os_obj.id, cancellation_reason="Erro de digitação do operador"
            )
            
            self.assertEqual(deleted_os.status, OSStatus.CANCELADA)
            self.assertEqual(deleted_os.cancellation_reason, "Erro de digitação do operador")
            self.assertIsNone(deleted_os.od_lens_inventory_id)
            self.assertIsNone(deleted_os.oe_lens_inventory_id)
            
            # Valida estorno de estoque (+1)
            res_od_restored = await session.execute(select(LensInventoryGrade).where(LensInventoryGrade.id == self.grade_od.id))
            self.assertEqual(res_od_restored.scalar_one().quantity_available, 10)

    async def test_search_advanced_and_semantic(self):
        """Valida as buscas por filtros estruturados e busca semântica em observações."""
        async with self.async_session() as session:
            os1 = ServiceOrderCreate(
                client_name="Clara Luz",
                optical_store_id=self.store.id,
                clinical_notes="Paciente com alta miopia e sensibilidade forte à luz do sol"
            )
            os2 = ServiceOrderCreate(
                client_name="Bruno Silveira",
                optical_store_id=self.store.id,
                clinical_notes="Hipermetropia leve sem queixas adicionais"
            )
            await crud_os.create_service_order(session, os1)
            await crud_os.create_service_order(session, os2)
            
            # 1. Busca por nome do paciente
            results = await crud_os.get_service_orders(session, query_str="clara")
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].client_name, "Clara Luz")
            
            # 2. Busca semântica por proximidade de texto clínico
            results_sem = await crud_os.get_service_orders(session, semantic_query="sensibilidade ao sol e fotofobia")
            self.assertTrue(len(results_sem) >= 1)
            # Como mockamos o embedding em ambiente de teste com o mesmo vetor, no SQLite
            # a ordenação respeitará a lista. No entanto, em ambiente real, o primeiro resultado
            # será mais próximo semanticamente. No SQLite em teste, o mock retorna vetor zerado.

if __name__ == "__main__":
    unittest.main()
