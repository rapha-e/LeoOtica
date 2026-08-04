import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator
from backend.app.models.user import User
from backend.app.schemas.os import (
    ServiceOrderResponse, ServiceOrderCreate, ServiceOrderUpdate, OSCancelRequest, AllocateRequest, StatusUpdateRequest, ReprocessRequest,
    ServiceOrderItemCreate, ServiceOrderItemResponse, CQInspectionCreate
)
from backend.app.crud import os as crud_os
from backend.app.services.ai_ocr import analyze_recipe_image
from decimal import Decimal
from backend.app.models.os import OSStatus
from backend.app.models.partner import PartnerShop

router = APIRouter()

@router.post("/", response_model=ServiceOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_service_order_endpoint(
    payload: ServiceOrderCreate,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Cria manualmente uma nova Ordem de Serviço (OS) com os dados de receita e ótica de faturamento.
    """
    return await crud_os.create_service_order(db, payload)

@router.post("/upload-receita", response_model=ServiceOrderResponse, status_code=status.HTTP_201_CREATED)
async def upload_receita_ocr(
    file: UploadFile = File(...),
    optical_store_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe imagem da receita oftálmica, roda OCR/LLM (Gemini) e cria
    uma Ordem de Serviço (OS) com os graus estruturados em status Recebida.
    """
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo inválido. Envie uma imagem (PNG, JPG, JPEG)."
        )

@router.get("/financial-blocked", response_model=List[ServiceOrderResponse])
async def list_financial_blocked_orders_endpoint(
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a fila administrativa de Ordens de Serviço bloqueadas por restrição financeira.
    """
    return await crud_os.get_financial_blocked_orders(db)
        
    try:
        content = await file.read()
        extracted_data = await analyze_recipe_image(file.filename, content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro ao processar imagem da receita: {str(e)}"
        )
        
    partner_shop_id = None
    shop_name = extracted_data.get("shop_name")
    if shop_name:
        query = select(PartnerShop).where(
            or_(
                PartnerShop.trade_name.ilike(f"%{shop_name}%"),
                PartnerShop.corporate_name.ilike(f"%{shop_name}%")
            )
        )
        res = await db.execute(query)
        partner = res.scalars().first()
        if partner:
            partner_shop_id = partner.id

    os_in = ServiceOrderCreate(
        os_number=None, # Auto-gerado
        client_name=extracted_data.get("client_name"),
        doctor_name=extracted_data.get("doctor_name"),
        partner_shop_id=partner_shop_id,
        optical_store_id=optical_store_id,
        od_spherical=Decimal(str(extracted_data.get("od_spherical", 0.0))) if extracted_data.get("od_spherical") is not None else None,
        od_cylindrical=Decimal(str(extracted_data.get("od_cylindrical", 0.0))) if extracted_data.get("od_cylindrical") is not None else None,
        od_axis=extracted_data.get("od_axis"),
        od_addition=Decimal(str(extracted_data.get("od_addition", 0.0))) if extracted_data.get("od_addition") is not None else None,
        od_dnp=Decimal(str(extracted_data.get("od_dnp", 0.0))) if extracted_data.get("od_dnp") else None,
        oe_spherical=Decimal(str(extracted_data.get("oe_spherical", 0.0))) if extracted_data.get("oe_spherical") is not None else None,
        oe_cylindrical=Decimal(str(extracted_data.get("oe_cylindrical", 0.0))) if extracted_data.get("oe_cylindrical") is not None else None,
        oe_axis=extracted_data.get("oe_axis"),
        oe_addition=Decimal(str(extracted_data.get("oe_addition", 0.0))) if extracted_data.get("oe_addition") is not None else None,
        oe_dnp=Decimal(str(extracted_data.get("oe_dnp", 0.0))) if extracted_data.get("oe_dnp") else None
    )
    
    return await crud_os.create_service_order(db, os_in)

@router.post("/{os_id}/allocate", response_model=ServiceOrderResponse)
async def allocate_os_lenses(
    os_id: uuid.UUID,
    payload: AllocateRequest,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Realiza a validação geométrica de corte e tenta reservar as lentes do estoque.
    Se o diâmetro for insuficiente, a OS muda para status Cancelada.
    Se der certo, as lentes são reservadas e o status muda para Em Produção.
    """
    success, message, os_obj = await crud_os.allocate_lenses_for_os(db, os_id, payload)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
        
    return os_obj

@router.post("/{os_id}/status", response_model=ServiceOrderResponse)
async def update_status(
    os_id: uuid.UUID,
    payload: StatusUpdateRequest,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza o status da OS no workflow das bancadas da fábrica e grava no histórico.
    """
    status_str = payload.status
    status_map = {
        "Recebida": OSStatus.RECEBIDA,
        "Separação": OSStatus.SEPARACAO,
        "Produção": OSStatus.SURFACAGEM,
        "Surfaçagem": OSStatus.SURFACAGEM,
        "Montagem": OSStatus.MONTAGEM,
        "CQ": OSStatus.CQ_FINAL,
        "CQ Final": OSStatus.CQ_FINAL,
        "Expedição": OSStatus.EXPEDICAO,
        "Concluída": OSStatus.CONCLUIDA,
        "Entregue": OSStatus.ENTREGUE,
        "Cancelada": OSStatus.CANCELADA
    }
    
    target_status = status_map.get(status_str)
    if not target_status:
        try:
            target_status = OSStatus(status_str)
        except ValueError:
            target_status = OSStatus.SURFACAGEM if status_str.lower() in ["producao", "produção"] else OSStatus.SURFACAGEM


    sector = payload.sector
    if not sector:
        sector_mapping = {
            OSStatus.RECEBIDA: "Recepção / Triagem",
            OSStatus.SEPARACAO: "Almoxarifado / Separação",
            OSStatus.PRODUCAO: "Surfaçagem / Produção",
            OSStatus.SURFACAGEM: "Surfaçagem / Produção",
            OSStatus.MONTAGEM: "Corte & Montagem",
            OSStatus.CQ: "Controle de Qualidade",
            OSStatus.CQ_FINAL: "Controle de Qualidade",
            OSStatus.EXPEDICAO: "Expedição",
            OSStatus.CONCLUIDA: "Concluída / Entregue",
            OSStatus.ENTREGUE: "Concluída / Entregue",
            OSStatus.CANCELADA: "Administrativo"
        }
        sector = sector_mapping.get(target_status, "Operacional")

    os_obj = await crud_os.update_os_status(
        db, 
        os_id, 
        target_status, 
        payload.operator_notes,
        operator_id=current_user.id,
        sector=sector
    )

    if not os_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de Serviço não encontrada."
        )
        
    return os_obj

@router.post("/{os_id}/reprocess", response_model=ServiceOrderResponse)
async def reprocess_os_quebra(
    os_id: uuid.UUID,
    payload: ReprocessRequest,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra que uma lente quebrou no facetamento ou inspeção.
    Inutiliza as lentes alocadas anteriormente e retorna a OS para Recebida.
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
    return os_obj

@router.post("/{os_id}/cq", response_model=ServiceOrderResponse)
async def create_cq_inspection_endpoint(
    os_id: uuid.UUID,
    payload: CQInspectionCreate,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra uma inspeção de Controle de Qualidade para a OS e transiciona seu status.
    """
    try:
        _, os_obj = await crud_os.create_cq_inspection(
            db, 
            os_id, 
            operator_id=current_user.id,
            cq_in=payload
        )
        return os_obj
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/", response_model=List[ServiceOrderResponse])
async def read_service_orders(
    status: Optional[str] = Query(None, description="Filtra OSs por status de workflow"),
    query: Optional[str] = Query(None, description="Filtro global por código, paciente, CNPJ ou nome de óticas"),
    semantic_query: Optional[str] = Query(None, description="Busca semântica em observações clínicas via IA"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a lista de todas as Ordens de Serviço (OS) com seus históricos e itens.
    Suporta filtros avançados de busca estruturada e busca semântica em observações.
    """
    return await crud_os.get_service_orders(
        db, status=status, query_str=query, semantic_query=semantic_query, skip=skip, limit=limit
    )



@router.get("/dashboard/kpis")
async def read_os_dashboard_kpis(
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna indicadores gerenciais de quebra, produtividade e perda financeira do laboratório.
    """
    return await crud_os.get_os_dashboard_kpis(db)

@router.get("/{os_id}", response_model=ServiceOrderResponse)
async def read_service_order(
    os_id: uuid.UUID,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os detalhes de uma OS específica incluindo o histórico, itens e dados de estoque das lentes.
    """
    os_obj = await crud_os.get_service_order(db, os_id)
    if not os_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de Serviço não encontrada."
        )
    return os_obj


# --- ROTAS DE FATURAMENTO (ITENS DA OS) ---

@router.post("/{os_id}/items/", response_model=ServiceOrderItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item_to_os(
    os_id: uuid.UUID,
    payload: ServiceOrderItemCreate,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Adiciona um item comercial (Produto, Tratamento, Serviço) ao faturamento da OS
    aplicando a tabela de preços do cliente correspondente.
    """
    try:
        return await crud_os.add_item_to_service_order(db, os_id, payload, operator_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{os_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item_from_os(
    os_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Remove um item do faturamento da OS e atualiza o montante total.
    """
    success = await crud_os.remove_item_from_service_order(db, os_id, item_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de faturamento não localizado na OS correspondente."
        )
    return

@router.put("/{os_id}", response_model=ServiceOrderResponse)
async def update_service_order_endpoint(
    os_id: uuid.UUID,
    payload: ServiceOrderUpdate,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza os dados de uma Ordem de Serviço (OS).
    Dispara recálculos técnicos se houver modificações em graus/armadura e valida o estoque.
    Bloqueia se o status for superior a Separação.
    """
    try:
        os_obj = await crud_os.update_service_order(db, os_id, payload, operator_id=current_user.id)
        if not os_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ordem de Serviço não encontrada."
            )
        return os_obj
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/{os_id}/authorize-financial", response_model=ServiceOrderResponse)

async def authorize_financial_blocked_order_endpoint(
    os_id: uuid.UUID,
    payload: Optional[dict] = None,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Libera administrativamente uma OS bloqueada por inadimplência (Exclusivo Administrador).
    """
    notes = payload.get("notes") if payload else "Liberação de crédito efetuada pelo Administrador."
    res = await crud_os.authorize_financial_blocked_os(db, os_id, current_user.id, notes)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de Serviço não encontrada."
        )
    return res

@router.post("/{os_id}/cancel", response_model=ServiceOrderResponse)
@router.delete("/{os_id}", response_model=ServiceOrderResponse)
async def cancel_service_order_endpoint(
    os_id: uuid.UUID,
    payload: Optional[dict] = None,
    current_user: User = Depends(get_current_active_operator),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancela compulsoriamente uma Ordem de Serviço (OS) com justificativa obrigatória e estorna o estoque.
    """
    reason = "Cancelamento efetuado pelo operador."
    if payload and "cancellation_reason" in payload and payload["cancellation_reason"]:
        reason = str(payload["cancellation_reason"])
    elif payload and "reason" in payload and payload["reason"]:
        reason = str(payload["reason"])

    res = await crud_os.soft_delete_service_order(db, os_id, reason, operator_id=current_user.id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de Serviço não encontrada."
        )
    return res

