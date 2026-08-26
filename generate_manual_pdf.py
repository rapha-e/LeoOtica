import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Cabeçalho de Páginas (A partir da pág 2)
        if self._pageNumber > 1:
            self.drawString(36, 812, "NOVA LAB V 2.0 — Manual de Implantação e Cadastros Iniciais")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(36, 804, 559, 804)
        
        # Rodapé em todas as páginas
        self.setFont("Helvetica", 8)
        self.drawString(36, 25, "Documentação Oficial de Operação e Suporte Técnico Nova Lab")
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(559, 25, page_text)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 35, 559, 35)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=48,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Cores do Sistema
    PRIMARY = colors.HexColor("#1e3a8a")     # Azul Escuro Corporativo
    SECONDARY = colors.HexColor("#2563eb")   # Azul Real
    PURPLE = colors.HexColor("#7e22ce")      # Roxo Destaque IA
    DARK_TEXT = colors.HexColor("#0f172a")   # Texto Escuro
    LIGHT_BG = colors.HexColor("#f8fafc")    # Fundo Cinza Claro
    BORDER_COLOR = colors.HexColor("#e2e8f0")
    SUCCESS_COLOR = colors.HexColor("#166534")

    # Custom Estilos de Parágrafo
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=PRIMARY,
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT,
        spaceAfter=6
    )

    bold_body = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT,
        spaceAfter=4
    )

    path_style = ParagraphStyle(
        'MenuPath',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=SECONDARY,
        spaceAfter=4
    )

    tip_style = ParagraphStyle(
        'TipText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    story = []

    # =========================================================================
    # CAPA / CABEÇALHO DO DOCUMENTO
    # =========================================================================
    story.append(Paragraph("MANUAL DE CONFIGURAÇÃO E IMPLANTAÇÃO INICIAL", title_style))
    story.append(Paragraph("<b>Sistema Nova Lab V 2.0 — Guia Passo a Passo Prático de Pré-Requisitos para Operação Fabril</b>", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=SECONDARY, spaceBefore=0, spaceAfter=15))

    # RESUMO INICIAL E OBJETIVO
    intro_html = """
    Este tutorial orienta os administradores e operadores da fábrica nos <b>cadastramentos prévios necessários</b> 
    que devem ser realizados no sistema antes do cadastramento de lentes de estoque e do registro de Ordens de Serviço (OS). 
    Seguir esta ordem garante a correta precificação automática por dioptria, a integridade dos dados financeiros, 
    o bloqueio preventivo de inadimplência e o perfeito fluxo de bancada.
    """
    story.append(Paragraph(intro_html, body_style))
    story.append(Spacer(1, 10))

    # QUADRO DE RESUMO DA ORDEM DE IMPLANTAÇÃO
    flow_data = [
        [Paragraph("<b>ETAPA</b>", bold_body), Paragraph("<b>NOME DO MÓDULO / CADASTRO</b>", bold_body), Paragraph("<b>OBJETIVO PRINCIPAL</b>", bold_body)],
        [Paragraph("<b>1. Autenticação</b>", body_style), Paragraph("Acesso Administrador Inicial", body_style), Paragraph("Entrar com usuário <b>admin</b> / <b>admin</b>", body_style)],
        [Paragraph("<b>2. Parâmetros</b>", body_style), Paragraph("Parâmetros Globais do Sistema", body_style), Paragraph("Definir limite de grau e política base de preços", body_style)],
        [Paragraph("<b>3. Usuários</b>", body_style), Paragraph("Gestão de Usuários e Permissões", body_style), Paragraph("Cadastrar operadores de bancada e gerentes", body_style)],
        [Paragraph("<b>4. Clientes</b>", body_style), Paragraph("Cadastro de Óticas Clientes", body_style), Paragraph("Cadastrar lojas parceiras e regras de crédito", body_style)],
        [Paragraph("<b>5. Catálogo</b>", body_style), Paragraph("Serviços Técnicos e Tratamentos", body_style), Paragraph("Cadastrar serviços de laboratório e adicionais", body_style)],
        [Paragraph("<b>6. Tabelas</b>", body_style), Paragraph("Tabelas de Preço Personalizadas", body_style), Paragraph("Vincular condições comerciais específicas por ótica", body_style)],
        [Paragraph("<b>7. Lentes</b>", body_style), Paragraph("Cadastrador Unificado & Bipador", body_style), Paragraph("Cadastrar modelos de lentes e alimentar estoque", body_style)],
        [Paragraph("<b>8. Emissão</b>", body_style), Paragraph("Nova OS de Fábrica (Com OCR)", body_style), Paragraph("Registrar a primeira OS fabril para a esteira", body_style)]
    ]
    t_flow = Table(flow_data, colWidths=[80, 180, 263])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_flow)
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 1: ACESSO INICIAL E CREDENCIAIS
    # =========================================================================
    story.append(Paragraph("1. Acesso Inicial e Login Administrador", h1_style))
    story.append(Paragraph("<b>Caminho no Sistema:</b> Tela Inicial de Login", path_style))
    p1_text = """
    Ao iniciar o sistema executável (<b>Nova Lab V 2.0.exe</b>) ou acessar via navegador, efetue o primeiro login 
    utilizando as credenciais mestre de administrador pré-configuradas. Este acesso desbloqueia os menus corporativos 
    de parametrização comercial e gestão financeira.
    <br/><br/>
    • <b>E-mail ou Login:</b> <code>admin</code> (ou <code>admin@leootica.com.br</code>)<br/>
    • <b>Senha Inicial:</b> <code>admin</code>
    """
    story.append(Paragraph(p1_text, body_style))
    story.append(Spacer(1, 10))

    # =========================================================================
    # PASSO 2: CONFIGURAÇÃO DE PARÂMETROS GLOBAIS DO SISTEMA
    # =========================================================================
    story.append(Paragraph("2. Configuração de Parâmetros Globais do Sistema", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Sistema & IA ➜ Parâmetros do Sistema", path_style))
    p2_text = """
    <b>Por que é necessário antes das lentes?</b> O sistema calcula o preço final da OS de acordo com a política de preços por grau 
    definida nos parâmetros globais. Sem essa configuração, o sistema não saberá a faixa de corte entre graus baixos e altos.
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse o menu <b>Sistema & IA</b> e clique na opção <b>Parâmetros do Sistema</b>.<br/>
    2. No campo <b>Limite Dioptria de Grau Alto (D)</b>, informe o valor limite (Ex: <code>2.00</code> D). Dioptrias acima desse valor serão classificadas como Grau Alto.<br/>
    3. Informe os preços base de venda sugeridos:<br/>
       &nbsp;&nbsp;- <b>Preço Padrão (Grau ≤ Limite):</b> Ex: <code>R$ 75,00</code><br/>
       &nbsp;&nbsp;- <b>Preço Padrão (Grau > Limite):</b> Ex: <code>R$ 95,00</code><br/>
    4. Configure as margens de tolerância de estoque e regras globais de bloqueio por inadimplência.<br/>
    5. Clique no botão <b>Salvar Parâmetros do Sistema</b>.
    """
    story.append(Paragraph(p2_text, body_style))
    
    # Dica Box
    tip2_data = [[Paragraph("<b>💡 Nota Importante:</b> A alteração dos Parâmetros do Sistema é aplicada imediatamente para todos os novos cadastros de modelos de lentes e regras de preço do catálogo.", tip_style)]]
    t_tip2 = Table(tip2_data, colWidths=[523])
    t_tip2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eff6ff")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#bfdbfe")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_tip2)
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 3: GESTÃO DE USUÁRIOS E PERMISSÕES DE ACESSO
    # =========================================================================
    story.append(Paragraph("3. Cadastramento de Usuários do Sistema e Operadores", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Sistema & IA ➜ Gestão de Usuários", path_style))
    p3_text = """
    <b>Objetivo:</b> Criar os logins individuais para os funcionários da fábrica, técnicos de surfaçagem/montagem 
    e atendentes comerciais, garantindo a rastreabilidade de quem realizou cada movimentação na bancada.
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse o menu <b>Sistema & IA</b> ➜ <b>Gestão de Usuários</b>.<br/>
    2. Clique no botão de ação <b>+ Novo Usuário</b>.<br/>
    3. Preencha os campos obrigatórios:<br/>
       &nbsp;&nbsp;• <b>Nome Completo:</b> Nome do funcionário (Ex: <i>Carlos Eduardo Montador</i>).<br/>
       &nbsp;&nbsp;• <b>E-mail Corporativo / Login:</b> E-mail de acesso (Ex: <i>carlos.montagem@novalab.com.br</i>).<br/>
       &nbsp;&nbsp;• <b>Perfil de Acesso (Role):</b> Selecione <code>Administrador</code> (Acesso total) ou <code>Operador</code> (Operações de bancada).<br/>
       &nbsp;&nbsp;• <b>Senha Inicial:</b> Defina uma senha segura para o primeiro acesso.<br/>
    4. Clique em <b>Salvar Usuário</b>.
    """
    story.append(Paragraph(p3_text, body_style))
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 4: CADASTRO DE ÓTICAS CLIENTES (LOJAS PARCEIRAS)
    # =========================================================================
    story.append(Paragraph("4. Cadastro de Óticas Clientes (Lojas Parceiras)", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Sistema & IA ➜ Cadastro de Óticas", path_style))
    p4_text = """
    <b>Por que é necessário antes da OS?</b> Toda Ordem de Serviço deve obrigatoriamente estar vinculada a uma Ótica Cliente parceira.
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse o menu <b>Sistema & IA</b> ➜ <b>Cadastro de Óticas</b>.<br/>
    2. Clique em <b>+ Nova Ótica Cliente</b>.<br/>
    3. Informe os dados cadastrais da loja:<br/>
       &nbsp;&nbsp;• <b>Razão Social</b> e <b>Nome Fantasia</b> (Ex: <i>Ótica Visão Real - Loja 02</i>).<br/>
       &nbsp;&nbsp;• <b>CNPJ</b> e <b>Inscrição Estadual</b>.<br/>
       &nbsp;&nbsp;• <b>Telefone / WhatsApp</b> e <b>E-mail do Responsável Financeiro</b>.<br/>
       &nbsp;&nbsp;• <b>Endereço Completo de Entrega da Bandeja</b>.<br/>
    4. <b>Política Comercial de Crédito:</b> Defina se a ótica possui limite de crédito ou bloqueio automático em caso de títulos vencidos.<br/>
    5. Clique em <b>Salvar Cadastramento</b>.
    """
    story.append(Paragraph(p4_text, body_style))
    story.append(Spacer(1, 15))

    story.append(PageBreak()) # Quebra para a segunda página

    # =========================================================================
    # PASSO 5: CADASTRO DO CATÁLOGO FINANCEIRO & SERVIÇOS TÉCNICOS
    # =========================================================================
    story.append(Paragraph("5. Cadastro do Catálogo Financeiro & Serviços Técnicos da Fábrica", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Comercial & Finanças ➜ Catálogo Financeiro", path_style))
    p5_text = """
    <b>Objetivo:</b> Cadastrar todos os serviços prestados pelo laboratório (montagem, surfaçagem, solda, coloração) 
    e tratamentos adicionais. Esses serviços populam dinamicamente os campos de seleção durante o registro de novas OS 
    e ordens de apenas reparo/serviço fabril.
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse o menu <b>Comercial & Finanças</b> e clique em <b>Catálogo Financeiro</b>.<br/>
    2. Na aba <b>Serviços Técnicos / Laboratório</b>, clique em <b>+ Novo Serviço Técnico</b>:<br/>
       &nbsp;&nbsp;• <b>Nome do Serviço:</b> Ex: <i>Surfaçagem + Montagem Completa</i>, <i>Coloração Especial / Banho</i>, <i>Solda de Armação</i>.<br/>
       &nbsp;&nbsp;• <b>Código do Serviço:</b> Ex: <code>SRV-01</code>.<br/>
       &nbsp;&nbsp;• <b>Valor Padrão de Venda (R$):</b> Ex: <code>R$ 35,00</code>.<br/>
    3. Na aba <b>Tratamentos & Adicionais</b>, cadastre os tratamentos disponíveis no laboratório:<br/>
       &nbsp;&nbsp;• Ex: <i>Anti-Reflexo Crizal Easy</i>, <i>Filtro Blue Cut</i>, <i>Proteção UV400</i>.<br/>
       &nbsp;&nbsp;• Preço adicional de tabela para cada tratamento.<br/>
    4. Clique em <b>Salvar no Catálogo</b>.
    """
    story.append(Paragraph(p5_text, body_style))
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 6: CADASTRO DE TABELAS DE PREÇO PERSONALIZADAS
    # =========================================================================
    story.append(Paragraph("6. Cadastro de Tabelas de Preço Personalizadas por Cliente (Opcional)", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Comercial & Finanças ➜ Tabela de Preços", path_style))
    p6_text = """
    <b>Objetivo:</b> Configurar tabelas de preços com condições especiais ou descontos negociados para grandes redes ou grupos de óticas parceiras.
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse <b>Comercial & Finanças</b> ➜ <b>Tabela de Preços</b>.<br/>
    2. Clique em <b>+ Nova Tabela Comercial</b> e informe a descrição (Ex: <i>Tabela Prata - Redes Conveniadas</i>).<br/>
    3. Vincule as Óticas Clientes que utilizarão esta tabela.<br/>
    4. Defina os valores negociados para cada modelo de lente e serviço de bancada.<br/>
    5. Clique em <b>Salvar Tabela de Preços</b>.
    """
    story.append(Paragraph(p6_text, body_style))
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 7: CADASTRO DE LENTES E ENTRADA DE ESTOQUE (CADASTRADOR UNIFICADO)
    # =========================================================================
    story.append(Paragraph("7. Cadastro e Entrada de Lentes no Estoque (Cadastrador Unificado & Bipador USB)", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Estoque & Grade ➜ Cadastrador Unificado & Bipador USB", path_style))
    p7_text = """
    <b>Objetivo:</b> Após a configuração dos parâmetros e catálogo, efetuar o cadastro dos <b>Modelos de Lentes</b> 
    e a alimentação das matrizes de estoque de lentes físicas por dioptria (Esférico x Cilíndrico).
    <br/><br/>
    <b>Passo a Passo de Procedimentos:</b><br/>
    1. Acesse <b>Estoque & Grade</b> ➜ <b>Cadastrador Unificado & Bipador USB</b>.<br/>
    2. <b>Aba 1 - Cadastrador Unificado por Presets:</b><br/>
       &nbsp;&nbsp;• Selecione a Marca / Família (Ex: <i>Visão Simples LP</i>, <i>Multifocal Acabado 1.67</i>).<br/>
       &nbsp;&nbsp;• Informe o Material (Resina, Policarbonato, Alto Índice n=1.67) e Tratamento Inclusos.<br/>
       &nbsp;&nbsp;• Informe o <b>Diâmetro Físico (mm)</b> (Ex: <code>70</code> mm ou <code>75</code> mm).<br/>
       &nbsp;&nbsp;• O sistema aplicará a precificação automática por dioptria conforme os parâmetros definidos no Passo 2.<br/>
       &nbsp;&nbsp;• Clique em <b>Gerar Matriz e Salvar Modelo</b>.<br/>
    3. <b>Aba 2 - Entrada via Bipador USB (BIP):</b><br/>
       &nbsp;&nbsp;• Conecte o leitor de código de barras USB ao computador.<br/>
       &nbsp;&nbsp;• Bipe o código EAN/UPC da caixa da lente para dar entrada rápida com localização automática na gaveta de estoque.
    """
    story.append(Paragraph(p7_text, body_style))
    story.append(Spacer(1, 15))

    # =========================================================================
    # PASSO 8: REGISTRO DA PRIMEIRA ORDEM DE SERVIÇO (NOVA OS DE FÁBRICA)
    # =========================================================================
    story.append(Paragraph("8. Emissão da Primeira Ordem de Serviço Fabril (Nova OS com OCR & Manual)", h1_style))
    story.append(Paragraph("<b>Caminho no Menu:</b> Bancada OS ➜ Nova OS de Fábrica (Com OCR & Manual)", path_style))
    p8_text = """
    <b>Objetivo:</b> Com todos os cadastros prévios concluídos, o sistema está 100% pronto para emitir Ordens de Serviço fabris.
    <br/><br/>
    <b>Passo a Passo de Emissão da OS:</b><br/>
    1. Acesse <b>Bancada OS</b> ➜ <b>Nova OS de Fábrica (Com OCR & Manual)</b>.<br/>
    2. <b>Etapa 1 - Identificação & Serviço (ADMIN):</b><br/>
       &nbsp;&nbsp;• Selecione a <b>Ótica Cliente Parceira</b> (cadastrada no Passo 4).<br/>
       &nbsp;&nbsp;• Digite o <b>Número do Pedido da Loja</b> (Obrigatório).<br/>
       &nbsp;&nbsp;• Informe o Número da Bandeja (Opcional) e Prioridade.<br/>
       &nbsp;&nbsp;• Clique em <b>Próximo: Prescrição Óptica</b>.<br/>
    3. <b>Etapa 2 - Prescrição Óptica (PRESCRIPTION):</b><br/>
       &nbsp;&nbsp;• Digite manualmente os graus da receita (Esférico, Cilíndrico, Eixo, Adição, DNP, Altura) OU clique no botão <b>Carregar Foto / PDF da Receita</b> para que a IA (OCR) preencha automaticamente.<br/>
       &nbsp;&nbsp;• Clique em <b>Próximo: Selecionar Lente</b>.<br/>
    4. <b>Etapa 3 - Lente & Tratamentos (PRODUCT):</b><br/>
       &nbsp;&nbsp;• Selecione a Lente Cadastrada no Passo 7. O sistema calcula o preço e carrega os tratamentos automaticamente.<br/>
       &nbsp;&nbsp;• Clique em <b>Próximo: Armação & Bisel</b>.<br/>
    5. <b>Etapa 4 - Geometria da Armação (FRAME):</b><br/>
       &nbsp;&nbsp;• Informe o Aro A, B, Ponte DBL e Maior Diâmetro ED.<br/>
       &nbsp;&nbsp;• Clique em <b>Próximo: Observações</b>.<br/>
    6. <b>Etapa 5 - Finalização (OBSERVATIONS):</b><br/>
       &nbsp;&nbsp;• Clique em <b>Registrar Ordem de Serviço</b>. A OS entra instantaneamente na esteira de produção da bancada!
    """
    story.append(Paragraph(p8_text, body_style))
    story.append(Spacer(1, 15))

    # QUADRO FINAL DE CONCLUSÃO
    final_data = [[Paragraph("<b>✅ IMPLANTAÇÃO CONCLUÍDA COM SUCESSO:</b> Seguindo este fluxo de pré-requisitos, a fábrica opera com total automatização de preços por dioptria, rastreabilidade por operador e segurança comercial no faturamento.", ParagraphStyle('FinText', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=SUCCESS_COLOR))]]
    t_final = Table(final_data, colWidths=[523])
    t_final.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#bbf7d0")),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_final)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Manual em PDF gerado com sucesso em: {filename}")

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_path = os.path.join(project_root, "Tutorial_Cadastros_Iniciais_Nova_Lab.pdf")
    build_pdf(target_path)
