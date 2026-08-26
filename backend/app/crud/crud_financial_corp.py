import uuid
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable, CostCenter, FinancialCategory, FinancialTransaction
from backend.app.models.billing import BillingCycle
from backend.app.models.optical_store import OpticalStore

# --- CONTAS A RECEBER & INADIMPLÊNCIA ---

async def sync_billing_cycles_to_receivables(db: AsyncSession):
    """
    Garante que todos os BillingCycles no banco possuam um AccountsReceivable correspondente.
    """
    cycles_stmt = select(BillingCycle).options(selectinload(BillingCycle.optical_store))
    cycles = (await db.execute(cycles_stmt)).scalars().all()
    
    for cycle in cycles:
        rec_stmt = select(AccountsReceivable).where(AccountsReceivable.billing_cycle_id == cycle.id)
        existing = (await db.execute(rec_stmt)).scalars().first()
        
        if not existing:
            status = "RECEBIDO" if cycle.status == "PAGO" else "PENDENTE"
            due_dt = cycle.due_date or (cycle.created_at + timedelta(days=15))
            
            # Normaliza para comparação segura com datetime.now(timezone.utc)
            due_dt_aware = due_dt.replace(tzinfo=timezone.utc) if due_dt.tzinfo is None else due_dt.astimezone(timezone.utc)
            now_utc = datetime.now(timezone.utc)

            # Se a data de vencimento já passou e não foi pago, marca como ATRASADO
            if status == "PENDENTE" and due_dt_aware < now_utc:
                status = "ATRASADO"
                
            rec = AccountsReceivable(
                billing_cycle_id=cycle.id,
                optical_store_id=cycle.optical_store_id,
                description=f"Fatura de Fechamento - {cycle.optical_store.trade_name if cycle.optical_store else 'Ótica'}",
                amount=float(cycle.total_amount),
                amount_received=float(cycle.total_amount) if status == "RECEBIDO" else 0.0,
                due_date=due_dt,
                received_at=cycle.paid_at if status == "RECEBIDO" else None,
                status=status
            )
            db.add(rec)
    await db.commit()

async def check_optical_store_delinquency(db: AsyncSession, store_id: uuid.UUID) -> Dict[str, Any]:
    """
    Verifica se a ótica possui títulos vencidos (inadimplentes).
    Retorna métricas de inadimplência: is_delinquent, count, total_amount, max_days_overdue.
    """
    await sync_billing_cycles_to_receivables(db)
    
    now_utc = datetime.now(timezone.utc)
    stmt = select(AccountsReceivable).where(
        and_(
            AccountsReceivable.optical_store_id == store_id,
            AccountsReceivable.status.in_(["PENDENTE", "ATRASADO", "RECEBIDO_PARCIAL"])
        )
    )
    result = await db.execute(stmt)
    all_pending = result.scalars().all()

    overdue_items = []
    for item in all_pending:
        if item.due_date:
            item_due = item.due_date.replace(tzinfo=timezone.utc) if item.due_date.tzinfo is None else item.due_date.astimezone(timezone.utc)
            if item_due < now_utc:
                overdue_items.append((item, (now_utc - item_due).days))
    
    if not overdue_items:
        return {
            "is_delinquent": False,
            "overdue_count": 0,
            "total_overdue_amount": 0.0,
            "max_overdue_days": 0,
            "items": []
        }
        
    total_amount = sum(it[0].amount - it[0].amount_received for it in overdue_items)
    max_days = max(it[1] for it in overdue_items)
    
    return {
        "is_delinquent": True,
        "overdue_count": len(overdue_items),
        "total_overdue_amount": float(total_amount),
        "max_overdue_days": max_days,
        "items": [
            {
                "id": str(item.id),
                "description": item.description,
                "amount": float(item.amount),
                "amount_received": float(item.amount_received),
                "due_date": item.due_date.isoformat(),
                "days_overdue": (now_utc - item.due_date).days if item.due_date else 0
            }
            for item in overdue_items
        ]
    }

