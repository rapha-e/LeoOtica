from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict
from backend.app.services.backup_service import create_backup, list_backups, restore_backup
from backend.app.api.deps import get_current_active_admin

router = APIRouter()

@router.post("/create", response_model=Dict)
async def trigger_manual_backup(
    current_user = Depends(get_current_active_admin)
):
    """
    Executa um backup imediato do banco de dados SQLite.
    Restrito a administradores.
    """
    try:
        return create_backup()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao gerar backup: {str(e)}"
        )

@router.get("/list", response_model=List[Dict])
async def get_backup_history(
    current_user = Depends(get_current_active_admin)
):
    """
    Retorna o histórico de cópias de segurança de banco salvas em disco.
    """
    return list_backups()

@router.post("/restore/{filename}", response_model=Dict)
async def restore_db_backup(
    filename: str,
    current_user = Depends(get_current_active_admin)
):
    """
    Restaura uma versão anterior do banco de dados por nome do arquivo.
    """
    try:
        return restore_backup(filename)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha na restauração do backup: {str(e)}"
        )
