import uuid
import os
from datetime import datetime, timezone
import re
from typing import List, Optional, Tuple
from decimal import Decimal
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend.app.models.os import ServiceOrder, OSWorkflowHistory, OSStatus, ServiceOrderItem, OSCQInspection
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.models.financial_catalog import Product, Treatment, TechnicalService
from backend.app.schemas.os import ServiceOrderCreate, ServiceOrderUpdate, AllocateRequest, ServiceOrderItemCreate, CQInspectionCreate
from backend.app.crud import movement as crud_movement
from backend.app.crud import customer_price as crud_customer_price
from backend.app.schemas.movement import StockMovementCreate

async def generate_clinical_embedding(text: str) -> List[float]:
    import google.generativeai as genai
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return [0.0] * 512
    try:
        genai.configure(api_key=api_key)
        response = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document",
            output_dimensionality=512
        )
        return response['embedding']
    except Exception as e:
        print(f"[AI Embedding] Erro ao gerar embedding: {e}")
        return [0.0] * 512


# --- WORKFLOW & OS CRUD ---

async def generate_os_number(db: AsyncSession) -> str:
    """
    Gera um número de OS único e sequencial (Ex: OS-2026-0001).
    Busca todas as OS do ano atual para computar o maior número sequencial numérico
    e previne colisões com formatos legados.
    """
    from datetime import timezone
    year = datetime.now(timezone.utc).year
    year_prefix = f"OS-{year}-"

    stmt = select(ServiceOrder.os_number).where(ServiceOrder.os_number.like(f"{year_prefix}%"))
    result = await db.execute(stmt)
    existing_numbers = set(result.scalars().all())

    max_seq = 0
    for num in existing_numbers:
        suffix = num.replace(year_prefix, "")
        if suffix.isdigit():
            val = int(suffix)
            if val > max_seq:
                max_seq = val

    next_num = f"{year_prefix}{max_seq + 1:04d}"
    while next_num in existing_numbers:
        max_seq += 1
        next_num = f"{year_prefix}{max_seq:04d}"

    return next_num

async def create_service_order(db: AsyncSession, obj_in: ServiceOrderCreate) -> ServiceOrder:
    os_num = obj_in.os_number if obj_in.os_number else await generate_os_number(db)
    
    clinical_emb = None
    if obj_in.clinical_notes:
        clinical_emb = await generate_clinical_embedding(obj_in.clinical_notes)
        
    initial_status = OSStatus.RECEBIDA
    fin_val_date = None
    fin_policy = None
    fin_amount = 0.0
    fin_count = 0
    fin_max_days = 0
    is_blocked_financially = False

    # Verificação de política de inadimplência da ótica (Universal sem descarte)
    if obj_in.optical_store_id:
        from backend.app.crud.crud_system_parameters import get_parameter
        from backend.app.crud.crud_financial_corp import check_optical_store_delinquency

        delinquency_info = await check_optical_store_delinquency(db, obj_in.optical_store_id)
        if delinquency_info["is_delinquent"]:
            fin_val_date = datetime.now(timezone.utc)
            fin_amount = delinquency_info["total_overdue_amount"]
            fin_count = delinquency_info["overdue_count"]
            fin_max_days = delinquency_info["max_overdue_days"]

            policy = await get_parameter(db, "financial_delinquency_policy", "POLICY_ALERT")
            fin_policy = policy

            if policy == "POLICY_AUTHORIZE":
                initial_status = OSStatus.AGUARDANDO_LIBERACAO
                is_blocked_financially = True
            elif policy == "POLICY_BLOCK":
                initial_status = OSStatus.BLOQUEADA_FINANCEIRO
                is_blocked_financially = True

    db_obj = ServiceOrder(
        os_number=os_num,
        client_name=obj_in.client_name,
        doctor_name=obj_in.doctor_name,
        partner_shop_id=obj_in.partner_shop_id,
        optical_store_id=obj_in.optical_store_id,
        client_order_number=getattr(obj_in, "client_order_number", None),
        tray_number=getattr(obj_in, "tray_number", None),
        priority=getattr(obj_in, "priority", "NORMAL"),
        status=initial_status.value if hasattr(initial_status, 'value') else initial_status,
        os_type=obj_in.os_type or "PADRAO",
        od_spherical=obj_in.od_spherical,


        od_cylindrical=obj_in.od_cylindrical,
        od_axis=obj_in.od_axis,
        od_addition=obj_in.od_addition,
        od_dnp=obj_in.od_dnp,
        od_prism=obj_in.od_prism,
        od_height=obj_in.od_height,
        oe_spherical=obj_in.oe_spherical,
        oe_cylindrical=obj_in.oe_cylindrical,
        oe_axis=obj_in.oe_axis,
        oe_addition=obj_in.oe_addition,
        oe_dnp=obj_in.oe_dnp,
        oe_prism=obj_in.oe_prism,
        oe_height=obj_in.oe_height,
        frame_a=obj_in.frame_a,
        frame_bridge=obj_in.frame_bridge,
        frame_ed=obj_in.frame_ed,
        clinical_notes=obj_in.clinical_notes,
        clinical_embedding=clinical_emb,
        is_rework=obj_in.is_rework or False,
        total_amount=0.00,
        financial_validation_date=fin_val_date,
        financial_policy_applied=fin_policy,
        financial_overdue_amount=fin_amount,
        financial_overdue_count=fin_count,
        financial_max_overdue_days=fin_max_days
    )
    db.add(db_obj)
    await db.commit()
    
    # Adiciona registro inicial no histórico de workflow
    history_msg = f"Ordem de serviço cadastrada no sistema (Status: {initial_status.value})."
    if is_blocked_financially:
        history_msg += f" RETENÇÃO FINANCEIRA: Ótica possui {fin_count} fatura(s) vencida(s) totalizando R$ {fin_amount:.2f} ({fin_max_days} dias de atraso). Alocação de estoque e PCP pausados."
    
    await add_workflow_history(db, db_obj.id, None, initial_status, history_msg)
    
    # Gatilho de alocação de estoque APENAS se a OS NÃO estiver bloqueada por inadimplência:
    if not is_blocked_financially and obj_in.frame_a and obj_in.frame_bridge and obj_in.frame_ed and obj_in.lens_model_id:
        alloc_payload = AllocateRequest(
            frame_a=obj_in.frame_a,
            frame_bridge=obj_in.frame_bridge,
            frame_ed=obj_in.frame_ed,
            lens_model_id=obj_in.lens_model_id,
            od_dnp=obj_in.od_dnp,
            oe_dnp=obj_in.oe_dnp
        )
        await allocate_lenses_for_os(db, db_obj.id, alloc_payload)
        
    return await get_service_order(db, db_obj.id)


