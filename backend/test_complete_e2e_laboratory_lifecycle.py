import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.crud.movement import create_stock_movement
from backend.app.crud.crud_financial_corp import get_consolidated_dre, receive_payment, pay_account_payable
from backend.app.services.allocation import allocate_and_deduct_inventory
from backend.app.schemas.movement import StockMovementCreate


@pytest.mark.asyncio
async def test_complete_e2e_laboratory_lifecycle():
    """
    TESTE PONTA A PONTA (E2E) - CICLO COMPLETO DO LEOÓTICAS:
    1. Cadastro de Estoque Inicial com Preço de Custo Manual.
    2. Entrada adicional via Compra/XML recalculando o Custo Médio Ponderado (CMP).
    3. Consulta via Bipador e Abertura de OS com Reserva Atômica.
    4. Separação Física no Chão de Fábrica com Baixa Definitiva.
    5. Faturamento da OS para Ótica Parceira (Contas a Receber).
    6. Lançamento de Contas a Pagar (Fornecedor + Folha de Pagamento).
    7. Liquidação Financeira (Baixa de Pagamentos / Transações).
    8. Apuração do DRE Consolidado em Tempo Real (Faturamento - CMV - Folha = Lucro).
    """
    async with AsyncSessionLocal() as db:
        unique_suffix = uuid.uuid4().hex[:8]

        # =========================================================================
        # ETAPA 1: Cadastro de Modelo e Estoque Inicial com Custo Manual
        # =========================================================================
        lens_model = LensModel(
            id=uuid.uuid4(),
            brand=f"NovaLab E2E {unique_suffix}",
            material="CR-39",
            refractive_index=Decimal("1.56"),
            treatment="Anti-Reflexo",
            diameter=70,
            cost_price=Decimal("15.00"),
            average_cost_price=Decimal("15.00"),
            last_purchase_price=Decimal("15.00")
        )
        db.add(lens_model)
        await db.flush()

        test_barcode = f"E2E{unique_suffix}"
        grade_item = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=lens_model.id,
            barcode=test_barcode,
            spherical=Decimal("-2.00"),
            cylindrical=Decimal("-0.50"),
            location_tag="Gaveta-E2E-01",
            quantity_available=10,
            quantity_reserved=0,
            average_cost_price=Decimal("15.00"),
            last_purchase_price=Decimal("15.00")
        )
        db.add(grade_item)
        await db.flush()

        assert grade_item.quantity_available == 10
        assert grade_item.average_cost_price == Decimal("15.00")

        # =========================================================================
        # ETAPA 2: Entrada Adicional (XML) e Recálculo de CMP
        # 10 un a R$ 15,00 + 10 un a R$ 25,00 = 20 un com CMP de R$ 20,00
        # =========================================================================
        movement_in = StockMovementCreate(
            lens_inventory_id=grade_item.id,
            movement_type="IN",
            quantity=10,
            reason="Entrada XML NF-e Fornecedor E2E"
        )
        await create_stock_movement(db, movement_in, unit_cost=25.00)
        await db.refresh(grade_item)

        assert grade_item.quantity_available == 20
        assert float(grade_item.average_cost_price) == 20.00
        assert float(grade_item.last_purchase_price) == 25.00

        # =========================================================================
        # ETAPA 3: Abertura de OS com Busca por Bipador e Reserva Atômica
        # =========================================================================
        partner_otica = OpticalStore(
            id=uuid.uuid4(),
            trade_name=f"Ótica Visão Futura {unique_suffix}",
            corporate_name="Ótica Visão LTDA",
            cnpj=f"{uuid.uuid4().int % 100000000000000:014d}",
            credit_limit=Decimal("5000.00"),
            is_active=True
        )
        db.add(partner_otica)
        await db.flush()

        os_record = ServiceOrder(
            id=uuid.uuid4(),
            optical_store_id=partner_otica.id,
            os_number=f"OS-E2E-{unique_suffix}",
            tray_number=f"B-{unique_suffix[:4]}",
            status=OSStatus.RECEBIDA,
            total_amount=Decimal("120.00"),  # Faturamento cobrado da ótica
            created_at=datetime.now(timezone.utc)
        )
        db.add(os_record)
        await db.flush()

        # Alocação/Reserva Atômica da Lente OD
        alloc_res = await allocate_and_deduct_inventory(
            db=db,
            os_id=os_record.id,
            lens_model_id=lens_model.id,
            rx_data={
                "OD": {"spherical": -2.00, "cylindrical": -0.50}
            }
        )
        assert alloc_res["status"] == "SUCCESS"
        await db.refresh(grade_item)

        # Saldo físico continua 20, mas agora 1 está reservada (Saldo livre = 19)
        assert grade_item.quantity_available == 20
        assert grade_item.reserved_quantity == 1
        assert (grade_item.quantity_available - grade_item.reserved_quantity) == 19

        # =========================================================================
        # ETAPA 4: Separação Física no Chão de Fábrica (Baixa Definitiva)
        # =========================================================================
        grade_item.quantity_available -= 1
        grade_item.reserved_quantity -= 1
        os_record.status = OSStatus.EXPEDICAO
        await db.flush()
        await db.refresh(grade_item)

        assert grade_item.quantity_available == 19
        assert grade_item.reserved_quantity == 0

        # =========================================================================
        # ETAPA 5: Fechamento Comercial & Contas a Receber (Fatura da Ótica)
        # =========================================================================
        fatura_receber = AccountsReceivable(
            id=uuid.uuid4(),
            optical_store_id=partner_otica.id,
            description=f"Fatura OS-E2E-{unique_suffix}",
            amount=Decimal("120.00"),
            amount_received=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        db.add(fatura_receber)
        await db.flush()

        # =========================================================================
        # ETAPA 6: Lançamento de Contas a Pagar (Fornecedor + Folha de Pagamento)
        # =========================================================================
        conta_fornecedor = AccountsPayable(
            id=uuid.uuid4(),
            description="Fatura Compra Lentes Fornecedor",
            supplier_name="Fornecedor Lentes E2E",
            amount=Decimal("250.00"),
            amount_paid=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        conta_folha = AccountsPayable(
            id=uuid.uuid4(),
            description="Folha de Pagamento - Técnico Bancada",
            supplier_name="Equipe Interna",
            amount=Decimal("50.00"),
            amount_paid=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        db.add_all([conta_fornecedor, conta_folha])
        await db.flush()

        # =========================================================================
        # ETAPA 7: Liquidação Financeira (Baixas de Pagamentos e Recebimentos)
        # =========================================================================
        # Recebimento da ótica parceira (R$ 120,00)
        await receive_payment(db, fatura_receber.id, payment_amount=120.00, notes="Baixa PIX E2E")

        # Pagamento da Folha de Pagamento (R$ 50,00)
        await pay_account_payable(db, conta_folha.id, payment_amount=50.00)

        await db.commit()

        # =========================================================================
        # ETAPA 8: Apuração e Validação do DRE Consolidado
        # =========================================================================
        now_dt = datetime.now(timezone.utc)
        start_date = now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        dre = await get_consolidated_dre(
            db, 
            start_date=start_date, 
            end_date=now_dt
        )

        # Faturamento Bruto: >= R$ 120,00
        # CMV Real: >= R$ 20,00
        # Folha de Pagamento Paga: >= R$ 50,00
        assert dre["gross_revenue"] >= 120.00
        assert dre["cmv_real"] >= 20.00
        assert dre["payroll"] >= 50.00
        assert "net_profit" in dre
        assert "net_margin_pct" in dre
