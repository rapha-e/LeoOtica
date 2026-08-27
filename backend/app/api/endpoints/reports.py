import uuid
from decimal import Decimal
from datetime import datetime, date, time, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_, case, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator, get_current_active_admin
from backend.app.models.user import User
from backend.app.models.os import ServiceOrder, OSStatus, OSWorkflowHistory
from backend.app.models.lens import LensModel, LensInventoryGrade, MatrixType, ProductionRoute
from backend.app.models.movement import StockMovement
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsReceivable, AccountsPayable, FinancialTransaction, FinancialCategory
from backend.app.schemas.report_schemas import (
    ProductionAnalyticResponse, ProductionKPISchema, ProductionOSItem,
    InventoryKardexResponse, InventoryKPISchema, InventoryKardexItem,
    CommercialRankingResponse, CommercialKPISchema, CommercialRankingItem, TreatmentSalesItem,
    FinancialDREReportResponse, FinancialDRELineItem,
    FinancialAgingResponse, AgingBucketSummary, AgingTitleItem
)

router = APIRouter()

def get_date_bounds(start_date: Any, end_date: Any):
    """
    Tratamento rigoroso de boundary de datas:
    dt_start = 00:00:00.000000
    dt_end   = 23:59:59.999999
    Garante que registros de todos os turnos (inclusive noturnos) sejam computados.
    """
    now = datetime.now(timezone.utc)
    if isinstance(start_date, datetime):
        dt_start = start_date
    elif isinstance(start_date, date):
        dt_start = datetime.combine(start_date, time.min)
    else:
        dt_start = datetime(now.year, now.month, 1, 0, 0, 0)
    
    if isinstance(end_date, datetime):
        dt_end = end_date
    elif isinstance(end_date, date):
        dt_end = datetime.combine(end_date, time.max)
    else:
        dt_end = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
        
    return dt_start, dt_end


def _clean_str(s):
    return s if isinstance(s, str) and s.strip() else None

def _clean_uuid(u):
    if isinstance(u, uuid.UUID):
        return u
    if isinstance(u, str) and u.strip():
        try:
            return uuid.UUID(u)
        except ValueError:
            return None
    return None

def _clean_bool(b):
    return bool(b) if isinstance(b, bool) else False


# ==============================================================================
# 1. RELATÓRIO ANALÍTICO DE PRODUÇÃO & MES (Chão de Fábrica)
# ==============================================================================

