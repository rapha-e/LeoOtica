/**
 * Utilitários de Exportação e Impressão para Central de Relatórios & BI
 */

/**
 * Dispara o download de um Blob (PDF ou XLSX) recebido da API
 * @param {Blob|ArrayBuffer} data - Dados binários do arquivo
 * @param {string} filename - Nome do arquivo a ser salvo
 * @param {string} mimeType - Tipo MIME opcional
 */
export const downloadBlob = (data, filename, mimeType = null) => {
  if (!data) return;
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Exporta array de objetos para arquivo CSV formatado com UTF-8 BOM
 * @param {Array<Object>} rows - Linhas de dados
 * @param {string} filename - Nome do arquivo
 * @param {Object} [headersMap] - Mapeamento de chave -> Título da coluna (ex: { os_number: 'Nº OS' })
 */
export const exportToCSV = (rows, filename, headersMap = null) => {
  if (!rows || !rows.length) {
    alert('Não há dados disponíveis para exportar.');
    return;
  }

  const keys = headersMap ? Object.keys(headersMap) : Object.keys(rows[0]);
  const headers = headersMap ? Object.values(headersMap) : keys;

  const csvRows = [];
  // Linha de cabeçalho
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';'));

  // Linhas de dados
  for (const row of rows) {
    const values = keys.map(k => {
      let val = row[k];
      if (val === null || val === undefined) val = '';
      else if (typeof val === 'number') val = String(val).replace('.', ',');
      else val = String(val);
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(';'));
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Abre janela de impressão formatada para relatórios
 * @param {string} title - Título do relatório
 * @param {string} contentHtml - HTML a ser impresso
 */
export const printReportHtml = (title, contentHtml) => {
  const printWindow = window.open('', '_blank', 'width=900,height=650');
  if (!printWindow) {
    alert('Por favor, autorize pop-ups para imprimir o relatório.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          background: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header h1 { margin: 0; font-size: 18px; color: #0f172a; }
        .header .meta { font-size: 10px; color: #64748b; text-align: right; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 600;
          color: #334155;
        }
        tr:nth-child(even) { background-color: #f8fafc; }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px;
          background: #f8fafc;
        }
        .kpi-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
        .kpi-card .value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 4px; }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Nova LAB Ótica Industrial</h1>
          <div style="font-size: 13px; font-weight: 600; color: #0284c7; margin-top: 2px;">${title}</div>
        </div>
        <div class="meta">
          <div>Emissão: ${new Date().toLocaleString('pt-BR')}</div>
          <div>CNPJ: 58.032.958/0001-44</div>
        </div>
      </div>
      ${contentHtml}
      <div class="footer">
        Documento emitido automaticamente pelo Sistema LeoÓtica 2.0 • Página 1 de 1
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); }
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
