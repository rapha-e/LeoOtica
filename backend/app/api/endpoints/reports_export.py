import io
import uuid
from decimal import Decimal
from datetime import datetime, date, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import pandas as pd

from backend.app.core.database import get_db
from backend.app.api.deps import get_current_active_operator
from backend.app.models.user import User
from backend.app.api.endpoints.reports import (
    get_production_analytic_report,
    get_inventory_kardex_report,
    get_commercial_ranking_report,
    get_financial_dre_report,
    get_financial_aging_report
)
from backend.app.services.pdf_generator import (
    generate_dre_pdf,
    generate_inventory_kardex_pdf,
    generate_production_pdf,
    generate_aging_pdf
)

router = APIRouter()

LAB_INFO = {
    "name": "Nova LAB Ótica Industrial",
    "cnpj": "58.032.958/0001-44",
    "telephone": "61 99266-7281",
    "address": "Avenida transversal quadra 23 conjunto B lote 27"
}

def _clean_param(p, expected_types):
    if isinstance(p, expected_types):
        return p
    return None

@router.get("/pdf")
async def export_report_pdf(
    report_type: str = Query(..., description="Tipo do relatório: 'dre', 'kardex', 'production', 'aging'"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    matrix_type: Optional[str] = Query(None),
    optical_store_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    """
    Exportação server-side de relatórios formatados em PDF via StreamingResponse com buffer em memória.
    """
    start_date = _clean_param(start_date, (date, datetime))
    end_date = _clean_param(end_date, (date, datetime))
    matrix_type = _clean_param(matrix_type, str)
    optical_store_id = _clean_param(optical_store_id, uuid.UUID)

    role_name = current_user.role.name if hasattr(current_user.role, 'name') else str(current_user.role or "")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if report_type == "dre":
        if role_name != "Administrador":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem exportar o DRE.")
        data = await get_financial_dre_report(start_date=start_date, end_date=end_date, db=db, current_user=current_user)
        pdf_bytes = generate_dre_pdf(data.model_dump(), LAB_INFO)
        filename = f"relatorio_dre_{ts}.pdf"

    elif report_type == "kardex":
        data = await get_inventory_kardex_report(matrix_type=matrix_type, db=db, current_user=current_user)
        pdf_bytes = generate_inventory_kardex_pdf(data.model_dump(), LAB_INFO)
        filename = f"posicao_estoque_kardex_{ts}.pdf"

    elif report_type == "production":
        data = await get_production_analytic_report(
            start_date=start_date, end_date=end_date, optical_store_id=optical_store_id, db=db, current_user=current_user
        )
        pdf_bytes = generate_production_pdf(data.model_dump(), LAB_INFO)
        filename = f"relatorio_producao_mes_{ts}.pdf"

    elif report_type == "aging":
        data = await get_financial_aging_report(optical_store_id=optical_store_id, db=db, current_user=current_user)
        pdf_bytes = generate_aging_pdf(data.model_dump(), LAB_INFO)
        filename = f"aging_list_inadimplencia_{ts}.pdf"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Tipo de relatório '{report_type}' inválido. Opções: dre, kardex, production, aging."
        )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/excel")
async def export_report_excel(
    report_type: str = Query(..., description="Tipo do relatório: 'dre', 'kardex', 'production', 'commercial', 'aging'"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    matrix_type: Optional[str] = Query(None),
    optical_store_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_operator)
):
    """
    Exportação analítica em planilha Excel (.xlsx) com múltiplas abas e formatação contábil.
    """
    start_date = _clean_param(start_date, (date, datetime))
    end_date = _clean_param(end_date, (date, datetime))
    matrix_type = _clean_param(matrix_type, str)
    optical_store_id = _clean_param(optical_store_id, uuid.UUID)

    role_name = current_user.role.name if hasattr(current_user.role, 'name') else str(current_user.role or "")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if report_type == "production":
            data = await get_production_analytic_report(
                start_date=start_date, end_date=end_date, optical_store_id=optical_store_id, db=db, current_user=current_user
            )
            rows = []
            for o in data.orders:
                rows.append({
                    "Número OS": o.os_number,
                    "Pedido Loja": o.client_order_number or "",
                    "Ótica Cliente": o.optical_store_name,
                    "Bandeja": o.tray_number or "",
                    "Tipo OS": o.os_type,
                    "Status": o.status,
                    "Prioridade": o.priority,
                    "Rota de Produção": o.production_route,
                    "Modelo Lente": o.lens_model_name or "",
                    "Grau OD": o.od_degree or "",
                    "Grau OE": o.oe_degree or "",
                    "Lead Time (Horas)": o.lead_time_hours if o.lead_time_hours is not None else 0.0,
                    "Valor Total (R$)": float(o.total_amount),
                    "Data Criação": o.created_at.strftime("%d/%m/%Y %H:%M")
                })
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name="Produção MES", index=False)
            filename = f"export_producao_{ts}.xlsx"

        elif report_type == "kardex":
            data = await get_inventory_kardex_report(matrix_type=matrix_type, db=db, current_user=current_user)
            rows = []
            for it in data.items:
                rows.append({
                    "Matriz": it.matrix_type,
                    "Modelo": it.model_name,
                    "Marca": it.brand,
                    "Tratamento": it.treatment,
                    "Índice Refração": float(it.refractive_index) if it.refractive_index else 1.56,
                    "Curva Base": float(it.base_curve) if it.base_curve is not None else "",
                    "Grau Esférico": float(it.spherical) if it.spherical is not None else "",
                    "Grau Cilíndrico": float(it.cylindrical) if it.cylindrical is not None else "",
                    "Adição": float(it.addition) if it.addition is not None else "",
                    "Olho": it.eye or "AMB",
                    "Gaveta/Local": it.location_tag or "",
                    "Código Barras / EAN": it.barcode or "",
                    "Saldo Físico (un)": it.quantity_available,
                    "Reservado (un)": it.reserved_quantity,
                    "Saldo Livre (un)": it.free_quantity,
                    "Custo Médio CMP (R$)": float(it.unit_cost_cmp),
                    "Valor Total Estoque (R$)": float(it.total_value_cmp)
                })
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name="Posição Kardex", index=False)
            filename = f"export_kardex_estoque_{ts}.xlsx"

        elif report_type == "commercial":
            data = await get_commercial_ranking_report(start_date=start_date, end_date=end_date, db=db, current_user=current_user)
            rows = []
            for r in data.ranking:
                rows.append({
                    "Razão Social": r.store_name,
                    "Nome Fantasia": r.trade_name or "",
                    "CNPJ": r.cnpj or "",
                    "Total OSs Faturadas": r.total_orders_count,
                    "Faturamento Total (R$)": float(r.total_billed_amount),
                    "Ticket Médio (R$)": float(r.average_ticket),
                    "Política de Crédito": r.status_policy
                })
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name="Ranking Óticas", index=False)
            filename = f"export_ranking_comercial_{ts}.xlsx"

        elif report_type == "aging":
            data = await get_financial_aging_report(optical_store_id=optical_store_id, db=db, current_user=current_user)
            rows = []
            for t in data.titles:
                rows.append({
                    "Ótica Cliente": t.store_name,
                    "Nº Documento / Fatura": t.document_number,
                    "Data Vencimento": t.due_date.strftime("%d/%m/%Y"),
                    "Dias de Atraso": t.days_overdue,
                    "Faixa Aging": t.aging_bucket,
                    "Status": t.status,
                    "Valor Título (R$)": float(t.amount),
                    "Valor Pago (R$)": float(t.amount_paid),
                    "Saldo Devedor (R$)": float(t.balance_due)
                })
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name="Aging Contas a Receber", index=False)
            filename = f"export_aging_inadimplencia_{ts}.xlsx"

        elif report_type == "dre":
            if role_name != "Administrador":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem exportar o DRE.")
            data = await get_financial_dre_report(start_date=start_date, end_date=end_date, db=db, current_user=current_user)
            rows = []
            for d in data.dre_statement:
                rows.append({
                    "Conta": d.account_code,
                    "Descrição": d.description,
                    "Valor (R$)": float(d.amount),
                    "% Receita Líquida": d.percentage
                })
            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name="DRE Gerencial", index=False)
            filename = f"export_dre_{ts}.xlsx"
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de relatório inválido.")

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