@router.get("/production/analytic", response_model=ProductionAnalyticResponse)
async def get_production_analytic_report(
    start_date: Optional[date] = Query(None, description="Data Inicial (AAAA-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Data Final (AAAA-MM-DD)"),
    status_filter: Optional[str] = Query(None, description="Filtrar por Status de OS"),
    optical_store_id: Optional[uuid.UUID] = Query(None, description="Filtrar por Ótica"),
    production_route: Optional[str] = Query(None, description="Filtrar por Rota (EXPRESSA_FACETAMENTO ou SURFACAGEM_CNC)"),
    priority: Optional[str] = Query(None, description="Filtrar por Prioridade"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    dt_start, dt_end = get_date_bounds(start_date, end_date)
    status_filter = _clean_str(status_filter)
    optical_store_id = _clean_uuid(optical_store_id)
    production_route = _clean_str(production_route)
    priority = _clean_str(priority)

    query = (
        select(ServiceOrder)
        .options(
            selectinload(ServiceOrder.optical_store),
            selectinload(ServiceOrder.lens_model)
        )
        .where(
            ServiceOrder.created_at >= dt_start,
            ServiceOrder.created_at <= dt_end
        )
        .order_by(desc(ServiceOrder.created_at))
    )

    if status_filter:
        query = query.where(ServiceOrder.status == status_filter)
    if optical_store_id:
        query = query.where(ServiceOrder.optical_store_id == optical_store_id)
    if priority:
        query = query.where(ServiceOrder.priority == priority)
    if production_route:
        query = query.where(ServiceOrder.production_route == production_route)

    res = await db.execute(query)
    orders = res.scalars().all()

    # Agregações e KPIs
    total_orders = len(orders)
    orders_completed = 0
    orders_in_progress = 0
    orders_rework = 0
    orders_blocked = 0
    express_count = 0
    cnc_count = 0
    lead_times = []

    status_dist = {}
    route_dist = {"EXPRESSA_FACETAMENTO": 0, "SURFACAGEM_CNC": 0, "SERVICO_REPARO": 0}

    order_items = []
    for o in orders:
        st = str(o.status)
        status_dist[st] = status_dist.get(st, 0) + 1

        route = o.lens_model.production_route if o.lens_model else ("SERVICO_REPARO" if o.os_type == "REPARO_SERVICO" else "SURFACAGEM_CNC")
        if production_route and route != production_route:
            continue

        route_dist[route] = route_dist.get(route, 0) + 1
        if route == "EXPRESSA_FACETAMENTO":
            express_count += 1
        elif route == "SURFACAGEM_CNC":
            cnc_count += 1

        if o.priority == "REFAZIMENTO" or o.is_rework:
            orders_rework += 1

        if "Bloqueada" in st or "Inadimplência" in st or "Aguardando Liberação" in st:
            orders_blocked += 1
        elif "Concluída" in st or "Entregue" in st or "Expedição" in st:
            orders_completed += 1
        else:
            orders_in_progress += 1

        # Cálculo de Lead Time (horas entre criação e última atualização/conclusão)
        lead_time = None
        if o.updated_at and o.created_at:
            delta = o.updated_at - o.created_at
            lead_time = round(delta.total_seconds() / 3600.0, 1)
            if "Concluída" in st or "Entregue" in st:
                lead_times.append(lead_time)

        od_str = f"Esf: {float(o.od_spherical or 0):+.2f} | Cil: {float(o.od_cylindrical or 0):+.2f}" if o.od_spherical is not None else None
        oe_str = f"Esf: {float(o.oe_spherical or 0):+.2f} | Cil: {float(o.oe_cylindrical or 0):+.2f}" if o.oe_spherical is not None else None

        order_items.append(
            ProductionOSItem(
                id=o.id,
                os_number=o.os_number,
                client_order_number=o.client_order_number,
                optical_store_name=o.optical_store.trade_name or o.optical_store.corporate_name if o.optical_store else "Venda Balcão",
                tray_number=o.tray_number,
                os_type=o.os_type,
                status=st,
                priority=o.priority or "NORMAL",
                production_route=route,
                lens_model_name=o.lens_model.name or o.lens_model.brand if o.lens_model else None,
                od_degree=od_str,
                oe_degree=oe_str,
                total_amount=o.total_amount or Decimal("0.00"),
                created_at=o.created_at,
                updated_at=o.updated_at,
                lead_time_hours=lead_time
            )
        )

    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else 0.0

    return ProductionAnalyticResponse(
        kpis=ProductionKPISchema(
            total_orders=total_orders,
            orders_completed=orders_completed,
            orders_in_progress=orders_in_progress,
            orders_rework=orders_rework,
            orders_blocked=orders_blocked,
            avg_lead_time_hours=avg_lead_time,
            express_route_count=express_count,
            cnc_route_count=cnc_count
        ),
        orders=order_items,
        orders_by_status=status_dist,
        orders_by_route=route_dist
    )


# ==============================================================================
# 2. RELATÓRIO DE ESTOQUE KARDEX VALORIZADO POR CMP (WMS)
# ==============================================================================

@router.get("/inventory/kardex", response_model=InventoryKardexResponse)
async def get_inventory_kardex_report(
    matrix_type: Optional[str] = Query(None, description="Filtrar por Matriz (LP_GRADE, GRADE_167, MF_ACB, MF_BLOCO, BLOCO_VS)"),
    only_critical: bool = Query(False, description="Apenas itens com saldo <= 2 un"),
    only_in_stock: bool = Query(False, description="Apenas itens com saldo > 0"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    matrix_type = _clean_str(matrix_type)
    only_critical = _clean_bool(only_critical)
    only_in_stock = _clean_bool(only_in_stock)

    query = (
        select(LensInventoryGrade)
        .options(selectinload(LensInventoryGrade.lens_model))
        .join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id)
        .order_by(LensModel.matrix_type, LensInventoryGrade.base_curve, LensInventoryGrade.spherical, LensInventoryGrade.cylindrical)
    )

    if matrix_type:
        query = query.where(LensModel.matrix_type == matrix_type)

    res = await db.execute(query)
    all_items = res.scalars().all()

    kardex_items = []
    total_units_stock = 0
    total_units_reserved = 0
    total_stock_value = Decimal("0.00")
    critical_count = 0
    rupture_count = 0

    stock_by_matrix = {}
    value_by_matrix = {}

    for item in all_items:
        model = item.lens_model
        m_type = model.matrix_type or "LP_GRADE"
        qty_avail = item.quantity_available or 0
        qty_res = item.reserved_quantity or 0
        free_qty = max(0, qty_avail - qty_res)

        if only_in_stock and qty_avail <= 0:
            continue
        if only_critical and qty_avail > 2:
            continue

        # Fallback de CMP robusto: average_cost_price -> last_purchase_price -> model.cost_price -> 25.00
        cmp_unit = (
            item.average_cost_price 
            or item.last_purchase_price 
            or (model.cost_price if model else None) 
            or Decimal("25.00")
        )
        total_val = Decimal(str(qty_avail)) * cmp_unit

        total_units_stock += qty_avail
        total_units_reserved += qty_res
        total_stock_value += total_val

        if qty_avail == 0:
            rupture_count += 1
            critical_count += 1
        elif qty_avail <= 2:
            critical_count += 1

        stock_by_matrix[m_type] = stock_by_matrix.get(m_type, 0) + qty_avail
        value_by_matrix[m_type] = value_by_matrix.get(m_type, Decimal("0.00")) + total_val

        kardex_items.append(
            InventoryKardexItem(
                id=item.id,
                matrix_type=m_type,
                model_name=model.name or model.brand if model else "Sem Modelo",
                brand=model.brand if model else "N/A",
                treatment=model.treatment if model else "Incolor",
                refractive_index=model.refractive_index if model else None,
                base_curve=item.base_curve,
                spherical=item.spherical,
                cylindrical=item.cylindrical,
                addition=item.addition,
                eye=item.eye,
                location_tag=item.location_tag,
                barcode=item.barcode,
                quantity_available=qty_avail,
                reserved_quantity=qty_res,
                free_quantity=free_qty,
                unit_cost_cmp=cmp_unit,
                total_value_cmp=total_val,
                last_purchase_price=item.last_purchase_price
            )
        )

    return InventoryKardexResponse(
        kpis=InventoryKPISchema(
            total_items_count=len(kardex_items),
            total_units_stock=total_units_stock,
            total_units_reserved=total_units_reserved,
            total_stock_value_cmp=total_stock_value,
            critical_items_count=critical_count,
            rupture_items_count=rupture_count
        ),
        items=kardex_items,
        stock_by_matrix=stock_by_matrix,
        value_by_matrix=value_by_matrix
    )


# ==============================================================================
# 3. RELATÓRIO COMERCIAL & RANKING DE ÓTICAS (Vendas)
# ==============================================================================

@router.get("/commercial/ranking", response_model=CommercialRankingResponse)
async def get_commercial_ranking_report(
    start_date: Optional[date] = Query(None, description="Data Inicial"),
    end_date: Optional[date] = Query(None, description="Data Final"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    dt_start, dt_end = get_date_bounds(start_date, end_date)

    # Consulta todas as óticas e suas ordens no período
    query = (
        select(
            OpticalStore.id,
            OpticalStore.corporate_name,
            OpticalStore.trade_name,
            OpticalStore.cnpj,
            OpticalStore.pipeline_stage,
            func.count(ServiceOrder.id).label("total_orders"),
            func.coalesce(func.sum(ServiceOrder.total_amount), Decimal("0.00")).label("total_billed")
        )
        .outerjoin(
            ServiceOrder,
            and_(
                ServiceOrder.optical_store_id == OpticalStore.id,
                ServiceOrder.created_at >= dt_start,
                ServiceOrder.created_at <= dt_end,
                ServiceOrder.status != OSStatus.CANCELADA
            )
        )
        .group_by(OpticalStore.id)
        .order_by(desc("total_billed"))
    )

    res = await db.execute(query)
    rows = res.all()

    ranking = []
    total_sales = Decimal("0.00")
    total_orders_sold = 0
    active_stores = 0

    for r in rows:
        billed = Decimal(str(r.total_billed or 0.0))
        count_os = int(r.total_orders or 0)
        avg_ticket = (billed / Decimal(count_os)) if count_os > 0 else Decimal("0.00")

        if count_os > 0:
            active_stores += 1
            total_sales += billed
            total_orders_sold += count_os

        ranking.append(
            CommercialRankingItem(
                optical_store_id=r.id,
                store_name=r.trade_name or r.corporate_name,
                trade_name=r.trade_name,
                cnpj=r.cnpj,
                total_orders_count=count_os,
                total_billed_amount=billed,
                average_ticket=avg_ticket,
                status_policy=r.pipeline_stage or "ATIVO"
            )
        )

    # Consulta tratamentos mais vendidos
    treatments_query = (
        select(
            func.coalesce(LensModel.treatment, "Incolor").label("treatment"),
            func.count(ServiceOrder.id).label("qty_sold"),
            func.coalesce(func.sum(ServiceOrder.total_amount), Decimal("0.00")).label("amount")
        )
        .join(LensModel, ServiceOrder.lens_model_id == LensModel.id)
        .where(
            ServiceOrder.created_at >= dt_start,
            ServiceOrder.created_at <= dt_end,
            ServiceOrder.status != OSStatus.CANCELADA
        )
        .group_by(LensModel.treatment)
        .order_by(desc("qty_sold"))
    )
    treat_res = await db.execute(treatments_query)
    top_treatments = [
        TreatmentSalesItem(
            treatment_name=t.treatment,
            quantity_sold=int(t.qty_sold),
            total_amount=Decimal(str(t.amount))
        )
        for t in treat_res.all()
    ]

    overall_avg_ticket = (total_sales / Decimal(total_orders_sold)) if total_orders_sold > 0 else Decimal("0.00")

    return CommercialRankingResponse(
        kpis=CommercialKPISchema(
            total_sales_amount=total_sales,
            total_orders_sold=total_orders_sold,
            overall_avg_ticket=overall_avg_ticket,
            active_stores_count=active_stores
        ),
        ranking=ranking,
        top_treatments=top_treatments
    )


# ==============================================================================
# 4. RELATÓRIO DRE CONSOLIDADO (Demonstração do Resultado do Exercício)
# Restrito a Administradores (Diretoria & Controladoria)
# ==============================================================================

@router.get("/financial/dre", response_model=FinancialDREReportResponse)
async def get_financial_dre_report(
    start_date: Optional[date] = Query(None, description="Data Inicial"),
    end_date: Optional[date] = Query(None, description="Data Final"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    dt_start, dt_end = get_date_bounds(start_date, end_date)

    # 1. Receita Bruta Operacional (OSs Concluídas/Não Canceladas no período)
    rev_res = await db.execute(
        select(func.coalesce(func.sum(ServiceOrder.total_amount), Decimal("0.00")))
        .where(
            ServiceOrder.created_at >= dt_start,
            ServiceOrder.created_at <= dt_end,
            ServiceOrder.status != OSStatus.CANCELADA
        )
    )
    gross_revenue = Decimal(str(rev_res.scalar_one_or_none() or "0.00"))

    # 2. CMV Real - Custo das Mercadorias Vendidas (Saídas 'OUT' com CMP do insumo)
    cmv_query = (
        select(
            func.coalesce(
                func.sum(
                    StockMovement.quantity * func.coalesce(
                        LensInventoryGrade.average_cost_price,
                        LensInventoryGrade.last_purchase_price,
                        LensModel.cost_price,
                        Decimal("25.00")
                    )
                ),
                Decimal("0.00")
            )
        )
        .join(LensInventoryGrade, StockMovement.lens_inventory_id == LensInventoryGrade.id)
        .join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id)
        .where(
            StockMovement.movement_type == "OUT",
            StockMovement.movement_date >= dt_start,
            StockMovement.movement_date <= dt_end
        )
    )
    cmv_res = await db.execute(cmv_query)
    cmv_total = Decimal(str(cmv_res.scalar_one_or_none() or "0.00"))

    # 3. Despesas Operacionais e Folha (Contas a Pagar liquidadas no período)
    pay_res = await db.execute(
        select(
            FinancialCategory.name.label("category_name"),
            func.coalesce(func.sum(AccountsPayable.amount), Decimal("0.00")).label("total")
        )
        .outerjoin(FinancialCategory, AccountsPayable.category_id == FinancialCategory.id)
        .where(
            AccountsPayable.status == "PAGO",
            AccountsPayable.due_date >= dt_start,
            AccountsPayable.due_date <= dt_end
        )
        .group_by(FinancialCategory.name)
    )
    pay_rows = pay_res.all()

    payroll_expenses = Decimal("0.00")
    operating_expenses = Decimal("0.00")

    for p in pay_rows:
        cat = str(p.category_name or "").upper()
        amt = Decimal(str(p.total or "0.00"))
        if "FOLHA" in cat or "SALARIO" in cat or "RH" in cat:
            payroll_expenses += amt
        elif "INSUMO" not in cat and "FORNECEDOR" not in cat:
            operating_expenses += amt

    # Cálculos Contábeis do DRE
    deductions = Decimal("0.00")
    net_revenue = gross_revenue - deductions
    gross_profit = net_revenue - cmv_total
    gross_margin_pct = float((gross_profit / net_revenue * 100)) if net_revenue > 0 else 0.0

    net_profit = gross_profit - operating_expenses - payroll_expenses
    net_margin_pct = float((net_profit / net_revenue * 100)) if net_revenue > 0 else 0.0

    # Demonstração detalhada das linhas contábeis
    base_div = net_revenue if net_revenue > 0 else Decimal("1.00")
    dre_statement = [
        FinancialDRELineItem(
            account_code="1.0",
            description="RECEITA BRUTA OPERACIONAL (Vendas de Lentes & Serviços)",
            amount=gross_revenue,
            percentage=float(round(gross_revenue / base_div * 100, 1)),
            is_group=True,
            is_negative=False
        ),
        FinancialDRELineItem(
            account_code="1.1",
            description="(-) Deduções da Receita Bruta e Abatimentos",
            amount=deductions,
            percentage=float(round(deductions / base_div * 100, 1)),
            is_group=False,
            is_negative=True
        ),
        FinancialDRELineItem(
            account_code="2.0",
            description="(=) RECEITA LÍQUIDA OPERACIONAL",
            amount=net_revenue,
            percentage=100.0,
            is_group=True,
            is_negative=False
        ),
        FinancialDRELineItem(
            account_code="3.0",
            description="(-) Custo das Mercadorias Vendidas (CMV Real ao CMP)",
            amount=cmv_total,
            percentage=float(round(cmv_total / base_div * 100, 1)),
            is_group=False,
            is_negative=True
        ),
        FinancialDRELineItem(
            account_code="4.0",
            description="(=) LUCRO BRUTO / MARGEM BRUTA",
            amount=gross_profit,
            percentage=float(round(gross_margin_pct, 1)),
            is_group=True,
            is_negative=gross_profit < 0
        ),
        FinancialDRELineItem(
            account_code="5.0",
            description="(-) Despesas Operacionais & Utilidades",
            amount=operating_expenses,
            percentage=float(round(operating_expenses / base_div * 100, 1)),
            is_group=False,
            is_negative=True
        ),
        FinancialDRELineItem(
            account_code="6.0",
            description="(-) Despesas com Pessoal & Folha de Pagamento",
            amount=payroll_expenses,
            percentage=float(round(payroll_expenses / base_div * 100, 1)),
            is_group=False,
            is_negative=True
        ),
        FinancialDRELineItem(
            account_code="7.0",
            description="(=) RESULTADO OPERACIONAL LÍQUIDO (LUCRO/PREJUÍZO)",
            amount=net_profit,
            percentage=float(round(net_margin_pct, 1)),
            is_group=True,
            is_negative=net_profit < 0
        )
    ]

    return FinancialDREReportResponse(
        period_start=dt_start.strftime("%d/%m/%Y"),
        period_end=dt_end.strftime("%d/%m/%Y"),
        gross_revenue=gross_revenue,
        deductions=deductions,
        net_revenue=net_revenue,
        cmv_total=cmv_total,
        gross_profit=gross_profit,
        gross_margin_pct=round(gross_margin_pct, 2),
        operating_expenses=operating_expenses,
        payroll_expenses=payroll_expenses,
        net_profit=net_profit,
        net_margin_pct=round(net_margin_pct, 2),
        dre_statement=dre_statement
    )


# ==============================================================================
# 5. RELATÓRIO DE AGING LIST & INADIMPLÊNCIA (Contas a Receber)
# ==============================================================================

@router.get("/financial/aging", response_model=FinancialAgingResponse)
async def get_financial_aging_report(
    optical_store_id: Optional[uuid.UUID] = Query(None, description="Filtrar por Ótica Cliente"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    optical_store_id = _clean_uuid(optical_store_id)
    today = date.today()

    query = (
        select(AccountsReceivable)
        .options(selectinload(AccountsReceivable.optical_store))
        .where(AccountsReceivable.status.in_(["PENDENTE", "ATRASADO", "RECEBIDO_PARCIAL"]))
        .order_by(AccountsReceivable.due_date)
    )
    if optical_store_id:
        query = query.where(AccountsReceivable.optical_store_id == optical_store_id)

    res = await db.execute(query)
    titles = res.scalars().all()

    total_receivable = Decimal("0.00")
    total_overdue = Decimal("0.00")
    total_to_mature = Decimal("0.00")

    bucket_data = {
        "A_VENCER": {"label": "A Vencer (No Prazo)", "count": 0, "total": Decimal("0.00")},
        "1_15":     {"label": "1 a 15 Dias de Atraso", "count": 0, "total": Decimal("0.00")},
        "16_30":    {"label": "16 a 30 Dias de Atraso", "count": 0, "total": Decimal("0.00")},
        "31_60":    {"label": "31 a 60 Dias de Atraso", "count": 0, "total": Decimal("0.00")},
        "60_MAIS":  {"label": "Acima de 60 Dias (Crítico)", "count": 0, "total": Decimal("0.00")}
    }

    title_items = []
    for t in titles:
        # Extrai data de vencimento com segurança
        d_val = t.due_date
        due_d = d_val.date() if isinstance(d_val, datetime) else d_val
        diff_days = (today - due_d).days

        balance = t.amount - (t.amount_paid or Decimal("0.00"))
        if balance <= 0:
            continue

        total_receivable += balance

        if diff_days <= 0:
            b_key = "A_VENCER"
            total_to_mature += balance
            days_overdue = 0
        elif diff_days <= 15:
            b_key = "1_15"
            total_overdue += balance
            days_overdue = diff_days
        elif diff_days <= 30:
            b_key = "1_15" if diff_days <= 15 else "16_30"
            total_overdue += balance
            days_overdue = diff_days
        elif diff_days <= 60:
            b_key = "31_60"
            total_overdue += balance
            days_overdue = diff_days
        else:
            b_key = "60_MAIS"
            total_overdue += balance
            days_overdue = diff_days

        bucket_data[b_key]["count"] += 1
        bucket_data[b_key]["total"] += balance

        title_items.append(
            AgingTitleItem(
                id=t.id,
                optical_store_id=t.optical_store_id,
                store_name=t.optical_store.trade_name or t.optical_store.corporate_name if t.optical_store else "Ótica Não Identificada",
                document_number=t.document_number or f"FAT-{str(t.id)[:8]}",
                due_date=due_d,
                days_overdue=days_overdue,
                amount=t.amount,
                amount_paid=t.amount_paid or Decimal("0.00"),
                balance_due=balance,
                aging_bucket=b_key,
                status=t.status
            )
        )

    delinquency_rate = float((total_overdue / total_receivable * 100)) if total_receivable > 0 else 0.0

    bucket_summaries = [
        AgingBucketSummary(
            bucket=k,
            label=v["label"],
            count=v["count"],
            total_amount=v["total"]
        )
        for k, v in bucket_data.items()
    ]

    return FinancialAgingResponse(
        total_receivable=total_receivable,
        total_overdue=total_overdue,
        total_to_mature=total_to_mature,
        delinquency_rate_pct=round(delinquency_rate, 2),
        bucket_summaries=bucket_summaries,
        titles=title_items
    )
