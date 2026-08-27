import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, DollarSign, AlertCircle, AlertTriangle, Layers, 
  Archive, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react';
import { ReportService } from '../../services/api';
import { downloadBlob } from '../../utils/exportHelper';
import ReportKPICards from '../../components/reports/ReportKPICards';
import ReportTable from '../../components/reports/ReportTable';

const MATRIX_OPTIONS = [
  { value: '', label: 'Todas as Matrizes' },
  { value: 'LP_GRADE', label: 'Visão Simples (LP Grade)' },
  { value: 'GRADE_167', label: 'Alto Índice 1.67' },
  { value: 'MF_ACB', label: 'Multifocal Acabado' },
  { value: 'MF_BLOCO', label: 'Multifocal Semiacabado (Bloco)' },
  { value: 'BLOCO_VS', label: 'Bloco Visão Simples' },
];

export default function TabEstoque() {
  const [matrixType, setMatrixType] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        matrix_type: matrixType || undefined,
        only_critical: onlyCritical ? true : undefined,
        only_in_stock: onlyInStock ? true : undefined,
      };
      const res = await ReportService.getInventoryKardex(params);
      setReportData(res.data);
    } catch (err) {
      console.error('Erro ao carregar kardex de estoque:', err);
    } finally {
      setLoading(false);
    }
  }, [matrixType, onlyCritical, onlyInStock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportPdf = async () => {
    try {
      const params = {
        report_type: 'kardex',
        matrix_type: matrixType || undefined,
      };
      const res = await ReportService.exportPdf(params);
      const filename = `posicao_estoque_kardex_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(res.data, filename, 'application/pdf');
    } catch (err) {
      alert('Erro ao gerar PDF de posição de estoque.');
      console.error(err);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = {
        report_type: 'kardex',
        matrix_type: matrixType || undefined,
      };
      const res = await ReportService.exportExcel(params);
      const filename = `kardex_estoque_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(res.data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Erro ao gerar planilha de estoque.');
      console.error(err);
    }
  };

  const kpis = reportData?.kpis || {};
  const formattedStockValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.total_stock_value_cmp || 0);

  const kpiCards = [
    {
      label: 'Valor Total do Estoque (CMP)',
      value: formattedStockValue,
      subtitle: 'Valorizado pelo Custo Médio Ponderado',
      icon: <DollarSign size={20} />,
      color: 'emerald',
    },
    {
      label: 'Saldo Físico Total',
      value: `${kpis.total_units_stock || 0} un`,
      subtitle: `${kpis.total_units_reserved || 0} un reservadas em OS`,
      icon: <Package size={20} />,
      color: 'sky',
    },
    {
      label: 'Itens em Ruptura (Zerados)',
      value: `${kpis.rupture_items_count || 0} SKUs`,
      subtitle: 'Estoque zerado no almoxarifado',
      icon: <ShieldAlert size={20} />,
      color: 'rose',
      trendType: kpis.rupture_items_count > 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Estoque Crítico (≤ 2 un)',
      value: `${kpis.critical_items_count || 0} SKUs`,
      subtitle: 'Risco iminente de falta',
      icon: <AlertTriangle size={20} />,
      color: 'amber',
    },
  ];

  const columns = [
    {
      key: 'matrix_type',
      label: 'Matriz',
      render: (row) => {
        const labels = {
          LP_GRADE: 'Visão Simples',
          GRADE_167: 'Alto Índice 1.67',
          MF_ACB: 'Multifocal Acab.',
          MF_BLOCO: 'Bloco Multifocal',
          BLOCO_VS: 'Bloco VS',
        };
        return (
          <span 
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(241, 245, 249, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.8)',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'hsl(var(--text-secondary))'
            }}
          >
            {labels[row.matrix_type] || row.matrix_type}
          </span>
        );
      },
    },
    {
      key: 'model_name',
      label: 'Modelo da Lente',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{row.model_name}</div>
          <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))' }}>{row.brand} • {row.treatment}</div>
        </div>
      ),
    },
    {
      key: 'diopters',
      label: 'Graduação / Dioptrias',
      render: (row) => {
        const parts = [];
        if (row.spherical !== null && row.spherical !== undefined) parts.push(`Esf: ${row.spherical > 0 ? '+' : ''}${row.spherical}`);
        if (row.cylindrical !== null && row.cylindrical !== undefined) parts.push(`Cil: ${row.cylindrical}`);
        if (row.addition !== null && row.addition !== undefined) parts.push(`Add: +${row.addition}`);
        if (row.base_curve !== null && row.base_curve !== undefined) parts.push(`Base: ${row.base_curve}`);
        if (row.eye) parts.push(`Olho: ${row.eye}`);
        return (
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'hsl(var(--secondary))', fontWeight: 600 }}>
            {parts.length > 0 ? parts.join(' | ') : 'Sem grau (Insumo)'}
          </span>
        );
      },
    },
    {
      key: 'barcode',
      label: 'Código de Barras',
      render: (row) => row.barcode ? (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{row.barcode}</span>
      ) : <span style={{ color: 'hsl(var(--text-muted))' }}>-</span>,
    },
    {
      key: 'quantity_available',
      label: 'Saldo Físico',
      align: 'center',
      render: (row) => {
        const qty = row.quantity_available || 0;
        let color = 'hsl(142, 75%, 32%)';
        if (qty === 0) color = 'hsl(0, 75%, 48%)';
        else if (qty <= 2) color = 'hsl(35, 85%, 40%)';
        return <span style={{ fontFamily: 'monospace', fontWeight: 800, color, fontSize: '0.82rem' }}>{qty} un</span>;
      },
    },
    {
      key: 'reserved_quantity',
      label: 'Reservado',
      align: 'center',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', color: 'hsl(35, 85%, 40%)', fontWeight: 600 }}>
          {row.reserved_quantity ? `${row.reserved_quantity} un` : '-'}
        </span>
      ),
    },
    {
      key: 'free_quantity',
      label: 'Saldo Livre',
      align: 'center',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          {row.free_quantity || 0} un
        </span>
      ),
    },
    {
      key: 'unit_cost_cmp',
      label: 'Custo CMP',
      align: 'right',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-secondary))' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.unit_cost_cmp || 0)}
        </span>
      ),
    },
    {
      key: 'total_value_cmp',
      label: 'Valor Total',
      align: 'right',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'hsl(142, 75%, 32%)' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total_value_cmp || 0)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de Filtros */}
      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '14px',
          padding: '12px 18px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
            <Layers size={16} style={{ color: 'hsl(var(--primary))' }} />
            <span>Matriz:</span>
          </div>

          <select
            value={matrixType}
            onChange={(e) => setMatrixType(e.target.value)}
            style={{
              background: 'rgba(248, 250, 252, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {MATRIX_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Toggles */}
          <label 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'hsl(35, 85%, 40%)',
              cursor: 'pointer',
              userSelect: 'none',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '5px 10px',
              borderRadius: '8px'
            }}
          >
            <input
              type="checkbox"
              checked={onlyCritical}
              onChange={(e) => setOnlyCritical(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas Críticos (≤ 2 un)</span>
          </label>

          <label 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'hsl(142, 75%, 32%)',
              cursor: 'pointer',
              userSelect: 'none',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              padding: '5px 10px',
              borderRadius: '8px'
            }}
          >
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas Saldo Positivo</span>
          </label>
        </div>

        <button
          type="button"
          onClick={loadData}
          title="Atualizar Estoque"
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '0.78rem',
            fontWeight: 700
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* KPIs de Estoque */}
      <ReportKPICards cards={kpiCards} columns={4} />

      {/* Tabela de Kardex */}
      <ReportTable
        title="Posição Geral do Estoque & Kardex Valorizado"
        columns={columns}
        data={reportData?.items || []}
        loading={loading}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        initialPageSize={25}
      />
    </div>
  );
}
