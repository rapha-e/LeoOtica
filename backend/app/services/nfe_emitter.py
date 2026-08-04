import io
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.barcode import code128

# Importação condicional do modelo para evitar erros de importação circular no runtime
from backend.app.models.billing import BillingCycle

def generate_access_key(uf: int, cnpj: str, model: int, serie: int, nfe_number: int) -> str:
    """
    Gera uma chave de acesso válida de 44 dígitos padrão SEFAZ
    com base no código de UF, data atual, CNPJ, modelo, série e número da nota.
    O último dígito é o dígito verificador calculado através do Módulo 11.
    """
    now = datetime.now()
    year_month = now.strftime("%y%m")
    
    # Sanitização e preenchimento
    uf_str = f"{uf:02d}"
    cnpj_clean = "".join(filter(str.isdigit, cnpj)).zfill(14)
    model_str = f"{model:02d}"
    serie_str = f"{serie:03d}"
    nfe_number_str = f"{nfe_number:09d}"
    tp_emis = "1"  # Emissão normal
    cnf = "87654321"  # Código numérico aleatório
    
    key_without_dv = f"{uf_str}{year_month}{cnpj_clean}{model_str}{serie_str}{nfe_number_str}{tp_emis}{cnf}"
    
    # Módulo 11 (Pesos de 2 a 9 da direita para a esquerda)
    weights = [2, 3, 4, 5, 6, 7, 8, 9]
    total_sum = 0
    for i, char in enumerate(reversed(key_without_dv)):
        weight = weights[i % len(weights)]
        total_sum += int(char) * weight
        
    remainder = total_sum % 11
    dv = 11 - remainder if remainder >= 2 else 0
    
    return f"{key_without_dv}{dv}"

def generate_nfe_xml(cycle: BillingCycle, nfe_number: int, key: str, laboratory: Any = None) -> str:
    """
    Gera uma string XML simulada de NF-e 4.00 contendo as OSs consolidadas
    e dados de faturamento do ciclo.
    """
    now = datetime.now()
    
    lab_name = laboratory.name if laboratory else "Nova Lab"
    lab_cnpj = "".join(filter(str.isdigit, laboratory.cnpj if laboratory else "58032958000144")).zfill(14)
    lab_cep = "".join(filter(str.isdigit, laboratory.cep if laboratory else "71572302")).zfill(8)
    lab_phone = laboratory.telephone if laboratory else "61 99266-7281"
    lab_address = laboratory.address if laboratory else "Área Especial, Lote 1, Brasília - DF"
    
    # Faz um split simples para tentar obter rua e número
    addr_parts = lab_address.split(",")
    lgr = addr_parts[0].strip() if len(addr_parts) > 0 else "Área Especial"
    nro = addr_parts[1].strip() if len(addr_parts) > 1 else "Lote 1"
    bairro = addr_parts[2].strip() if len(addr_parts) > 2 else "Brasília"

    cnpj_dest = "".join(filter(str.isdigit, cycle.optical_store.cnpj or "")).zfill(14)
    
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe{key}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>87654321</cNF>
      <natOp>Prestacao de Servico Laboratorial</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>{nfe_number}</nNF>
      <dhEmi>{now.isoformat()}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>{key[-1]}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0.0</verProc>
    </ide>
    <emit>
      <CNPJ>{lab_cnpj}</CNPJ>
      <xNome>{lab_name.upper()}</xNome>
      <xFant>{lab_name}</xFant>
      <enderEmit>
        <xLgr>{lgr}</xLgr>
        <nro>{nro}</nro>
        <xBairro>{bairro}</xBairro>
        <cMun>5300108</cMun>
        <xMun>Brasilia</xMun>
        <UF>DF</UF>
        <CEP>{lab_cep}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>{lab_phone}</fone>
      </enderEmit>
      <IE>111222333444</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <CNPJ>{cnpj_dest}</CNPJ>
      <xNome>{cycle.optical_store.corporate_name}</xNome>
      <enderDest>
        <xLgr>{cycle.optical_store.address or "Rua Comercial"}</xLgr>
        <nro>S/N</nro>
        <xBairro>Bairro Comercial</xBairro>
        <cMun>3550308</cMun>
        <xMun>Sao Paulo</xMun>
        <UF>SP</UF>
        <CEP>01234567</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
      <email>{cycle.optical_store.email or ""}</email>
    </dest>
