import io
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Linha divisória de rodapé
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(40, 35, 555, 35)
        
        # Textos de rodapé
        now_str = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")
        self.drawString(40, 22, f"LeoÓtica 2.0 Enterprise — Emitido em: {now_str}")
        self.drawRightString(555, 22, f"Página {self._pageNumber} de {page_count}")
        self.restoreState()


def _create_header(title: str, subtitle: str, lab_info: Dict[str, Any] = None) -> List[Any]:
    styles = getSampleStyleSheet()
    lab_name = lab_info.get("name", "Nova LAB Ótica Industrial") if lab_info else "Nova LAB Ótica Industrial"
    lab_cnpj = lab_info.get("cnpj", "58.032.958/0001-44") if lab_info else "58.032.958/0001-44"

    header_title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Heading1'],
        fontSize=14,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        fontName='Helvetica-Bold'
    )
    header_subtitle_style = ParagraphStyle(
        'HeaderSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#475569")
    )
    report_name_style = ParagraphStyle(
        'ReportName',
        parent=styles['Heading2'],
        fontSize=12,
        leading=14,
        textColor=colors.HexColor("#0284c7"),
        fontName='Helvetica-Bold',
        alignment=2 # Right
    )
    report_sub_style = ParagraphStyle(
        'ReportSub',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=2 # Right
    )

    left_cell = [
        Paragraph(f"<b>{lab_name}</b>", header_title_style),
        Paragraph(f"CNPJ: {lab_cnpj} | Sistema MES/ERP", header_subtitle_style)
    ]
    right_cell = [
        Paragraph(title.upper(), report_name_style),
        Paragraph(subtitle, report_sub_style)
    ]

    header_table = Table([[left_cell, right_cell]], colWidths=[280, 235])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.HexColor("#0284c7")),
    ]))

    return [header_table, Spacer(1, 12)]


# ==============================================================================
# 1. DRE CONTÁBIL GERENCIAL (PDF)
# ==============================================================================

def generate_dre_pdf(dre_data: Dict[str, Any], lab_info: Dict[str, Any] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=50
    )
    styles = getSampleStyleSheet()
    story = []

    period_str = f"Período: {dre_data.get('period_start', '')} até {dre_data.get('period_end', '')}"
    story.extend(_create_header("Demonstração do Resultado (DRE)", period_str, lab_info))

    # Tabela do DRE
    table_data = [
        [
            Paragraph("<b>CÓDIGO</b>", styles['Normal']),
            Paragraph("<b>DESCRIÇÃO DA CONTA CONTÁBIL</b>", styles['Normal']),
            Paragraph("<b>VALOR (R$)</b>", styles['Normal']),
            Paragraph("<b>% RECEITA</b>", styles['Normal'])
        ]
    ]

    for item in dre_data.get("dre_statement", []):
        is_grp = item.get("is_group", False)
        is_neg = item.get("is_negative", False)
        amt = Decimal(str(item.get("amount", 0.0)))
        pct = item.get("percentage", 0.0)
        desc = item.get("description", "")
        code = item.get("account_code", "")

        amt_formatted = f"R$ {amt:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        if is_neg and amt > 0:
            amt_formatted = f"- {amt_formatted}"

        desc_styled = f"<b>{desc}</b>" if is_grp else f"&nbsp;&nbsp;&nbsp;{desc}"
        amt_styled = f"<b>{amt_formatted}</b>" if is_grp else amt_formatted

        table_data.append([
            code,
            Paragraph(desc_styled, styles['Normal']),
            Paragraph(amt_styled, styles['Normal']),
            f"{pct:.1f}%"
        ])

    dre_table = Table(table_data, colWidths=[55, 270, 120, 70])
    dre_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    story.append(dre_table)
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


# ==============================================================================
# 2. RELATÓRIO DE ESTOQUE KARDEX VALORIZADO (PDF)
# ==============================================================================