async def get_financial_blocked_orders(db: AsyncSession) -> List[ServiceOrder]:
    """
    Retorna a fila administrativa de Ordens de Serviço bloqueadas por restrição financeira.
    """
    blocked_statuses = [
        OSStatus.AGUARDANDO_LIBERACAO,
        OSStatus.BLOQUEADA_FINANCEIRO,
        "Aguardando Liberação Financeira",
        "Bloqueada por Inadimplência"
    ]
    query = (
        select(ServiceOrder)
        .where(ServiceOrder.status.in_(blocked_statuses))
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.partner_shop),
            selectinload(ServiceOrder.optical_store),
            selectinload(ServiceOrder.workflow_history).selectinload(OSWorkflowHistory.operator),
            selectinload(ServiceOrder.items),
            selectinload(ServiceOrder.cq_inspections).selectinload(OSCQInspection.operator)
        )
        .order_by(ServiceOrder.created_at.desc())
    )

    result = await db.execute(query)
    return list(result.scalars().all())


async def authorize_financial_blocked_os(
    db: AsyncSession,
    os_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    notes: Optional[str] = None
) -> Optional[ServiceOrder]:
    """
    Libera administrativamente uma Ordem de Serviço retida por inadimplência.
    Altera o status para 'Liberada Financeiramente' -> 'Recebida' e executa a alocação de estoque.
    """
    query_os = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(
            selectinload(ServiceOrder.items),
            selectinload(ServiceOrder.optical_store),
            selectinload(ServiceOrder.partner_shop),
            selectinload(ServiceOrder.workflow_history),
            selectinload(ServiceOrder.cq_inspections)
        )
        .with_for_update()
    )
    res_os = await db.execute(query_os)
    os_obj = res_os.scalar_one_or_none()
    if not os_obj:
        return None


    # Guarda de estado: valida se a OS está realmente bloqueada financeiramente
    blocked_statuses = [
        OSStatus.BLOQUEADA_FINANCEIRO, OSStatus.BLOQUEADA_FINANCEIRO.value,
        OSStatus.AGUARDANDO_LIBERACAO, OSStatus.AGUARDANDO_LIBERACAO.value,
        "Bloqueada por Inadimplência", "Aguardando Liberação Financeira"
    ]
    if os_obj.status not in blocked_statuses:
        # Já foi liberada anteriormente — retorna sem modificar
        return await get_service_order(db, os_id)

    prev_status = os_obj.status
    os_obj.status = OSStatus.RECEBIDA.value
    os_obj.financial_authorized_by_id = admin_user_id

    os_obj.financial_authorized_at = datetime.now(timezone.utc)
    os_obj.financial_authorization_notes = notes or "Liberação de crédito efetuada pelo Administrador."

    await db.commit()

    log_notes = f"Liberação Administrativa de Crédito concedida por Admin (ID: {admin_user_id}). Motivo: {os_obj.financial_authorization_notes}"
    await add_workflow_history(db, os_id, prev_status, OSStatus.RECEBIDA, log_notes, operator_id=admin_user_id, sector="Financeiro/Crédito")

    # Dispara a alocação de estoque caso a OS possua os dados geométricos e o modelo de lente
    if os_obj.frame_a and os_obj.frame_bridge and os_obj.frame_ed:
        # Prioridade 1: usa o lens_model_id diretamente do campo da OS (fluxo fabril)
        lens_model_id = os_obj.lens_model_id

        # Prioridade 2: tenta encontrar via itens de produto (fluxo manual)
        if not lens_model_id:
            prod_items = [i for i in os_obj.items if getattr(i, "entity_type", "") == "product"] if os_obj.items else []
            if prod_items:
                from backend.app.models.financial_catalog import Product
                p_res = await db.execute(select(Product).where(Product.id == prod_items[0].entity_id))
                p_obj = p_res.scalar_one_or_none()
                if p_obj and p_obj.lens_model_id:
                    lens_model_id = p_obj.lens_model_id

        if lens_model_id:
            alloc_payload = AllocateRequest(
                frame_a=os_obj.frame_a,
                frame_bridge=os_obj.frame_bridge,
                frame_ed=os_obj.frame_ed,
                lens_model_id=lens_model_id,
                od_dnp=os_obj.od_dnp,
                oe_dnp=os_obj.oe_dnp
            )
            await allocate_lenses_for_os(db, os_id, alloc_payload)

    return await get_service_order(db, os_id)




async def enrich_os_items(db: AsyncSession, os_objs: list):
    """Enriquece os itens da OS com os campos 'name' e 'description' vindos do catálogo financeiro."""
    if not os_objs:
        return os_objs
    
    all_items = []
    for os_obj in os_objs:
        if os_obj and os_obj.items:
            all_items.extend(os_obj.items)
            
    if not all_items:
        return os_objs
        
    product_ids = list(set(i.entity_id for i in all_items if i.entity_type == "product"))
    treatment_ids = list(set(i.entity_id for i in all_items if i.entity_type == "treatment"))
    service_ids = list(set(i.entity_id for i in all_items if i.entity_type == "service"))

    products_map = {}
    treatments_map = {}
    services_map = {}

    from backend.app.models.financial_catalog import Product, Treatment, TechnicalService

    if product_ids:
        res = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        products_map = {p.id: p for p in res.scalars().all()}
    if treatment_ids:
        res = await db.execute(select(Treatment).where(Treatment.id.in_(treatment_ids)))
        treatments_map = {t.id: t for t in res.scalars().all()}
    if service_ids:
        res = await db.execute(select(TechnicalService).where(TechnicalService.id.in_(service_ids)))
        services_map = {s.id: s for s in res.scalars().all()}

    for item in all_items:
        if item.entity_type == "product" and item.entity_id in products_map:
            p = products_map[item.entity_id]
            setattr(item, "name", p.name)
            setattr(item, "description", p.description or p.name)
        elif item.entity_type == "treatment" and item.entity_id in treatments_map:
            t = treatments_map[item.entity_id]
            setattr(item, "name", t.name)
            setattr(item, "description", t.description or t.name)
        elif item.entity_type == "service" and item.entity_id in services_map:
            s = services_map[item.entity_id]
            setattr(item, "name", s.name)
            setattr(item, "description", s.description or s.name)
        else:
            setattr(item, "name", f"Item ({item.entity_type})")
            setattr(item, "description", f"Item de faturamento ({item.entity_type})")

    return os_objs

async def get_service_order(db: AsyncSession, os_id: uuid.UUID) -> Optional[ServiceOrder]:
    query = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.partner_shop),
            selectinload(ServiceOrder.optical_store),
            selectinload(ServiceOrder.workflow_history).selectinload(OSWorkflowHistory.operator),
            selectinload(ServiceOrder.items),
            selectinload(ServiceOrder.cq_inspections).selectinload(OSCQInspection.operator)
        )
    )
    result = await db.execute(query)
    os_obj = result.scalar_one_or_none()
    if os_obj:
        await enrich_os_items(db, [os_obj])
    return os_obj

