import io
from datetime import datetime
from typing import List, Dict, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def generate_purchase_pdf(alerts_data: List[Dict[str, Any]]) -> bytes:
    """
    Gera um relatório PDF elegante em formato A4 contendo
    a lista detalhada de sugestão de compras de lentes para os fornecedores,
    seguindo fielmente o layout de referência visual do usuário.
    """
    # Filtra apenas itens com recomendação de compra > 0
    filtered_data = [item for item in alerts_data if item["suggested_purchase"] > 0]
    
    # Se não houver itens com sugestão, gera com todos para não ir vazio
    if not filtered_data:
        filtered_data = alerts_data
        
    buffer = io.BytesIO()
    
    # Definição do documento A4 (largura utilizável = 515pt com margens de 40pt)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Definição das fontes e estilos de parágrafo
    font_family = 'Helvetica'
    font_family_bold = 'Helvetica-Bold'
    
    style_logo = ParagraphStyle(
        'BrandLogo',
        fontName=font_family_bold,
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1F4E78'),
        spaceAfter=2
    )
    
    style_logo_sub = ParagraphStyle(
        'BrandLogoSub',
        fontName=font_family,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#595959'),
        spaceAfter=15
    )
    
    style_tag = ParagraphStyle(
        'TagText',
        fontName=font_family_bold,
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#2A6BB8')
    )
    
    style_sec_title = ParagraphStyle(
        'SecTitle',
        fontName=font_family_bold,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#2A6BB8'),
        spaceAfter=15
    )
    
    style_box_title = ParagraphStyle(
        'BoxTitle',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#6B7280'),
        spaceAfter=4
    )
    
    style_box_req = ParagraphStyle(
        'BoxReq',
        fontName=font_family_bold,
        fontSize=11,
        leading=13,
        textColor=colors.HexColor('#2A6BB8'),
        spaceAfter=6
    )
    
    style_box_label = ParagraphStyle(
        'BoxLabel',
        fontName=font_family_bold,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1F2937')
    )
    
    style_box_val = ParagraphStyle(
        'BoxVal',
        fontName=font_family,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#4B5563')
    )
    
    style_box_val_bold = ParagraphStyle(
        'BoxValBold',
        fontName=font_family_bold,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1F2937')
    )
    
    style_tbl_header = ParagraphStyle(
        'TblHeader',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )
    
    style_tbl_header_left = ParagraphStyle(
        'TblHeaderLeft',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_LEFT
    )
    
    style_tbl_cell = ParagraphStyle(
        'TblCell',
        fontName=font_family,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_CENTER
    )
    
    style_tbl_cell_left = ParagraphStyle(
        'TblCellLeft',
        fontName=font_family,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_LEFT
    )
    
    style_tbl_cell_bold = ParagraphStyle(
        'TblCellBold',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_CENTER
    )
    
    style_tbl_cell_bold_left = ParagraphStyle(
        'TblCellBoldLeft',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_LEFT
    )
    
    style_tbl_cell_red = ParagraphStyle(
        'TblCellRed',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#DC2626'),
        alignment=TA_CENTER
    )
    
    style_tbl_cell_orange = ParagraphStyle(
        'TblCellOrange',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#D97706'),
        alignment=TA_CENTER
    )
    
    style_tbl_cell_blue = ParagraphStyle(
        'TblCellBlue',
        fontName=font_family_bold,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#2A6BB8'),
        alignment=TA_CENTER
    )
    
    style_note_title = ParagraphStyle(
        'NoteTitle',
        fontName=font_family_bold,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#78350F')
    )
    
    style_note_text = ParagraphStyle(
        'NoteText',
        fontName=font_family,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#78350F')
    )

    # 1. CABEÇALHO (LOGO E ETIOQUETA DO PEDIDO)
    logo_flowable = [
        Paragraph("Nova Lab", style_logo),
        Paragraph("MÓDULO DE AUTOMAÇÃO DE STOCK", style_logo_sub)
    ]
    
    # Etiqueta "PEDIDO DE REPOSIÇÃO AUTOMÁTICA" à direita
    tag_table = Table(
        [[Paragraph("PEDIDO DE REPOSIÇÃO AUTOMÁTICA", style_tag)]],
        colWidths=[180],
        rowHeights=[24]
    )
    tag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EBF2FA')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    header_table = Table(
        [[logo_flowable, tag_table]],
        colWidths=[315, 200]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 5))

    # 2. CAIXAS DE INFORMAÇÕES (IDENTIFICAÇÃO & FORNECEDOR)
    req_number = f"#REQ-{datetime.now().strftime('%Y%m%d')}-{len(filtered_data):03d}"
    data_emissao = datetime.now().strftime("%d/%m/%Y %H:%M") + " (Horário de Brasília)"
    
    # Conteúdo da Caixa da Esquerda
    info_left = [
        Paragraph("IDENTIFICAÇÃO DA REQUISIÇÃO", style_box_title),
        Paragraph(req_number, style_box_req),
        Spacer(1, 3),
        Table([
            [Paragraph("DATA DE EMISSÃO", style_box_label)],
            [Paragraph(data_emissao, style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("ORIGEM DO PEDIDO", style_box_label)],
            [Paragraph("Laboratório Central Nova Lab<br/>Brasília - DF", style_box_val)],
        ], colWidths=[220], style=[
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ])
    ]
    
    # Conteúdo da Caixa da Direita
    info_right = [
        Paragraph("FORNECEDOR DESTINATÁRIO", style_box_title),
        Paragraph("EssilorLuxottica Portugal / Brasil", style_box_val_bold),
        Spacer(1, 3),
        Table([
            [Paragraph("CNPJ / NIF", style_box_label)],
            [Paragraph("00.000.000/0001-00", style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("CANAL DE INTEGRAÇÃO", style_box_label)],
            [Paragraph("pedidos.b2b@essilorluxottica.com.br", style_box_val)],
        ], colWidths=[220], style=[
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ])
    ]
    
    # Tabela principal de Informações (duas caixas lado a lado)
    box_table = Table(
        [[info_left, info_right]],
        colWidths=[247, 248]
    )
    box_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0F4F8')),
        ('BOX', (0, 0), (0, 0), 0.5, colors.HexColor('#CBD5E1')),
        ('BOX', (1, 0), (1, 0), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    # Envolve em uma tabela com espaçamento
    outer_box_table = Table([[box_table]], colWidths=[515])
    outer_box_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
    ]))
    story.append(outer_box_table)

    # 3. TÍTULO DOS ITENS
    story.append(Paragraph("Itens Necessários para Reposição (Abaixo do Nível de Segurança)", style_sec_title))
    story.append(Spacer(1, 5))

    # 4. TABELA DE PRODUTOS
    headers = [
        Paragraph("CÓDIGO SKU", style_tbl_header_left),
        Paragraph("DESCRIÇÃO DO MODELO", style_tbl_header_left),
        Paragraph("ÍNDICE", style_tbl_header),
        Paragraph("ESFÉRICO", style_tbl_header),
        Paragraph("CILÍNDRICO", style_tbl_header),
        Paragraph("ATUAL", style_tbl_header),
        Paragraph("MÍN.", style_tbl_header),
        Paragraph("QTD. SOLICITADA", style_tbl_header)
    ]
    
    table_data = [headers]
    counter = 1
    
    for item in filtered_data:
        sku_brand = item['brand'][:3].upper().replace(" ", "")
        sku = f"LENS-{int(item['refractive_index']*100)}-{sku_brand}-{counter:03d}"
        
        brand_material = f"{item['brand']} {item['material']}"
        desc = f"{item['brand']} {item['material']} {item['treatment']}"
        
        # Define estilo de cor para estoque atual
        stock = item['quantity_available']
        if stock == 0:
            p_stock = Paragraph(f"{stock} un", style_tbl_cell_red)
        elif stock <= item['reorder_point']:
            p_stock = Paragraph(f"{stock} un", style_tbl_cell_orange)
        else:
            p_stock = Paragraph(f"{stock} un", style_tbl_cell)
            
        min_qty = int(item['reorder_point']) if item['reorder_point'] > 0 else 5
        
        row = [
            Paragraph(sku, style_tbl_cell_bold_left),
            Paragraph(desc, style_tbl_cell_left),
            Paragraph(f"{item['refractive_index']:.2f}", style_tbl_cell),
            Paragraph(f"{item['spherical']:+.2f}", style_tbl_cell),
            Paragraph(f"{item['cylindrical']:+.2f}", style_tbl_cell),
            p_stock,
            Paragraph(f"{min_qty} un", style_tbl_cell),
            Paragraph(f"{item['suggested_purchase']} un", style_tbl_cell_blue)
        ]
        table_data.append(row)
        counter += 1
        
    col_widths = [80, 150, 42, 50, 50, 43, 40, 60]
    
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2A6BB8')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ]))
    
    # Zebrado
    for i in range(1, len(table_data)):
        bg_color = colors.HexColor('#F9FAFB') if i % 2 == 0 else colors.white
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, i), (-1, i), bg_color),
            ('TOPPADDING', (0, i), (-1, i), 7),
            ('BOTTOMPADDING', (0, i), (-1, i), 7),
        ]))
        
    story.append(t)
    story.append(Spacer(1, 20))

    # 5. DIRETRIZES DE LOGÍSTICA
    story.append(Paragraph("Diretrizes de Logística e Transição de Estados", style_sec_title))
    story.append(Spacer(1, 5))

    # 6. CAIXA DE NOTA AUTOMÁTICA (Fundo bege e barra lateral laranja)
    note_content = [
        Paragraph("Nota Automática do Sistema:", style_note_title),
        Spacer(1, 4),
        Paragraph(
            "1. As dioptrias listadas acima atingiram ou ultrapassaram o limite crítico de ruptura (estoque abaixo do nível de segurança). Este lote foi projetado com base na taxa de consumo diário (daily_burn_rate) para suprir os próximos 15 dias de operação.<br/>"
            "2. Para evitar duplicidade de pedidos por gatilhos repetidos, as respectivas células da Grade Óptica foram alteradas temporariamente para o estado STATUS_AWAITING_SUPPLIER até a recepção física da nota de faturamento.",
            style_note_text
        )
    ]
    
    # Tabela simulando a barra laranja lateral à esquerda
    note_table = Table(
        [[ "", note_content ]],
        colWidths=[4, 511]
    )
    note_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#F97316')), # Barra laranja
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#FFFBEB')), # Fundo bege
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (1, 0), (1, 0), 12),
        ('BOTTOMPADDING', (1, 0), (1, 0), 12),
        ('LEFTPADDING', (1, 0), (1, 0), 15),
        ('RIGHTPADDING', (1, 0), (1, 0), 15),
        ('TOPPADDING', (0, 0), (0, 0), 0),
        ('BOTTOMPADDING', (0, 0), (0, 0), 0),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 0),
        ('BOX', (0, 0), (1, 0), 0.5, colors.HexColor('#FDE68A')), # Borda amarela clara ao redor do box
    ]))
    
    story.append(note_table)

    # Constrói o documento
    doc.build(story)
    
    buffer.seek(0)
    return buffer.getvalue()


