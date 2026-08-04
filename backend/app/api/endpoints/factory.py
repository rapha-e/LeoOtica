import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.models.os import ServiceOrder, OSStatus
from backend.app.schemas.os import ServiceOrderResponse, BipBancadaRequest, ReprocessRequest
from backend.app.crud import os as crud_os
from backend.app.core.websocket import manager
from backend.app.api.deps import get_current_active_operator
from backend.app.models.user import User

router = APIRouter()

@router.post("/os/bip-bancada", response_model=ServiceOrderResponse)
async def os_bip_bancada(
    payload: BipBancadaRequest,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Simula a bipagem de uma OS por leitor de código de barras.
    Busca a OS pelo número e transiciona seu status na máquina de estados de produção,
    enviando um sinal em tempo real via WebSockets.
    """
    query = select(ServiceOrder).where(ServiceOrder.os_number == payload.os_number)
    res = await db.execute(query)
    os_obj = res.scalar_one_or_none()
    
    if not os_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ordem de Serviço com número {payload.os_number} não encontrada."
        )
        
    if payload.target_status:
        try:
            new_status = OSStatus(payload.target_status)
        except ValueError:
            new_status = payload.target_status
    else:
        current_status = os_obj.status
        if current_status == OSStatus.RECEBIDA:
            if os_obj.os_type == "REPARO_SERVICO":
                new_status = OSStatus.MONTAGEM
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A OS está em Triagem (status Recebida). Aloque as lentes apropriadas no painel da Triagem para prosseguir."
                )
        elif current_status == OSStatus.CANCELADA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta OS foi CANCELADA e não pode prosseguir. Registre um reprocessamento."
            )
        elif current_status == OSStatus.EXPEDICAO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta OS já foi FINALIZADA e EXPEDIDA."
            )
        elif current_status == OSStatus.SEPARACAO:
            new_status = OSStatus.PRODUCAO
        elif current_status == OSStatus.PRODUCAO:
            new_status = OSStatus.MONTAGEM
        elif current_status == OSStatus.MONTAGEM:
            new_status = OSStatus.CQ
        elif current_status == OSStatus.CQ:
            new_status = OSStatus.EXPEDICAO
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status de workflow '{current_status}' desconhecido para avanço automático."
            )
            
    notes = payload.operator_notes
    if not notes:
        status_val = new_status.value if hasattr(new_status, 'value') else str(new_status)
        notes = f"Avanço de status automático via leitor de código de barras para: {status_val}."
        
    sector_mapping = {
        OSStatus.RECEBIDA: "Recepção / Triagem",
        OSStatus.SEPARACAO: "Almoxarifado / Separação",
        OSStatus.PRODUCAO: "Surfaçagem / Produção",
        OSStatus.MONTAGEM: "Corte & Montagem",
        OSStatus.CQ: "Controle de Qualidade",
        OSStatus.EXPEDICAO: "Expedição",
        OSStatus.CANCELADA: "Administrativo"
    }
    sector = sector_mapping.get(new_status, "Bipes")

    updated_os = await crud_os.update_os_status(
        db, 
        os_obj.id, 
        new_status, 
        notes, 
        operator_id=current_user.id, 
        sector=sector
    )
    if not updated_os:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar o status do workflow."
        )
        
    await manager.broadcast({
        "event": "os_status_updated",
        "os_id": str(updated_os.id),
        "os_number": updated_os.os_number,
        "client_name": updated_os.client_name,
        "status": updated_os.status.value if hasattr(updated_os.status, 'value') else updated_os.status
    })
    
    full_os = await crud_os.get_service_order(db, updated_os.id)
    return full_os


@router.post("/os/{os_id}/breakage", response_model=ServiceOrderResponse)
async def register_factory_breakage(
    os_id: uuid.UUID,
    payload: ReprocessRequest,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra quebra física de lente e retorna a OS para RECEBIDA.
    Dispara broadcast de WebSocket para o painel operacional.
    """
    success, message, os_obj = await crud_os.reprocess_broken_lenses(
        db, 
        os_id, 
        payload.operator_notes,
        operator_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
        
    await manager.broadcast({
        "event": "os_status_updated",
        "os_id": str(os_obj.id),
        "os_number": os_obj.os_number,
        "client_name": os_obj.client_name,
        "status": os_obj.status.value if hasattr(os_obj.status, 'value') else os_obj.status
    })
    
    return os_obj
