import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import os
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.core.config import settings
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.nfe import NfeSaida
from backend.app.models.laboratory import Laboratory
from backend.app.crud import billing as crud_billing
from backend.app.crud import os as crud_os
from backend.app.crud import nfe as crud_nfe
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderItemCreate
from backend.app.models.financial_catalog import Product
from backend.app.services.focus_nfe_service import FocusNFeService, FocusNfeService


class TestFocusNfeIntegration(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.async_session() as session:
            self.lab = Laboratory(
                name="Nova Lab Otica Industrial",
                address="SIA Trecho 3, Lote 100, Brasilia - DF",
                cep="71200-030",
                telephone="(61) 99266-7281",
                cnpj="58.032.958/0001-44"
            )
            session.add(self.lab)

            self.store = OpticalStore(
                corporate_name="Optica Visao Real Ltda",
                trade_name="Visao Real Centro",
                cnpj="12.345.678/0001-90",
                ie="0712345600100",
                is_active=True,
                address="Quadra 102, Bloco B, Asa Sul - Brasilia / DF"
            )
            session.add(self.store)

            self.product = Product(
                name="Lente Monofocal 1.56 AR",
                sku="L-MONO-156-AR",
                cost_price=30.00,
                sale_price=180.00,
                is_active=True,
                current_version=1
            )
            session.add(self.product)
            await session.commit()

            await session.refresh(self.store)
            await session.refresh(self.product)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _create_os_and_cycle(self, amount: float = 360.00):
        async with self.async_session() as session:
            os_in = ServiceOrderCreate(
                client_name="Cliente Fiscal SEFAZ",
                optical_store_id=self.store.id
            )
            db_os = await crud_os.create_service_order(session, os_in)
            item_in = ServiceOrderItemCreate(
                entity_type="product",
                entity_id=self.product.id,
                quantity=1
            )
            item = await crud_os.add_item_to_service_order(session, db_os.id, item_in)
            item.unit_price = amount
            item.total_price = amount
            session.add(item)
            db_os.total_amount = amount
            session.add(db_os)
            await session.flush()

            # Move OS para expedicao
            await crud_os.update_os_status(session, db_os.id, OSStatus.SEPARACAO, "S")
            await crud_os.update_os_status(session, db_os.id, OSStatus.PRODUCAO, "P")
            await crud_os.update_os_status(session, db_os.id, OSStatus.EXPEDICAO, "E")

            cycle = await crud_billing.create_billing_cycle(
                session,
                optical_store_id=self.store.id,
                start_date=datetime.now(timezone.utc) - timedelta(days=7),
                end_date=datetime.now(timezone.utc),
                service_order_ids=[db_os.id],
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            return cycle.id

    async def test_build_nfe_payload_structure(self):
        """Valida que o payload JSON gerado para a Focus NFe contém todos os campos fiscais obrigatórios."""
        cycle_id = await self._create_os_and_cycle(250.00)

        async with self.async_session() as session:
            cycle = await crud_billing.get_billing_cycle(session, cycle_id)
            payload = FocusNFeService.build_nfe_payload(cycle, nfe_number=101, laboratory=self.lab)

            self.assertEqual(payload["natureza_operacao"], "PRESTACAO LABORATORIAL / VENDA DE LENTES")
            self.assertEqual(payload["tipo_documento"], 1)
            self.assertEqual(payload["finalidade_emissao"], 1)
            self.assertEqual(payload["consumidor_final"], 1)
            self.assertEqual(payload["presenca_comprador"], 9)
            self.assertEqual(payload["cnpj_emitente"], "58032958000144")
            self.assertEqual(payload["nome_destinatario"], "Optica Visao Real Ltda")
            self.assertEqual(payload["cnpj_destinatario"], "12345678000190")
            self.assertEqual(payload["indicador_inscricao_estadual_destinatario"], "1")
            self.assertEqual(payload["inscricao_estadual_destinatario"], "0712345600100")

            # Verifica itens fiscais
            self.assertTrue(len(payload["items"]) >= 1)
            first_item = payload["items"][0]
            self.assertEqual(first_item["codigo_ncm"], "90015000")
            self.assertEqual(first_item["cfop"], "5102")  # Ambos no DF
            self.assertEqual(first_item["icms_situacao_tributaria"], "102")
            self.assertEqual(first_item["pis_situacao_tributaria"], "07")
            self.assertEqual(first_item["cofins_situacao_tributaria"], "07")
            self.assertEqual(first_item["valor_bruto"], 250.00)

            # Verifica pagamento
            self.assertEqual(len(payload["formas_pagamento"]), 1)
            self.assertEqual(payload["formas_pagamento"][0]["valor_pagamento"], 250.00)

    async def test_fallback_simulation_mode_when_token_none(self):
        """Valida que o sistema opera perfeitamente em modo simulação local quando FOCUS_NFE_TOKEN é nulo."""
        cycle_id = await self._create_os_and_cycle(400.00)

        with patch.object(settings, "FOCUS_NFE_TOKEN", None):
            async with self.async_session() as session:
                nfe = await crud_nfe.create_nfe_saida(session, cycle_id)
                self.assertIsNotNone(nfe.id)
                self.assertEqual(nfe.status, "EMITIDA")
                self.assertIn("modo simulação", nfe.mensagem_sefaz.lower())
                self.assertEqual(len(nfe.chave_acesso), 44)
                self.assertTrue(nfe.xml_content.startswith("<?xml"))

    async def test_emit_nfe_authorized_synchronously(self):
        """Valida a emissão integrada quando a Focus NFe autoriza a nota de forma síncrona."""
        cycle_id = await self._create_os_and_cycle(520.00)

        mock_response = {
            "status": "autorizado",
            "chave_nfe": "35260958032958000144550010000001011876543210",
            "protocolo": "135260000123456",
            "caminho_danfe": "https://homologacao.focusnfe.com.br/arquivos/danfe_101.pdf",
            "caminho_xml_nota_fiscal": "https://homologacao.focusnfe.com.br/arquivos/nfe_101.xml",
            "mensagem_sefaz": "Autorizado o uso da NF-e"
        }

        with patch.object(settings, "FOCUS_NFE_TOKEN", "fake_test_token_123"):
            with patch.object(FocusNfeService, "emit_nfe", new_callable=AsyncMock) as mock_emit:
                mock_emit.return_value = mock_response

                async with self.async_session() as session:
                    nfe = await crud_nfe.create_nfe_saida(session, cycle_id)
                    self.assertEqual(nfe.status, "AUTORIZADA")
                    self.assertEqual(nfe.chave_acesso, "35260958032958000144550010000001011876543210")
                    self.assertEqual(nfe.protocolo, "135260000123456")
                    self.assertEqual(nfe.danfe_url, "https://homologacao.focusnfe.com.br/arquivos/danfe_101.pdf")
                    self.assertEqual(nfe.xml_url, "https://homologacao.focusnfe.com.br/arquivos/nfe_101.xml")
                    self.assertEqual(nfe.mensagem_sefaz, "Autorizado o uso da NF-e")
                    self.assertTrue(nfe.focus_ref.startswith("CICLO-"))

    async def test_emit_nfe_async_processing_and_sync(self):
        """Valida o ciclo assíncrono: emissão com retorno PROCESSANDO na SEFAZ e sincronização posterior para AUTORIZADA."""
        cycle_id = await self._create_os_and_cycle(300.00)

        initial_response = {
            "status": "processando_autorizacao",
            "mensagem_sefaz": "Nota recebida. Aguardando processamento na SEFAZ."
        }

        updated_response = {
            "status": "autorizado",
            "chave_nfe": "35260958032958000144550010000001021876543211",
            "protocolo": "135260000987654",
            "caminho_danfe": "https://homologacao.focusnfe.com.br/arquivos/danfe_102.pdf",
            "caminho_xml_nota_fiscal": "https://homologacao.focusnfe.com.br/arquivos/nfe_102.xml",
            "mensagem_sefaz": "Autorizado o uso da NF-e"
        }

        with patch.object(settings, "FOCUS_NFE_TOKEN", "fake_test_token_123"):
            # 1. Emissão assíncrona
            with patch.object(FocusNfeService, "emit_nfe", new_callable=AsyncMock) as mock_emit:
                mock_emit.return_value = initial_response

                async with self.async_session() as session:
                    nfe = await crud_nfe.create_nfe_saida(session, cycle_id)
                    self.assertEqual(nfe.status, "PROCESSANDO")

            # 2. Sincronização após autorização
            with patch.object(FocusNfeService, "get_nfe", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = updated_response

                async with self.async_session() as session:
                    nfe_synced = await crud_nfe.sync_nfe_saida(session, cycle_id)
                    self.assertEqual(nfe_synced.status, "AUTORIZADA")
                    self.assertEqual(nfe_synced.chave_acesso, "35260958032958000144550010000001021876543211")
                    self.assertEqual(nfe_synced.protocolo, "135260000987654")

    async def test_emit_nfe_rejected_by_sefaz(self):
        """Valida que notas rejeitadas pela SEFAZ são salvas como REJEITADA com a mensagem explicativa."""
        cycle_id = await self._create_os_and_cycle(200.00)

        reject_response = {
            "status": "erro_autorizacao",
            "mensagem_sefaz": "Rejeicao: IE do destinatario nao vinculada ao CNPJ"
        }

        with patch.object(settings, "FOCUS_NFE_TOKEN", "fake_test_token_123"):
            with patch.object(FocusNfeService, "emit_nfe", new_callable=AsyncMock) as mock_emit:
                mock_emit.return_value = reject_response

                async with self.async_session() as session:
                    nfe = await crud_nfe.create_nfe_saida(session, cycle_id)
                    self.assertEqual(nfe.status, "REJEITADA")
                    self.assertIn("IE do destinatario", nfe.mensagem_sefaz)

    async def test_cancel_nfe_via_focus(self):
        """Valida o cancelamento de nota perante a SEFAZ via Focus NFe."""
        cycle_id = await self._create_os_and_cycle(750.00)

        emit_response = {
            "status": "autorizado",
            "chave_nfe": "35260958032958000144550010000001031876543212",
            "protocolo": "135260000555555",
            "mensagem_sefaz": "Autorizado o uso da NF-e"
        }

        with patch.object(settings, "FOCUS_NFE_TOKEN", "fake_test_token_123"):
            with patch.object(FocusNfeService, "emit_nfe", new_callable=AsyncMock) as mock_emit:
                mock_emit.return_value = emit_response
                async with self.async_session() as session:
                    await crud_nfe.create_nfe_saida(session, cycle_id)

            with patch.object(FocusNfeService, "cancel_nfe", new_callable=AsyncMock) as mock_cancel:
                mock_cancel.return_value = {"status": "cancelado", "mensagem_sefaz": "Cancelamento homologado"}

                async with self.async_session() as session:
                    cancelled = await crud_nfe.cancel_nfe_saida(
                        session, cycle_id, justification="Cancelamento por divergencia de pedido comercial"
                    )
                    self.assertEqual(cancelled.status, "CANCELADA")
                    self.assertIn("Cancelamento", cancelled.mensagem_sefaz)
                    mock_cancel.assert_called_once()

    async def test_check_connection_endpoint(self):
        """Valida o diagnóstico de conexão da Focus NFe nos modos simulação e configurado."""
        # Sem token
        with patch.object(settings, "FOCUS_NFE_TOKEN", None):
            status = await FocusNFeService.check_connection()
            self.assertEqual(status["status"], "simulation_mode")
            self.assertFalse(status["configured"])

        # Com token (mock de resposta bem-sucedida da Focus NFe)
        with patch.object(settings, "FOCUS_NFE_TOKEN", "token_valido_xyz"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                mock_res = MagicMock()
                mock_res.status_code = 200
                mock_get.return_value = mock_res

                status = await FocusNFeService.check_connection()
                self.assertEqual(status["status"], "online")
                self.assertTrue(status["configured"])


if __name__ == "__main__":
    unittest.main()