def generate_billing_pdf(cycle, laboratory=None) -> bytes:
    """
    Gera um PDF elegante em formato A4 contendo
    a fatura de fechamento financeiro detalhado de uma ótica comercial,
    seguindo o design premium do laboratório.
    """
    from datetime import datetime
    
    def format_dt(dt, format_str="%d/%m/%Y %H:%M"):
        if not dt:
            return "Pendente"
        if isinstance(dt, str):
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
                try:
                    return datetime.strptime(dt.split("+")[0].split("Z")[0], fmt).strftime(format_str)
                except ValueError:
                    continue
            return dt
        return dt.strftime(format_str)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    story = []
    
    # Fontes
    font_family = 'Helvetica'
    font_family_bold = 'Helvetica-Bold'
    
    # Estilos
    style_logo = ParagraphStyle(
        'BillingLogo',
        fontName=font_family_bold,
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1F4E78'),
        spaceAfter=2
    )
    style_logo_sub = ParagraphStyle(
        'BillingLogoSub',
        fontName=font_family,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#595959'),
        spaceAfter=15
    )
    style_tag = ParagraphStyle(
        'BillingTagText',
        fontName=font_family_bold,
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#10B981')
    )
    style_sec_title = ParagraphStyle(
        'BillingSecTitle',
        fontName=font_family_bold,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1F4E78'),
        spaceAfter=15
    )
    style_box_title = ParagraphStyle(
        'BillingBoxTitle',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#6B7280'),
        spaceAfter=4
    )
    style_box_req = ParagraphStyle(
        'BillingBoxReq',
        fontName=font_family_bold,
        fontSize=11,
        leading=13,
        textColor=colors.HexColor('#1F4E78'),
        spaceAfter=6
    )
    style_box_label = ParagraphStyle(
        'BillingBoxLabel',
        fontName=font_family_bold,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1F2937')
    )
    style_box_val = ParagraphStyle(
        'BillingBoxVal',
        fontName=font_family,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#4B5563')
    )
    style_box_val_bold = ParagraphStyle(
        'BillingBoxValBold',
        fontName=font_family_bold,
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1F2937')
    )
    style_tbl_header = ParagraphStyle(
        'BillingTblHeader',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )
    style_tbl_header_left = ParagraphStyle(
        'BillingTblHeaderLeft',
        fontName=font_family_bold,
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_LEFT
    )
    style_tbl_cell = ParagraphStyle(
        'BillingTblCell',
        fontName=font_family,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_CENTER
    )
    style_tbl_cell_left = ParagraphStyle(
        'BillingTblCellLeft',
        fontName=font_family,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_LEFT
    )
    style_tbl_cell_bold = ParagraphStyle(
        'BillingTblCellBold',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_RIGHT
    )
    style_note_title = ParagraphStyle(
        'BillingNoteTitle',
        fontName=font_family_bold,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#065F46')
    )
    style_note_text = ParagraphStyle(
        'BillingNoteText',
        fontName=font_family,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#065F46')
    )

    # 1. CABEÇALHO (LOGO E ETIQUETA)
    logo_flowable = [
        Paragraph(laboratory.name if laboratory else "Nova Lab", style_logo),
        Paragraph("MÓDULO DE CONTROLE FINANCEIRO", style_logo_sub)
    ]
    
    status_text = "PAGO" if cycle.status == "PAGO" else "AGUARDANDO QUITAÇÃO"
    tag_bg = colors.HexColor('#D1FAE5') if cycle.status == "PAGO" else colors.HexColor('#FEF3C7')
    tag_border = colors.HexColor('#A7F3D0') if cycle.status == "PAGO" else colors.HexColor('#FDE68A')
    tag_text_color = colors.HexColor('#047857') if cycle.status == "PAGO" else colors.HexColor('#D97706')
    
    style_tag_dynamic = ParagraphStyle(
        'BillingTagDynamic',
        parent=style_tag,
        textColor=tag_text_color
    )
    
    tag_table = Table(
        [[Paragraph(status_text, style_tag_dynamic)]],
        colWidths=[180],
        rowHeights=[24]
    )
    tag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), tag_bg),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, tag_border),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    header_table = Table(
        [[logo_flowable, tag_table]],
        colWidths=[315, 200]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 5))

    # 2. CAIXAS DE INFORMAÇÕES (FECHAMENTO & DESTINATÁRIO)
    cycle_code = f"#FAT-{cycle.id.hex[:8].upper()}" if cycle.id else "#FAT-N/A"
    data_emissao = format_dt(cycle.created_at, "%d/%m/%Y %H:%M")
    periodo = f"{format_dt(cycle.start_date, '%d/%m/%Y')} a {format_dt(cycle.end_date, '%d/%m/%Y')}"
    data_pagamento = format_dt(cycle.paid_at, "%d/%m/%Y %H:%M") if cycle.paid_at else "Pendente"
    
    # Conteúdo da Caixa da Esquerda (Dados do Fechamento)
    info_left = [
        Paragraph("INFORMAÇÕES DA COBRANÇA", style_box_title),
        Paragraph(cycle_code, style_box_req),
        Spacer(1, 3),
        Table([
            [Paragraph("PERÍODO DO FECHAMENTO", style_box_label)],
            [Paragraph(periodo, style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("DATA DE EMISSÃO", style_box_label)],
            [Paragraph(data_emissao, style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("DATA DE LIQUIDAÇÃO", style_box_label)],
            [Paragraph(data_pagamento, style_box_val)],
        ], colWidths=[220], style=[
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ])
    ]
    
    # Conteúdo da Caixa da Direita (Ótica Comercial Destinatária)
    store_name = (cycle.optical_store.trade_name or "Ótica Desconhecida") if cycle.optical_store else "Ótica Desconhecida"
    store_cnpj = (cycle.optical_store.cnpj or "-") if cycle.optical_store else "-"
    store_email = (cycle.optical_store.email or "-") if cycle.optical_store else "-"
    store_address = (cycle.optical_store.address or "-") if cycle.optical_store else "-"
    
    info_right = [
        Paragraph("CLIENTE DESTINATÁRIO", style_box_title),
        Paragraph(store_name, style_box_val_bold),
        Spacer(1, 3),
        Table([
            [Paragraph("CNPJ / IE", style_box_label)],
            [Paragraph(store_cnpj, style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("E-MAIL DE CONTATO", style_box_label)],
            [Paragraph(store_email, style_box_val)],
            [Spacer(1, 2)],
            [Paragraph("ENDEREÇO COMERCIAL", style_box_label)],
            [Paragraph(store_address, style_box_val)],
        ], colWidths=[220], style=[
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ])
    ]
    
    # Tabela principal de Informações (duas caixas lado a lado)
    box_table = Table(
        [[info_left, info_right]],
        colWidths=[247, 248]
    )
    box_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F4F6')),
        ('BOX', (0, 0), (0, 0), 0.5, colors.HexColor('#E5E7EB')),
        ('BOX', (1, 0), (1, 0), 0.5, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    outer_box_table = Table([[box_table]], colWidths=[515])
    outer_box_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
    ]))
    story.append(outer_box_table)

    # 3. TÍTULO DOS ITENS
    story.append(Paragraph("Detalhamento de Itens e Serviços na Fatura (Padrão Catálogo)", style_sec_title))
    story.append(Spacer(1, 5))

    # 4. TABELA DE ITENS COM DETALHAMENTO DO ANEXO 1 (ITEM/SERVIÇO, DESCRIÇÃO, TIPO, QTD, VALOR)
    headers = [
        Paragraph("ITEM / SERVIÇO", style_tbl_header_left),
        Paragraph("DESCRIÇÃO DO CATÁLOGO", style_tbl_header_left),
        Paragraph("TIPO", style_tbl_header),
        Paragraph("QTD", style_tbl_header),
        Paragraph("VALOR (R$)", style_tbl_header)
    ]
    
    table_data = [headers]
    
    style_os_header = ParagraphStyle(
        'BillingOsHeader',
        fontName=font_family_bold,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F4E78'),
        alignment=TA_LEFT
    )

    for item in cycle.items:
        os_num = getattr(item, "os_number", None) or "OS-N/A"
        client = getattr(item, "client_name", None) or "Consumidor Final"
        
        # Linha separadora de cabeçalho da OS
        os_hdr_row = [
            Paragraph(f"<b>OS: {os_num}</b> — Paciente / Cliente: <b>{client}</b>", style_os_header),
            "", "", "",
            Paragraph(f"<b>R$ {(item.amount or 0.0):,.2f}</b>".replace(",", "X").replace(".", ",").replace("X", "."), style_tbl_cell_bold)
        ]
        table_data.append(os_hdr_row)

        detailed_list = getattr(item, "detailed_items", []) or []
        if detailed_list:
            for detail in detailed_list:
                d_name = getattr(detail, "name", "") or "Item"
                d_desc = getattr(detail, "description", "") or "-"
                d_type = getattr(detail, "item_type", "") or "Serviço"
                d_qty = getattr(detail, "quantity", 1)
                d_price = float(getattr(detail, "total_price", 0.0) or 0.0)
                
                qty_str = f"{d_qty} un" if d_type == "Lente" else f"{d_qty}"
                fmt_price = f"R$ {d_price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

                row = [
                    Paragraph(f"  • {d_name}", style_tbl_cell_left),
                    Paragraph(d_desc, style_tbl_cell_left),
                    Paragraph(d_type, style_tbl_cell),
                    Paragraph(qty_str, style_tbl_cell),
                    Paragraph(fmt_price, style_tbl_cell)
                ]
                table_data.append(row)
        else:
            # Fallback de compatibilidade
            l_txt = getattr(item, "lens_type", "Lente Padrão Laboratorial")
            l_price = getattr(item, "lens_price", item.amount or 0.0) or 0.0
            fmt_lprice = f"R$ {l_price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            table_data.append([
                Paragraph(f"  • {l_txt}", style_tbl_cell_left),
                Paragraph("Lente Oftálmica Visão Simples / Digital", style_tbl_cell_left),
                Paragraph("Lente", style_tbl_cell),
                Paragraph("2 un", style_tbl_cell),
                Paragraph(fmt_lprice, style_tbl_cell)
            ])
            
            s_txt = getattr(item, "services", None)
            s_price = getattr(item, "service_price", 0.0) or 0.0
            if s_txt:
                fmt_sprice = f"R$ {s_price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                table_data.append([
                    Paragraph(f"  • {s_txt}", style_tbl_cell_left),
                    Paragraph("Montagem e Acabamento de Precisão", style_tbl_cell_left),
                    Paragraph("Serviço", style_tbl_cell),
                    Paragraph("1", style_tbl_cell),
                    Paragraph(fmt_sprice, style_tbl_cell)
                ])

            t_txt = getattr(item, "treatments", None)
            t_price = getattr(item, "treatment_price", 0.0) or 0.0
            if t_txt and t_txt != "Incolor / Sem Tratamento":
                fmt_tprice = f"R$ {t_price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                table_data.append([
                    Paragraph(f"  • {t_txt}", style_tbl_cell_left),
                    Paragraph("Tratamento de Superfície Lente", style_tbl_cell_left),
                    Paragraph("Tratamento", style_tbl_cell),
                    Paragraph("1", style_tbl_cell),
                    Paragraph(fmt_tprice, style_tbl_cell)
                ])
        
    col_widths = [135, 180, 60, 50, 90]
    
    t = Table(table_data, colWidths=col_widths)

    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E78')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ]))
    
    # Estilização das linhas (zebrado + fundos para cabeçalhos de OS)
    for i in range(1, len(table_data)):
        row_cells = table_data[i]
        # Se for linha de cabeçalho de OS (4 células vazias/mescladas)
        if len(row_cells) == 5 and row_cells[1] == "" and row_cells[2] == "":
            t.setStyle(TableStyle([
                ('SPAN', (0, i), (3, i)),
                ('BACKGROUND', (0, i), (-1, i), colors.HexColor('#EBF2FA')),
                ('TOPPADDING', (0, i), (-1, i), 6),
                ('BOTTOMPADDING', (0, i), (-1, i), 6),
            ]))
        else:
            bg_color = colors.HexColor('#F9FAFB') if i % 2 == 0 else colors.white
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, i), (-1, i), bg_color),
                ('TOPPADDING', (0, i), (-1, i), 5),
                ('BOTTOMPADDING', (0, i), (-1, i), 5),
            ]))
        
    story.append(t)
    story.append(Spacer(1, 15))
    
    # Totalizador Geral
    total_val = cycle.total_amount or 0.0
    formatted_total = f"R$ {total_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    style_total_label = ParagraphStyle(
        'BillingTotalLabel',
        fontName=font_family_bold,
        fontSize=11,
        textColor=colors.HexColor('#1F2937'),
        alignment=TA_LEFT
    )
    style_total_val = ParagraphStyle(
        'BillingTotalVal',
        fontName=font_family_bold,
        fontSize=13,
        textColor=colors.HexColor('#1F4E78'),
        alignment=TA_RIGHT
    )
    total_table = Table(
        [
            [Paragraph("TOTAL DA FATURA:", style_total_label), Paragraph(formatted_total, style_total_val)]
        ],
        colWidths=[385, 130]
    )
    total_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEABOVE', (0, 0), (-1, -1), 1.5, colors.HexColor('#1F4E78')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(total_table)
    story.append(Spacer(1, 20))

    # 5. CAIXA DE NOTA COMERCIAL (Instruções)
    note_content = [
        Paragraph("Instruções de Pagamento e Quitação:", style_note_title),
        Spacer(1, 4),
        Paragraph(
            f"1. Efetue a transferência ou depósito para a conta bancária padrão do laboratório {laboratory.name if laboratory else 'Nova Lab'} no banco parceiro.<br/>"
            "2. O prazo padrão para compensação e conciliação do lote faturado é de até 2 dias úteis a partir do envio do comprovante pelo Portal do Lojista.<br/>"
            "3. Após a confirmação e quitação deste ciclo, o status será alterado para PAGO, liberando o respectivo selo no histórico de faturas.",
            style_note_text
        )
    ]
    
    note_table = Table(
        [[ "", note_content ]],
        colWidths=[4, 511]
    )
    note_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#10B981')), # Barra verde
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#ECFDF5')), # Fundo verde
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (1, 0), (1, 0), 12),
        ('BOTTOMPADDING', (1, 0), (1, 0), 12),
        ('LEFTPADDING', (1, 0), (1, 0), 15),
        ('RIGHTPADDING', (1, 0), (1, 0), 15),
        ('TOPPADDING', (0, 0), (0, 0), 0),
        ('BOTTOMPADDING', (0, 0), (0, 0), 0),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 0),
        ('BOX', (0, 0), (1, 0), 0.5, colors.HexColor('#A7F3D0')),
    ]))
    
    story.append(note_table)

    # Constrói o documento
    doc.build(story)
    
    buffer.seek(0)
    return buffer.getvalue()
