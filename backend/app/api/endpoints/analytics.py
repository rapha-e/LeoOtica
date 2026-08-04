from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.crud import analytics as crud_analytics

router = APIRouter()

@router.get("/matrix-heat", response_model=List[Dict[str, Any]])
async def get_matrix_heatmap_data(
    brand: Optional[str] = Query(None, description="Filtra mapa de calor por marca de lente"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os dados térmicos das lentes (dioptrias e velocidade de consumo) para renderização do gaveteiro.
    """
    return await crud_analytics.get_matrix_heatmap(db, brand=brand)

@router.get("/funnel", response_model=Dict[str, int])
async def get_logistics_funnel_data(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna as métricas logísticas do funil (Estoque Livre, Lentes Reservadas e Lentes Descartadas por quebra).
    """
    return await crud_analytics.get_funnel_metrics(db)

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_manager_dashboard(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna as métricas e indicadores do Dashboard Gerencial (Comercial, Produção e Estoque).
    """
    return await crud_analytics.get_manager_dashboard_data(db)


from pydantic import BaseModel
from backend.app.services import ai_assistant

class AssistantRequest(BaseModel):
    message: str

@router.post("/assistant", response_model=Dict[str, str])
async def ask_ai_assistant(
    payload: AssistantRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Envia uma pergunta ao Assistente Operacional da Nova Lab.
    Retorna a resposta da IA ou o fallback local em markdown.
    """

    response_text = await ai_assistant.ask_assistant(db, payload.message)
    return {"response": response_text}

# --- FASE 7: IA CORPORATIVA (BOM DIA EXECUTIVO) ---

@router.get("/morning-briefing")
async def get_executive_morning_briefing(
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a mensagem situacional pró-ativa 'Bom Dia Executivo' e os contadores de alerta matinais.
    """
    return await ai_assistant.get_morning_briefing(db)




