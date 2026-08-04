import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.commercial_order import CommercialOrder, CommercialOrderItem
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsReceivable
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.schemas.order import CommercialOrderCreate, CommercialOrderUpdate

async def generate_order_number(db: AsyncSession) -> str:
    """Gera um número sequencial único para o Pedido Comercial (ex: PED-2026-0001)."""
    current_year = datetime.utcnow().year
    prefix = f"PED-{current_year}-"
    
    query = select(func.count(CommercialOrder.id))
    result = await db.execute(query)
    count = result.scalar() or 0
    
    return f"{prefix}{(count + 1):04d}"

async def get_orders(
    db: AsyncSession,
    status: Optional[str] = None,
    optical_store_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[CommercialOrder]:
    """Lista pedidos de venda comerciais com filtros e paginação."""
    query = (
        select(CommercialOrder)
        .options(selectinload(CommercialOrder.items), selectinload(CommercialOrder.optical_store))
        .order_by(CommercialOrder.created_at.desc())
    )

    if status:
        query = query.where(CommercialOrder.status == status)
    if optical_store_id:
        query = query.where(CommercialOrder.optical_store_id == optical_store_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                CommercialOrder.order_number.ilike(s),
                CommercialOrder.client_name.ilike(s),
                CommercialOrder.doctor_name.ilike(s)
            )
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_order_by_id(db: AsyncSession, order_id: uuid.UUID) -> Optional[CommercialOrder]:
    """Obtém um pedido comercial pelo ID com seus itens e ótica vinculada."""
    query = (
        select(CommercialOrder)
        .where(CommercialOrder.id == order_id)
        .options(selectinload(CommercialOrder.items), selectinload(CommercialOrder.optical_store))
    )
    result = await db.execute(query)
    return result.scalars().first()

async def create_commercial_order(db: AsyncSession, data: CommercialOrderCreate) -> CommercialOrder:
    """
    Cria um novo Pedido Comercial de Venda com cálculo de itens e verificação automática de crédito.
    """
    # 1. Busca dados da Ótica
    store_res = await db.execute(select(OpticalStore).where(OpticalStore.id == data.optical_store_id))
    store = store_res.scalars().first()
    if not store:
        raise ValueError("Ótica parceira não cadastrada no sistema.")

    # 2. Calcula Subtotal e Total dos Itens
    subtotal = Decimal("0.00")
    order_items_objs = []
    
    for item in data.items:
        unit = Decimal(str(item.unit_price))
        qty = item.quantity
        tot = unit * Decimal(str(qty))
        subtotal += tot

        order_items_objs.append(
            CommercialOrderItem(
                item_type=item.item_type,
                item_name=item.item_name,
                quantity=qty,
                unit_price=unit,
                total_price=tot,
                reference_id=item.reference_id
            )
        )

    discount = Decimal("0.00")
    total_amount = subtotal - discount
    order_number = await generate_order_number(db)

    # 3. Validação de Crédito & Inadimplência via Contas a Receber (AR)
    overdue_query = select(AccountsReceivable).where(
        and_(
            AccountsReceivable.optical_store_id == data.optical_store_id,
            AccountsReceivable.status == "PENDENTE",
            AccountsReceivable.due_date < datetime.utcnow()
        )
    )
    overdue_res = await db.execute(overdue_query)
    overdue_items = overdue_res.scalars().all()

    debt_query = select(func.sum(AccountsReceivable.amount - AccountsReceivable.amount_received)).where(
        and_(
            AccountsReceivable.optical_store_id == data.optical_store_id,
            AccountsReceivable.status.in_(["PENDENTE", "RECEBIDO_PARCIAL"])
        )
    )
    debt_res = await db.execute(debt_query)
    current_debt = Decimal(str(debt_res.scalar() or 0.0))

    initial_status = "EM_PRODUCAO"
    hold_reason = None

    if len(overdue_items) > 0:
        initial_status = "BLOQUEADO_FINANCEIRO"
        hold_reason = f"Ótica possui {len(overdue_items)} fatura(s) vencida(s) no Contas a Receber."
    elif float(current_debt) + float(total_amount) > float(store.credit_limit):
        initial_status = "BLOQUEADO_FINANCEIRO"
        hold_reason = f"Valor do pedido excede o limite de crédito (Limite: R$ {float(store.credit_limit):.2f} | Débito: R$ {float(current_debt):.2f})."

    # 4. Instancia e Salva o Pedido
    order = CommercialOrder(
        order_number=order_number,
        optical_store_id=data.optical_store_id,
        client_name=data.client_name,
        doctor_name=data.doctor_name,
        frame_type=data.frame_type,
        payment_terms=data.payment_terms,
        
        od_spherical=Decimal(str(data.od_spherical or 0.0)),
        od_cylindrical=Decimal(str(data.od_cylindrical or 0.0)),
        od_axis=data.od_axis or 0,
        od_addition=Decimal(str(data.od_addition or 0.0)),
        od_dnp=Decimal(str(data.od_dnp or 30.0)),
        od_height=Decimal(str(data.od_height or 18.0)),

        oe_spherical=Decimal(str(data.oe_spherical or 0.0)),
        oe_cylindrical=Decimal(str(data.oe_cylindrical or 0.0)),
        oe_axis=data.oe_axis or 0,
        oe_addition=Decimal(str(data.oe_addition or 0.0)),
        oe_dnp=Decimal(str(data.oe_dnp or 30.0)),
        oe_height=Decimal(str(data.oe_height or 18.0)),

        status=initial_status,
        financial_hold_reason=hold_reason,
        subtotal=subtotal,
        discount_amount=discount,
        total_amount=total_amount,
        notes=data.notes,
        items=order_items_objs
    )

    db.add(order)
    await db.flush()

    # 5. Se aprovado, sincroniza e gera a OS na produção MES
    if initial_status == "EM_PRODUCAO":
        await create_mes_service_order_for_commercial_order(db, order)

    await db.commit()
    return await get_order_by_id(db, order.id)

async def approve_financial_hold(db: AsyncSession, order_id: uuid.UUID) -> Optional[CommercialOrder]:
    """Aprova manualmente o crédito de um pedido bloqueado e o libera para a produção MES."""
    order = await get_order_by_id(db, order_id)
    if not order:
        return None

    if order.status == "BLOQUEADO_FINANCEIRO":
        order.status = "EM_PRODUCAO"
        order.financial_hold_reason = "Aprovado manualmente pela Gestão Financeira"
        db.add(order)
        await db.flush()

        await create_mes_service_order_for_commercial_order(db, order)
        await db.commit()

    return await get_order_by_id(db, order.id)

async def bill_commercial_order(db: AsyncSession, order_id: uuid.UUID) -> Optional[CommercialOrder]:
    """
    Fatura o Pedido Comercial de Venda, atualizando o status para FATURADO
    e gerando automaticamente um título no Contas a Receber (AR).
    """
    order = await get_order_by_id(db, order_id)
    if not order:
        return None

    if order.status in ["EM_PRODUCAO", "PRONTO_EXPEDICAO"]:
        order.status = "FATURADO"
        db.add(order)
        await db.flush()

        # Gera o Título no Contas a Receber
        days_to_due = 30 if order.payment_terms == "30_DIAS" else 15
        receivable = AccountsReceivable(
            optical_store_id=order.optical_store_id,
            description=f"Faturamento Pedido Comercial {order.order_number} - {order.client_name}",
            amount=float(order.total_amount),
            amount_received=0.00,
            due_date=datetime.utcnow() + timedelta(days=days_to_due),
            status="PENDENTE",
            notes=f"Gerado automaticamente pelo faturamento do pedido {order.order_number}"
        )
        db.add(receivable)
        await db.commit()

    return await get_order_by_id(db, order.id)

async def create_mes_service_order_for_commercial_order(db: AsyncSession, order: CommercialOrder):
    """Cria uma Ordem de Serviço de Produção MES correspondente ao pedido aprovado."""
    os_number = f"OS-{order.order_number.replace('PED-', '')}"
    
    # Verifica se já existe OS criada com este número
    existing = await db.execute(select(ServiceOrder).where(ServiceOrder.os_number == os_number))
    if existing.scalars().first():
        return

    service_order = ServiceOrder(
        os_number=os_number,
        client_name=order.client_name,
        doctor_name=order.doctor_name,
        optical_store_id=order.optical_store_id,
        status=OSStatus.RECEBIDA,
        
        od_spherical=order.od_spherical,
        od_cylindrical=order.od_cylindrical,
        od_axis=order.od_axis,
        od_addition=order.od_addition,
        od_dnp=order.od_dnp,

        oe_spherical=order.oe_spherical,
        oe_cylindrical=order.oe_cylindrical,
        oe_axis=order.oe_axis,
        oe_addition=order.oe_addition,
        oe_dnp=order.oe_dnp,

        total_amount=order.total_amount,
        is_financial_approved=True
    )
    db.add(service_order)
