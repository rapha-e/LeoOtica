import React, { useState, useMemo } from 'react';
import { 
  Search, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, 
  Printer, ChevronLeft, ChevronRight, FileText, RefreshCcw
} from 'lucide-react';
import { exportToCSV, printReportHtml } from '../../utils/exportHelper';

export default function ReportTable({
  columns = [],
  data = [],
  title = 'Relatório Analítico',
  loading = false,
  onExportExcel = null,
  onExportPdf = null,
  headerActions = null,
  initialPageSize = 25,
  style = {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Filtro de busca
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm]);

  // Ordenação
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginação
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headersMap = {};
    columns.forEach((c) => {
      headersMap[c.key] = c.label;
    });
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCSV(sortedData, filename, headersMap);
  };

  const handlePrint = () => {
    const headersHtml = columns.map(c => `<th>${c.label}</th>`).join('');
    const rowsHtml = sortedData.map((row, idx) => {
      const cells = columns.map(c => {
        const val = row[c.key];
        return `<td>${val !== null && val !== undefined ? String(val) : ''}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const tableHtml = `
      <table>
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
    printReportHtml(title, tableHtml);
  };

  return (
    <div 
      className="glass-panel" 
      style={{
        padding: '0',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
    >
      {/* Top Bar */}
      <div 
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          background: 'rgba(248, 250, 252, 0.65)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.3px' }}>
            {title}
          </h3>
          <span 
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(147, 51, 234, 0.08)',
              color: 'hsl(var(--primary))',
              border: '1px solid rgba(147, 51, 234, 0.15)'
            }}
          >
            {totalItems} {totalItems === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Busca */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar nos resultados..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 12px 6px 30px',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                background: '#ffffff',
                color: 'hsl(var(--text-primary))',
                width: '200px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
          </div>

          {headerActions}

          {/* Exportadores */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid rgba(203, 213, 225, 0.8)', paddingLeft: '8px' }}>
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                title="Exportar PDF Formatado"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'hsl(0, 75%, 45%)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileText size={13} /> PDF
              </button>
            )}

            {onExportExcel ? (
              <button
                type="button"
                onClick={onExportExcel}
                title="Exportar Planilha Excel (.xlsx)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  background: 'rgba(34, 197, 94, 0.08)',
                  color: 'hsl(142, 75%, 32%)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportCSV}
                title="Exportar Tabela em CSV"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  background: 'rgba(34, 197, 94, 0.08)',
                  color: 'hsl(142, 75%, 32%)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Download size={13} /> CSV
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              title="Imprimir Tabela"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                background: '#ffffff',
                color: 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Printer size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div style={{ overflowX: 'auto', minHeight: '220px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'rgba(241, 245, 249, 0.9)', borderBottom: '1px solid rgba(203, 213, 225, 0.9)' }}>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const align = col.align || 'left';
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    style={{
                      padding: '11px 16px',
                      color: 'hsl(var(--text-secondary))',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      textAlign: align,
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span style={{ color: isSorted ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', opacity: isSorted ? 1 : 0.4 }}>
                          {isSorted ? (
                            sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-secondary))' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <RefreshCcw size={18} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                    <span>Processando dados analíticos...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const globalIndex = (currentPage - 1) * pageSize + idx;
                return (
                  <tr
                    key={row.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(241, 245, 249, 0.9)',
                      background: idx % 2 === 0 ? '#ffffff' : 'rgba(248, 250, 252, 0.6)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(147, 51, 234, 0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : 'rgba(248, 250, 252, 0.6)'}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '10px 16px',
                          color: 'hsl(var(--text-primary))',
                          textAlign: col.align || 'left',
                          whiteSpace: col.wrap ? 'normal' : 'nowrap'
                        }}
                      >
                        {col.render 
                          ? col.render(row, globalIndex) 
                          : (row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '-')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && totalItems > 0 && (
        <div 
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            background: 'rgba(248, 250, 252, 0.75)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '0.78rem',
            color: 'hsl(var(--text-secondary))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Linhas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                color: 'hsl(var(--text-primary))',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Exibindo {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, totalItems)} de {totalItems}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: '#ffffff',
                color: 'hsl(var(--text-secondary))',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ padding: '0 6px', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: '#ffffff',
                color: 'hsl(var(--text-secondary))',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
