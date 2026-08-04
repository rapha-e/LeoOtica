import uuid
import csv
import io
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.optical_store import (
    OpticalStoreCreate, OpticalStoreUpdate, OpticalStoreResponse
)
from backend.app.crud import optical_store as crud_store
from backend.app.api.deps import get_current_active_admin, get_current_active_operator

router = APIRouter()

@router.post("/", response_model=OpticalStoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    payload: OpticalStoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Cadastra uma nova ótica comercial. Valida CNPJ único.
    """
    existing_store = await crud_store.get_optical_store_by_cnpj(db, cnpj=payload.cnpj)
    if existing_store:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma ótica cadastrada com este CNPJ."
        )
    return await crud_store.create_optical_store(db, payload)

@router.get("/", response_model=List[OpticalStoreResponse])
async def list_stores(
    skip: int = 0,
    limit: int = 100,
    query: Optional[str] = Query(None, description="Termo de busca textual para Razão Social, Nome Fantasia ou CNPJ"),
    is_active: Optional[bool] = Query(None, description="Filtrar por óticas ativas ou inativas"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista as óticas comerciais com paginação, busca e filtro de status.
    """
    return await crud_store.get_optical_stores(
        db, skip=skip, limit=limit, query=query, is_active=is_active
    )

@router.get("/export")
async def export_stores_csv(
    query: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Gera e exporta um relatório em CSV contendo a lista de óticas filtradas.
    """
    # Carrega a lista inteira baseada nos filtros (sem limites de paginação para exportar tudo)
    stores = await crud_store.get_optical_stores(
        db, skip=0, limit=10000, query=query, is_active=is_active
    )
    
    # Cria o buffer em memória para o CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Escreve o cabeçalho
    writer.writerow([
        "ID", "Razao Social", "Nome Fantasia", "CNPJ", "Inscricao Estadual", 
        "Telefone", "E-mail", "Endereco", "Status", "Data de Cadastro"
    ])
    
    # Escreve os registros
    for store in stores:
        status_str = "Ativo" if store.is_active else "Inativo"
        date_str = store.created_at.strftime("%d/%m/%Y %H:%M:%S")
        writer.writerow([
            str(store.id),
            store.corporate_name,
            store.trade_name,
            store.cnpj,
            store.ie or "",
            store.telephone or "",
            store.email or "",
            store.address or "",
            status_str,
            date_str
        ])
        
    output.seek(0)
    
    # Retorna o arquivo de stream CSV
    return StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=cadastro_oticas.csv",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }
    )

@router.get("/{store_id}", response_model=OpticalStoreResponse)
async def get_store(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Obtém os detalhes cadastrais de uma ótica pelo ID.
    """
    db_store = await crud_store.get_optical_store(db, store_id)
    if not db_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ótica não encontrada."
        )
    return db_store

@router.put("/{store_id}", response_model=OpticalStoreResponse)
async def update_store(
    store_id: uuid.UUID,
    payload: OpticalStoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Atualiza os dados de uma ótica. Valida CNPJ único se alterado.
    """
    # Se CNPJ foi informado no payload, verifica se é único
    if payload.cnpj is not None:
        db_store = await crud_store.get_optical_store(db, store_id)
        if not db_store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ótica não encontrada."
            )
        if db_store.cnpj != payload.cnpj:
            existing = await crud_store.get_optical_store_by_cnpj(db, cnpj=payload.cnpj)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Já existe outra ótica cadastrada com este CNPJ."
                )
                
    updated = await crud_store.update_optical_store(db, store_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ótica não encontrada."
        )
    return updated

@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Exclui permanentemente uma ótica. Apenas administradores.
    """
    success = await crud_store.delete_optical_store(db, store_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ótica não encontrada."
        )
    return