async def get_service_orders(
    db: AsyncSession, 
    status: Optional[OSStatus] = None, 
    query_str: Optional[str] = None,
    semantic_query: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[ServiceOrder]:
    query = select(ServiceOrder).options(
        selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
        selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
        selectinload(ServiceOrder.partner_shop),
        selectinload(ServiceOrder.optical_store),
        selectinload(ServiceOrder.workflow_history).selectinload(OSWorkflowHistory.operator),
        selectinload(ServiceOrder.items),
        selectinload(ServiceOrder.cq_inspections).selectinload(OSCQInspection.operator)
    )
    
    if status:
        if isinstance(status, str):
            status_val = status
        else:
            status_val = status.value if hasattr(status, 'value') else str(status)

        if status_val in ["CQ", "CQ Final"]:
            query = query.where(ServiceOrder.status.in_(["CQ", "CQ Final"]))
        elif status_val in ["Produção", "Surfaçagem"]:
            query = query.where(ServiceOrder.status.in_(["Produção", "Surfaçagem"]))
        else:
            query = query.where(ServiceOrder.status == status_val)

        
    if query_str:
        query_str_clean = f"%{query_str}%"
        from backend.app.models.optical_store import OpticalStore
        from backend.app.models.partner import PartnerShop
        
        query = (
            query
            .outerjoin(OpticalStore, ServiceOrder.optical_store_id == OpticalStore.id)
            .outerjoin(PartnerShop, ServiceOrder.partner_shop_id == PartnerShop.id)
            .where(
                or_(
                    ServiceOrder.os_number.ilike(query_str_clean),
                    ServiceOrder.client_order_number.ilike(query_str_clean),
                    ServiceOrder.tray_number.ilike(query_str_clean),
                    ServiceOrder.client_name.ilike(query_str_clean),
                    OpticalStore.cnpj.ilike(query_str_clean),
                    PartnerShop.cnpj.ilike(query_str_clean),
                    OpticalStore.trade_name.ilike(query_str_clean),
                    PartnerShop.trade_name.ilike(query_str_clean)
                )
            )
        )
        
    query_vector = None
    if semantic_query:
        query_vector = await generate_clinical_embedding(semantic_query)
        is_postgres = db.bind.dialect.name == 'postgresql'
        if is_postgres:
            query = (
                query
                .where(ServiceOrder.clinical_embedding.isnot(None))
                .order_by(ServiceOrder.clinical_embedding.cosine_distance(query_vector))
            )
            
    if not semantic_query or (semantic_query and db.bind.dialect.name != 'postgresql'):
        query = query.order_by(ServiceOrder.is_rework.desc(), ServiceOrder.created_at.desc())
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    orders = list(result.scalars().all())
    
    if semantic_query and db.bind.dialect.name != 'postgresql':
        orders_with_emb = [o for o in orders if o.clinical_embedding is not None]
        orders_no_emb = [o for o in orders if o.clinical_embedding is None]
        
        def cosine_similarity(v1, v2):
            dot_product = sum(x * y for x, y in zip(v1, v2))
            norm_v1 = sum(x * x for x in v1) ** 0.5
            norm_v2 = sum(x * x for x in v2) ** 0.5
            if norm_v1 == 0 or norm_v2 == 0:
                return 0.0
            return dot_product / (norm_v1 * norm_v2)
            
        orders_with_emb.sort(key=lambda o: cosine_similarity(o.clinical_embedding, query_vector), reverse=True)
        orders = orders_with_emb + orders_no_emb
        
    if orders:
        await enrich_os_items(db, orders)

    return orders


async def add_workflow_history(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    prev_status: Optional[OSStatus], 
    new_status: OSStatus, 
    notes: Optional[str],
    operator_id: Optional[uuid.UUID] = None,
    sector: Optional[str] = None
) -> OSWorkflowHistory:
    history_obj = OSWorkflowHistory(
        service_order_id=os_id,
        previous_status=prev_status,
        new_status=new_status,
        operator_notes=notes,
        operator_id=operator_id,
        sector=sector
    )
    db.add(history_obj)
    await db.commit()
    await db.refresh(history_obj)
    return history_obj

async def update_os_status(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    new_status: OSStatus, 
    notes: Optional[str],
    operator_id: Optional[uuid.UUID] = None,
    sector: Optional[str] = None
) -> Optional[ServiceOrder]:
    os_obj = await get_service_order(db, os_id)
    if not os_obj:
        return None
        
    prev_status = os_obj.status
    os_obj.status = new_status
    
    if os_obj.optical_store_id is None:
        from backend.app.models.optical_store import OpticalStore
        first_store = (await db.execute(select(OpticalStore).limit(1))).scalar_one_or_none()
        if first_store:
            os_obj.optical_store_id = first_store.id

    await db.commit()

    await add_workflow_history(db, os_id, prev_status, new_status, notes, operator_id, sector)
    db.expire(os_obj)
    return await get_service_order(db, os_id)

# --- ALGORITMO DE TRANSPOSIÇÃO DE DIOPTRIA ---

def transpose_dioptria(spherical: Decimal, cylindrical: Decimal, axis: Optional[int]) -> Tuple[Decimal, Decimal, Optional[int]]:
    """
    Converte receita com cilindro positivo para cilindro negativo se necessário.
    """
    if cylindrical <= 0:
        return spherical, cylindrical, axis
        
    new_sph = spherical + cylindrical
    new_cyl = -cylindrical
    new_axis = axis
    if axis is not None:
        new_axis = axis + 90 if axis <= 90 else axis - 90
        if new_axis <= 0:
            new_axis = 180
            
    return new_sph, new_cyl, new_axis


# --- ALOCAÇÃO E VALIDAÇÃO GEOMÉTRICA ---

async def allocate_lenses_for_os(
    db: AsyncSession, os_id: uuid.UUID, payload: AllocateRequest
) -> Tuple[bool, str, Optional[ServiceOrder]]:
    """
    Executa a validação geométrica do diâmetro, busca lentes adequadas
    no estoque, reserva atômica física (-1 no saldo) e associa à OS.
    """
    query_os = select(ServiceOrder).where(ServiceOrder.id == os_id).with_for_update()
    res_os = await db.execute(query_os)
    os_obj = res_os.scalar_one_or_none()
    
    if not os_obj:
        return False, "Ordem de Serviço não encontrada.", None

    if os_obj.os_type == "REPARO_SERVICO":
        os_obj.status = OSStatus.MONTAGEM.value if hasattr(OSStatus.MONTAGEM, 'value') else OSStatus.MONTAGEM
        await db.commit()
        await add_workflow_history(db, os_id, OSStatus.RECEBIDA, OSStatus.MONTAGEM, "OS de Reparo/Serviço encaminhada diretamente para a Bancada Técnica (Montagem).", sector="Serviço Técnico / Reparos")
        return True, "OS de Reparo/Serviço encaminhada para a bancada técnica.", os_obj

    if os_obj.status != OSStatus.RECEBIDA:
        return False, f"Alocação só permitida no status Recebida. Status atual: {os_obj.status}.", os_obj
        
    os_obj.frame_a = payload.frame_a
    os_obj.frame_bridge = payload.frame_bridge
    os_obj.frame_ed = payload.frame_ed
    
    if payload.od_dnp:
        os_obj.od_dnp = payload.od_dnp
    if payload.oe_dnp:
        os_obj.oe_dnp = payload.oe_dnp
        
    if not os_obj.od_dnp or not os_obj.oe_dnp:
        await db.commit()
        return False, "Distâncias Nasopupilares (DNP) para ambos os olhos são obrigatórias para validação geométrica.", os_obj
        
    od_sph, od_cyl, od_axis = transpose_dioptria(os_obj.od_spherical or Decimal("0.0"), os_obj.od_cylindrical or Decimal("0.0"), os_obj.od_axis)
    oe_sph, oe_cyl, oe_axis = transpose_dioptria(os_obj.oe_spherical or Decimal("0.0"), os_obj.oe_cylindrical or Decimal("0.0"), os_obj.oe_axis)
    
    od_decentration = ((os_obj.frame_a + os_obj.frame_bridge) / 2) - os_obj.od_dnp
    oe_decentration = ((os_obj.frame_a + os_obj.frame_bridge) / 2) - os_obj.oe_dnp
    
    od_min_diameter = os_obj.frame_ed + (Decimal("2.0") * od_decentration) + Decimal("2.0")
    oe_min_diameter = os_obj.frame_ed + (Decimal("2.0") * oe_decentration) + Decimal("2.0")
    
    # Carrega o modelo de lente para determinar o matrix_type
    from backend.app.models.lens import LensModel
    lm_res = await db.execute(select(LensModel).where(LensModel.id == payload.lens_model_id))
    lens_model_obj = lm_res.scalar_one_or_none()
    matrix_type = lens_model_obj.matrix_type if lens_model_obj else "LP_GRADE"

    od_item = await get_inventory_item_for_allocation(
        db, payload.lens_model_id, od_sph, od_cyl,
        matrix_type=matrix_type,
        addition=os_obj.od_addition,
        base_curve=getattr(payload, 'od_base_curve', None),
        eye="OD"
    )
    oe_item = await get_inventory_item_for_allocation(
        db, payload.lens_model_id, oe_sph, oe_cyl,
        matrix_type=matrix_type,
        addition=os_obj.oe_addition,
        base_curve=getattr(payload, 'oe_base_curve', None),
        eye="OE"
    )
    
    if not od_item or not oe_item:
        msg = f"Dioptria necessária não localizada no estoque para o modelo selecionado. OD: {od_sph:+.2f}/{od_cyl:+.2f} | OE: {oe_sph:+.2f}/{oe_cyl:+.2f}."
        await db.commit()
        return False, msg, os_obj
        
    od_phys_diam = od_item.lens_model.diameter
    oe_phys_diam = oe_item.lens_model.diameter
    
    if od_phys_diam < od_min_diameter or oe_phys_diam < oe_min_diameter:
        os_obj.status = OSStatus.CANCELADA
        msg = f"Reprovado na Triagem Técnica: Diâmetro de lente física insuficiente para corte da armação. OD exigido: {od_min_diameter:.1f}mm (Disponível: {od_phys_diam}mm) | OE exigido: {oe_min_diameter:.1f}mm (Disponível: {oe_phys_diam}mm)."
        await db.commit()
        await add_workflow_history(db, os_id, OSStatus.RECEBIDA, OSStatus.CANCELADA, msg)
        return False, msg, os_obj
        
    if od_item.quantity_available < 1 or oe_item.quantity_available < 1:
        if od_item.id == oe_item.id and od_item.quantity_available < 2:
            await db.commit()
            return False, "Saldo de estoque insuficiente (necessário 2 unidades para esta dioptria).", os_obj
        else:
            await db.commit()
            return False, "Saldo de estoque insuficiente para um dos olhos.", os_obj
            
    movement_od = StockMovementCreate(
        lens_inventory_id=od_item.id,
        movement_type="OUT",
        quantity=1,
        reason=f"Reserva Automática OS {os_obj.os_number} (Olho Direito)"
    )
    movement_oe = StockMovementCreate(
        lens_inventory_id=oe_item.id,
        movement_type="OUT",
        quantity=1,
        reason=f"Reserva Automática OS {os_obj.os_number} (Olho Esquerdo)"
    )
    
    await crud_movement.create_stock_movement(db, movement_od)
    await crud_movement.create_stock_movement(db, movement_oe)
    
    os_obj.od_lens_inventory_id = od_item.id
    os_obj.oe_lens_inventory_id = oe_item.id
    os_obj.status = OSStatus.SEPARACAO
    
    # Faturamento automático das lentes alocadas
    try:
        # 1. Remove itens de produto (lentes) anteriores da OS para evitar duplicidade em re-alocações
        delete_items_query = select(ServiceOrderItem).where(
            and_(
                ServiceOrderItem.service_order_id == os_obj.id,
                ServiceOrderItem.entity_type == "product"
            )
        )
        existing_items = (await db.execute(delete_items_query)).scalars().all()
        for item in existing_items:
            await db.delete(item)
        await db.flush()
        
        # 2. Função interna para buscar o produto compatível no catálogo comercial
        async def find_matching_product(lens_model):
            p_query = select(Product).where(
                and_(
                    Product.is_active == True,
                    Product.lens_model_id == lens_model.id
                )
            )
            prod = (await db.execute(p_query)).scalars().first()
            if not prod:
                idx_clean = f"{lens_model.refractive_index:.2f}"
                p_query = select(Product).where(
                    and_(
                        Product.is_active == True,
                        Product.name.ilike(f"%{lens_model.brand}%"),
                        Product.name.like(f"%{idx_clean}%")
                    )
                )
                prod = (await db.execute(p_query)).scalars().first()
            if not prod:
                p_query = select(Product).where(
                    and_(
                        Product.is_active == True,
                        Product.name.ilike(f"%{lens_model.brand}%")
                    )
                )
                prod = (await db.execute(p_query)).scalars().first()
            if not prod:
                p_query = select(Product).where(Product.is_active == True).limit(1)
                prod = (await db.execute(p_query)).scalars().first()
            return prod

        od_prod = await find_matching_product(od_item.lens_model)
        oe_prod = await find_matching_product(oe_item.lens_model)
        
        if od_prod and oe_prod:
            if od_prod.id == oe_prod.id:
                item_in = ServiceOrderItemCreate(
                    entity_type="product",
                    entity_id=od_prod.id,
                    quantity=2
                )
                await add_item_to_service_order(db, os_obj.id, item_in)
            else:
                item_in_od = ServiceOrderItemCreate(
                    entity_type="product",
                    entity_id=od_prod.id,
                    quantity=1
                )
                await add_item_to_service_order(db, os_obj.id, item_in_od)
                
                item_in_oe = ServiceOrderItemCreate(
                    entity_type="product",
                    entity_id=oe_prod.id,
                    quantity=1
                )
                await add_item_to_service_order(db, os_obj.id, item_in_oe)
    except Exception as e:
        print(f"[Faturamento Automático] Erro ao alocar itens comerciais: {e}")
        
    transposition_notes = ""
    if os_obj.od_cylindrical > 0 or os_obj.oe_cylindrical > 0:
        transposition_notes = " Graus transpostos para cilindro negativo no acoplamento."
        
    notes = f"Validação geométrica bem-sucedida (OD exigido: {od_min_diameter:.1f}mm, OE: {oe_min_diameter:.1f}mm). Lentes reservadas nas gavetas OD: {od_item.location_tag or 'N/A'} | OE: {oe_item.location_tag or 'N/A'}.{transposition_notes}"
    
    await db.commit()
    await add_workflow_history(db, os_id, OSStatus.RECEBIDA, OSStatus.SEPARACAO, notes)
    db.expire(os_obj)
    os_loaded = await get_service_order(db, os_id)
    return True, "Alocação e reserva de estoque executadas com sucesso.", os_loaded

async def get_inventory_item_for_allocation(
    db: AsyncSession,
    model_id: uuid.UUID,
    sph: Decimal,
    cyl: Decimal,
    matrix_type: Optional[str] = None,
    addition: Optional[Decimal] = None,
    base_curve: Optional[Decimal] = None,
    eye: Optional[str] = None
) -> Optional[LensInventoryGrade]:
    """
    Busca item de estoque respeitando o tipo de matriz:
    - LP_GRADE / GRADE_167: busca por esférico + cilíndrico
    - MF_ACB / MF_BLOCO: busca por adição + olho
    - BLOCO_VS: busca por curva base
    """
    from backend.app.models.lens import MatrixType

    mtype = matrix_type or MatrixType.LP_GRADE

    if mtype in [MatrixType.MF_ACB, MatrixType.MF_BLOCO, "MF_ACB", "MF_BLOCO"]:
        # Lentes multifocais: match por adição + olho
        if addition is None:
            return None  # Sem adição, não é possível alocar MF
        add_val = float(addition)
        query = (
            select(LensInventoryGrade)
            .where(
                LensInventoryGrade.lens_model_id == model_id,
                func.abs(func.coalesce(LensInventoryGrade.addition, 0.0) - add_val) < 0.001,
                LensInventoryGrade.eye == eye if eye else True
            )
            .options(selectinload(LensInventoryGrade.lens_model))
            .with_for_update()
        )
    elif mtype in [MatrixType.BLOCO_VS, "BLOCO_VS"]:
        # Blocos: match por curva base
        if base_curve is not None and float(base_curve) > 0:
            base_val = float(base_curve)
            query = (
                select(LensInventoryGrade)
                .where(
                    LensInventoryGrade.lens_model_id == model_id,
                    func.abs(func.coalesce(LensInventoryGrade.base_curve, 0.0) - base_val) < 0.001
                )
                .options(selectinload(LensInventoryGrade.lens_model))
                .with_for_update()
            )
        else:
            query = (
                select(LensInventoryGrade)
                .where(LensInventoryGrade.lens_model_id == model_id)
                .options(selectinload(LensInventoryGrade.lens_model))
                .with_for_update()
            )
    else:
        # LP_GRADE e GRADE_167: match por esférico + cilíndrico (comportamento original)
        query = (
            select(LensInventoryGrade)
            .where(
                LensInventoryGrade.lens_model_id == model_id,
                func.abs(func.coalesce(LensInventoryGrade.spherical, 0.0) - float(sph)) < 0.001,
                func.abs(func.coalesce(LensInventoryGrade.cylindrical, 0.0) - float(cyl)) < 0.001
            )
            .options(selectinload(LensInventoryGrade.lens_model))
            .with_for_update()
        )

    res = await db.execute(query)
    return res.scalar_one_or_none()


# --- REPROCESSAMENTO DE QUEBRAS (FASE 3) ---

async def reprocess_broken_lenses(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    notes: str,
    operator_id: Optional[uuid.UUID] = None
) -> Tuple[bool, str, Optional[ServiceOrder]]:
    query_os = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model)
        )
        .with_for_update()
    )
    res_os = await db.execute(query_os)
    os_obj = res_os.scalar_one_or_none()
    
    if not os_obj:
        return False, "Ordem de Serviço não encontrada.", None
        
    if os_obj.status not in [
        OSStatus.SEPARACAO, OSStatus.PRODUCAO, OSStatus.MONTAGEM, OSStatus.CQ,
        OSStatus.SEPARACAO.value, OSStatus.PRODUCAO.value, OSStatus.MONTAGEM.value, OSStatus.CQ.value,
        OSStatus.CQ_FINAL.value, OSStatus.CQ_FINAL,
        "Separação", "Produção", "Surfaçagem", "Montagem", "CQ", "CQ Final",
        OSStatus.SURFACAGEM, OSStatus.SURFACAGEM.value
    ]:
        return False, f"Reprocessamento não permitido para OS no estado {os_obj.status}.", os_obj
        
    prev_status = os_obj.status
    
    cost_loss = Decimal("0.00")
    if os_obj.od_lens_inventory:
        cost_loss += os_obj.od_lens_inventory.lens_model.cost_price
    if os_obj.oe_lens_inventory:
        cost_loss += os_obj.oe_lens_inventory.lens_model.cost_price
    
    os_obj.od_lens_inventory_id = None
    os_obj.oe_lens_inventory_id = None
    os_obj.status = OSStatus.RECEBIDA
    os_obj.is_rework = True
    
    history_notes = f"Quebra registrada no workflow. Lentes antigas inutilizadas. Custo Perda: R$ {cost_loss:.2f}. Razão: {notes}"
    
    await db.commit()
    await add_workflow_history(db, os_id, prev_status, OSStatus.RECEBIDA, history_notes, operator_id=operator_id, sector="Reprocessamento")
    db.expire(os_obj)
    os_loaded = await get_service_order(db, os_id)
    return True, history_notes, os_loaded



