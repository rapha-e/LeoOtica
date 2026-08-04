import unittest
import sys
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from xml.etree import ElementTree

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.nfe import NfeSaida
from backend.app.crud import billing as crud_billing
from backend.app.crud import os as crud_os
from backend.app.crud import nfe as crud_nfe
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate
from backend.app.models.financial_catalog import Product
from backend.app.services.nfe_emitter import generate_access_key, generate_nfe_xml, generate_danfe_pdf

class TestNfeIntegration(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            self.store = OpticalStore(
                corporate_name="Optica Fiscal Ltda",
                trade_name="Leo Otica Fiscal",
                cnpj="12.345.678/0001-99",
                is_active=True,
                address="Av. Paulista, 1000 - Bela Vista"
            )
            session.add(self.store)
            
            self.product = Product(
                name="Lente Teste Fiscal",
                sku="L-TEST-FISCAL",
                cost_price=20.00,
                sale_price=250.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            await session.commit()
            
            await session.refresh(self.store)
            await session.refresh(self.product)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _create_os(self, session, amount):
        os_in = ServiceOrderCreate(
            client_name="Paciente Fiscal",
            optical_store_id=self.store.id
        )
        db_os = await crud_os.create_service_order(session, os_in)
        item_in = ServiceOrderItemCreate(
            entity_type="product",
            entity_id=self.product.id,
            quantity=1
        )
        item = await crud_os.add_item_to_service_order(session, db_os.id, item_in)
        
        # Força valor comercial
        item.unit_price = amount
        item.total_price = amount
        session.add(item)
        db_os.total_amount = amount
        session.add(db_os)
        await session.flush()
        
        # Move a OS ao longo do workflow até a Expedição
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "S")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "P")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.MONTAGEM, "M")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.CQ, "Q")
        db_os = await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "E")
        return db_os

    def test_generate_access_key_checksum(self):
        """Valida que a geração de chave de acesso de 44 dígitos calcula o DV corretamente."""
        uf = 35
        cnpj = "00.123.456/0001-99"
        model = 55
        serie = 1
        nfe_number = 432
        
        key = generate_access_key(uf, cnpj, model, serie, nfe_number)
        
        # Verifica tamanho de 44 caracteres
        self.assertEqual(len(key), 44)
        self.assertTrue(key.isdigit())
        
        # Verifica UF e Modelo inseridos na chave
        self.assertEqual(key[:2], "35")
        self.assertEqual(key[20:22], "55")
        
        # Verifica número sequencial preenchido com zeros à esquerda
        self.assertEqual(key[25:34], "000000432")

    async def test_emit_and_cancel_nfe_flow(self):
        """Testa o fluxo completo de emissão, geração de XML, DANFE e cancelamento da NF-e com sessões isoladas."""
        # 1. Cria a OS e o ciclo de faturamento
        async with self.async_session() as session:
            os_item = await self._create_os(session, 450.00)
            cycle = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.utcnow() - timedelta(days=5),
                end_date=datetime.utcnow(),
                service_order_ids=[os_item.id],
                due_date=datetime.utcnow() + timedelta(days=10)
            )
            cycle_id = cycle.id
            
        # 2. Emite a Nota Fiscal para o ciclo
        async with self.async_session() as session:
            nfe = await crud_nfe.create_nfe_saida(session, cycle_id)
            
            self.assertIsNotNone(nfe.id)
            self.assertEqual(nfe.nfe_number, 1)
            self.assertEqual(nfe.status, "EMITIDA")
            self.assertEqual(len(nfe.chave_acesso), 44)
            self.assertIn("<?xml", nfe.xml_content)
            
            # Valida a estrutura XML gerada
            xml_tree = ElementTree.fromstring(nfe.xml_content)
            self.assertTrue(xml_tree.tag.endswith("NFe"))
            infNFe = xml_tree.find("{http://www.portalfiscal.inf.br/nfe}infNFe")
            self.assertIsNotNone(infNFe)
            
            ide = infNFe.find("{http://www.portalfiscal.inf.br/nfe}ide")
            self.assertEqual(ide.find("{http://www.portalfiscal.inf.br/nfe}nNF").text, "1")
            
            emit = infNFe.find("{http://www.portalfiscal.inf.br/nfe}emit")
            self.assertEqual(emit.find("{http://www.portalfiscal.inf.br/nfe}xNome").text, "NOVA LAB")
            
            dest = infNFe.find("{http://www.portalfiscal.inf.br/nfe}dest")
            self.assertEqual(dest.find("{http://www.portalfiscal.inf.br/nfe}CNPJ").text, "12345678000199")
            
            total = infNFe.find("{http://www.portalfiscal.inf.br/nfe}total")
            vProd = total.find("{http://www.portalfiscal.inf.br/nfe}ICMSTot").find("{http://www.portalfiscal.inf.br/nfe}vProd").text
            self.assertEqual(vProd, "450.00")
            
        # 3. Valida barreira de unicidade (não permitir duplicar nota)
        async with self.async_session() as session:
            with self.assertRaises(ValueError):
                await crud_nfe.create_nfe_saida(session, cycle_id)
                
        # 4. Valida relacionamento reverso no BillingCycle
        async with self.async_session() as session:
            cycle_loaded = await crud_billing.get_billing_cycle(session, cycle_id)
            self.assertIsNotNone(cycle_loaded.nfe_saida)
            self.assertEqual(cycle_loaded.nfe_saida.nfe_number, 1)
            self.assertEqual(cycle_loaded.nfe_saida.status, "EMITIDA")
            
            # Valida a geração do PDF do DANFE (bytes do ReportLab)
            danfe_pdf = generate_danfe_pdf(cycle_loaded, cycle_loaded.nfe_saida.status, cycle_loaded.nfe_saida.nfe_number, cycle_loaded.nfe_saida.chave_acesso)
            self.assertIsNotNone(danfe_pdf)
            self.assertTrue(danfe_pdf.startswith(b"%PDF"))
            
        # 5. Cancela a Nota Fiscal
        async with self.async_session() as session:
            cancelled_nfe = await crud_nfe.cancel_nfe_saida(session, cycle_id)
            self.assertEqual(cancelled_nfe.status, "CANCELADA")
            
        # 6. Valida barreira de cancelamento duplicado
        async with self.async_session() as session:
            with self.assertRaises(ValueError):
                await crud_nfe.cancel_nfe_saida(session, cycle_id)

if __name__ == "__main__":
    unittest.main()
