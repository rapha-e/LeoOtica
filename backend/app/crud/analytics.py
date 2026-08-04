from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.views import LensConsumptionVelocity
from backend.app.models.lens import LensInventoryGrade
from backend.app.models.os import ServiceOrder, OSWorkflowHistory, OSStatus
from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.optical_store import OpticalStore
from backend.app.models.movement import StockMovement
from backend.app.services.predictive import calculate_predictive_alerts

async def get_matrix_heatmap(db: AsyncSession, brand: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retorna os dados analíticos de consumo e giro a partir da View SQL.
    Opcionalmente filtra por marca/fabricante de lentes.
    """
    query = select(LensConsumptionVelocity)
    if brand:
        query = query.where(LensConsumptionVelocity.brand == brand)
        
    result = await db.execute(query)
    records = result.scalars().all()
    
    return [
        {
            "lens_inventory_id": r.lens_inventory_id,
            "brand": r.brand,
            "material": r.material,
            "spherical": float(r.spherical),
            "cylindrical": float(r.cylindrical),
            "quantity_available": r.quantity_available,
            "units_consumed_30_days": r.units_consumed_30_days,
            "daily_burn_rate": float(r.daily_burn_rate)
        }
        for r in records
    ]

async def get_funnel_metrics(db: AsyncSession) -> Dict[str, int]:
    """
    Calcula as métricas para o Funil Logístico:
    - Livres: Soma das quantidades físicas disponíveis nas gavetas.
    - Reservadas: Lentes atualmente associadas a OSs em produção (RESERVADO, CORTE, QUALIDADE).
    - Descartadas (Quebras): Total de lentes inutilizadas no laboratório.
    """
    # 1. Lentes Livres (Físicas disponíveis no estoque)
    query_free = select(func.sum(LensInventoryGrade.quantity_available))
    res_free = await db.execute(query_free)
    free_qty = res_free.scalar_one() or 0
    
    # 2. Lentes Reservadas (Associadas a OSs em produção)
    # Soma lentes OD e OE reservadas nas OSs ativas no fluxo de fabricação
    active_statuses = ["Separação", "Produção", "Montagem", "CQ"]
    query_res_od = select(func.count(ServiceOrder.od_lens_inventory_id)).where(ServiceOrder.status.in_(active_statuses))
    query_res_oe = select(func.count(ServiceOrder.oe_lens_inventory_id)).where(ServiceOrder.status.in_(active_statuses))
    
    res_od = await db.execute(query_res_od)
    res_oe = await db.execute(query_res_oe)
    
    reserved_qty = (res_od.scalar_one() or 0) + (res_oe.scalar_one() or 0)
    
    # 3. Lentes Descartadas (Quebradas fisicamente no facetamento/qualidade)
    # Contamos quantos logs de reprocesso por quebra existem no histórico do workflow
    query_broken = select(func.count(OSWorkflowHistory.id)).where(
        OSWorkflowHistory.operator_notes.like("%Quebra registrada no workflow%")
    )
    res_broken = await db.execute(query_broken)
    broken_events = res_broken.scalar_one() or 0
    
    # Cada evento de quebra consome o par de lentes alocadas OD/OE
    discarded_qty = broken_events * 2
    
    return {
        "free": free_qty,
        "reserved": reserved_qty,
        "discarded": discarded_qty
    }

async def get_manager_dashboard_data(db: AsyncSession) -> Dict[str, Any]:
    """
    Consolida as métricas gerenciais dos pilares Comercial, Produção e Estoque
    para o Dashboard do administrador.
    """
    limite_30_dias = datetime.utcnow() - timedelta(days=30)
    
    # --- 1. INDICADORES COMERCIAIS ---
    # Faturamento Total Geral
    query_fat = select(func.sum(BillingCycle.total_amount))
    res_fat = await db.execute(query_fat)
    faturamento = float(res_fat.scalar() or 0.0)
    
    # Faturamento Pago vs Pendente
    query_fat_paid = select(func.sum(BillingCycle.total_amount)).where(BillingCycle.status == "PAGO")
    res_fat_paid = await db.execute(query_fat_paid)
    faturamento_pago = float(res_fat_paid.scalar() or 0.0)
    
    faturamento_pendente = round(faturamento - faturamento_pago, 2)
    
    # Ticket Médio: Faturamento Total / Total OSs faturadas (tamanho de billing_items)
    query_items = select(func.count(BillingItem.id))
    res_items = await db.execute(query_items)
    total_os_faturadas = res_items.scalar() or 0
    
    ticket_medio = round(faturamento / total_os_faturadas, 2) if total_os_faturadas > 0 else 0.0
    
    # Óticas Ativas
    query_stores = select(func.count(OpticalStore.id)).where(OpticalStore.is_active == True)
    res_stores = await db.execute(query_stores)
    oticas_ativas = res_stores.scalar() or 0
    
    # --- 2. INDICADORES DE PRODUÇÃO ---
    # OS Abertas (qualquer status diferente de Expedição e Cancelada)
    query_abertas = select(func.count(ServiceOrder.id)).where(
        ServiceOrder.status != OSStatus.EXPEDICAO,
        ServiceOrder.status != OSStatus.CANCELADA
    )
    res_abertas = await db.execute(query_abertas)
    os_abertas = res_abertas.scalar() or 0
    
    # OS Concluídas (status igual a Expedição)
    query_concluidas = select(func.count(ServiceOrder.id)).where(ServiceOrder.status == OSStatus.EXPEDICAO)
    res_concluidas = await db.execute(query_concluidas)
    os_concluidas = res_concluidas.scalar() or 0
    
    # SLA (Tempo de Entrega) em dias nos últimos 30 dias
    query_sla = (
        select(
            ServiceOrder.created_at.label("os_created"),
            OSWorkflowHistory.changed_at.label("trans_created")
        )
        .join(OSWorkflowHistory, OSWorkflowHistory.service_order_id == ServiceOrder.id)
        .where(OSWorkflowHistory.new_status == OSStatus.EXPEDICAO)
        .where(OSWorkflowHistory.changed_at >= limite_30_dias)
    )
    res_sla = await db.execute(query_sla)
    sla_rows = res_sla.all()
    
    if sla_rows:
        total_days = 0.0
        for row in sla_rows:
            delta = row.trans_created - row.os_created
            total_days += delta.total_seconds() / 86400.0
        sla_average_days = round(total_days / len(sla_rows), 2)
    else:
        sla_average_days = 0.0
        
    # --- 3. INDICADORES DE ESTOQUE ---
    # Rupturas: itens com quantity_available == 0
    query_rupturas = select(func.count(LensInventoryGrade.id)).where(LensInventoryGrade.quantity_available == 0)
    res_rupturas = await db.execute(query_rupturas)
    rupturas = res_rupturas.scalar() or 0
    
    # Giro: consumo últimos 30 dias / estoque total disponível
    query_consumo = (
        select(func.sum(StockMovement.quantity))
        .where(StockMovement.movement_type == "OUT")
        .where(StockMovement.movement_date >= limite_30_dias)
    )
    res_consumo = await db.execute(query_consumo)
    consumo_qty = res_consumo.scalar() or 0
    
    query_total_stock = select(func.sum(LensInventoryGrade.quantity_available))
    res_total_stock = await db.execute(query_total_stock)
    total_stock_qty = res_total_stock.scalar() or 0
    
    giro = round(float(consumo_qty) / float(total_stock_qty), 4) if total_stock_qty > 0 else 0.0
    
    # Compras sugeridas (Alertas preditivos ativos)
    alerts = await calculate_predictive_alerts(db, lead_time_days=7, safety_days=5, coverage_days=15)
    compras = sum(1 for item in alerts if item.get("suggested_purchase", 0) > 0)
    
    return {
        "comercial": {
            "faturamento": faturamento,
            "faturamento_pago": faturamento_pago,
            "faturamento_pendente": faturamento_pendente,
            "ticket_medio": ticket_medio,
            "oticas_ativas": oticas_ativas,
            "total_os_faturadas": total_os_faturadas
        },
        "producao": {
            "os_abertas": os_abertas,
            "os_concluidas": os_concluidas,
            "sla_average_days": sla_average_days
        },
        "estoque": {
            "rupturas": rupturas,
            "giro": giro,
            "compras": compras,
            "total_stock_qty": total_stock_qty,
            "consumo_30_dias": consumo_qty
        }
    }