# --- KPI DASHBOARD (FASE 4) ---

async def get_os_dashboard_kpis(db: AsyncSession) -> dict:
    query_total = select(func.count(ServiceOrder.id))
    res_total = await db.execute(query_total)
    total_orders = res_total.scalar_one()
    
    query_status = select(ServiceOrder.status, func.count(ServiceOrder.id)).group_by(ServiceOrder.status)
    res_status = await db.execute(query_status)
    
    status_counts = {}
    for row in res_status.all():
        db_status = row[0]
        status_val = None
        if isinstance(db_status, OSStatus):
            status_val = db_status.value
        elif isinstance(db_status, str):
            for st in OSStatus:
                if st.value == db_status or st.name == db_status:
                    status_val = st.value
                    break
            if not status_val:
                status_val = db_status
        if status_val:
            status_counts[status_val] = status_counts.get(status_val, 0) + row[1]
            
    for st in [OSStatus.RECEBIDA, OSStatus.SEPARACAO, OSStatus.SURFACAGEM, OSStatus.MONTAGEM, OSStatus.CQ_FINAL, OSStatus.EXPEDICAO, OSStatus.CANCELADA]:
        if st.value not in status_counts:
            status_counts[st.value] = 0


    query_loss = select(OSWorkflowHistory.operator_notes).where(
        or_(
            OSWorkflowHistory.operator_notes.like("%Custo Perda: R$%"),
            OSWorkflowHistory.operator_notes.like("%Perda de Custo: R$%")
        )
    )
    res_loss = await db.execute(query_loss)
    notes_list = res_loss.scalars().all()
    
    total_loss = Decimal("0.00")
    reproduction_count = 0
    for note in notes_list:
        if note:
            reproduction_count += 1
            match = re.search(r'(?:Custo Perda|Perda de Custo): R\$\s*(\d+\.\d{2})', note)
            if match:
                total_loss += Decimal(match.group(1))
                
    expedited_qty = status_counts.get(OSStatus.EXPEDICAO.value, 0)
    reproduction_rate = 0.0
    if expedited_qty > 0:
        reproduction_rate = round((reproduction_count / expedited_qty) * 100.0, 1)
    elif reproduction_count > 0:
        reproduction_rate = 100.0
        
    query_history = select(OSWorkflowHistory).order_by(
        OSWorkflowHistory.service_order_id, 
        OSWorkflowHistory.changed_at
    )
    res_history = await db.execute(query_history)
    history_records = res_history.scalars().all()
    
    os_history = {}
    for rec in history_records:
        if rec.service_order_id not in os_history:
            os_history[rec.service_order_id] = []
        os_history[rec.service_order_id].append(rec)
        
    status_map = {
        "Recebida": OSStatus.RECEBIDA,
        "Separação": OSStatus.SEPARACAO,
        "Produção": OSStatus.PRODUCAO,
        "Surfaçagem": OSStatus.SURFACAGEM,
        "Montagem": OSStatus.MONTAGEM,
        "CQ": OSStatus.CQ,
        "CQ Final": OSStatus.CQ_FINAL,
        "Expedição": OSStatus.EXPEDICAO,
        "Concluída": OSStatus.CONCLUIDA,
        "Entregue": OSStatus.ENTREGUE,
        "Cancelada": OSStatus.CANCELADA
    }
        
    transition_times = {
        "Recebida -> Separação": [],
        "Separação -> Produção": [],
        "Produção -> Montagem": [],
        "Montagem -> CQ": [],
        "CQ -> Expedição": []
    }
    
    for os_id, records in os_history.items():
        current_status = None
        status_entered_at = None
        
        for rec in records:
            if current_status is None:
                current_status = rec.new_status
                status_entered_at = rec.changed_at
            elif rec.new_status != current_status:
                def get_status_value(st):
                    if isinstance(st, OSStatus):
                        return st.value
                    elif isinstance(st, str):
                        try:
                            return OSStatus[st].value
                        except KeyError:
                            for item in OSStatus:
                                if item.value == st:
                                    return item.value
                            return st
                    return str(st)
                
                prev_val = get_status_value(current_status)
                new_val = get_status_value(rec.new_status)
                pair_key = f"{prev_val} -> {new_val}"
                
                if pair_key in transition_times:
                    delta = rec.changed_at - status_entered_at
                    minutes = delta.total_seconds() / 60.0
                    transition_times[pair_key].append(minutes)
                
                current_status = rec.new_status
                status_entered_at = rec.changed_at
                
    avg_times = {}
    for key, values in transition_times.items():
        if values:
            avg_times[key] = round(sum(values) / len(values), 1)
        else:
            avg_times[key] = 0.0
            
    return {
        "total_orders": total_orders,
        "status_distribution": status_counts,
        "financial_loss": float(total_loss),
        "reprocess_count": reproduction_count,
        "reproduction_rate": reproduction_rate,
        "average_minutes_by_stage": avg_times
    }


