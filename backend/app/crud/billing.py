import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensInventoryGrade



async def get_pending_billing_groups(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Busca todas as OSs no status Expedição que não tenham nenhum faturamento associado,
    agrupando os totais por ótica parceira.
    """
    # Auto-associa OSs orfãs (sem ótica vinculada) à primeira ótica cadastrada
    VALID_BILLING_STATUSES = [
        OSStatus.EXPEDICAO, OSStatus.CONCLUIDA, OSStatus.ENTREGUE,
        "Expedição", "EXPEDICAO", "Concluída", "CONCLUIDA", "Entregue", "ENTREGUE"
    ]
    first_store = (await db.execute(select(OpticalStore).limit(1))).scalar_one_or_none()
    if first_store:
        unassigned_query = select(ServiceOrder).where(
            and_(
                ServiceOrder.status.in_(VALID_BILLING_STATUSES),
                ServiceOrder.optical_store_id == None
            )
        )
        unassigned_os = (await db.execute(unassigned_query)).scalars().all()
        if unassigned_os:
            for os_item in unassigned_os:
                os_item.optical_store_id = first_store.id
            await db.commit()

    query = (
        select(
            OpticalStore.id.label("optical_store_id"),
            OpticalStore.trade_name.label("optical_store_name"),
            func.count(ServiceOrder.id).label("pending_os_count"),
            func.sum(ServiceOrder.total_amount).label("estimated_total_amount")
        )
        .join(ServiceOrder, ServiceOrder.optical_store_id == OpticalStore.id)
        .outerjoin(BillingItem, BillingItem.service_order_id == ServiceOrder.id)
        .where(
            and_(
                ServiceOrder.status.in_(VALID_BILLING_STATUSES),
                BillingItem.id == None
            )
        )
        .group_by(OpticalStore.id, OpticalStore.trade_name)
    )
    
    result = await db.execute(query)
    groups = result.all()
    
    # Converter para lista de dicionários para corresponder ao schema
    return [
        {
            "optical_store_id": g.optical_store_id,
            "optical_store_name": g.optical_store_name,
            "pending_os_count": g.pending_os_count,
            "estimated_total_amount": float(g.estimated_total_amount or 0.0)
        }
        for g in groups
    ]

async def get_pending_orders_by_store(db: AsyncSession, store_id: uuid.UUID) -> List[ServiceOrder]:
    """
    Retorna os detalhes de todas as OSs finalizadas elegíveis para faturamento de uma ótica específica.
    """
    VALID_BILLING_STATUSES = [
        OSStatus.EXPEDICAO, OSStatus.CONCLUIDA, OSStatus.ENTREGUE,
        "Expedição", "EXPEDICAO", "Concluída", "CONCLUIDA", "Entregue", "ENTREGUE"
    ]
    query = (
        select(ServiceOrder)
        .outerjoin(BillingItem, BillingItem.service_order_id == ServiceOrder.id)
        .where(
            and_(
                ServiceOrder.optical_store_id == store_id,
                ServiceOrder.status.in_(VALID_BILLING_STATUSES),
                BillingItem.id == None
            )
        )
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.optical_store),
            selectinload(ServiceOrder.items)
        )
        .order_by(ServiceOrder.created_at.asc())
    )
    result = await db.execute(query)
    orders = list(result.scalars().all())
    for o in orders:
        enrich_billing_item(o)
    return orders


def enrich_billing_item(item):
    order = getattr(item, "service_order", None) or item

    
    # 1. Tipo de Lente & 2. Tratamentos
    lens_parts = []
    treat_parts = []
    
    if getattr(order, "od_lens_inventory", None) and order.od_lens_inventory.lens_model:
        m = order.od_lens_inventory.lens_model
        lens_parts.append(f"{m.brand} {m.material} (n={m.refractive_index})")
        if m.treatment and m.treatment not in treat_parts:
            treat_parts.append(m.treatment)

    if getattr(order, "oe_lens_inventory", None) and order.oe_lens_inventory.lens_model:
        m = order.oe_lens_inventory.lens_model
        oe_txt = f"{m.brand} {m.material} (n={m.refractive_index})"
        if oe_txt not in lens_parts:
            lens_parts.append(oe_txt)
        if m.treatment and m.treatment not in treat_parts:
            treat_parts.append(m.treatment)

    if not lens_parts and getattr(order, "items", None):
        prod_items = [i for i in order.items if getattr(i, "entity_type", "") == 'product']
        for p in prod_items:
            lens_parts.append("Lente Oftálmica Personalizada")

    item.lens_type = ", ".join(lens_parts) if lens_parts else "Lente Visão Simples / Multifocal Digital"

    if getattr(order, "items", None):
        t_items = [i for i in order.items if getattr(i, "entity_type", "") == 'treatment']
        for t in t_items:
            treat_parts.append("Tratamento Antirreflexo / UV")

    if not treat_parts:
        if getattr(order, "clinical_notes", None) and "crizal" in str(order.clinical_notes).lower():
            treat_parts.append("Anti-Reflexo Crizal Sapphire")
        else:
            treat_parts.append("Anti-Reflexo Premium, Filtro Azul UV400")

    item.treatments = ", ".join(treat_parts)


    # 3. Serviços Realizados
    serv_parts = []
    if getattr(order, "items", None):
        s_items = [i for i in order.items if getattr(i, "entity_type", "") == 'service']
        for s in s_items:
            serv_parts.append(f"Serviço Laboratorial")
            
    if not serv_parts:
        serv_parts.append("Surfaçagem Digital, Facetamento e Montagem")

    item.services = ", ".join(serv_parts)
    return item

async def get_billing_cycle(db: AsyncSession, cycle_id: uuid.UUID) -> Optional[BillingCycle]:
    """
    Busca o fechamento financeiro detalhado com pré-carregamento de ótica e itens/OSs.
    """
    query = (
        select(BillingCycle)
        .where(BillingCycle.id == cycle_id)
        .options(
            selectinload(BillingCycle.optical_store),
            selectinload(BillingCycle.items).selectinload(BillingItem.service_order).selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(BillingCycle.items).selectinload(BillingItem.service_order).selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(BillingCycle.items).selectinload(BillingItem.service_order).selectinload(ServiceOrder.items),
            selectinload(BillingCycle.nfe_saida)
        )
    )
    result = await db.execute(query)
    cycle = result.scalar_one_or_none()
    if cycle:
        for item in cycle.items:
            enrich_billing_item(item)
    return cycle


async def list_billing_cycles(
    db: AsyncSession,
    optical_store_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 100
) -> List[BillingCycle]:
    """
    Lista os fechamentos gerados no sistema.
    """
    query = select(BillingCycle).options(
        selectinload(BillingCycle.optical_store),
        selectinload(BillingCycle.items).selectinload(BillingItem.service_order),
        selectinload(BillingCycle.nfe_saida)
    )
    
    if optical_store_id:
        query = query.where(BillingCycle.optical_store_id == optical_store_id)
        
    query = query.order_by(BillingCycle.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())

async def create_billing_cycle(
    db: AsyncSession,
    optical_store_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime,
    service_order_ids: List[uuid.UUID],
    due_date: Optional[datetime] = None
) -> BillingCycle:
    """
    Cria um ciclo de faturamento para as ordens de serviço passadas.
    Lança ValueError caso uma das ordens não seja elegível ou pertença a outra ótica.
    """
    from datetime import timezone
    if start_date.tzinfo is not None:
        start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
    if end_date.tzinfo is not None:
        end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
    if due_date and due_date.tzinfo is not None:
        due_date = due_date.astimezone(timezone.utc).replace(tzinfo=None)

    if not service_order_ids:
        raise ValueError("Pelo menos uma Ordem de Serviço deve ser selecionada para o faturamento.")
        
    # Verificar se a ótica existe
    store_query = select(OpticalStore).where(OpticalStore.id == optical_store_id)
    store_result = await db.execute(store_query)
    store = store_result.scalar_one_or_none()
    if not store:
        raise ValueError("Ótica comercial não encontrada.")
        
    # Buscar as OSs solicitadas
    os_query = (
        select(ServiceOrder)
        .outerjoin(BillingItem, BillingItem.service_order_id == ServiceOrder.id)
        .where(ServiceOrder.id.in_(service_order_ids))
        .options(selectinload(ServiceOrder.items))
    )
    os_result = await db.execute(os_query)
    orders = os_result.scalars().all()
    
    # Validar se todas as OSs solicitadas existem
    found_ids = {order.id for order in orders}
    missing_ids = set(service_order_ids) - found_ids
    if missing_ids:
        raise ValueError(f"As seguintes Ordens de Serviço não foram encontradas: {list(missing_ids)}")
        
    # Validar restrições para cada OS
    total_amount = 0.0
    for order in orders:
        if order.optical_store_id != optical_store_id:
            raise ValueError(f"A OS {order.os_number} pertence a outra ótica.")
            
        if st_val not in ["Expedição", "EXPEDICAO", OSStatus.EXPEDICAO, "Concluída", "CONCLUIDA", OSStatus.CONCLUIDA, "Entregue", "ENTREGUE", OSStatus.ENTREGUE]:
            raise ValueError(f"A OS {order.os_number} não está em um status expedido ou concluído (Status atual: {st_val}).")

            
        # Verificar se já tem faturamento associado (para evitar duplicidade)
        billing_item_query = select(BillingItem).where(BillingItem.service_order_id == order.id)
        bi_result = await db.execute(billing_item_query)
        if bi_result.scalar_one_or_none() is not None:
            raise ValueError(f"A OS {order.os_number} já foi faturada em outro ciclo.")
            
        total_amount += float(order.total_amount)
        
    if not due_date:
        from datetime import timedelta
        due_date = datetime.utcnow() + timedelta(days=10)
        
    # Criar o ciclo de faturamento
    db_cycle = BillingCycle(
        optical_store_id=optical_store_id,
        start_date=start_date,
        end_date=end_date,
        status="FECHADO",
        total_amount=total_amount,
        created_at=datetime.utcnow(),
        closed_at=datetime.utcnow(),
        due_date=due_date
    )
    db.add(db_cycle)
    # Dar flush para obter o ID do ciclo
    await db.flush()
    
    # Criar os itens de faturamento
    for order in orders:
        db_item = BillingItem(
            billing_cycle_id=db_cycle.id,
            service_order_id=order.id,
            amount=float(order.total_amount),
            created_at=datetime.utcnow()
        )
        db.add(db_item)
        
    await db.commit()
    
    # Recarregar o ciclo com os relacionamentos pré-carregados
    return await get_billing_cycle(db, db_cycle.id)

async def pay_billing_cycle(db: AsyncSession, cycle_id: uuid.UUID) -> Optional[BillingCycle]:
    """
    Registra a quitação e pagamento de um ciclo de faturamento.
    """
    db_cycle = await get_billing_cycle(db, cycle_id)
    if not db_cycle:
        return None
        
    if db_cycle.status == "PAGO":
        return db_cycle
        
    db_cycle.status = "PAGO"
    db_cycle.paid_at = datetime.utcnow()
    
    db.add(db_cycle)
    await db.commit()
    await db.refresh(db_cycle)
    
    return db_cycle


async def get_receivables_kpis(db: AsyncSession) -> Dict[str, Any]:
    """
    Calcula estatísticas de Contas a Receber: total pago, pendente e inadimplente (atrasado).
    """
    now = datetime.utcnow()
    
    # Faturas pagas
    paid_query = select(func.sum(BillingCycle.total_amount), func.count(BillingCycle.id)).where(BillingCycle.status == "PAGO")
    paid_res = await db.execute(paid_query)
    paid_sum, paid_count = paid_res.first()
    
    # Faturas pendentes (dentro do prazo)
    pending_query = select(func.sum(BillingCycle.total_amount), func.count(BillingCycle.id)).where(
        and_(
            BillingCycle.status == "FECHADO",
            or_(BillingCycle.due_date >= now, BillingCycle.due_date == None)
        )
    )
    pending_res = await db.execute(pending_query)
    pending_sum, pending_count = pending_res.first()
    
    # Faturas vencidas / inadimplentes
    overdue_query = select(func.sum(BillingCycle.total_amount), func.count(BillingCycle.id)).where(
        and_(
            BillingCycle.status == "FECHADO",
            BillingCycle.due_date < now
        )
    )
    overdue_res = await db.execute(overdue_query)
    overdue_sum, overdue_count = overdue_res.first()
    
    return {
        "total_paid": float(paid_sum or 0.0),
        "count_paid": int(paid_count or 0),
        "total_pending": float(pending_sum or 0.0),
        "count_pending": int(pending_count or 0),
        "total_overdue": float(overdue_sum or 0.0),
        "count_overdue": int(overdue_count or 0)
    }
