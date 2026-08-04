from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.services.predictive import calculate_predictive_alerts, generate_purchase_plan_excel
from backend.app.services.pdf_generator import generate_purchase_pdf
import io

router = APIRouter()

@router.get("/predictive", response_model=List[Dict[str, Any]])
async def get_stock_predictions(
    lead_time_days: int = Query(7, description="Lead time (dias) do fornecedor"),
    safety_days: int = Query(5, description="Dias adicionais de consumo como estoque de segurança"),
    coverage_days: int = Query(15, description="Dias de cobertura para sugestão de compra"),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista a saúde do estoque de cada dioptria, calculando taxa de consumo,
    ponto de ressuprimento e sugerindo compras baseado no Lead Time.
    """
    return await calculate_predictive_alerts(
        db, lead_time_days=lead_time_days, safety_days=safety_days, coverage_days=coverage_days
    )

@router.get("/export-purchases")
async def export_purchase_plan(
    lead_time_days: int = Query(7),
    safety_days: int = Query(5),
    coverage_days: int = Query(15),
    db: AsyncSession = Depends(get_db)
):
    """
    Gera e faz o download da planilha Excel com as sugestões de compra semanais
    com base no cálculo preditivo de rupturas.
    """
    alerts = await calculate_predictive_alerts(
        db, lead_time_days=lead_time_days, safety_days=safety_days, coverage_days=coverage_days
    )
    excel_bytes = generate_purchase_plan_excel(alerts)
    
    filename = f"sugestao_compras_novalab_{datetime.now().strftime('%Y%m%d')}.xlsx"

    
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export-pdf")
async def export_purchase_pdf(
    lead_time_days: int = Query(7),
    safety_days: int = Query(5),
    coverage_days: int = Query(15),
    db: AsyncSession = Depends(get_db)
):
    """
    Gera e faz o download do relatório em PDF formatado em A4 com as sugestões
    semanais de compra para os fornecedores.
    """
    alerts = await calculate_predictive_alerts(
        db, lead_time_days=lead_time_days, safety_days=safety_days, coverage_days=coverage_days
    )
    pdf_bytes = generate_purchase_pdf(alerts)
    
    filename = f"sugestao_compras_novalab_{datetime.now().strftime('%Y%m%d')}.pdf"

    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Importação de datetime para o nome do arquivo
from datetime import datetime