# --- 5. LOGICA DE FATURAMENTO E ITENS DE OS ---

async def add_item_to_service_order(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    item_in: ServiceOrderItemCreate,
    operator_id: Optional[uuid.UUID] = None
) -> ServiceOrderItem:
    """
    Adiciona um item (Lente, Tratamento ou Serviço) a uma OS calculando o preço adequado
    para a ótica parceira (se associada). Permite aplicar preço manual autorizado sob justificativa.
    """
    # 1. Carrega a OS para obter a optical_store_id
    os_obj = await get_service_order(db, os_id)
    if not os_obj:
        raise ValueError("Ordem de Serviço não encontrada.")

    # 2. Obtém o nome do item para o log de histórico
    item_name = "Item"
    if item_in.entity_type == "product":
        p = (await db.execute(select(Product).where(Product.id == item_in.entity_id))).scalars().first()
        item_name = p.name if p else "Lente/Produto"
    elif item_in.entity_type == "treatment":
        t = (await db.execute(select(Treatment).where(Treatment.id == item_in.entity_id))).scalars().first()
        item_name = t.name if t else "Tratamento"
    elif item_in.entity_type == "service":
        s = (await db.execute(select(TechnicalService).where(TechnicalService.id == item_in.entity_id))).scalars().first()
        item_name = s.name if s else "Serviço"

    # 3. Calcula o preço faturado unitário aplicando as tabelas de preços contratuais
    original_unit_price = 0.00
    if os_obj.optical_store_id:
        calc_response = await crud_customer_price.calculate_customer_price(
            db, 
            optical_store_id=os_obj.optical_store_id, 
            entity_type=item_in.entity_type, 
            entity_id=item_in.entity_id
        )
        original_unit_price = float(calc_response.calculated_price)
    else:
        # Fallback manual caso a OS não tenha ótica vinculada (usa tabela de catálogo geral)
        if item_in.entity_type == "product":
            p_obj = (await db.execute(select(Product).where(Product.id == item_in.entity_id))).scalars().first()
            original_unit_price = float(p_obj.sale_price) if p_obj else 0.00
        elif item_in.entity_type == "treatment":
            t_obj = (await db.execute(select(Treatment).where(Treatment.id == item_in.entity_id))).scalars().first()
            original_unit_price = float(t_obj.price) if t_obj else 0.00
        elif item_in.entity_type == "service":
            s_obj = (await db.execute(select(TechnicalService).where(TechnicalService.id == item_in.entity_id))).scalars().first()
            original_unit_price = float(s_obj.price) if s_obj else 0.00
        else:
            raise ValueError("Tipo de entidade inválido.")

    # 4. Processa a lógica de Sobrescrita de Preço Manual Autorizado
    custom_price_applied = False
    price_override_reason = None
    unit_price = original_unit_price

    if item_in.override_price is not None:
        if not item_in.price_override_reason or item_in.price_override_reason.strip() == "":
            raise ValueError("Justificativa obrigatória para alteração manual de preço.")
        unit_price = item_in.override_price
        custom_price_applied = True
        price_override_reason = item_in.price_override_reason

    # 5. Cria a linha de faturamento
    db_item = ServiceOrderItem(
        service_order_id=os_id,
        entity_type=item_in.entity_type,
        entity_id=item_in.entity_id,
        quantity=item_in.quantity,
        unit_price=unit_price,
        total_price=round(unit_price * item_in.quantity, 2),
        custom_price_applied=custom_price_applied,
        original_price=Decimal(f"{original_unit_price:.2f}"),
        price_override_reason=price_override_reason
    )
    db.add(db_item)
    await db.flush()

    # 6. Registra log de auditoria no histórico da OS caso tenha ocorrido preço manual
    if custom_price_applied:
        log_notes = f"Preço manual autorizado para {item_name}: De R$ {original_unit_price:.2f} para R$ {unit_price:.2f}. Motivo: {price_override_reason}"
        await add_workflow_history(
            db, 
            os_id, 
            os_obj.status, 
            os_obj.status, 
            log_notes, 
            operator_id=operator_id,
            sector="Comercial / Faturamento"
        )
    # 7. Atualiza o total acumulado da OS
    await update_os_total_amount(db, os_obj)
    await db.commit()
    await db.refresh(db_item)
    setattr(db_item, "name", item_name)
    setattr(db_item, "description", item_name)
    return db_item