async def get_accounts_receivable(db: AsyncSession, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    await sync_billing_cycles_to_receivables(db)
    
    stmt = select(AccountsReceivable).options(selectinload(AccountsReceivable.optical_store)).order_by(AccountsReceivable.due_date.asc())
    if status_filter:
        stmt = stmt.where(AccountsReceivable.status == status_filter)
        
    items = (await db.execute(stmt)).scalars().all()
    now = datetime.now(timezone.utc)
    
    res = []
    for item in items:
        days_overdue = 0
        current_status = item.status
        due = item.due_date
        if due:
            due_aware = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due.astimezone(timezone.utc)
            if current_status != "RECEBIDO" and due_aware < now:
                current_status = "ATRASADO"
                days_overdue = max(1, (now - due_aware).days)
            elif current_status == "ATRASADO":
                days_overdue = max(1, (now - due_aware).days)
            
        res.append({
            "id": item.id,
            "billing_cycle_id": item.billing_cycle_id,
            "optical_store_id": item.optical_store_id,
            "optical_store_name": item.optical_store.trade_name if item.optical_store else "N/A",
            "description": item.description,
            "amount": float(item.amount),
            "amount_received": float(item.amount_received),
            "balance_due": float(item.amount - item.amount_received),
            "due_date": item.due_date,
            "received_at": item.received_at,
            "status": current_status,
            "days_overdue": days_overdue
        })
    return res

async def receive_payment(db: AsyncSession, receivable_id: uuid.UUID, payment_amount: float, notes: Optional[str] = None) -> AccountsReceivable:
    stmt = select(AccountsReceivable).where(AccountsReceivable.id == receivable_id)
    rec = (await db.execute(stmt)).scalar_one_or_none()
    if not rec:
        raise ValueError("Título a receber não encontrado.")
        
    payment_dec = Decimal(str(payment_amount))
    rec.amount_received = (Decimal(str(rec.amount_received)) if rec.amount_received is not None else Decimal("0.0")) + payment_dec
    if rec.amount_received >= rec.amount:
        rec.amount_received = rec.amount
        rec.status = "RECEBIDO"
        rec.received_at = datetime.now(timezone.utc)
    else:
        rec.status = "RECEBIDO_PARCIAL"
        
    if notes:
        rec.notes = (rec.notes or "") + f"\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Baixa de R$ {payment_amount:.2f}: {notes}"
        
    # Grava a transação financeira de receita
    tx = FinancialTransaction(
        id=uuid.uuid4(),
        type="RECEITA",
        category="FATURAMENTO",
        amount=float(payment_dec),
        description=f"Recebimento de título: {rec.description}",
        transaction_date=datetime.now(timezone.utc),
        accounts_receivable_id=rec.id
    )
    db.add(tx)

    # Sincroniza o BillingCycle se aplicável
    if rec.billing_cycle_id and rec.status == "RECEBIDO":
        cycle_stmt = select(BillingCycle).where(BillingCycle.id == rec.billing_cycle_id)
        cycle = (await db.execute(cycle_stmt)).scalar_one_or_none()
        if cycle:
            cycle.status = "PAGO"
            cycle.paid_at = datetime.now(timezone.utc)
            
    await db.commit()
    await db.refresh(rec)
    return rec

# --- CONTAS A PAGAR ---

async def get_accounts_payable(db: AsyncSession, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    stmt = select(AccountsPayable).options(
        selectinload(AccountsPayable.category),
        selectinload(AccountsPayable.cost_center)
    ).order_by(AccountsPayable.due_date.asc())
    
    if status_filter:
        stmt = stmt.where(AccountsPayable.status == status_filter)
        
    items = (await db.execute(stmt)).scalars().all()
    now = datetime.now(timezone.utc)
    
    res = []
    for item in items:
        days_overdue = 0
        current_status = item.status
        due = item.due_date
        if due:
            due_aware = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due.astimezone(timezone.utc)
            if current_status in ["PENDENTE", "PAGO_PARCIAL"] and due_aware < now:
                days_overdue = (now - due_aware).days
            
        res.append({
            "id": item.id,
            "description": item.description,
            "supplier_name": item.supplier_name,
            "document_number": item.document_number,
            "amount": float(item.amount),
            "amount_paid": float(item.amount_paid),
            "balance_due": float(item.amount - item.amount_paid),
            "due_date": item.due_date,
            "payment_date": item.payment_date,
            "status": current_status,
            "category_name": item.category.name if item.category else "Geral",
            "cost_center_name": item.cost_center.name if item.cost_center else "Fábrica Principal",
            "days_overdue": days_overdue
        })
    return res

async def create_account_payable(db: AsyncSession, data: Dict[str, Any]) -> AccountsPayable:
    payable = AccountsPayable(
        description=data["description"],
        supplier_name=data["supplier_name"],
        document_number=data.get("document_number"),
        amount=float(data["amount"]),
        amount_paid=float(data.get("amount_paid", 0.0)),
        due_date=data["due_date"],
        category_id=data.get("category_id"),
        cost_center_id=data.get("cost_center_id"),
        notes=data.get("notes")
    )
    db.add(payable)
    await db.commit()
    await db.refresh(payable)
    return payable

async def pay_account_payable(db: AsyncSession, payable_id: uuid.UUID, payment_amount: float) -> AccountsPayable:
    stmt = select(AccountsPayable).options(selectinload(AccountsPayable.category)).where(AccountsPayable.id == payable_id)
    pay = (await db.execute(stmt)).scalar_one_or_none()
    if not pay:
        raise ValueError("Conta a pagar não encontrada.")
        
    payment_dec = Decimal(str(payment_amount))
    pay.amount_paid = (Decimal(str(pay.amount_paid)) if pay.amount_paid is not None else Decimal("0.0")) + payment_dec
    if pay.amount_paid >= pay.amount:
        pay.amount_paid = pay.amount
        pay.status = "PAGO"
        pay.payment_date = datetime.now(timezone.utc)
    else:
        pay.status = "PAGO_PARCIAL"
        
    cat_name = pay.category.name if pay.category else ("FOLHA" if "FOLHA" in pay.description.upper() else "FORNECEDOR")
    tx = FinancialTransaction(
        id=uuid.uuid4(),
        type="DESPESA",
        category=cat_name,
        amount=float(payment_dec),
        description=f"Pagamento de conta: {pay.description} ({pay.supplier_name})",
        transaction_date=datetime.now(timezone.utc),
        accounts_payable_id=pay.id
    )
    db.add(tx)

    await db.commit()
    await db.refresh(pay)
    return pay

# --- FLUXO DE CAIXA & INDICADORES ---

async def get_cash_flow(db: AsyncSession, timeframe: str = "monthly") -> List[Dict[str, Any]]:
    """
    Retorna o fluxo de caixa (Entradas Previstas/Realizadas vs Saídas Previstas/Realizadas).
    """
    await sync_billing_cycles_to_receivables(db)
    
    receivables = await get_accounts_receivable(db)
    payables = await get_accounts_payable(db)
    
    # Agrupamento simples de fluxo nos últimos 30 dias e próximos 30 dias
    cash_flow_map = {}
    now = datetime.now(timezone.utc)
    
    for day_offset in range(-15, 30):
        target_date = (now + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        cash_flow_map[target_date] = {
            "date": target_date,
            "inflows_planned": 0.0,
            "inflows_realized": 0.0,
            "outflows_planned": 0.0,
            "outflows_realized": 0.0,
            "net_projected": 0.0
        }
        
    for r in receivables:
        d_str = r["due_date"].strftime("%Y-%m-%d") if isinstance(r["due_date"], (datetime, date)) else str(r["due_date"])[:10]
        if d_str in cash_flow_map:
            cash_flow_map[d_str]["inflows_planned"] += r["amount"]
            cash_flow_map[d_str]["inflows_realized"] += r["amount_received"]
            
    for p in payables:
        d_str = p["due_date"].strftime("%Y-%m-%d") if isinstance(p["due_date"], (datetime, date)) else str(p["due_date"])[:10]
        if d_str in cash_flow_map:
            cash_flow_map[d_str]["outflows_planned"] += p["amount"]
            cash_flow_map[d_str]["outflows_realized"] += p["amount_paid"]
            
    for d_str, data in cash_flow_map.items():
        data["net_projected"] = data["inflows_planned"] - data["outflows_planned"]
        
    return list(cash_flow_map.values())

async def get_executive_financial_kpis(db: AsyncSession) -> Dict[str, Any]:
    """
    Retorna Indicadores Financeiros de Alto Nível (Faturado, Recebido, Em Aberto, Vencido, Taxa de Inadimplência, Ranking de Óticas).
    """
    await sync_billing_cycles_to_receivables(db)
    
    receivables = await get_accounts_receivable(db)
    payables = await get_accounts_payable(db)
    
    total_billed = sum(r["amount"] for r in receivables)
    total_received = sum(r["amount_received"] for r in receivables)
    total_open = sum(r["balance_due"] for r in receivables if r["status"] in ["PENDENTE", "RECEBIDO_PARCIAL"])
    total_overdue = sum(r["balance_due"] for r in receivables if r["status"] == "ATRASADO" or r["days_overdue"] > 0)
    
    delinquency_rate = (total_overdue / total_billed * 100) if total_billed > 0 else 0.0
    
    # Ranking por ótica
    store_ranking = {}
    for r in receivables:
        s_name = r["optical_store_name"]
        if s_name not in store_ranking:
            store_ranking[s_name] = {"total_amount": 0.0, "total_received": 0.0, "total_overdue": 0.0, "count": 0}
        store_ranking[s_name]["total_amount"] += r["amount"]
        store_ranking[s_name]["total_received"] += r["amount_received"]
        if r["status"] == "ATRASADO" or r["days_overdue"] > 0:
            store_ranking[s_name]["total_overdue"] += r["balance_due"]
        store_ranking[s_name]["count"] += 1
        
    ranking_list = [
        {
            "optical_store_name": name,
            "total_amount": float(data["total_amount"]),
            "total_received": float(data["total_received"]),
            "total_overdue": float(data["total_overdue"]),
            "ticket_medio": float(data["total_amount"] / data["count"]) if data["count"] > 0 else 0.0
        }
        for name, data in store_ranking.items()
    ]
    ranking_list.sort(key=lambda x: x["total_amount"], reverse=True)
    
    return {
        "total_billed": float(total_billed),
        "total_received": float(total_received),
        "total_open": float(total_open),
        "total_overdue": float(total_overdue),
        "delinquency_rate": float(round(delinquency_rate, 2)),
        "ranking_by_store": ranking_list,
        "payables_summary": {
            "total_payables": sum(p["amount"] for p in payables),
            "total_paid": sum(p["amount_paid"] for p in payables),
            "total_pending": sum(p["balance_due"] for p in payables if p["status"] != "PAGO")
        }
    }


async def get_consolidated_dre(db: AsyncSession, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Calcula a Demonstração do Resultado do Exercício (DRE Consolidado):
    Faturamento Bruto - CMV Real - Despesas Operacionais - Folha de Pagamento = Lucro Líquido
    """
    await sync_billing_cycles_to_receivables(db)
    
    now_utc = datetime.now(timezone.utc)
    if not start_date:
        start_date = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if not end_date:
        end_date = now_utc
        
    # 1. Faturamento Bruto (Receitas faturadas/recebidas no período)
    rec_stmt = select(func.sum(AccountsReceivable.amount)).where(
        AccountsReceivable.due_date >= start_date,
        AccountsReceivable.due_date <= end_date
    )
    total_billed = float((await db.execute(rec_stmt)).scalar() or 0.0)
    
    # 2. CMV Real (Custo dos Produtos/Insumos Consumidos em OSs entregues no período)
    from backend.app.models.os import ServiceOrder, OSStatus
    from backend.app.models.lens import LensInventoryGrade
    
    os_stmt = select(ServiceOrder).options(
        selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
        selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model)
    ).where(
        ServiceOrder.created_at >= start_date,
        ServiceOrder.created_at <= end_date,
        ServiceOrder.status != OSStatus.CANCELADA
    )
    os_list = (await db.execute(os_stmt)).scalars().all()
    
    cmv_real = 0.0
    for os_item in os_list:
        if os_item.od_lens_inventory:
            cmp_od = float(os_item.od_lens_inventory.average_cost_price or (os_item.od_lens_inventory.lens_model.cost_price if os_item.od_lens_inventory.lens_model else 25.0))
            cmv_real += cmp_od
        if os_item.oe_lens_inventory:
            cmp_oe = float(os_item.oe_lens_inventory.average_cost_price or (os_item.oe_lens_inventory.lens_model.cost_price if os_item.oe_lens_inventory.lens_model else 25.0))
            cmv_real += cmp_oe

    # Margem Bruta
    gross_margin = total_billed - cmv_real
    
    # 3. Folha de Pagamento (Contas a Pagar pagas/vencidas da categoria 'FOLHA')
    folha_stmt = select(func.sum(AccountsPayable.amount_paid)).join(
        FinancialCategory, AccountsPayable.category_id == FinancialCategory.id, isouter=True
    ).where(
        AccountsPayable.due_date >= start_date,
        AccountsPayable.due_date <= end_date,
        or_(FinancialCategory.name.ilike("%FOLHA%"), AccountsPayable.description.ilike("%FOLHA%"), AccountsPayable.description.ilike("%SALARIO%"))
    )
    payroll = float((await db.execute(folha_stmt)).scalar() or 0.0)
    
    # 4. Outras Despesas Operacionais / Fornecedores
    total_despesas_stmt = select(func.sum(AccountsPayable.amount_paid)).where(
        AccountsPayable.due_date >= start_date,
        AccountsPayable.due_date <= end_date
    )
    total_paid = float((await db.execute(total_despesas_stmt)).scalar() or 0.0)
    other_expenses = max(0.0, total_paid - payroll)
    
    # 5. Lucro Líquido
    net_profit = gross_margin - payroll - other_expenses
    net_margin_pct = round((net_profit / total_billed * 100), 2) if total_billed > 0 else 0.0
    
    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "gross_revenue": round(total_billed, 2),
        "cmv_real": round(cmv_real, 2),
        "gross_margin": round(gross_margin, 2),
        "payroll": round(payroll, 2),
        "other_expenses": round(other_expenses, 2),
        "net_profit": round(net_profit, 2),
        "net_margin_pct": net_margin_pct
    }
