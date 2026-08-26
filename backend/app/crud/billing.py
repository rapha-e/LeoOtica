import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.billing import BillingCycle, BillingItem
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensInventoryGrade


def clean_store_name(name: Optional[str]) -> str:
    """
    Normaliza o nome da ótica parceira removendo sufixos alfanuméricos/UUIDs de teste.
    Exemplo: "Ótica Visão Futura 2b3779e7" -> "Ótica Visão Futura"
    """
    if not name:
        return "Ótica Parceira"
    cleaned = re.sub(r'\s+[a-f0-9]{4,32}$', '', name.strip(), flags=re.IGNORECASE)
    return cleaned.strip() or name.strip()


async def get_pending_billing_groups(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Busca todas as OSs no status Expedição/Concluída/Entregue que não tenham nenhum faturamento associado,
    agrupando os totais pelo nome normalizado da ótica parceira.
    """
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
            ServiceOrder.id.label("os_id"),
            ServiceOrder.total_amount.label("total_amount")
        )
        .join(ServiceOrder, ServiceOrder.optical_store_id == OpticalStore.id)
        .outerjoin(BillingItem, BillingItem.service_order_id == ServiceOrder.id)
        .where(
            and_(
                ServiceOrder.status.in_(VALID_BILLING_STATUSES),
                BillingItem.id == None
            )
        )
    )
    
    result = await db.execute(query)
    rows = result.all()

    # Agrupar em memória pelo nome limpo da ótica
    grouped_map: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        c_name = clean_store_name(r.optical_store_name)
        if c_name not in grouped_map:
            grouped_map[c_name] = {
                "optical_store_id": r.optical_store_id,
                "optical_store_name": c_name,
                "pending_os_count": 0,
                "estimated_total_amount": 0.0
            }
        grouped_map[c_name]["pending_os_count"] += 1
        grouped_map[c_name]["estimated_total_amount"] += float(r.total_amount or 0.0)

    return list(grouped_map.values())


async def get_pending_orders_by_store(db: AsyncSession, store_id: uuid.UUID) -> List[ServiceOrder]:
    """
    Retorna os detalhes de todas as OSs finalizadas elegíveis para faturamento de uma ótica específica
    (incluindo óticas que possuem o mesmo nome base normalizado).
    """
    VALID_BILLING_STATUSES = [
        OSStatus.EXPEDICAO, OSStatus.CONCLUIDA, OSStatus.ENTREGUE,
        "Expedição", "EXPEDICAO", "Concluída", "CONCLUIDA", "Entregue", "ENTREGUE"
    ]
    target_store = (await db.execute(select(OpticalStore).where(OpticalStore.id == store_id))).scalar_one_or_none()
    store_ids = [store_id]
    if target_store:
        target_clean_name = clean_store_name(target_store.trade_name)
        all_stores_res = await db.execute(select(OpticalStore))
        all_stores = all_stores_res.scalars().all()
        matching_ids = [s.id for s in all_stores if clean_store_name(s.trade_name) == target_clean_name]
        if matching_ids:
            store_ids = matching_ids

    query = (
        select(ServiceOrder)
        .outerjoin(BillingItem, BillingItem.service_order_id == ServiceOrder.id)
        .where(
            and_(
                ServiceOrder.optical_store_id.in_(store_ids),
                ServiceOrder.status.in_(VALID_BILLING_STATUSES),
                BillingItem.id == None
            )
        )
        .options(
            selectinload(ServiceOrder.lens_model),
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
        await enrich_billing_item(db, o)
    return orders


async def enrich_billing_item(db_or_item: Any, item_or_none: Any = None):
    """
    Enriquece o item/OS de faturamento com descrições discriminadas de lentes,
    serviços, tratamentos, valores discriminados e a lista detailed_items no padrão Anexo 1.
    """
    if item_or_none is None and not isinstance(db_or_item, AsyncSession):
        db = None
        item = db_or_item
    elif isinstance(db_or_item, AsyncSession):
        db = db_or_item
        item = item_or_none
    else:
        db = None
        item = db_or_item or item_or_none

    order = getattr(item, "service_order", None) or item

    # 1. Tipo / Modelo da Lente (Exatamente conforme cadastrado no sistema)
    lens_name = None
    
    if getattr(order, "lens_model", None):
        lm = order.lens_model
        lens_name = f"{lm.brand} {lm.material}"
        if lm.refractive_index:
            lens_name += f" (n={lm.refractive_index})"
    elif getattr(order, "od_lens_inventory", None) and order.od_lens_inventory.lens_model:
        lm = order.od_lens_inventory.lens_model
        lens_name = f"{lm.brand} {lm.material}"
        if lm.refractive_index:
            lens_name += f" (n={lm.refractive_index})"
    elif getattr(order, "oe_lens_inventory", None) and order.oe_lens_inventory.lens_model:
        lm = order.oe_lens_inventory.lens_model
        lens_name = f"{lm.brand} {lm.material}"
        if lm.refractive_index:
            lens_name += f" (n={lm.refractive_index})"
            
    if not lens_name and getattr(order, "items", None):
        prod_items = [i for i in order.items if getattr(i, "entity_type", "") == 'product']
        if prod_items:
            names = [getattr(p, "name", None) or "Lente Oftálmica" for p in prod_items]
            lens_name = ", ".join(names)

    if not lens_name:
        if getattr(order, "os_type", "") == "REPARO_SERVICO":
            lens_name = "Sem Lente (Reparo / Serviço do Lojista)"
        else:
            lens_name = "Lente Padrão Laboratorial"

    item.lens_type = lens_name

    # 2. Tratamentos / Adicionais (Exatamente conforme cadastrados)
    treatments_list = []
    
    lm_treat = None
    if getattr(order, "lens_model", None):
        lm_treat = order.lens_model.treatment
    elif getattr(order, "od_lens_inventory", None) and order.od_lens_inventory.lens_model:
        lm_treat = order.od_lens_inventory.lens_model.treatment
    elif getattr(order, "oe_lens_inventory", None) and order.oe_lens_inventory.lens_model:
        lm_treat = order.oe_lens_inventory.lens_model.treatment

    if lm_treat and lm_treat.strip() and lm_treat.strip().lower() not in ["nenhum", "sem tratamento"]:
        treatments_list.append(lm_treat)

    if getattr(order, "items", None):
        t_items = [i for i in order.items if getattr(i, "entity_type", "") == 'treatment']
        for t in t_items:
            t_name = getattr(t, "name", None)
            if t_name and t_name not in treatments_list:
                treatments_list.append(t_name)

    if treatments_list:
        item.treatments = ", ".join(treatments_list)
    else:
        item.treatments = "Incolor / Sem Tratamento"

    # 3. Serviços Técnicos Realizados (Exatamente conforme cadastrados)
    services_list = []
    if getattr(order, "items", None):
        s_items = [i for i in order.items if getattr(i, "entity_type", "") == 'service']
        for s in s_items:
            s_name = getattr(s, "name", None)
            if s_name and s_name not in services_list:
                services_list.append(s_name)

    if getattr(order, "service_type", None) and order.service_type not in services_list:
        services_list.append(order.service_type)

    if services_list:
        item.services = ", ".join(services_list)
    else:
        item.services = "Serviço de Montagem Padrão"

    # 4. Cálculo discriminado de valores (Lente, Serviço, Tratamento)
    lens_price = 0.0
    service_price = 0.0
    treatment_price = 0.0

    order_items = getattr(order, "items", []) or []
    has_product_items = False
    has_service_items = False
    has_treatment_items = False

    for i in order_items:
        e_type = getattr(i, "entity_type", "")
        price = float(getattr(i, "total_price", 0.0) or getattr(i, "unit_price", 0.0) or 0.0)
        if e_type == "product":
            lens_price += price
            has_product_items = True
        elif e_type == "service":
            service_price += price
            has_service_items = True
        elif e_type == "treatment":
            treatment_price += price
            has_treatment_items = True

    total_amount = float(getattr(order, "total_amount", 0.0) or getattr(item, "amount", 0.0) or 0.0)

    if getattr(order, "os_type", "") == "REPARO_SERVICO":
        if not has_service_items:
            service_price = max(0.0, total_amount - treatment_price)
        lens_price = 0.0
    else:
        if not has_product_items:
            lens_price = max(0.0, total_amount - service_price - treatment_price)

    item.lens_price = round(lens_price, 2)
    item.service_price = round(service_price, 2)
    item.treatment_price = round(treatment_price, 2)

    # 5. Montagem da lista detailed_items (Anexo 1 & Anexo 2)
    from backend.app.schemas.billing import OSItemDetail
    detailed: List[OSItemDetail] = []

    # Dicionários de catálogo se DB estiver disponível
    catalog_cache: Dict[str, Dict[uuid.UUID, Any]] = {"product": {}, "service": {}, "treatment": {}}
    if db is not None and order_items:
        try:
            prod_ids = [i.entity_id for i in order_items if getattr(i, "entity_type", "") == "product"]
            serv_ids = [i.entity_id for i in order_items if getattr(i, "entity_type", "") == "service"]
            treat_ids = [i.entity_id for i in order_items if getattr(i, "entity_type", "") == "treatment"]

            if prod_ids:
                from backend.app.models.financial_catalog import Product
                p_res = await db.execute(select(Product).where(Product.id.in_(prod_ids)))
                catalog_cache["product"] = {p.id: p for p in p_res.scalars().all()}
            if serv_ids:
                from backend.app.models.financial_catalog import TechnicalService
                s_res = await db.execute(select(TechnicalService).where(TechnicalService.id.in_(serv_ids)))
                catalog_cache["service"] = {s.id: s for s in s_res.scalars().all()}
            if treat_ids:
                from backend.app.models.financial_catalog import Treatment
                t_res = await db.execute(select(Treatment).where(Treatment.id.in_(treat_ids)))
                catalog_cache["treatment"] = {t.id: t for t in t_res.scalars().all()}
        except Exception:
            pass

    # 5.1 Linha da Lente (se não for REPARO_SERVICO ou se houver lens_price > 0 ou produtos)
    if getattr(order, "os_type", "") != "REPARO_SERVICO" and (lens_price > 0 or not order_items):
        lens_qty = 2  # Par de lentes por padrão para cada OS de produção
        prod_items = [i for i in order_items if getattr(i, "entity_type", "") == "product"]
        lens_desc = "Lente Oftálmica Visão Simples / Digital"
        if prod_items:
            sum_qty = sum(getattr(pi, "quantity", 1) for pi in prod_items)
            if sum_qty > 0:
                lens_qty = sum_qty
            first_p = catalog_cache["product"].get(prod_items[0].entity_id)
            if first_p and getattr(first_p, "description", None):
                lens_desc = first_p.description

        unit_p = round(lens_price / lens_qty, 2) if lens_qty > 0 else lens_price
        detailed.append(OSItemDetail(
            name=lens_name,
            description=lens_desc,
            item_type="Lente",
            quantity=lens_qty,
            unit_price=unit_p,
            total_price=round(lens_price, 2)
        ))

    # 5.2 Linhas de Serviços Técnicos
    service_items_found = [i for i in order_items if getattr(i, "entity_type", "") == "service"]
    if service_items_found:
        for si in service_items_found:
            cat_serv = catalog_cache["service"].get(si.entity_id)
            s_name = getattr(cat_serv, "name", None) or getattr(si, "name", None) or item.services
            s_desc = getattr(cat_serv, "description", None) or "Serviço Técnico Laboratorial"
            s_qty = getattr(si, "quantity", 1)
            s_uprice = float(getattr(si, "unit_price", 0.0) or 0.0)
            s_tprice = float(getattr(si, "total_price", 0.0) or (s_uprice * s_qty))
            detailed.append(OSItemDetail(
                name=s_name,
                description=s_desc,
                item_type="Serviço",
                quantity=s_qty,
                unit_price=round(s_uprice, 2),
                total_price=round(s_tprice, 2)
            ))
    elif service_price > 0:
        detailed.append(OSItemDetail(
            name=item.services,
            description="Montagem e Acabamento de Precisão",
            item_type="Serviço",
            quantity=1,
            unit_price=round(service_price, 2),
            total_price=round(service_price, 2)
        ))

    # 5.3 Linhas de Tratamentos
    treatment_items_found = [i for i in order_items if getattr(i, "entity_type", "") == "treatment"]
    if treatment_items_found:
        for ti in treatment_items_found:
            cat_treat = catalog_cache["treatment"].get(ti.entity_id)
            t_name = getattr(cat_treat, "name", None) or getattr(ti, "name", None) or item.treatments
            t_desc = getattr(cat_treat, "description", None) or "Tratamento de Superfície e Proteção Visual"
            t_qty = getattr(ti, "quantity", 1)
            t_uprice = float(getattr(ti, "unit_price", 0.0) or 0.0)
            t_tprice = float(getattr(ti, "total_price", 0.0) or (t_uprice * t_qty))
            detailed.append(OSItemDetail(
                name=t_name,
                description=t_desc,
                item_type="Tratamento",
                quantity=t_qty,
                unit_price=round(t_uprice, 2),
                total_price=round(t_tprice, 2)
            ))
    elif treatment_price > 0 and item.treatments != "Incolor / Sem Tratamento":
        detailed.append(OSItemDetail(
            name=item.treatments,
            description="Tratamento de Superfície Lente",
            item_type="Tratamento",
            quantity=1,
            unit_price=round(treatment_price, 2),
            total_price=round(treatment_price, 2)
        ))

    item.detailed_items = detailed
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
            selectinload(BillingCycle.items).selectinload(BillingItem.service_order).selectinload(ServiceOrder.lens_model),
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
            await enrich_billing_item(db, item)
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
        
    # Buscar todas as óticas no mesmo grupo de nome da ótica selecionada
    target_clean_name = clean_store_name(store.trade_name)
    all_stores_res = await db.execute(select(OpticalStore))
    group_store_ids = {s.id for s in all_stores_res.scalars().all() if clean_store_name(s.trade_name) == target_clean_name}

    # Validar restrições para cada OS
    total_amount = 0.0
    for order in orders:
        if order.optical_store_id not in group_store_ids:
            raise ValueError(f"A OS {order.os_number} pertence a outra ótica.")
            
        # Reassocia a OS para a ótica principal do ciclo se for de uma store_id secundária do mesmo grupo
        if order.optical_store_id != optical_store_id:
            order.optical_store_id = optical_store_id
            db.add(order)
            
        st_val = getattr(order.status, 'value', order.status)
        if st_val not in ["Expedição", "EXPEDICAO", OSStatus.EXPEDICAO, "Concluída", "CONCLUIDA", OSStatus.CONCLUIDA, "Entregue", "ENTREGUE", OSStatus.ENTREGUE]:
            raise ValueError(f"A OS {order.os_number} não está no status de Expedição, Concluída ou Entregue (Status atual: {st_val}). Apenas OSs concluídas podem ser faturadas.")

            
        # Verificar se já tem faturamento associado (para evitar duplicidade)
        billing_item_query = select(BillingItem).where(BillingItem.service_order_id == order.id)
        bi_result = await db.execute(billing_item_query)
        if bi_result.scalar_one_or_none() is not None:
            raise ValueError(f"A OS {order.os_number} já foi faturada em outro ciclo.")
            
        total_amount += float(order.total_amount)
        
    if not due_date:
        from datetime import timedelta
        due_date = datetime.now(timezone.utc) + timedelta(days=10)
        
    # Criar o ciclo de faturamento
    db_cycle = BillingCycle(
        optical_store_id=optical_store_id,
        start_date=start_date,
        end_date=end_date,
        status="FECHADO",
        total_amount=total_amount,
        created_at=datetime.now(timezone.utc),
        closed_at=datetime.now(timezone.utc),
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
            created_at=datetime.now(timezone.utc)
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
    db_cycle.paid_at = datetime.now(timezone.utc)
    
    db.add(db_cycle)
    await db.commit()
    await db.refresh(db_cycle)
    
    return db_cycle


async def get_receivables_kpis(db: AsyncSession) -> Dict[str, Any]:
    """
    Calcula estatísticas de Contas a Receber: total pago, pendente e inadimplente (atrasado).
    """
    now = datetime.now(timezone.utc)
    
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
