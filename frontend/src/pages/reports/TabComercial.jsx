import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Award, ShoppingBag, Store, DollarSign, 
  Sparkles, RefreshCw, Layers, ArrowUpRight
} from 'lucide-react';
import { ReportService } from '../../services/api';
import { downloadBlob } from '../../utils/exportHelper';
import ReportDatePresets, { getPresetDates } from '../../components/reports/ReportDatePresets';
import ReportKPICards from '../../components/reports/ReportKPICards';
import ReportTable from '../../components/reports/ReportTable';

export default function TabComercial() {
  const defaultDates = getPresetDates('thisMonth') || { startDate: '', endDate: '' };
  const [dates, setDates] = useState(defaultDates);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
      };
      const res = await ReportService.getCommercialRanking(params);
      setReportData(res.data);
    } catch (err) {
      console.error('Erro ao carregar relatório comercial:', err);
    } finally {
      setLoading(false);
    }
  }, [dates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportExcel = async () => {
    try {
      const params = {
        report_type: 'commercial',
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
      };
      const res = await ReportService.exportExcel(params);
      const filename = `ranking_comercial_${dates.startDate}_a_${dates.endDate}.xlsx`;
      downloadBlob(res.data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Erro ao gerar planilha comercial.');
      console.error(err);
    }
  };

  const kpis = reportData?.kpis || {};
  const formattedRevenue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.total_sales_amount || 0);
  const formattedAvgTicket = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.overall_avg_ticket || 0);

  const kpiCards = [
    {
      label: 'Faturamento Bruto (Vendas)',
      value: formattedRevenue,
      subtitle: `Período: ${dates.startDate} a ${dates.endDate}`,
      icon: <DollarSign size={20} />,
      color: 'emerald',
      trend: `${kpis.total_orders_sold || 0} ordens faturadas`,
      trendType: 'positive',
    },
    {
      label: 'Volume de OS Vendidas',
      value: `${kpis.total_orders_sold || 0} OSs`,
      subtitle: 'Ordens concluídas e faturadas',
      icon: <ShoppingBag size={20} />,
      color: 'sky',
    },
    {
      label: 'Ticket Médio por Ordem',
      value: formattedAvgTicket,
      subtitle: 'Valor médio por OS faturada',
      icon: <TrendingUp size={20} />,
      color: 'indigo',
    },
    {
      label: 'Óticas Ativas no Período',
      value: `${kpis.active_stores_count || 0} lojas`,
      subtitle: 'Clientes com pelo menos 1 OS',
      icon: <Store size={20} />,
      color: 'amber',
    },
  ];

  const rankingColumns = [
    {
      key: 'position',
      label: '#',
      align: 'center',
      render: (row, idx) => {
        const position = (typeof idx === 'number' && !isNaN(idx)) ? idx + 1 : 1;
        let badgeStyle = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          fontSize: '0.75rem',
          fontWeight: 800,
          background: 'rgba(241, 245, 249, 0.9)',
          color: 'hsl(var(--text-secondary))'
        };

        if (position === 1) {
          badgeStyle = { ...badgeStyle, background: 'rgba(234, 179, 8, 0.2)', color: 'hsl(35, 90%, 40%)', border: '1px solid rgba(234, 179, 8, 0.4)' };
          return <span style={badgeStyle}>🥇</span>;
        } else if (position === 2) {
          badgeStyle = { ...badgeStyle, background: 'rgba(148, 163, 184, 0.2)', color: 'hsl(215, 25%, 35%)', border: '1px solid rgba(148, 163, 184, 0.4)' };
          return <span style={badgeStyle}>🥈</span>;
        } else if (position === 3) {
          badgeStyle = { ...badgeStyle, background: 'rgba(217, 119, 6, 0.2)', color: 'hsl(25, 80%, 45%)', border: '1px solid rgba(217, 119, 6, 0.4)' };
          return <span style={badgeStyle}>🥉</span>;
        }
        return <span style={badgeStyle}>{position}º</span>;
      },
    },
    {
      key: 'store_name',
      label: 'Ótica / Razão Social',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{row.store_name}</div>
          {row.trade_name && row.trade_name !== row.store_name && (
            <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))' }}>Fantasia: {row.trade_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'cnpj',
      label: 'CNPJ',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
          {row.cnpj || '-'}
        </span>
      ),
    },
    {
      key: 'total_orders_count',
      label: 'Volume OS',
      align: 'center',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'hsl(var(--secondary))', fontFamily: 'monospace' }}>
          {row.total_orders_count} un
        </span>
      ),
    },
    {
      key: 'total_billed_amount',
      label: 'Faturamento Total',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 800, color: 'hsl(142, 75%, 32%)', fontFamily: 'monospace' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total_billed_amount || 0)}
        </span>
      ),
    },
    {
      key: 'average_ticket',
      label: 'Ticket Médio',
      align: 'right',
      render: (row) => (
        <span style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.average_ticket || 0)}
        </span>
      ),
    },
    {
      key: 'status_policy',
      label: 'Estágio CRM',
      align: 'center',
      render: (row) => (
        <span 
          style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.68rem',
            fontWeight: 700,
            background: 'rgba(147, 51, 234, 0.08)',
            color: 'hsl(var(--primary))',
            border: '1px solid rgba(147, 51, 234, 0.15)'
          }}
        >
          {row.status_policy || 'ATIVO'}
        </span>
      ),
    },
  ];

  const treatmentColumns = [
    {
      key: 'treatment_name',
      label: 'Tratamento / Antirreflexo',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
          <Sparkles size={14} style={{ color: 'hsl(35, 85%, 45%)' }} />
          <span>{row.treatment_name}</span>
        </div>
      ),
    },
    {
      key: 'quantity_sold',
      label: 'Qtd. Vendida',
      align: 'center',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'hsl(var(--secondary))', fontFamily: 'monospace' }}>
          {row.quantity_sold} un
        </span>
      ),
    },
    {
      key: 'total_amount',
      label: 'Receita Gerada',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 800, color: 'hsl(142, 75%, 32%)', fontFamily: 'monospace' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total_amount || 0)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de Filtro de Datas e Ação */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <ReportDatePresets
          defaultPreset="thisMonth"
          onDateChange={(newDates) => setDates(newDates)}
          style={{ flex: 1 }}
        />

        <button
          type="button"
          onClick={loadData}
          title="Recarregar Dados"
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Recarregar</span>
        </button>
      </div>

      {/* KPIs Comerciais */}
      <ReportKPICards cards={kpiCards} columns={4} />

      {/* Tabelas de Ranking e Mix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Tabela de Ranking Óticas */}
        <div style={{ minWidth: '320px', flex: '2' }}>
          <ReportTable
            title="Ranking de Faturamento por Ótica"
            columns={rankingColumns}
            data={reportData?.ranking || []}
            loading={loading}
            onExportExcel={handleExportExcel}
            initialPageSize={15}
          />
        </div>

        {/* Tabela de Mix de Tratamentos */}
        <div style={{ minWidth: '280px', flex: '1' }}>
          <ReportTable
            title="Mix de Tratamentos & Antirreflexos"
            columns={treatmentColumns}
            data={reportData?.top_treatments || []}
            loading={loading}
            initialPageSize={10}
          />
        </div>
      </div>
    </div>
  );
}