async def remove_item_from_service_order(
    db: AsyncSession, 
    os_id: uuid.UUID, 
    item_id: uuid.UUID
) -> bool:
    """
    Remove uma linha de faturamento da OS e recalcula seu valor total.
    """
    # Carrega a OS trazendo seus itens comerciais associados
    query_os = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(selectinload(ServiceOrder.items))
    )
    os_obj = (await db.execute(query_os)).scalars().first()
    if not os_obj:
        return False

    # Localiza o item a ser removido na coleção em memória
    db_item = next((item for item in os_obj.items if item.id == item_id), None)
    if not db_item:
        return False

    # Remove da coleção. O cascade "all, delete-orphan" do SQLAlchemy deletará o registro fisicamente.
    os_obj.items.remove(db_item)
    await db.flush()

    # Recalcula o total acumulado
    await update_os_total_amount(db, os_obj)
    await db.commit()
    return True

async def update_os_total_amount(db: AsyncSession, os_obj: ServiceOrder):
    """
    Calcula a soma das linhas de faturamento da OS e grava no total_amount.
    """
    sum_query = select(func.sum(ServiceOrderItem.total_price)).where(ServiceOrderItem.service_order_id == os_obj.id)
    res_sum = await db.execute(sum_query)
    total_val = res_sum.scalar() or 0.00
    os_obj.total_amount = float(total_val)

