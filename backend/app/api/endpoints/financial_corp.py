import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_admin, get_current_active_operator

from backend.app.models.user import User
from backend.app.crud import crud_financial_corp

router = APIRouter()

@router.get("/receivables")
async def list_receivables(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o relatório de Contas a Receber (Exclusivo Administrador).
    """
    return await crud_financial_corp.get_accounts_receivable(db, status_filter)

@router.post("/receivables/{receivable_id}/pay")
async def receive_payment_endpoint(
    receivable_id: uuid.UUID,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Registra recebimento total ou parcial de um título a receber.
    """
    amount = float(payload.get("amount", 0.0))
    notes = payload.get("notes")
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor de pagamento inválido.")
    return await crud_financial_corp.receive_payment(db, receivable_id, amount, notes)

@router.get("/payables")
async def list_payables(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o relatório de Contas a Pagar (Exclusivo Administrador).
    """
    return await crud_financial_corp.get_accounts_payable(db, status_filter)

@router.post("/payables")
async def create_payable_endpoint(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Cadastra um novo título a pagar.
    """
    from datetime import datetime
    if "due_date" in payload and isinstance(payload["due_date"], str):
        payload["due_date"] = datetime.fromisoformat(payload["due_date"].replace("Z", ""))
    return await crud_financial_corp.create_account_payable(db, payload)

@router.post("/payables/{payable_id}/pay")
async def pay_payable_endpoint(
    payable_id: uuid.UUID,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Registra pagamento de uma conta a pagar.
    """
    amount = float(payload.get("amount", 0.0))
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor de pagamento inválido.")
    return await crud_financial_corp.pay_account_payable(db, payable_id, amount)

@router.post("/payables/{payable_id}/dismiss-alert")
async def dismiss_payable_alert_endpoint(
    payable_id: uuid.UUID,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Dispensa o alerta de vencimento para uma conta a pagar (o operador opta por não alertar mais).
    """
    try:
        return await crud_financial_corp.dismiss_payable_alert(db, payable_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/payables/{payable_id}/reactivate-alert")
async def reactivate_payable_alert_endpoint(
    payable_id: uuid.UUID,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Reativa o alerta de vencimento para uma conta a pagar previamente silenciada.
    """
    try:
        return await crud_financial_corp.reactivate_payable_alert(db, payable_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/cash-flow")
async def get_cash_flow_endpoint(
    timeframe: str = Query("monthly"),
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o Fluxo de Caixa projetado e realizado (Exclusivo Administrador).
    """
    return await crud_financial_corp.get_cash_flow(db, timeframe)

@router.get("/kpis-executive")
async def get_executive_kpis_endpoint(
    current_user: User = Depends(get_current_active_operator),

    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o resumo executivo dos Indicadores Financeiros (Exclusivo Administrador).
    """
    return await crud_financial_corp.get_executive_financial_kpis(db)

@router.get("/delinquency-check/{store_id}")
async def check_store_delinquency_endpoint(
    store_id: uuid.UUID,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Verifica se a ótica solicitante possui títulos vencidos e retorna alertas e política.
    """
    from backend.app.crud.crud_system_parameters import get_parameter
    delinquency_info = await crud_financial_corp.check_optical_store_delinquency(db, store_id)
    delinquency_info["policy"] = await get_parameter(db, "financial_delinquency_policy", "POLICY_ALERT")
    return delinquency_info

@router.get("/overdue-alerts")
async def get_overdue_alerts_endpoint(
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Central de Alertas Financeiros consolidada (Recebíveis vencidos + Contas a Pagar com alerta ativo).
    """
    await crud_financial_corp.sync_billing_cycles_to_receivables(db)
    receivables = await crud_financial_corp.get_accounts_receivable(db)
    payables = await crud_financial_corp.get_accounts_payable(db)
    
    overdue_items = [r for r in receivables if r["days_overdue"] > 0 or r["status"] == "ATRASADO"]
    due_today_items = [r for r in receivables if r["days_overdue"] == 0 and r["status"] in ["PENDENTE", "RECEBIDO_PARCIAL"]]
    due_in_7_days = [r for r in receivables if 0 <= r["days_overdue"] >= -7 and r["status"] in ["PENDENTE", "RECEBIDO_PARCIAL"]]
    
    delinquent_stores = set(r["optical_store_name"] for r in overdue_items)

    # Alertas ativos de Contas a Pagar (não dispensados pelo operador)
    payable_alerts = [p for p in payables if p.get("is_alert_active")]
    payable_overdue = [p for p in payable_alerts if p.get("days_overdue", 0) > 0]
    payable_due_today = [p for p in payable_alerts if p.get("days_until_due") == 0]
    payable_due_soon = [p for p in payable_alerts if p.get("days_until_due", 0) > 0]
    
    return {
        "overdue_count": len(overdue_items),
        "total_overdue_amount": float(sum(r["balance_due"] for r in overdue_items)),
        "delinquent_stores_count": len(delinquent_stores),
        "due_today_count": len(due_today_items),
        "due_in_7_days_count": len(due_in_7_days),
        "overdue_items": overdue_items[:10],
        # Contas a Pagar
        "payable_alerts_count": len(payable_alerts),
        "payable_overdue_count": len(payable_overdue),
        "payable_due_today_count": len(payable_due_today),
        "payable_due_soon_count": len(payable_due_soon),
        "payable_total_alert_amount": float(sum(p["balance_due"] for p in payable_alerts)),
        "payable_alerts": payable_alerts
    }

@router.get("/dre")
async def get_consolidated_dre_endpoint(
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a Demonstração do Resultado do Exercício (DRE Consolidado).
    Calcula: Faturamento Bruto - CMV Real - Despesas Operacionais - Folha = Lucro Líquido.
    """
    return await crud_financial_corp.get_consolidated_dre(db)
