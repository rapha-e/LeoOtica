import uuid
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.schemas.lens import LensModelCreate, LensModelResponse, LensModelUpdate
from backend.app.crud import lens as crud_lens
from backend.app.api.deps import get_current_active_admin, get_current_active_operator

router = APIRouter()

@router.post("/", response_model=LensModelResponse, status_code=status.HTTP_201_CREATED)
async def create_new_lens_model(
    model_in: LensModelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Cadastra um novo modelo base de lente (Marca, Material, Índice de Refração, etc.).
    Apenas Administradores podem cadastrar novos modelos.
    """
    # Verifica se já existe um modelo com os mesmos atributos para evitar duplicidade
    existing = await crud_lens.get_lens_model_by_attributes(
        db,
        brand=model_in.brand,
        material=model_in.material,
        refractive_index=model_in.refractive_index,
        treatment=model_in.treatment,
        diameter=model_in.diameter
    )
    if existing:
        return existing
        
    return await crud_lens.create_lens_model(db, model_in)

@router.get("/", response_model=List[LensModelResponse])
async def read_lens_models(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Lista todos os modelos de lentes cadastrados.
    Operadores e Administradores podem listar.
    """
    return await crud_lens.get_lens_models(db, skip=skip, limit=limit)

@router.get("/{model_id}", response_model=LensModelResponse)
async def read_lens_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_operator)
):
    """
    Obtém os detalhes de um modelo de lente específico por ID.
    Operadores e Administradores podem consultar.
    """
    db_model = await crud_lens.get_lens_model(db, model_id)
    if not db_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo de lente não encontrado."
        )
    return db_model

@router.put("/{model_id}", response_model=LensModelResponse)
async def update_lens_model(
    model_id: uuid.UUID,
    model_in: LensModelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Atualiza as informações (por exemplo, preço de custo) de um modelo de lente existente.
    Apenas Administradores podem atualizar.
    """
    updated_model = await crud_lens.update_lens_model(db, model_id, model_in)
    if not updated_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo de lente não encontrado."
        )
    return updated_model

@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lens_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_active_admin)
):
    """
    Remove um modelo de lente do cadastro.
    Apenas Administradores podem remover.
    """
    success = await crud_lens.delete_lens_model(db, model_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo de lente não encontrado."
        )
    return