async def create_cq_inspection(
    db: AsyncSession,
    os_id: uuid.UUID,
    operator_id: uuid.UUID,
    cq_in: CQInspectionCreate
) -> Tuple[OSCQInspection, ServiceOrder]:
    """
    Registra uma inspeção de Controle de Qualidade para uma OS no status CQ e avança o status
    (Aprovado -> Expedição, Retrabalho -> Montagem/Produção, Reprovado -> Recebida com perda de lentes).
    """
    # 1. Carrega a OS com bloqueio de concorrência e tabelas de estoque
    query_os = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model)
        )
        .with_for_update()
    )
    res_os = await db.execute(query_os)
    os_obj = res_os.scalar_one_or_none()
    if not os_obj:
        raise ValueError("Ordem de Serviço não encontrada.")

    # 2. Validações
    if os_obj.status not in [OSStatus.CQ, OSStatus.CQ_FINAL, "CQ", "CQ Final"]:
        raise ValueError(f"Apenas Ordens de Serviço na bancada de CQ podem ser inspecionadas. Status atual: {os_obj.status}")


    result_upper = cq_in.result.upper()
    if result_upper not in ["APROVADO", "RETRABALHO", "REPROVADO"]:
        raise ValueError("Resultado de CQ inválido. Deve ser APROVADO, RETRABALHO ou REPROVADO.")

    if result_upper in ["RETRABALHO", "REPROVADO"] and (not cq_in.notes or cq_in.notes.strip() == ""):
        raise ValueError(f"Justificativa obrigatória para resultado de CQ: {result_upper}.")

    prev_status = os_obj.status

    # 3. Processa a transição de status conforme o resultado
    if result_upper == "APROVADO":
        os_obj.status = OSStatus.EXPEDICAO
        notes_log = f"Aprovada no CQ. Checklist - Grau: Ok, Eixo: Ok, Prisma: Ok, Acabamento: Ok. Nota: {cq_in.notes or 'Sem observações'}"
        await add_workflow_history(
            db, 
            os_id, 
            prev_status, 
            OSStatus.EXPEDICAO, 
            notes_log, 
            operator_id=operator_id, 
            sector="Controle de Qualidade"
        )
    elif result_upper == "RETRABALHO":
        dest = cq_in.rework_destination
        if not dest or dest.strip() == "":
            dest = "Montagem"
        
        if dest.lower() in ["produção", "producao"]:
            target_status = OSStatus.PRODUCAO
            dest_label = "Produção"
        else:
            target_status = OSStatus.MONTAGEM
            dest_label = "Montagem"

        os_obj.status = target_status
        checklist_str = f"Grau: {'Ok' if cq_in.check_grau else 'Falhou'}, Eixo: {'Ok' if cq_in.check_eixo else 'Falhou'}, Prisma: {'Ok' if cq_in.check_prisma else 'Falhou'}, Acabamento: {'Ok' if cq_in.check_acabamento else 'Falhou'}"
        notes_log = f"Retrabalho enviado para {dest_label}. Checklist: ({checklist_str}). Motivo: {cq_in.notes}"
        await add_workflow_history(
            db, 
            os_id, 
            prev_status, 
            target_status, 
            notes_log, 
            operator_id=operator_id, 
            sector="Controle de Qualidade"
        )
    elif result_upper == "REPROVADO":
        cost_loss = Decimal("0.00")
        if os_obj.od_lens_inventory:
            cost_loss += os_obj.od_lens_inventory.lens_model.cost_price
        if os_obj.oe_lens_inventory:
            cost_loss += os_obj.oe_lens_inventory.lens_model.cost_price

        os_obj.od_lens_inventory_id = None
        os_obj.oe_lens_inventory_id = None
        os_obj.status = OSStatus.RECEBIDA
        os_obj.is_rework = True
        
        checklist_str = f"Grau: {'Ok' if cq_in.check_grau else 'Falhou'}, Eixo: {'Ok' if cq_in.check_eixo else 'Falhou'}, Prisma: {'Ok' if cq_in.check_prisma else 'Falhou'}, Acabamento: {'Ok' if cq_in.check_acabamento else 'Falhou'}"
        notes_log = f"Reprovada no CQ. Lentes descartadas. Perda de Custo: R$ {cost_loss:.2f}. Checklist: ({checklist_str}). Justificativa: {cq_in.notes}"
        await add_workflow_history(
            db, 
            os_id, 
            prev_status, 
            OSStatus.RECEBIDA, 
            notes_log, 
            operator_id=operator_id, 
            sector="Controle de Qualidade"
        )


    # 4. Registra a inspeção física de CQ no histórico
    cq_obj = OSCQInspection(
        service_order_id=os_id,
        operator_id=operator_id,
        check_grau=cq_in.check_grau,
        check_eixo=cq_in.check_eixo,
        check_prisma=cq_in.check_prisma,
        check_acabamento=cq_in.check_acabamento,
        result=result_upper,
        rework_destination=cq_in.rework_destination if result_upper == "RETRABALHO" else None,
        notes=cq_in.notes,
        created_at=datetime.now(timezone.utc)
    )
    db.add(cq_obj)
    await db.commit()
    db.expire(os_obj)
    
    os_loaded = await get_service_order(db, os_id)
    return cq_obj, os_loaded

