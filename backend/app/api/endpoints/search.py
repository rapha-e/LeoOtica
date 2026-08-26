from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator
from backend.app.models.os import ServiceOrder
from backend.app.models.optical_store import OpticalStore
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.models.billing import NfeSaida
from pydantic import BaseModel
from typing import Any

router = APIRouter()

class SearchResult(BaseModel):
    type: str          # 'os' | 'otica' | 'lente' | 'nfe'
    id: str
    title: str
    subtitle: str
    tab: str           # tab do frontend para navegar
    icon: str          # emoji de categoria

@router.get("/", response_model=List[SearchResult])
async def global_search(
    q: str = Query(..., min_length=2, description="Termo de busca"),
    limit: int = Query(10, le=30),
    current_user: Any = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Pesquisa global unificada em OS, Óticas, Lentes e NF-e.
    Retorna resultados categorizados com link de navegação para o frontend.
    """
    results: List[SearchResult] = []
    term = f"%{q}%"

    # 1. Ordens de Serviço — por número de OS, número do pedido da loja, bandeja ou nome do cliente
    os_query = await db.execute(
        select(ServiceOrder)
        .where(
            or_(
                ServiceOrder.os_number.ilike(term),
                ServiceOrder.client_order_number.ilike(term),
                ServiceOrder.tray_number.ilike(term),
                ServiceOrder.client_name.ilike(term),
            )
        )
        .limit(limit)
    )
    for os in os_query.scalars().all():
        ped_info = f" (Pedido: {os.client_order_number})" if os.client_order_number else ""
        tray_info = f" | Bandeja: {os.tray_number}" if os.tray_number else ""
        results.append(SearchResult(
            type="os",
            id=str(os.id),
            title=f"OS #{os.os_number}{ped_info}",
            subtitle=f"{os.client_name or 'Sem cliente'}{tray_info}",
            tab="os-workflow",
            icon="📋"
        ))

    # 2. Óticas — por nome fantasia, razão social ou CNPJ
    otica_query = await db.execute(
        select(OpticalStore)
        .where(
            or_(
                OpticalStore.trade_name.ilike(term),
                OpticalStore.corporate_name.ilike(term),
                OpticalStore.cnpj.ilike(term),
            )
        )
        .limit(limit)
    )
    for otica in otica_query.scalars().all():
        results.append(SearchResult(
            type="otica",
            id=str(otica.id),
            title=otica.trade_name or otica.corporate_name,
            subtitle=otica.cnpj or "",
            tab="os-workflow",
            icon="🏪"
        ))

    # 3. Lentes — por código de barras
    lente_query = await db.execute(
        select(LensInventoryGrade, LensModel)
        .join(LensModel, LensInventoryGrade.lens_model_id == LensModel.id)
        .where(
            or_(
                LensInventoryGrade.barcode.ilike(term),
                LensModel.brand.ilike(term),
                LensModel.material.ilike(term),
            )
        )
        .limit(limit)
    )
    for lig, lm in lente_query.all():
        m_type = lm.matrix_type or "LP_GRADE"
        target_tab = "grid"
        if m_type == "GRADE_167":
            target_tab = "grid-167"
        elif m_type == "MF_ACB":
            target_tab = "grid-multifocal-acabado"
        elif m_type == "BLOCO_VS":
            target_tab = "matriz-visao-simples"
        elif m_type == "MF_BLOCO":
            target_tab = "grid-blocos"

        results.append(SearchResult(
            type="lente",
            id=str(lig.id),
            title=f"{lm.brand} {lm.material} {lm.refractive_index} [{m_type}]",
            subtitle=lig.barcode or f"Esf: {lig.spherical} | Cil: {lig.cylindrical}",
            tab=target_tab,
            icon="🔬"
        ))

    # 4. NF-e — por número
    if q.isdigit():
        nfe_query = await db.execute(
            select(NfeSaida)
            .where(cast(NfeSaida.nfe_number, String).ilike(term))
            .limit(5)
        )
        for nfe in nfe_query.scalars().all():
            results.append(SearchResult(
                type="nfe",
                id=str(nfe.id),
                title=f"NF-e #{nfe.nfe_number:06d}",
                subtitle=f"Status: {nfe.status}",
                tab="billing",
                icon="🧾"
            ))

    # Retorna limitado e ordenado por tipo
    return results[:limit]