"""
    for idx, item in enumerate(cycle.items, start=1):
        desc = f"Prestacao de Servico Optico - OS {item.os_number} (Paciente: {item.client_name or 'N/A'})"
        xml += f"""    <det nItem="{idx}">
      <prod>
        <cProd>OS-{item.os_number}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>{desc}</xProd>
        <NCM>90019010</NCM>
        <CFOP>5933</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>{item.amount:.2f}</vUnCom>
        <vProd>{item.amount:.2f}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>1.0000</qTrib>
        <vUnTrib>{item.amount:.2f}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>{float(item.amount) * 0.1345:.2f}</vTotTrib>
      </imposto>
    </det>
"""
    
    xml += f"""    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>{cycle.total_amount:.2f}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>{cycle.total_amount:.2f}</vNF>
      </ICMSTot>
    </total>
    <cobr>
      <fat>
        <nFat>FAT-{cycle.id.hex[:8].upper()}</nFat>
        <vOrig>{cycle.total_amount:.2f}</vOrig>
        <vLiq>{cycle.total_amount:.2f}</vLiq>
      </fat>
      <dup>
        <nDup>001</nDup>
        <dVenc>{cycle.due_date.strftime('%Y-%m-%d') if cycle.due_date else now.strftime('%Y-%m-%d')}</dVenc>
        <vDup>{cycle.total_amount:.2f}</vDup>
      </dup>
    </cobr>
  </infNFe>
