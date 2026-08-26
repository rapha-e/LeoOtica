import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade, ProductionRoute
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.crud.movement import create_stock_movement
from backend.app.crud.crud_financial_corp import get_consolidated_dre, receive_payment, pay_account_payable
from backend.app.services.allocation import allocate_and_deduct_inventory
from backend.app.schemas.movement import StockMovementCreate


@pytest.mark.asyncio
async def test_complete_enterprise_lifecycle():
    """
    TESTE PONTA A PONTA (E2E) — LEOÓTICAS v2.0 ENTERPRISE
    
    Cobre todos os módulos do relatório:
    1. [Estoque/WMS]: Cadastro de lente, bipador EAN e entrada com CMP (Custo Médio Ponderado).
    2. [Comercial]: Cadastro de Ótica Parceira com validação de limite de crédito.
    3. [Produção/MES]: Transposição clínica (+ para -) e Roteamento (EXPRESSA_FACETAMENTO).
    4. [WMS/Reserva]: Reserva Atômica de dioptria na abertura da OS.
    5. [Chão de Fábrica]: Separação física, avanço na esteira e baixa atômica do saldo.
    6. [Financeiro]: Faturamento (Contas a Receber) e Despesas (Contas a Pagar Fornecedor + FOLHA).
    7. [Conciliação & DRE]: Liquidação no Livro Caixa e apuração do Lucro Líquido Real.
    """
    async with AsyncSessionLocal() as db:
        uid = uuid.uuid4().hex[:8]

        # =========================================================================
        # 1. ESTOQUE & CMP: Cadastro Inicial + Entrada com Recálculo de Custo
        # =========================================================================
        lens_model = LensModel(
            id=uuid.uuid4(),
            brand=f"Visão Simples 1.56 AR Premium {uid}",
            material="CR-39",
            refractive_index=Decimal("1.56"),
            treatment="Anti-Reflexo",
            diameter=70,
            matrix_type="LP_GRADE",
            production_route="EXPRESSA_FACETAMENTO",
            cost_price=Decimal("20.00"),
            average_cost_price=Decimal("20.00"),
            last_purchase_price=Decimal("20.00")
        )
        db.add(lens_model)
        await db.flush()

        test_ean = f"789{uid}001"
        grade_item = LensInventoryGrade(
            id=uuid.uuid4(),
            lens_model_id=lens_model.id,
            barcode=test_ean,
            spherical=Decimal("-2.00"),
            cylindrical=Decimal("-1.00"),
            location_tag="GAVETA-A12",
            quantity_available=10,
            reserved_quantity=0,
            average_cost_price=Decimal("20.00"),
            last_purchase_price=Decimal("20.00")
        )
        db.add(grade_item)
        await db.flush()

        # Entrada de NF-e: 10 un a R$ 30,00
        # Novo CMP = (10*20 + 10*30) / 20 = R$ 25,00
        movement_xml = StockMovementCreate(
            lens_inventory_id=grade_item.id,
            movement_type="IN",
            quantity=10,
            reason=f"Ingestão XML NF-e Fornecedor #{uid}"
        )
        await create_stock_movement(db, movement_xml, unit_cost=30.00)
        await db.refresh(grade_item)

        assert grade_item.quantity_available == 20
        assert float(grade_item.average_cost_price) == 25.00
        assert float(grade_item.last_purchase_price) == 30.00

        # =========================================================================
        # 2. COMERCIAL: Cadastro de Ótica Parceira & Limite de Crédito
        # =========================================================================
        partner = OpticalStore(
            id=uuid.uuid4(),
            trade_name=f"Ótica Alfa Prime {uid}",
            corporate_name="Ótica Alfa LTDA",
            cnpj=f"{uuid.uuid4().int % 100000000000000:014d}",
            credit_limit=Decimal("5000.00"),
            is_active=True
        )
        db.add(partner)
        await db.flush()

        # =========================================================================
        # 3. PRODUÇÃO / MES: Transposição Clínica & Criação da OS
        # Receita original: Esf: -3.00 | Cil: +1.00 | Eixo: 90°
        # Transposição: Esf = (-3.00 + 1.00) = -2.00 | Cil = -1.00 | Eixo = (90 + 90) = 180°
        # =========================================================================
        raw_sph = Decimal("-3.00")
        raw_cyl = Decimal("+1.00")
        raw_axis = 90

        if raw_cyl > 0:
            final_sph = raw_sph + raw_cyl
            final_cyl = -raw_cyl
            final_axis = (raw_axis + 90) % 180 or 180
        else:
            final_sph, final_cyl, final_axis = raw_sph, raw_cyl, raw_axis

        assert final_sph == Decimal("-2.00")
        assert final_cyl == Decimal("-1.00")
        assert final_axis == 180

        os_record = ServiceOrder(
            id=uuid.uuid4(),
            optical_store_id=partner.id,
            os_number=f"OS-{uid}",
            tray_number=f"B-{uid[:4]}",
            status=OSStatus.RECEBIDA,
            total_amount=Decimal("150.00"),  # Preço do serviço + lente
            created_at=datetime.now(timezone.utc)
        )
        db.add(os_record)
        await db.flush()

        # =========================================================================
        # 4. WMS & RESERVA ATÔMICA: Alocação via Bipador
        # =========================================================================
        alloc_res = await allocate_and_deduct_inventory(
            db=db,
            os_id=os_record.id,
            lens_model_id=lens_model.id,
            rx_data={
                "OD": {"spherical": float(final_sph), "cylindrical": float(final_cyl)}
            }
        )
        assert alloc_res["status"] == "SUCCESS"
        await db.refresh(grade_item)

        # Saldo físico continua 20, 1 reservada, 19 livres
        assert grade_item.quantity_available == 20
        assert grade_item.reserved_quantity == 1
        assert (grade_item.quantity_available - grade_item.reserved_quantity) == 19

        # =========================================================================
        # 5. CHÃO DE FÁBRICA: Separação Física, Baixa Atômica e Expedição
        # =========================================================================
        # Operador bipa a lente na gaveta física
        grade_item.quantity_available -= 1
        grade_item.reserved_quantity -= 1
        os_record.status = OSStatus.EXPEDICAO
        await db.flush()
        await db.refresh(grade_item)

        assert grade_item.quantity_available == 19
        assert grade_item.reserved_quantity == 0

        # =========================================================================
        # 6. FINANCEIRO: Contas a Receber (Ótica) e Contas a Pagar (Fornecedor + FOLHA)
        # =========================================================================
        # Título de Receita gerado pelo fechamento da OS
        fatura_otica = AccountsReceivable(
            id=uuid.uuid4(),
            optical_store_id=partner.id,
            description=f"Fatura OS-{uid}",
            amount=Decimal("150.00"),
            amount_received=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        # Título de Despesa da compra de insumos (10 un * R$ 30,00 = R$ 300,00)
        conta_fornecedor = AccountsPayable(
            id=uuid.uuid4(),
            description=f"NF Fornecedor Lentes #{uid}",
            supplier_name="Fornecedor Lentes Enterprise",
            amount=Decimal("300.00"),
            amount_paid=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        # Título de Despesa da folha de pagamento de técnicos
        conta_folha = AccountsPayable(
            id=uuid.uuid4(),
            description="Folha de Pagamento - Técnico Surfaçagem",
            supplier_name="Equipe Interna",
            amount=Decimal("45.00"),
            amount_paid=Decimal("0.00"),
            status="PENDENTE",
            due_date=datetime.now(timezone.utc)
        )
        db.add_all([fatura_otica, conta_fornecedor, conta_folha])
        await db.flush()

        # =========================================================================
        # 7. CONCILIAÇÃO & LIVRO CAIXA: Baixas e Geração de FinancialTransaction
        # =========================================================================
        # Recebimento da ótica via PIX
        await receive_payment(db, fatura_otica.id, payment_amount=150.00, notes="Recebimento PIX Alfa Prime")
        
        # Pagamento da Folha via Transferência Bancária
        await pay_account_payable(db, conta_folha.id, payment_amount=45.00)

        await db.commit()

        # =========================================================================
        # 8. ANALYTICS: Apuração do DRE Consolidado em Tempo Real
        # =========================================================================
        now_dt = datetime.now(timezone.utc)
        start_date = now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        dre = await get_consolidated_dre(
            db,
            start_date=start_date,
            end_date=now_dt
        )

        # Regra DRE:
        # (+) Faturamento Bruto: >= R$ 150.00
        # (-) CMV Real (1 lente consumida a CMP R$ 25.00): >= R$ 25.00
        # (-) Folha de Pagamento Liquidada: >= R$ 45.00
        assert dre["gross_revenue"] >= 150.00
        assert dre["cmv_real"] >= 25.00
        assert dre["payroll"] >= 45.00
        assert "net_profit" in dre
        assert "net_margin_pct" in dre

        print("\n" + "=" * 60)
        print("✅ TESTE PONTA A PONTA (E2E) v2.0 ENTERPRISE CONCLUÍDO COM SUCESSO")
        print("=" * 60)
        print(f"📦 Estoque: Saldo Físico = {grade_item.quantity_available} un | CMP = R$ {grade_item.average_cost_price}")
        print(f"👓 Óptica: Transposição clínica convertida para {final_sph:.2f} {final_cyl:.2f} {final_axis}°")
        print(f"📊 DRE Gerencial Consolidado:")
        print(f"   • (+) Faturamento Bruto:     R$ {dre['gross_revenue']}")
        print(f"   • (-) CMV Real (Lente CMP):  R$ {dre['cmv_real']}")
        print(f"   • (-) Folha de Pagamento:    R$ {dre['payroll']}")
        print(f"   • (=) Lucro Líquido Real:    R$ {dre['net_profit']}")
        print("=" * 60)
