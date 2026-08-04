from datetime import datetime, timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from backend.app.core.database import get_db
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.billing import BillingCycle
from backend.app.models.lens import LensInventoryGrade, LensModel

router = APIRouter()

def _today_range():
    """Retorna (inicio_dia, fim_dia) em UTC."""
    now = datetime.utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


@router.get("/producao", include_in_schema=True)
async def tv_producao(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Painel de TV - Producao.
    Dados publicos (sem autenticacao) para exibicao em televisao.
    """
    start, end = _today_range()

    # Contagem por status
    status_counts = {}
    for s in OSStatus:
        result = await db.execute(
            select(func.count(ServiceOrder.id))
            .where(ServiceOrder.status == s)
        )

        status_counts[s.value] = result.scalar() or 0

    # OS finalizadas hoje (EXPEDICAO com updated_at hoje)
    producao_hoje = await db.execute(
        select(func.count(ServiceOrder.id))
        .where(
            ServiceOrder.status == OSStatus.EXPEDICAO,
            ServiceOrder.updated_at >= start,
            ServiceOrder.updated_at < end,
        )
    )
    producao_hoje_count = producao_hoje.scalar() or 0

    # Retrabalho hoje
    retrabalho = await db.execute(
        select(func.count(ServiceOrder.id))
        .where(ServiceOrder.is_rework == True, ServiceOrder.updated_at >= start)
    )
    retrabalho_count = retrabalho.scalar() or 0

    # SLA: OSs com mais de 3 dias abertas (atrasadas)
    tres_dias_atras = datetime.utcnow() - timedelta(days=3)
    atrasadas = await db.execute(
        select(func.count(ServiceOrder.id))
        .where(
            ServiceOrder.status.not_in([OSStatus.EXPEDICAO, OSStatus.CANCELADA]),
            ServiceOrder.is_deleted == False,
            ServiceOrder.created_at < tres_dias_atras,
        )
    )
    atrasadas_count = atrasadas.scalar() or 0
    total_abertas = sum(v for k, v in status_counts.items() if k not in ['EXPEDICAO', 'CANCELADA'])
    sla_pct = round((1 - (atrasadas_count / max(total_abertas, 1))) * 100, 1)

    # Ultimas 5 OSs em expedicao hoje
    ultimas_query = await db.execute(
        select(ServiceOrder)
        .where(
            ServiceOrder.status == OSStatus.EXPEDICAO,
            ServiceOrder.updated_at >= start,
        )
        .order_by(ServiceOrder.updated_at.desc())
        .limit(5)
    )
    ultimas = [
        {"os_number": os.os_number, "client_name": os.client_name, "updated_at": os.updated_at.isoformat()}
        for os in ultimas_query.scalars().all()
    ]

    return {
        "panel": "producao",
        "atualizado_em": datetime.utcnow().isoformat(),
        "data": datetime.utcnow().strftime("%d/%m/%Y"),
        "hora": datetime.utcnow().strftime("%H:%M"),
        "kpis": {
            "producao_hoje": producao_hoje_count,
            "pendencias": status_counts.get("RECEBIDA", 0) + status_counts.get("SEPARACAO", 0),
            "em_producao": status_counts.get("PRODUCAO", 0),
            "montagem": status_counts.get("MONTAGEM", 0),
            "cq": status_counts.get("CQ", 0),
            "expedicao": status_counts.get("EXPEDICAO", 0),
            "retrabalho_hoje": retrabalho_count,
            "sla_pct": sla_pct,
        },
        "workflow": [
            {"etapa": "Recebidas", "icone": "inbox", "quantidade": status_counts.get("RECEBIDA", 0)},
            {"etapa": "Separacao", "icone": "package", "quantidade": status_counts.get("SEPARACAO", 0)},
            {"etapa": "Producao", "icone": "cpu", "quantidade": status_counts.get("PRODUCAO", 0)},
            {"etapa": "Montagem", "icone": "scissors", "quantidade": status_counts.get("MONTAGEM", 0)},
            {"etapa": "CQ", "icone": "shield", "quantidade": status_counts.get("CQ", 0)},
            {"etapa": "Expedicao", "icone": "truck", "quantidade": status_counts.get("EXPEDICAO", 0)},
        ],
        "ultimas_expedicoes": ultimas,
    }


@router.get("/comercial", include_in_schema=True)
async def tv_comercial(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Painel de TV - Comercial. Publico, sem autenticacao."""
    start, end = _today_range()

    # OSs do dia
    os_hoje = await db.execute(
        select(func.count(ServiceOrder.id))
        .where(ServiceOrder.created_at >= start, ServiceOrder.created_at < end, ServiceOrder.is_deleted == False)
    )
    os_hoje_count = os_hoje.scalar() or 0

    # Total de clientes unicos com OS em aberto
    clientes_ativos = await db.execute(
        select(func.count(func.distinct(ServiceOrder.client_name)))
        .where(ServiceOrder.status.not_in([OSStatus.CANCELADA]), ServiceOrder.is_deleted == False)
    )
    clientes_ativos_count = clientes_ativos.scalar() or 0

    # Ranking de oticas com mais OS abertas
    ranking_query = await db.execute(
        select(OpticalStore.trade_name, func.count(ServiceOrder.id).label("total"))
        .join(ServiceOrder, ServiceOrder.optical_store_id == OpticalStore.id)
        .where(ServiceOrder.status.not_in([OSStatus.CANCELADA]), ServiceOrder.is_deleted == False)
        .group_by(OpticalStore.trade_name)
        .order_by(func.count(ServiceOrder.id).desc())
        .limit(5)
    )
    ranking = [{"otica": row[0], "total": row[1]} for row in ranking_query.all()]

    return {
        "panel": "comercial",
        "atualizado_em": datetime.utcnow().isoformat(),
        "data": datetime.utcnow().strftime("%d/%m/%Y"),
        "hora": datetime.utcnow().strftime("%H:%M"),
        "kpis": {
            "os_hoje": os_hoje_count,
            "clientes_ativos": clientes_ativos_count,
        },
        "ranking_oticas": ranking,
    }


@router.get("/estoque", include_in_schema=True)
async def tv_estoque(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Painel de TV - Estoque. Publico, sem autenticacao."""

    # Total de lentes em estoque
    total_lentes = await db.execute(select(func.sum(LensInventoryGrade.quantity_available)))
    total_lentes_val = total_lentes.scalar() or 0

    # Alertas criticos: lentes com estoque <= 5
    criticos = await db.execute(
        select(LensModel.brand, LensModel.material, LensInventoryGrade.spherical,
               LensInventoryGrade.cylindrical, LensInventoryGrade.quantity_available)
        .join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id)
        .where(LensInventoryGrade.quantity_available <= 5)
        .order_by(LensInventoryGrade.quantity_available.asc())
        .limit(10)
    )
    alertas = [
        {
            "descricao": f"{row[0]} {row[1]} Esf:{row[2]} Cil:{row[3]}",
            "saldo": row[4]
        }
        for row in criticos.all()
    ]

    # Modelos de lentes ativos
    modelos = await db.execute(select(func.count(LensModel.id)))
    modelos_count = modelos.scalar() or 0

    # Itens zerados
    zerados = await db.execute(
        select(func.count(LensInventoryGrade.id))
        .where(LensInventoryGrade.quantity_available <= 0)
    )
    zerados_count = zerados.scalar() or 0

    return {
        "panel": "estoque",
        "atualizado_em": datetime.utcnow().isoformat(),
        "data": datetime.utcnow().strftime("%d/%m/%Y"),
        "hora": datetime.utcnow().strftime("%H:%M"),
        "kpis": {
            "total_unidades": int(total_lentes_val),
            "modelos_ativos": modelos_count,
            "itens_zerados": zerados_count,
            "alertas_criticos": len(alertas),
        },
        "alertas_ruptura": alertas,
    }


@router.get("/financeiro", include_in_schema=True)
async def tv_financeiro(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Painel de TV - Financeiro. Publico, sem autenticacao."""
    start, end = _today_range()

    # Faturamento do dia (ciclos fechados hoje)
    fat_hoje = await db.execute(
        select(func.sum(BillingCycle.total_amount))
        .where(BillingCycle.created_at >= start, BillingCycle.created_at < end)
    )
    fat_hoje_val = float(fat_hoje.scalar() or 0)

    # Total em aberto (FECHADO, nao pago)
    em_aberto = await db.execute(
        select(func.sum(BillingCycle.total_amount))
        .where(BillingCycle.status == "FECHADO")
    )
    em_aberto_val = float(em_aberto.scalar() or 0)

    # Inadimplentes
    hoje = datetime.utcnow()
    inadimplentes = await db.execute(
        select(func.count(BillingCycle.id))
        .where(BillingCycle.status == "FECHADO", BillingCycle.due_date < hoje)
    )
    inadimplentes_count = inadimplentes.scalar() or 0

    # Total pago no mes
    mes_inicio = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    pago_mes = await db.execute(
        select(func.sum(BillingCycle.total_amount))
        .where(BillingCycle.status == "PAGO", BillingCycle.paid_at >= mes_inicio)
    )
    pago_mes_val = float(pago_mes.scalar() or 0)

    return {
        "panel": "financeiro",
        "atualizado_em": datetime.utcnow().isoformat(),
        "data": datetime.utcnow().strftime("%d/%m/%Y"),
        "hora": datetime.utcnow().strftime("%H:%M"),
        "kpis": {
            "faturamento_hoje": fat_hoje_val,
            "em_aberto": em_aberto_val,
            "pago_mes": pago_mes_val,
            "inadimplentes": inadimplentes_count,
        },
    }