def generate_inventory_kardex_pdf(kardex_data: Dict[str, Any], lab_info: Dict[str, Any] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=35, rightMargin=35, topMargin=35, bottomMargin=45
    )
    styles = getSampleStyleSheet()
    story = []

    kpis = kardex_data.get("kpis", {})
    tot_val = Decimal(str(kpis.get("total_stock_value_cmp", 0.0)))
    tot_val_fmt = f"R$ {tot_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    sub_title = f"Total Peças: {kpis.get('total_units_stock', 0)} un | Valorizado CMP: {tot_val_fmt}"

    story.extend(_create_header("Posição Geral de Estoque (Kardex)", sub_title, lab_info))

    table_data = [
        [
            Paragraph("<b>MATRIZ</b>", styles['Normal']),
            Paragraph("<b>MODELO / LENTE</b>", styles['Normal']),
            Paragraph("<b>TRATAMENTO</b>", styles['Normal']),
            Paragraph("<b>DIOPTRIA / BASE</b>", styles['Normal']),
            Paragraph("<b>SALDO</b>", styles['Normal']),
            Paragraph("<b>CMP (R$)</b>", styles['Normal']),
            Paragraph("<b>TOTAL (R$)</b>", styles['Normal'])
        ]
    ]

    for it in kardex_data.get("items", [])[:300]: # Limite seguro para visualização
        diop_parts = []
        if it.get("base_curve") is not None:
            diop_parts.append(f"Base {float(it['base_curve']):.2f}")
        if it.get("spherical") is not None and it.get("cylindrical") is not None:
            diop_parts.append(f"{float(it['spherical']):+.2f}/{float(it['cylindrical']):+.2f}")
        if it.get("addition") is not None:
            diop_parts.append(f"Add {float(it['addition']):+.2f}")
        if it.get("eye"):
            diop_parts.append(f"({it['eye']})")
        diop_str = " ".join(diop_parts) or "Padrão"

        cmp_u = Decimal(str(it.get("unit_cost_cmp", 0.0)))
        tot_c = Decimal(str(it.get("total_value_cmp", 0.0)))

        table_data.append([
            it.get("matrix_type", ""),
            Paragraph(it.get("model_name", "")[:28], styles['Normal']),
            Paragraph(it.get("treatment", "")[:18], styles['Normal']),
            Paragraph(diop_str, styles['Normal']),
            f"{it.get('quantity_available', 0)} un",
            f"R$ {cmp_u:.2f}",
            f"R$ {tot_c:.2f}"
        ])

    table = Table(table_data, colWidths=[65, 125, 95, 100, 45, 50, 55])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (4, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    story.append(table)
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


# ==============================================================================
# 3. RELATÓRIO ANALÍTICO DE PRODUÇÃO & MES (PDF)
# ==============================================================================

def generate_production_pdf(prod_data: Dict[str, Any], lab_info: Dict[str, Any] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=35, rightMargin=35, topMargin=35, bottomMargin=45
    )
    styles = getSampleStyleSheet()
    story = []

    kpis = prod_data.get("kpis", {})
    sub = f"Total OSs: {kpis.get('total_orders', 0)} | Concluídas: {kpis.get('orders_completed', 0)} | Em Produção: {kpis.get('orders_in_progress', 0)} | Refazimento: {kpis.get('orders_rework', 0)}"

    story.extend(_create_header("Relatório Analítico de Produção (MES)", sub, lab_info))

    table_data = [
        [
            Paragraph("<b>Nº OS</b>", styles['Normal']),
            Paragraph("<b>ÓTICA / CLIENTE</b>", styles['Normal']),
            Paragraph("<b>BANDEJA</b>", styles['Normal']),
            Paragraph("<b>ROTA</b>", styles['Normal']),
            Paragraph("<b>STATUS</b>", styles['Normal']),
            Paragraph("<b>LEAD TIME</b>", styles['Normal']),
            Paragraph("<b>VALOR (R$)</b>", styles['Normal'])
        ]
    ]

    for o in prod_data.get("orders", [])[:250]:
        lt_str = f"{o.get('lead_time_hours', 0.0)}h" if o.get('lead_time_hours') is not None else "-"
        val = Decimal(str(o.get("total_amount", 0.0)))
        route_short = "Expressa" if "EXPRESSA" in o.get("production_route", "") else ("CNC" if "SURFACAGEM" in o.get("production_route", "") else "Reparo")

        table_data.append([
            o.get("os_number", ""),
            Paragraph(o.get("optical_store_name", "")[:26], styles['Normal']),
            o.get("tray_number", "-") or "-",
            route_short,
            Paragraph(o.get("status", ""), styles['Normal']),
            lt_str,
            f"R$ {val:.2f}"
        ])

    table = Table(table_data, colWidths=[80, 140, 60, 60, 95, 50, 55])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (5, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    story.append(table)
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


# ==============================================================================
# 4. RELATÓRIO DE AGING LIST & INADIMPLÊNCIA (PDF)
# ==============================================================================

def generate_aging_pdf(aging_data: Dict[str, Any], lab_info: Dict[str, Any] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=35, rightMargin=35, topMargin=35, bottomMargin=45
    )
    styles = getSampleStyleSheet()
    story = []

    tot_rec = Decimal(str(aging_data.get("total_receivable", 0.0)))
    tot_over = Decimal(str(aging_data.get("total_overdue", 0.0)))
    rate = aging_data.get("delinquency_rate_pct", 0.0)

    sub = f"Total a Receber: R$ {tot_rec:,.2f} | Vencido: R$ {tot_over:,.2f} | Inadimplência: {rate:.1f}%".replace(",", "X").replace(".", ",").replace("X", ".")
    story.extend(_create_header("Aging List & Inadimplência", sub, lab_info))

    table_data = [
        [
            Paragraph("<b>ÓTICA CLIENTE</b>", styles['Normal']),
            Paragraph("<b>DOCUMENTO</b>", styles['Normal']),
            Paragraph("<b>VENCIMENTO</b>", styles['Normal']),
            Paragraph("<b>ATRASO</b>", styles['Normal']),
            Paragraph("<b>FAIXA AGING</b>", styles['Normal']),
            Paragraph("<b>VALOR (R$)</b>", styles['Normal']),
            Paragraph("<b>SALDO DEVEDOR</b>", styles['Normal'])
        ]
    ]

    for t in aging_data.get("titles", [])[:300]:
        due_str = t.get("due_date", "")
        if isinstance(due_str, str) and "-" in due_str:
            parts = due_str.split("-")
            if len(parts) == 3:
                due_str = f"{parts[2]}/{parts[1]}/{parts[0]}"

        amt = Decimal(str(t.get("amount", 0.0)))
        bal = Decimal(str(t.get("balance_due", 0.0)))
        days = t.get("days_overdue", 0)

        table_data.append([
            Paragraph(t.get("store_name", "")[:28], styles['Normal']),
            t.get("document_number", ""),
            due_str,
            f"{days} dias" if days > 0 else "Em dia",
            t.get("aging_bucket", ""),
            f"R$ {amt:.2f}",
            f"R$ {bal:.2f}"
        ])

    table = Table(table_data, colWidths=[140, 80, 65, 55, 75, 60, 65])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (5, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    story.append(table)
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def generate_purchase_pdf(alerts_data: List[Dict[str, Any]], lab_info: Dict[str, Any] = None) -> bytes:
    """
    Gera PDF com a sugestão de compras do motor preditivo
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    story = []
    story.extend(_create_header("PLANO DE COMPRAS PREDITIVO (SUPPLY CHAIN)", "Sugestões calculadas por consumo diário, lead time e estoque de segurança", lab_info))

    styles = getSampleStyleSheet()
    filtered = [a for a in alerts_data if a.get("suggested_purchase", 0) > 0]
    total_items = len(filtered)
    total_qty = sum(a.get("suggested_purchase", 0) for a in filtered)

    kpis_data = [
        [
            Paragraph("<b>Total de Itens Sugeridos:</b>", styles['Normal']),
            Paragraph(f"<b>{total_items} SKUs</b>", styles['Normal']),
            Paragraph("<b>Volume Total de Peças:</b>", styles['Normal']),
            Paragraph(f"<font color='#0284c7'><b>{total_qty} unidades</b></font>", styles['Normal'])
        ]
    ]
    t_kpi = Table(kpis_data, colWidths=[150, 100, 150, 120])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 12))

    table_data = [
        [
            Paragraph("<b>PRODUTO / MODELO</b>", styles['Normal']),
            Paragraph("<b>GRAU / ESF</b>", styles['Normal']),
            Paragraph("<b>CIL</b>", styles['Normal']),
            Paragraph("<b>ESTOQUE</b>", styles['Normal']),
            Paragraph("<b>PONTO PEDIDO</b>", styles['Normal']),
            Paragraph("<b>SUGESTÃO</b>", styles['Normal'])
        ]
    ]

    for item in filtered[:350]:
        table_data.append([
            Paragraph(str(item.get("model_name", ""))[:28], styles['Normal']),
            f"{item.get('spherical', 0.0):.2f}",
            f"{item.get('cylindrical', 0.0):.2f}",
            f"{item.get('current_stock', 0)} un",
            f"{item.get('reorder_point', 0)} un",
            f"{item.get('suggested_purchase', 0)} un"
        ])

    if len(table_data) == 1:
        table_data.append([Paragraph("Nenhum item com necessidade de compra no momento.", styles['Normal']), "", "", "", "", ""])

    table = Table(table_data, colWidths=[180, 65, 65, 70, 75, 65])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))

    story.append(table)
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def generate_billing_pdf(cycle: Any, laboratory: Any = None) -> bytes:
    """
    Gera o PDF do Fechamento de Faturamento Financeiro (Fatura / Extrato de Cobrança)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    lab_info = {
        "name": getattr(laboratory, "name", "Nova LAB Ótica Industrial") or "Nova LAB Ótica Industrial",
        "cnpj": getattr(laboratory, "cnpj", "58.032.958/0001-44") or "58.032.958/0001-44",
        "telephone": getattr(laboratory, "telephone", "61 99266-7281") or "61 99266-7281",
        "address": getattr(laboratory, "address", "") or ""
    }

    story = []
    story.extend(_create_header("EXTRATO DE FATURAMENTO & FECHAMENTO", f"Fatura Ref.: #{str(cycle.id)[:8]} — Ciclo de Cobrança", lab_info))

    styles = getSampleStyleSheet()

    # Informações da Ótica Cliente e Período
    store = getattr(cycle, "optical_store", None)
    store_name = getattr(store, "corporate_name", "") or getattr(store, "trade_name", "Cliente")
    store_cnpj = getattr(store, "cnpj", "")
    start_dt = getattr(cycle, "start_date", None)
    end_dt = getattr(cycle, "end_date", None)

    start_str = start_dt.strftime("%d/%m/%Y") if hasattr(start_dt, "strftime") else str(start_dt or "")
    end_str = end_dt.strftime("%d/%m/%Y") if hasattr(end_dt, "strftime") else str(end_dt or "")

    client_info_data = [
        [
            Paragraph("<b>ÓTICA / CLIENTE:</b>", styles['Normal']),
            Paragraph(f"<b>{store_name}</b> (CNPJ: {store_cnpj})", styles['Normal']),
            Paragraph("<b>PERÍODO:</b>", styles['Normal']),
            Paragraph(f"{start_str} a {end_str}", styles['Normal'])
        ],
        [
            Paragraph("<b>STATUS:</b>", styles['Normal']),
            Paragraph(f"<b>{getattr(cycle, 'status', 'PENDENTE')}</b>", styles['Normal']),
            Paragraph("<b>DATA EMISSÃO:</b>", styles['Normal']),
            Paragraph(datetime.now().strftime("%d/%m/%Y %H:%M"), styles['Normal'])
        ]
    ]

    t_client = Table(client_info_data, colWidths=[110, 200, 80, 130])
    t_client.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(t_client)
    story.append(Spacer(1, 10))

    # Tabela de Ordens / Itens Faturados
    table_data = [
        [
            Paragraph("<b>Nº OS</b>", styles['Normal']),
            Paragraph("<b>PEDIDO</b>", styles['Normal']),
            Paragraph("<b>PACIENTE / CLIENTE</b>", styles['Normal']),
            Paragraph("<b>DATA</b>", styles['Normal']),
            Paragraph("<b>VALOR LENTE</b>", styles['Normal']),
            Paragraph("<b>VALOR SERV.</b>", styles['Normal']),
            Paragraph("<b>TOTAL</b>", styles['Normal'])
        ]
    ]

    items = getattr(cycle, "items", [])
    for it in items:
        os_rel = getattr(it, "service_order", None)
        os_num = getattr(os_rel, "os_number", str(it.service_order_id)[:8]) if os_rel else str(it.service_order_id)[:8]
        client_order = getattr(os_rel, "client_order_number", "") or ""
        patient = getattr(os_rel, "client_name", "") or "-"
        dt_val = getattr(os_rel, "created_at", getattr(it, "created_at", None))
        dt_str = dt_val.strftime("%d/%m") if hasattr(dt_val, "strftime") else ""

        lens_p = Decimal(str(getattr(it, "lens_price", 0.0) or 0.0))
        serv_p = Decimal(str(getattr(it, "service_price", 0.0) or 0.0))
        tot_p = Decimal(str(getattr(it, "final_price", 0.0) or (lens_p + serv_p)))

        table_data.append([
            f"#{os_num}",
            client_order,
            Paragraph(patient[:20], styles['Normal']),
            dt_str,
            f"R$ {lens_p:.2f}",
            f"R$ {serv_p:.2f}",
            f"R$ {tot_p:.2f}"
        ])

    table = Table(table_data, colWidths=[65, 65, 130, 50, 70, 70, 70])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (4, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))

    # Totais Finais
    subtotal = Decimal(str(getattr(cycle, "total_amount", 0.0) or 0.0))
    discount = Decimal(str(getattr(cycle, "discount_amount", 0.0) or 0.0))
    final_amt = Decimal(str(getattr(cycle, "final_amount", 0.0) or (subtotal - discount)))

    totals_data = [
        [Paragraph("<b>Subtotal Bruto:</b>", styles['Normal']), f"R$ {subtotal:.2f}"],
        [Paragraph("<b>Desconto Aplicado:</b>", styles['Normal']), f"- R$ {discount:.2f}"],
        [Paragraph("<b>VALOR TOTAL LÍQUIDO A PAGAR:</b>", styles['Normal']), f"<b>R$ {final_amt:.2f}</b>"]
    ]

    t_totals = Table(totals_data, colWidths=[380, 140])
    t_totals.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#f1f5f9")),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.HexColor("#0284c7")),
    ]))
    story.append(t_totals)

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


