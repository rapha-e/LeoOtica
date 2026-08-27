import React, { useState, useEffect, useCallback } from 'react';
import { 
  Factory, CheckCircle2, Clock, AlertTriangle, Zap, Cpu, 
  RotateCcw, RefreshCw, Filter, ShieldAlert
} from 'lucide-react';
import { ReportService, OpticalStoreService } from '../../services/api';
import { downloadBlob } from '../../utils/exportHelper';
import ReportDatePresets, { getPresetDates } from '../../components/reports/ReportDatePresets';
import ReportKPICards from '../../components/reports/ReportKPICards';
import ReportTable from '../../components/reports/ReportTable';

export default function TabProducao() {
  const defaultDates = getPresetDates('thisMonth') || { startDate: '', endDate: '' };
  const [dates, setDates] = useState(defaultDates);
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [opticalStores, setOpticalStores] = useState([]);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    OpticalStoreService.list('', true, 0, 200)
      .then((res) => setOpticalStores(res.data?.items || res.data || []))
      .catch((err) => console.error('Erro ao buscar óticas:', err));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
        status_filter: statusFilter || undefined,
        production_route: routeFilter || undefined,
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.getProductionAnalytic(params);
      setReportData(res.data);
    } catch (err) {
      console.error('Erro ao carregar relatório analítico de produção:', err);
    } finally {
      setLoading(false);
    }
  }, [dates, statusFilter, routeFilter, storeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportPdf = async () => {
    try {
      const params = {
        report_type: 'production',
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.exportPdf(params);
      const filename = `relatorio_producao_mes_${dates.startDate}_a_${dates.endDate}.pdf`;
      downloadBlob(res.data, filename, 'application/pdf');
    } catch (err) {
      alert('Erro ao gerar relatório em PDF.');
      console.error(err);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = {
        report_type: 'production',
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.exportExcel(params);
      const filename = `producao_mes_${dates.startDate}_a_${dates.endDate}.xlsx`;
      downloadBlob(res.data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Erro ao gerar planilha Excel.');
      console.error(err);
    }
  };

  const kpis = reportData?.kpis || {};

  const kpiCards = [
    {
      label: 'Volume Total de OS',
      value: `${kpis.total_orders || 0} OSs`,
      subtitle: `${dates.startDate} a ${dates.endDate}`,
      icon: <Factory size={20} />,
      color: 'sky',
    },
    {
      label: 'Concluídas / Prontas',
      value: `${kpis.orders_completed || 0} OSs`,
      subtitle: `${kpis.total_orders ? Math.round((kpis.orders_completed / kpis.total_orders) * 100) : 0}% de conclusão`,
      icon: <CheckCircle2 size={20} />,
      color: 'emerald',
      trend: `${kpis.orders_completed || 0} entregues`,
      trendType: 'positive',
    },
    {
      label: 'Em Processamento',
      value: `${kpis.orders_in_progress || 0} OSs`,
      subtitle: 'Em linhas de produção',
      icon: <Clock size={20} />,
      color: 'amber',
    },
    {
      label: 'Lead Time Médio',
      value: `${kpis.avg_lead_time_hours || 0} h`,
      subtitle: 'Tempo médio de ciclo MES',
      icon: <Zap size={20} />,
      color: 'indigo',
    },
    {
      label: 'Retrabalhos / Reparo',
      value: `${kpis.orders_rework || 0} OSs`,
      subtitle: `${kpis.total_orders ? ((kpis.orders_rework / kpis.total_orders) * 100).toFixed(1) : 0}% de refugo`,
      icon: <RotateCcw size={20} />,
      color: 'rose',
      trendType: kpis.orders_rework > 0 ? 'negative' : 'neutral',
    },
  ];

  const columns = [
    {
      key: 'os_number',
      label: 'Nº OS',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'hsl(var(--primary))' }}>
          #{row.os_number}
        </span>
      ),
    },
    {
      key: 'client_order_number',
      label: 'Pedido Loja',
      render: (row) => row.client_order_number ? (
        <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-secondary))' }}>{row.client_order_number}</span>
      ) : <span style={{ color: 'hsl(var(--text-muted))' }}>-</span>,
    },
    {
      key: 'optical_store_name',
      label: 'Ótica Cliente',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
          {row.optical_store_name || 'Balcão / Avulso'}
        </span>
      ),
    },
    {
      key: 'tray_number',
      label: 'Bandeja',
      align: 'center',
      render: (row) => row.tray_number ? (
        <span 
          style={{
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(241, 245, 249, 0.9)',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'hsl(var(--text-primary))'
          }}
        >
          {row.tray_number}
        </span>
      ) : <span style={{ color: 'hsl(var(--text-muted))' }}>-</span>,
    },
    {
      key: 'production_route',
      label: 'Rota',
      render: (row) => {
        if (row.production_route === 'EXPRESSA_FACETAMENTO') {
          return (
            <span 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.12)',
                color: 'hsl(35, 85%, 40%)',
                border: '1px solid rgba(245, 158, 11, 0.25)'
              }}
            >
              <Zap size={12} /> Expressa
            </span>
          );
        }
        if (row.production_route === 'SURFACAGEM_CNC') {
          return (
            <span 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'rgba(147, 51, 234, 0.12)',
                color: 'hsl(263, 75%, 50%)',
                border: '1px solid rgba(147, 51, 234, 0.25)'
              }}
            >
              <Cpu size={12} /> Surfaçagem CNC
            </span>
          );
        }
        return <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>{row.production_route || 'Padrão'}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        let styleBadge = {
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '0.7rem',
          fontWeight: 700,
          background: 'rgba(241, 245, 249, 0.9)',
          color: 'hsl(var(--text-secondary))',
          border: '1px solid rgba(203, 213, 225, 0.8)'
        };
        if (row.status === 'PRONTA' || row.status === 'ENTREGUE') {
          styleBadge = { ...styleBadge, background: 'rgba(34, 197, 94, 0.12)', color: 'hsl(142, 75%, 32%)', border: '1px solid rgba(34, 197, 94, 0.3)' };
        } else if (row.status === 'BLOQUEADA_FINANCEIRO' || row.status === 'CANCELADA') {
          styleBadge = { ...styleBadge, background: 'rgba(239, 68, 68, 0.12)', color: 'hsl(0, 75%, 48%)', border: '1px solid rgba(239, 68, 68, 0.3)' };
        } else if (row.status === 'RETRABALHO') {
          styleBadge = { ...styleBadge, background: 'rgba(245, 158, 11, 0.12)', color: 'hsl(35, 85%, 40%)', border: '1px solid rgba(245, 158, 11, 0.3)' };
        } else if (row.status?.startsWith('EM_')) {
          styleBadge = { ...styleBadge, background: 'rgba(6, 182, 212, 0.12)', color: 'hsl(190, 85%, 32%)', border: '1px solid rgba(6, 182, 212, 0.3)' };
        }
        return <span style={styleBadge}>{row.status}</span>;
      },
    },
    {
      key: 'lens_model_name',
      label: 'Lente / Produto',
      render: (row) => (
        <span style={{ color: 'hsl(var(--text-primary))', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
          {row.lens_model_name || '-'}
        </span>
      ),
    },
    {
      key: 'lead_time_hours',
      label: 'Lead Time',
      align: 'right',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
          {row.lead_time_hours !== null && row.lead_time_hours !== undefined ? `${row.lead_time_hours}h` : '-'}
        </span>
      ),
    },
    {
      key: 'total_amount',
      label: 'Valor Total',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 800, color: 'hsl(142, 75%, 32%)', fontFamily: 'monospace' }}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.total_amount || 0)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Data/Hora',
      render: (row) => (
        <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>
          {new Date(row.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de Filtros e Seletores */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <ReportDatePresets
          defaultPreset="thisMonth"
          onDateChange={(newDates) => setDates(newDates)}
          style={{ flex: 1 }}
        />

        <div 
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '14px',
            padding: '8px 14px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
          }}
        >
          {/* Filtro Rota */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            style={{
              background: 'rgba(248, 250, 252, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Todas as Rotas</option>
            <option value="EXPRESSA_FACETAMENTO">Expressa (Facetamento)</option>
            <option value="SURFACAGEM_CNC">Surfaçagem CNC</option>
          </select>

          {/* Filtro Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              background: 'rgba(248, 250, 252, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_SURFACAGEM">Em Surfaçagem</option>
            <option value="EM_TRATAMENTO">Em Tratamento</option>
            <option value="EM_MONTAGEM">Em Montagem</option>
            <option value="EM_CQ">Em CQ</option>
            <option value="PRONTA">Pronta</option>
            <option value="ENTREGUE">Entregue</option>
            <option value="RETRABALHO">Retrabalho</option>
            <option value="BLOQUEADA_FINANCEIRO">Bloqueada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>

          {/* Filtro Ótica */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            style={{
              background: 'rgba(248, 250, 252, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              maxWidth: '180px',
              cursor: 'pointer'
            }}
          >
            <option value="">Todas as Óticas</option>
            {opticalStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.trade_name || s.corporate_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadData}
            title="Atualizar"
            className="btn btn-secondary"
            style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid de KPIs */}
      <ReportKPICards cards={kpiCards} columns={5} />

      {/* Tabela MES */}
      <ReportTable
        title="Ordens de Serviço no Período (MES)"
        columns={columns}
        data={reportData?.orders || []}
        loading={loading}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
}