</NFe>"""

    return xml

def generate_danfe_pdf(cycle: BillingCycle, nfe_status: str, nfe_number: int, key: str, laboratory: Any = None) -> bytes:
    """
    Gera o PDF do DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) simplificado
    para faturamento de saída, seguindo o padrão ReportLab.
    """
    buffer = io.BytesIO()
    
    lab_name = laboratory.name if laboratory else "Nova Lab"
    lab_cnpj = laboratory.cnpj if laboratory else "58.032.958/0001-44"
    lab_cep = laboratory.cep if laboratory else "71572-302"
    lab_phone = laboratory.telephone if laboratory else "61 99266-7281"
    lab_address = laboratory.address if laboratory else "Área Especial, Lote 1, Brasília - DF"
    
    # A4: 595.27 x 841.89 pt. Largura utilizável: 535pt com margens de 30pt.
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Cores
    color_border = colors.HexColor('#D1D5DB')
    color_text = colors.HexColor('#1F2937')
    color_label = colors.HexColor('#4B5563')
    
    # Estilos customizados
    style_emit_name = ParagraphStyle(
        'EmitName',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=color_text
    )
    
    style_emit_info = ParagraphStyle(
        'EmitInfo',
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=color_label
    )
    
    style_danfe_title = ParagraphStyle(
        'DanfeTitle',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=15,
        alignment=TA_CENTER,
        textColor=color_text
    )
    
    style_danfe_sub = ParagraphStyle(
        'DanfeSub',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=color_text
    )
    
    style_key = ParagraphStyle(
        'Key',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=TA_CENTER,
        textColor=color_text
    )
    
    style_box_label = ParagraphStyle(
        'BoxLabel',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        textColor=color_label
    )
    
    style_box_value = ParagraphStyle(
        'BoxValue',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=color_text
    )
    
    style_box_value_right = ParagraphStyle(
        'BoxValueRight',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=10,
        alignment=TA_RIGHT,
        textColor=color_text
    )
    
    style_item_text = ParagraphStyle(
        'ItemText',
        fontName='Helvetica',
        fontSize=7.5,
        leading=9,
        textColor=color_text
    )
    
    style_item_text_bold = ParagraphStyle(
        'ItemTextBold',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9,
        textColor=color_text
    )
    
    # 1. QUADRO: CABEÇALHO (EMITENTE E CHAVE DE ACESSO)
    # Coluna 1: Emitente (215pt) | Coluna 2: Indicação DANFE (100pt) | Coluna 3: Código de barras & Chave (220pt)
    col_widths = [215, 100, 220]
    
    emit_p = Paragraph(
        f"<b>{lab_name.upper()}</b><br/>"
        f"{lab_address}<br/>"
        f"CEP: {lab_cep}<br/>"
        f"Telefone: {lab_phone}<br/>"
        f"CNPJ: {lab_cnpj} | IE: 111.222.333.444", 
        style_emit_info
    )
    
    danfe_p = Paragraph(
        "<b>DANFE</b><br/>"
        "Documento Auxiliar da<br/>"
        "Nota Fiscal Eletrônica<br/>"
        "0 - ENTRADA<br/>"
        "<b>1 - SAÍDA</b><br/>"
        f"<b>Nº {nfe_number:06d}</b><br/>"
        "SÉRIE 1<br/>"
        "FOLHA 1 / 1",
        style_danfe_sub
    )
    
    # Gera código de barras usando reportlab.graphics.barcode
    bar_drawing = code128.Code128(key, barHeight=25, barWidth=0.9)
    # Formata a chave em grupos de 4
    formatted_key = " ".join([key[i:i+4] for i in range(0, len(key), 4)])
    
    key_p = Paragraph(
        f"<font size='5'>CHAVE DE ACESSO</font><br/><b>{formatted_key}</b><br/>"
        "<font size='5'>Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br</font>",
        style_key
    )
    
    header_table_data = [
        [emit_p, danfe_p, [bar_drawing, Spacer(1, 4), key_p]]
    ]
    
    header_table = Table(header_table_data, colWidths=col_widths)
    header_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, color_border),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    
    # 2. QUADRO: DADOS DO DESTINATÁRIO
    dest_widths = [315, 110, 110]
    dest_data = [
        [
            Paragraph("<b>NOME / RAZÃO SOCIAL</b><br/>" + cycle.optical_store.corporate_name, style_emit_info),
            Paragraph("<b>CNPJ / CPF</b><br/>" + cycle.optical_store.cnpj, style_emit_info),
            Paragraph("<b>DATA DE EMISSÃO</b><br/>" + datetime.now().strftime("%d/%m/%Y"), style_emit_info)
        ],
        [
            Paragraph("<b>ENDEREÇO</b><br/>" + (cycle.optical_store.address or "Rua Comercial, S/N"), style_emit_info),
            Paragraph("<b>BAIRRO / DISTRITO</b><br/>Bairro Comercial", style_emit_info),
            Paragraph("<b>DATA DE SAÍDA</b><br/>" + datetime.now().strftime("%d/%m/%Y"), style_emit_info)
        ],
        [
            Paragraph("<b>MUNICÍPIO</b><br/>São Paulo", style_emit_info),
            Paragraph("<b>INSCRIÇÃO ESTADUAL</b><br/>ISENTO", style_emit_info),
            Paragraph("<b>HORA DE SAÍDA</b><br/>" + datetime.now().strftime("%H:%M"), style_emit_info)
        ]
    ]
    
    dest_table = Table(dest_data, colWidths=dest_widths)
    dest_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, color_border),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(Paragraph("<b>DESTINATÁRIO / REMETENTE</b>", style_box_label))
    story.append(dest_table)
    story.append(Spacer(1, 8))
    
    # 3. QUADRO: FATURAS E DUPLICATAS (Sprint 11)
    fat_widths = [135, 135, 135, 130]
    vencimento_str = cycle.due_date.strftime("%d/%m/%Y") if cycle.due_date else datetime.now().strftime("%d/%m/%Y")
    fat_data = [
        [
            Paragraph("<b>NÚMERO DA DUPLICATA</b><br/>DUP-001", style_emit_info),
            Paragraph("<b>VENCIMENTO</b><br/>" + vencimento_str, style_emit_info),
            Paragraph("<b>VALOR</b><br/>R$ " + f"{cycle.total_amount:.2f}", style_emit_info),
            Paragraph("<b>FORMA DE PAGAMENTO</b><br/>Faturamento Cobrança", style_emit_info)
        ]
    ]
    fat_table = Table(fat_data, colWidths=fat_widths)
    fat_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, color_border),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(Paragraph("<b>FATURAS / DUPLICATAS</b>", style_box_label))
    story.append(fat_table)
    story.append(Spacer(1, 8))
    
    # 4. QUADRO: CÁLCULO DO IMPOSTO
    imp_widths = [107, 107, 107, 107, 107]
    imp_data = [
        [
            Paragraph("<b>BASE DE CÁLC. ICMS</b><br/>0,00", style_emit_info),
            Paragraph("<b>VALOR DO ICMS</b><br/>0,00", style_emit_info),
            Paragraph("<b>BASE CÁLC. ICMS S.T.</b><br/>0,00", style_emit_info),
            Paragraph("<b>VALOR ICMS SUBSTITUIÇÃO</b><br/>0,00", style_emit_info),
            Paragraph("<b>VALOR TOTAL DOS PRODUTOS</b><br/>R$ " + f"{cycle.total_amount:.2f}", style_emit_info)
        ],
        [
            Paragraph("<b>VALOR DO FRETE</b><br/>0,00", style_emit_info),
            Paragraph("<b>VALOR DO SEGURO</b><br/>0,00", style_emit_info),
            Paragraph("<b>DESCONTO</b><br/>0,00", style_emit_info),
            Paragraph("<b>OUTRAS DESPESAS</b><br/>0,00", style_emit_info),
            Paragraph("<b>VALOR TOTAL DA NOTA</b><br/><b>R$ " + f"{cycle.total_amount:.2f}</b>", style_emit_info)
        ]
    ]
    imp_table = Table(imp_data, colWidths=imp_widths)
    imp_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, color_border),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(Paragraph("<b>CÁLCULO DO IMPOSTO</b>", style_box_label))
    story.append(imp_table)
    story.append(Spacer(1, 8))
    
    # 5. QUADRO: ITENS DA NOTA FISCAL (Ordens de Serviço)
    # Colunas: Cód (50) | Descrição do item (235) | NCM (45) | CST (25) | CFOP (30) | UN (20) | Qtd (30) | V.Unit (50) | V.Total (50)
    item_widths = [50, 235, 45, 25, 30, 20, 30, 50, 50]
    item_headers = [
        Paragraph("<b>CÓDIGO</b>", style_item_text_bold),
        Paragraph("<b>DESCRIÇÃO DOS SERVIÇOS/PRODUTOS</b>", style_item_text_bold),
        Paragraph("<b>NCM/SH</b>", style_item_text_bold),
        Paragraph("<b>CST</b>", style_item_text_bold),
        Paragraph("<b>CFOP</b>", style_item_text_bold),
        Paragraph("<b>UN</b>", style_item_text_bold),
        Paragraph("<b>QTD</b>", style_item_text_bold),
        Paragraph("<b>V. UNIT</b>", style_item_text_bold),
        Paragraph("<b>V. TOTAL</b>", style_item_text_bold)
    ]
    
    table_items_data = [item_headers]
    for item in cycle.items:
        desc = f"Prestação de Serviço OS {item.os_number} (Paciente: {item.client_name or 'N/A'})"
        table_items_data.append([
            Paragraph(f"OS-{item.os_number}", style_item_text),
            Paragraph(desc, style_item_text),
            Paragraph("90019010", style_item_text),
            Paragraph("090", style_item_text),
            Paragraph("5933", style_item_text),
            Paragraph("UN", style_item_text),
            Paragraph("1", style_item_text),
            Paragraph(f"R$ {item.amount:.2f}", style_item_text),
            Paragraph(f"R$ {item.amount:.2f}", style_item_text)
        ])
        
    items_table = Table(table_items_data, colWidths=item_widths)
    items_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, color_border),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    
    story.append(Paragraph("<b>DADOS DOS PRODUTOS / SERVIÇOS</b>", style_box_label))
    story.append(items_table)
    story.append(Spacer(1, 8))
    
    # 6. QUADRO: DADOS ADICIONAIS
    additional_widths = [535]
    status_msg = "NOTA FISCAL AUTORIZADA COM SUCESSO." if nfe_status == "EMITIDA" else "NOTA FISCAL CANCELADA FISCALMENTE."
    additional_data = [
        [
            Paragraph(
                "<b>INFORMAÇÕES COMPLEMENTARES</b><br/>"
                f"Status Fiscal: {status_msg}<br/>"
                "Simulação de Emissão Fiscal sob ambiente de testes de homologação.<br/>"
                f"Código do Ciclo: FAT-{cycle.id.hex[:12].upper()} | Gerado em: {cycle.created_at.strftime('%d/%m/%Y %H:%M')}<br/>"
                "Tributos aproximados conforme Lei 12.741/2012: R$ " + f"{float(cycle.total_amount) * 0.1345:.2f}",
                style_emit_info
            )
        ]
    ]
    additional_table = Table(additional_data, colWidths=additional_widths)
    additional_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, color_border),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(Paragraph("<b>DADOS ADICIONAIS</b>", style_box_label))
    story.append(additional_table)
    
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