async def update_service_order(
    db: AsyncSession, os_id: uuid.UUID, obj_in: ServiceOrderUpdate, operator_id: Optional[uuid.UUID] = None
) -> Optional[ServiceOrder]:
    query = (
        select(ServiceOrder)
        .where(ServiceOrder.id == os_id)
        .options(
            selectinload(ServiceOrder.od_lens_inventory),
            selectinload(ServiceOrder.oe_lens_inventory)
        )
        .with_for_update()
    )
    res = await db.execute(query)
    os_obj = res.scalar_one_or_none()
    if not os_obj:
        return None
        
    editable_statuses = [
        OSStatus.RECEBIDA, OSStatus.RECEBIDA.value,
        OSStatus.SEPARACAO, OSStatus.SEPARACAO.value,
        "Recebida", "Separação"
    ]
    if os_obj.status not in editable_statuses:
        status_val = os_obj.status.value if hasattr(os_obj.status, 'value') else os_obj.status
        raise ValueError(f"Não é permitido alterar dados técnicos de uma OS no status {status_val}.")
        
    fields_changed = False
    technical_fields = [
        "od_spherical", "od_cylindrical", "od_axis", "od_addition", "od_dnp", "od_prism", "od_height",
        "oe_spherical", "oe_cylindrical", "oe_axis", "oe_addition", "oe_dnp", "oe_prism", "oe_height",
        "frame_a", "frame_bridge", "frame_ed"
    ]
    for field in technical_fields:
        new_val = getattr(obj_in, field)
        if new_val is not None:
            old_val = getattr(os_obj, field)
            if old_val != new_val:
                fields_changed = True
                
    if obj_in.lens_model_id is not None:
        old_model_id = None
        if os_obj.od_lens_inventory:
            old_model_id = os_obj.od_lens_inventory.lens_model_id
        if old_model_id != obj_in.lens_model_id:
            fields_changed = True
            
    if obj_in.clinical_notes is not None and obj_in.clinical_notes != os_obj.clinical_notes:
        os_obj.clinical_notes = obj_in.clinical_notes
        os_obj.clinical_embedding = await generate_clinical_embedding(obj_in.clinical_notes)
        
    if obj_in.client_name is not None:
        os_obj.client_name = obj_in.client_name
    if obj_in.doctor_name is not None:
        os_obj.doctor_name = obj_in.doctor_name
    if obj_in.optical_store_id is not None:
        os_obj.optical_store_id = obj_in.optical_store_id
    if obj_in.partner_shop_id is not None:
        os_obj.partner_shop_id = obj_in.partner_shop_id
        
    if fields_changed:
        lenses_to_return = []
        if os_obj.od_lens_inventory_id:
            lenses_to_return.append(os_obj.od_lens_inventory_id)
        if os_obj.oe_lens_inventory_id:
            lenses_to_return.append(os_obj.oe_lens_inventory_id)
            
        for inv_id in lenses_to_return:
            mov = StockMovementCreate(
                lens_inventory_id=inv_id,
                movement_type="IN",
                quantity=1,
                reason=f"Estorno por alteração técnica da OS {os_obj.os_number}"
            )
            await crud_movement.create_stock_movement(db, mov)
            
        os_obj.od_lens_inventory_id = None
        os_obj.oe_lens_inventory_id = None
        
        for field in technical_fields:
            val = getattr(obj_in, field)
            if val is not None:
                setattr(os_obj, field, val)
                
        lens_model_id = obj_in.lens_model_id
        if not lens_model_id and os_obj.od_lens_inventory:
            lens_model_id = os_obj.od_lens_inventory.lens_model_id
            
        os_obj.status = OSStatus.RECEBIDA
        
        if os_obj.frame_a and os_obj.frame_bridge and os_obj.frame_ed and lens_model_id:
            alloc_payload = AllocateRequest(
                frame_a=os_obj.frame_a,
                frame_bridge=os_obj.frame_bridge,
                frame_ed=os_obj.frame_ed,
                lens_model_id=lens_model_id,
                od_dnp=os_obj.od_dnp,
                oe_dnp=os_obj.oe_dnp
            )
            success, message, _ = await allocate_lenses_for_os(db, os_obj.id, alloc_payload)
            if not success:
                await add_workflow_history(
                    db, 
                    os_obj.id, 
                    OSStatus.RECEBIDA, 
                    OSStatus.CANCELADA, 
                    f"Recálculo pós-edição reprovado: {message}",
                    operator_id=operator_id
                )
            else:
                await add_workflow_history(
                    db, 
                    os_obj.id, 
                    OSStatus.RECEBIDA, 
                    OSStatus.SEPARACAO, 
                    "Recálculo pós-edição executado com sucesso e novas lentes alocadas.",
                    operator_id=operator_id
                )
        else:
            await add_workflow_history(
                db, 
                os_obj.id, 
                os_obj.status, 
                OSStatus.RECEBIDA, 
                "Dados de receita alterados. Alocação pendente de medidas da armação.",
                operator_id=operator_id
            )
    else:
        for field in technical_fields:
            val = getattr(obj_in, field)
            if val is not None:
                setattr(os_obj, field, val)
                
    await db.commit()
    return await get_service_order(db, os_obj.id)

async def soft_delete_service_order(
    db: AsyncSession, os_id: uuid.UUID, cancellation_reason: str, operator_id: Optional[uuid.UUID] = None
) -> Optional[ServiceOrder]:
    query = select(ServiceOrder).where(ServiceOrder.id == os_id).with_for_update()
    res = await db.execute(query)
    os_obj = res.scalar_one_or_none()
    if not os_obj:
        return None
        
    # Guarda de idempotência: não cancela OS já cancelada
    if os_obj.status in [OSStatus.CANCELADA, OSStatus.CANCELADA.value, "Cancelada"]:
        return await get_service_order(db, os_id)

    prev_status = os_obj.status
    os_obj.status = OSStatus.CANCELADA
    os_obj.cancellation_reason = cancellation_reason
    
    lenses_to_return = []
    if os_obj.od_lens_inventory_id:
        lenses_to_return.append(os_obj.od_lens_inventory_id)
    if os_obj.oe_lens_inventory_id:
        lenses_to_return.append(os_obj.oe_lens_inventory_id)
        
    for inv_id in lenses_to_return:
        mov = StockMovementCreate(
            lens_inventory_id=inv_id,
            movement_type="IN",
            quantity=1,
            reason=f"Estorno por Cancelamento da OS {os_obj.os_number}. Motivo: {cancellation_reason}"
        )
        await crud_movement.create_stock_movement(db, mov)
        
    os_obj.od_lens_inventory_id = None
    os_obj.oe_lens_inventory_id = None
    
    await db.commit()
    await add_workflow_history(
        db, 
        os_id, 
        prev_status, 
        OSStatus.CANCELADA, 
        f"Cancelamento lógico da OS. Motivo: {cancellation_reason}",
        operator_id=operator_id
    )
    return await get_service_order(db, os_id)

