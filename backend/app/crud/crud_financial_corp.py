import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable, CostCenter, FinancialCategory
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
        existing = (await db.execute(rec_stmt)).scalar_one_or_none()
        
        if not existing:
            status = "RECEBIDO" if cycle.status == "PAGO" else "PENDENTE"
            due_dt = cycle.due_date or (cycle.created_at + timedelta(days=15))
            
            # Se a data de vencimento já passou e não foi pago, marca como ATRASADO
            if status == "PENDENTE" and due_dt < datetime.utcnow():
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
    
    now = datetime.utcnow()
    stmt = select(AccountsReceivable).where(
        and_(
            AccountsReceivable.optical_store_id == store_id,
            AccountsReceivable.status.in_(["PENDENTE", "ATRASADO", "RECEBIDO_PARCIAL"]),
            AccountsReceivable.due_date < now
        )
    )
    result = await db.execute(stmt)
    overdue_items = result.scalars().all()
    
    if not overdue_items:
        return {
            "is_delinquent": False,
            "overdue_count": 0,
            "total_overdue_amount": 0.0,
            "max_overdue_days": 0,
            "items": []
        }
        
    total_amount = sum(item.amount - item.amount_received for item in overdue_items)
    max_days = max((now - item.due_date).days for item in overdue_items)
    
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
                "days_overdue": (now - item.due_date).days
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
    now = datetime.utcnow()
    
    res = []
    for item in items:
        days_overdue = 0
        current_status = item.status
        if current_status != "RECEBIDO" and item.due_date < now:
            current_status = "ATRASADO"
            days_overdue = max(1, (now - item.due_date).days)
        elif current_status == "ATRASADO":
            days_overdue = max(1, (now - item.due_date).days)
            
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
        rec.received_at = datetime.utcnow()
    else:
        rec.status = "RECEBIDO_PARCIAL"
        
    if notes:
        rec.notes = (rec.notes or "") + f"\n[{datetime.utcnow().strftime('%Y-%m-%d %H:%M')}] Baixa de R$ {payment_amount:.2f}: {notes}"
        
    # Sincroniza o BillingCycle se aplicável
    if rec.billing_cycle_id and rec.status == "RECEBIDO":
        cycle_stmt = select(BillingCycle).where(BillingCycle.id == rec.billing_cycle_id)
        cycle = (await db.execute(cycle_stmt)).scalar_one_or_none()
        if cycle:
            cycle.status = "PAGO"
            cycle.paid_at = datetime.utcnow()
            
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
    now = datetime.utcnow()
    
    res = []
    for item in items:
        days_overdue = 0
        current_status = item.status
        if current_status in ["PENDENTE", "PAGO_PARCIAL"] and item.due_date < now:
            days_overdue = (now - item.due_date).days
            
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
    stmt = select(AccountsPayable).where(AccountsPayable.id == payable_id)
    pay = (await db.execute(stmt)).scalar_one_or_none()
    if not pay:
        raise ValueError("Conta a pagar não encontrada.")
        
    payment_dec = Decimal(str(payment_amount))
    pay.amount_paid = (Decimal(str(pay.amount_paid)) if pay.amount_paid is not None else Decimal("0.0")) + payment_dec
    if pay.amount_paid >= pay.amount:
        pay.amount_paid = pay.amount
        pay.status = "PAGO"
        pay.payment_date = datetime.utcnow()
    else:
        pay.status = "PAGO_PARCIAL"
        
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
    now = datetime.utcnow()
    
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
