import uuid
import io
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.billing import (
    BillingCycleCreate,
    BillingCycleResponse,
    PendingBillingGroupResponse,
    PendingOrderResponse
)
from backend.app.schemas.nfe import NfeSaidaResponse
from backend.app.crud import billing as crud_billing
from backend.app.crud import nfe as crud_nfe
from backend.app.api.deps import get_current_active_operator
from backend.app.services.pdf_generator import generate_billing_pdf
from backend.app.services.excel_generator import generate_billing_excel
from backend.app.services.nfe_emitter import generate_danfe_pdf

router = APIRouter()

@router.get("/pending", response_model=List[PendingBillingGroupResponse])
async def list_pending_groups(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista os totais acumulados de OSs elegíveis para faturamento agrupados por ótica.
    """
    return await crud_billing.get_pending_billing_groups(db)

@router.get("/pending/{store_id}", response_model=List[PendingOrderResponse])
async def list_pending_orders_by_store(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista os detalhes das OSs prontas para faturamento da ótica especificada.
    """
    return await crud_billing.get_pending_orders_by_store(db, store_id)

@router.post("/", response_model=BillingCycleResponse, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    payload: BillingCycleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Gera um novo fechamento/ciclo financeiro para a ótica.
    """
    try:
        return await crud_billing.create_billing_cycle(
            db,
            optical_store_id=payload.optical_store_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            service_order_ids=payload.service_order_ids,
            due_date=payload.due_date
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/kpis")
async def get_receivables_indicators(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Busca os consolidadores financeiros de Contas a Receber (Recebido, Pendente, Inadimplente).
    """
    return await crud_billing.get_receivables_kpis(db)

@router.get("/", response_model=List[BillingCycleResponse])
async def list_cycles(
    skip: int = 0,
    limit: int = 100,
    optical_store_id: Optional[uuid.UUID] = Query(None, description="Filtrar por ótica comercial"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista todos os fechamentos financeiros cadastrados no sistema.
    """
    return await crud_billing.list_billing_cycles(
        db, optical_store_id=optical_store_id, skip=skip, limit=limit
    )

@router.get("/{cycle_id}", response_model=BillingCycleResponse)
async def get_cycle(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Busca os detalhes completos de um fechamento financeiro específico.
    """
    cycle = await crud_billing.get_billing_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de faturamento não encontrado."
        )
    return cycle

@router.post("/{cycle_id}/pay", response_model=BillingCycleResponse)
async def pay_cycle(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Quita um ciclo de faturamento pendente (status FECHADO -> PAGO).
    """
    cycle = await crud_billing.pay_billing_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de faturamento não encontrado ou não pôde ser quitado."
        )
    return cycle


@router.get("/{cycle_id}/export-pdf")
async def export_cycle_pdf(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Exporta o fechamento financeiro em formato PDF A4 para impressão ou salvamento.
    """
    cycle = await crud_billing.get_billing_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de faturamento não encontrado."
        )
    from backend.app.crud import laboratory as crud_laboratory
    lab = await crud_laboratory.get_laboratory(db)
    pdf_bytes = generate_billing_pdf(cycle, laboratory=lab)
    
    lab_name_slug = "".join(c for c in (lab.name if lab else "novalab") if c.isalnum()).lower()
    filename = f"fatura_{lab_name_slug}_{cycle.id.hex[:8]}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{cycle_id}/export-excel")
async def export_cycle_excel(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Exporta o fechamento financeiro em formato Excel (.xlsx) contendo todas as OSs.
    """
    cycle = await crud_billing.get_billing_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de faturamento não encontrado."
        )
    excel_bytes = generate_billing_excel(cycle)
    
    from backend.app.crud import laboratory as crud_laboratory
    lab = await crud_laboratory.get_laboratory(db)
    lab_name_slug = "".join(c for c in (lab.name if lab else "novalab") if c.isalnum()).lower()

    filename = f"fatura_{lab_name_slug}_{cycle.id.hex[:8]}.xlsx"
    
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{cycle_id}/nfe", response_model=NfeSaidaResponse)
async def emit_nfe(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Emite a NF-e simulada para o ciclo de faturamento.
    """
    try:
        return await crud_nfe.create_nfe_saida(db, cycle_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{cycle_id}/nfe/xml")
async def get_nfe_xml(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Retorna o conteúdo XML da NF-e emitida para download.
    """
    nfe = await crud_nfe.get_nfe_by_cycle_id(db, cycle_id)
    if not nfe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nota fiscal não encontrada para este ciclo."
        )
    
    filename = f"nfe_{nfe.nfe_number:06d}.xml"
    return StreamingResponse(
        io.BytesIO(nfe.xml_content.encode("utf-8")),
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{cycle_id}/nfe/danfe")
async def get_nfe_danfe(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Gera e fornece para download/visualização o PDF do DANFE da nota fiscal emitida.
    """
    nfe = await crud_nfe.get_nfe_by_cycle_id(db, cycle_id)
    if not nfe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nota fiscal não encontrada para este ciclo."
        )
    
    # Busca o ciclo
    cycle = await crud_billing.get_billing_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de faturamento não encontrado."
        )
    from backend.app.crud import laboratory as crud_laboratory
    lab = await crud_laboratory.get_laboratory(db)
    pdf_bytes = generate_danfe_pdf(cycle, nfe.status, nfe.nfe_number, nfe.chave_acesso, laboratory=lab)
    
    filename = f"danfe_{nfe.nfe_number:06d}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{cycle_id}/nfe/cancel", response_model=NfeSaidaResponse)
async def cancel_nfe(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Cancela fiscalmente a nota emitida para o ciclo.
    """
    try:
        return await crud_nfe.cancel_nfe_saida(db, cycle_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
