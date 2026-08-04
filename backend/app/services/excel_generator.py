import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

def generate_billing_excel(cycle) -> bytes:
    """
    Gera uma planilha Excel formatada profissionalmente contendo
    o detalhamento de OSs faturadas em um lote de fechamento.
    """
    # Coletamos os dados das OSs
    data = []
    for item in cycle.items:
        data.append({
            "Código da OS": item.os_number or "N/A",
            "Paciente / Cliente Final": item.client_name or "Consumidor Final",
            "Valor da OS (R$)": float(item.amount),
            "Data de Loteamento": item.created_at.strftime("%d/%m/%Y %H:%M:%S")
        })
        
    df = pd.DataFrame(data)
    
    # Criamos o buffer em memória
    output = io.BytesIO()
    
    # Escrevemos com pandas
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Faturamento Detalhado")
        
        # Obter o workbook e a aba gerada para estilização
        workbook = writer.book
        worksheet = writer.sheets["Faturamento Detalhado"]
        
        # Ajusta a largura das colunas de forma inteligente
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 3, 15)
            
        # Estilos premium para o Excel
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid") # Azul clássico
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        
        cell_font = Font(name="Calibri", size=10)
        align_left = Alignment(horizontal="left", vertical="center")
        align_center = Alignment(horizontal="center", vertical="center")
        align_right = Alignment(horizontal="right", vertical="center")
        
        thin_side = Side(border_style="thin", color="D1D5DB")
        border_all = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        
        # Aplica estilo no cabeçalho
        for col_idx in range(1, len(df.columns) + 1):
            cell = worksheet.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = border_all
            
        # Aplica estilo e formatação decimal/moeda nas células de dados
        for row_idx in range(2, len(df) + 2):
            for col_idx in range(1, len(df.columns) + 1):
                cell = worksheet.cell(row=row_idx, column=col_idx)
                cell.font = cell_font
                cell.border = border_all
                
                # Alinhamentos específicos por coluna
                if col_idx == 1: # Código da OS
                    cell.alignment = align_center
                elif col_idx == 2: # Paciente
                    cell.alignment = align_left
                elif col_idx == 3: # Valor (R$)
                    cell.alignment = align_right
                    cell.number_format = '"R$"#,##0.00'
                elif col_idx == 4: # Data
                    cell.alignment = align_center
                    
        # Linha de total no final da planilha
        total_row_idx = len(df) + 3
        worksheet.cell(row=total_row_idx, column=1, value="TOTAL GERAL").font = Font(name="Calibri", size=11, bold=True)
        worksheet.cell(row=total_row_idx, column=1).alignment = align_left
        
        total_cell = worksheet.cell(row=total_row_idx, column=3, value=float(cycle.total_amount))
        total_cell.font = Font(name="Calibri", size=11, bold=True, color="1F4E78")
        total_cell.alignment = align_right
        total_cell.number_format = '"R$"#,##0.00'
        
        # Borda dupla inferior e simples superior para a linha de total
        top_side = Side(border_style="thin", color="1F4E78")
        double_bottom = Side(border_style="double", color="1F4E78")
        total_border = Border(top=top_side, bottom=double_bottom)
        
        for col_idx in range(1, len(df.columns) + 1):
            worksheet.cell(row=total_row_idx, column=col_idx).border = total_border
            
    return output.getvalue()
