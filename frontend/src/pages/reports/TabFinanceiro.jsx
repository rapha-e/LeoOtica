import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, PieChart, AlertOctagon, TrendingUp, TrendingDown, 
  FileText, ShieldCheck, Lock, FileSpreadsheet, RefreshCw, Calendar
} from 'lucide-react';
import { ReportService, OpticalStoreService } from '../../services/api';
import { downloadBlob } from '../../utils/exportHelper';
import ReportDatePresets, { getPresetDates } from '../../components/reports/ReportDatePresets';
import ReportKPICards from '../../components/reports/ReportKPICards';
import ReportTable from '../../components/reports/ReportTable';

export default function TabFinanceiro({ currentUser }) {
  const [subTab, setSubTab] = useState('dre'); // 'dre' | 'aging'
  const defaultDates = getPresetDates('thisMonth') || { startDate: '', endDate: '' };
  const [dates, setDates] = useState(defaultDates);
  const [storeFilter, setStoreFilter] = useState('');
  const [opticalStores, setOpticalStores] = useState([]);

  const [loading, setLoading] = useState(false);
  const [dreData, setDreData] = useState(null);
  const [agingData, setAgingData] = useState(null);

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role?.name === 'Administrador';

  useEffect(() => {
    if (isAdmin && subTab === 'aging') {
      OpticalStoreService.list('', true, 0, 200)
        .then((res) => setOpticalStores(res.data?.items || res.data || []))
        .catch((err) => console.error('Erro ao buscar óticas:', err));
    }
  }, [isAdmin, subTab]);

  const loadDRE = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = {
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
      };
      const res = await ReportService.getFinancialDRE(params);
      setDreData(res.data);
    } catch (err) {
      console.error('Erro ao carregar DRE:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dates]);

  const loadAging = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = {
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.getFinancialAging(params);
      setAgingData(res.data);
    } catch (err) {
      console.error('Erro ao carregar Aging List:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, storeFilter]);

  useEffect(() => {
    if (subTab === 'dre') {
      loadDRE();
    } else {
      loadAging();
    }
  }, [subTab, loadDRE, loadAging]);

  if (!isAdmin) {
    return (
      <div 
        className="glass-panel" 
        style={{
          padding: '60px 40px',
          textAlign: 'center',
          maxWidth: '560px',
          margin: '40px auto',
          borderLeft: '4px solid hsl(0, 75%, 48%)'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'hsl(0, 75%, 48%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            border: '1px solid rgba(239, 68, 68, 0.25)'
          }}
        >
          <Lock size={28} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>
          Acesso Restrito à Controladoria
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
          Os relatórios financeiros corporativos, Demonstrativo do Resultado do Exercício (DRE) e Aging List de Inadimplência são restritos exclusivamente ao perfil de <strong style={{ color: 'hsl(var(--text-primary))' }}>Administrador</strong>.
        </p>
      </div>
    );
  }

  const handleExportDREPdf = async () => {
    try {
      const params = {
        report_type: 'dre',
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
      };
      const res = await ReportService.exportPdf(params);
      const filename = `relatorio_dre_${dates.startDate}_a_${dates.endDate}.pdf`;
      downloadBlob(res.data, filename, 'application/pdf');
    } catch (err) {
      alert('Erro ao gerar DRE em PDF.');
      console.error(err);
    }
  };

  const handleExportDREExcel = async () => {
    try {
      const params = {
        report_type: 'dre',
        start_date: dates.startDate || undefined,
        end_date: dates.endDate || undefined,
      };
      const res = await ReportService.exportExcel(params);
      const filename = `dre_gerencial_${dates.startDate}_a_${dates.endDate}.xlsx`;
      downloadBlob(res.data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Erro ao gerar DRE em Excel.');
      console.error(err);
    }
  };

  const handleExportAgingPdf = async () => {
    try {
      const params = {
        report_type: 'aging',
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.exportPdf(params);
      const filename = `aging_list_inadimplencia_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(res.data, filename, 'application/pdf');
    } catch (err) {
      alert('Erro ao gerar Aging em PDF.');
      console.error(err);
    }
  };

  const handleExportAgingExcel = async () => {
    try {
      const params = {
        report_type: 'aging',
        optical_store_id: storeFilter || undefined,
      };
      const res = await ReportService.exportExcel(params);
      const filename = `aging_list_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(res.data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert('Erro ao gerar Aging em Excel.');
      console.error(err);
    }
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const dreKPICards = [
    {
      label: 'Receita Líquida',
      value: fmt(dreData?.net_revenue),
      subtitle: 'Faturamento bruto deduções',
      icon: <DollarSign size={20} />,
      color: 'emerald',
    },
    {
      label: 'CMV Total (Insumos)',
      value: fmt(dreData?.cmv_total),
      subtitle: 'Custo de mercadorias consumidas',
      icon: <TrendingDown size={20} />,
      color: 'amber',
    },
    {
      label: 'Lucro Bruto',
      value: fmt(dreData?.gross_profit),
      subtitle: `Margem Bruta: ${dreData?.gross_margin_pct || 0}%`,
      icon: <TrendingUp size={20} />,
      color: 'sky',
    },
    {
      label: 'Resultado Líquido do Exercício',
      value: fmt(dreData?.net_profit),
      subtitle: `Margem Líquida: ${dreData?.net_margin_pct || 0}%`,
      icon: <PieChart size={20} />,
      color: (dreData?.net_profit || 0) >= 0 ? 'emerald' : 'rose',
      trend: `${dreData?.net_margin_pct || 0}% líquido`,
      trendType: (dreData?.net_profit || 0) >= 0 ? 'positive' : 'negative',
    },
  ];

  const dreColumns = [
    {
      key: 'account_code',
      label: 'Conta',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: row.is_group ? 800 : 500, color: row.is_group ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))' }}>
          {row.account_code}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Descrição Contábil',
      render: (row) => (
        <span style={{ fontWeight: row.is_group ? 800 : 500, color: row.is_group ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))', paddingLeft: row.is_group ? '0' : '14px' }}>
          {row.description}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Valor (R$)',
      align: 'right',
      render: (row) => {
        const isNeg = row.is_negative;
        let color = row.is_group ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))';
        if (isNeg) color = 'hsl(0, 75%, 48%)';
        return (
          <span style={{ fontFamily: 'monospace', fontWeight: row.is_group ? 800 : 600, color }}>
            {isNeg ? `(${fmt(row.amount)})` : fmt(row.amount)}
          </span>
        );
      },
    },
    {
      key: 'percentage',
      label: '% Rec. Líq.',
      align: 'right',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-muted))' }}>
          {row.percentage !== null && row.percentage !== undefined ? `${row.percentage}%` : '-'}
        </span>
      ),
    },
  ];

  const agingSummary = agingData?.summary || agingData || {};
  const agingKPICards = [
    {
      label: 'Total a Receber',
      value: fmt(agingSummary.total_receivable),
      subtitle: 'Contas a receber pendentes',
      icon: <DollarSign size={20} />,
      color: 'sky',
    },
    {
      label: 'Total Vencido (Inadimplente)',
      value: fmt(agingSummary.total_overdue),
      subtitle: 'Títulos com data vencida',
      icon: <AlertOctagon size={20} />,
      color: 'rose',
      trendType: (agingSummary.total_overdue || 0) > 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Total a Vencer (No Prazo)',
      value: fmt(agingSummary.total_to_mature),
      subtitle: 'Fluxo futuro previsto',
      icon: <ShieldCheck size={20} />,
      color: 'emerald',
    },
    {
      label: 'Taxa de Inadimplência',
      value: `${agingSummary.delinquency_rate_pct || 0}%`,
      subtitle: 'Proporção vencida sobre a carteira',
      icon: <TrendingDown size={20} />,
      color: 'amber',
    },
  ];

  const agingColumns = [
    {
      key: 'store_name',
      label: 'Ótica Cliente',
      render: (row) => (
        <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{row.store_name}</div>
      ),
    },
    {
      key: 'document_number',
      label: 'Nº Título / Fatura',
      render: (row) => <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-secondary))' }}>{row.document_number}</span>,
    },
    {
      key: 'due_date',
      label: 'Vencimento',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-secondary))' }}>
          {new Date(row.due_date).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'days_overdue',
      label: 'Atraso',
      align: 'center',
      render: (row) => {
        if (row.days_overdue > 0) {
          return (
            <span 
              style={{
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(0, 75%, 48%)',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              {row.days_overdue} dias
            </span>
          );
        }
        return <span style={{ color: 'hsl(142, 75%, 32%)', fontWeight: 700 }}>No Prazo</span>;
      },
    },
    {
      key: 'aging_bucket',
      label: 'Faixa Aging',
      render: (row) => {
        const labels = {
          A_VENCER: 'A Vencer',
          '1_15': '1-15 dias',
          '16_30': '16-30 dias',
          '31_60': '31-60 dias',
          '60_MAIS': '+60 dias',
        };
        return <span style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{labels[row.aging_bucket] || row.aging_bucket}</span>;
      },
    },
    {
      key: 'amount',
      label: 'Valor Nominal',
      align: 'right',
      render: (row) => <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-secondary))' }}>{fmt(row.amount)}</span>,
    },
    {
      key: 'amount_paid',
      label: 'Valor Pago',
      align: 'right',
      render: (row) => <span style={{ fontFamily: 'monospace', color: 'hsl(142, 75%, 32%)', fontWeight: 600 }}>{fmt(row.amount_paid)}</span>,
    },
    {
      key: 'balance_due',
      label: 'Saldo Devedor',
      align: 'right',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'hsl(0, 75%, 48%)' }}>
          {fmt(row.balance_due)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-navegação do Financeiro */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
          paddingBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSubTab('dre')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: subTab === 'dre' ? '1px solid hsl(var(--primary))' : '1px solid rgba(226, 232, 240, 0.9)',
              background: subTab === 'dre' ? 'hsl(var(--primary))' : '#ffffff',
              color: subTab === 'dre' ? '#ffffff' : 'hsl(var(--text-secondary))',
              boxShadow: subTab === 'dre' ? '0 2px 8px rgba(147, 51, 234, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <PieChart size={15} />
            <span>Demonstração de Resultado (DRE)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('aging')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: subTab === 'aging' ? '1px solid hsl(var(--primary))' : '1px solid rgba(226, 232, 240, 0.9)',
              background: subTab === 'aging' ? 'hsl(var(--primary))' : '#ffffff',
              color: subTab === 'aging' ? '#ffffff' : 'hsl(var(--text-secondary))',
              boxShadow: subTab === 'aging' ? '0 2px 8px rgba(147, 51, 234, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertOctagon size={15} />
            <span>Aging List (Inadimplência)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={subTab === 'dre' ? loadDRE : loadAging}
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

      {/* DRE */}
      {subTab === 'dre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ReportDatePresets
            defaultPreset="thisMonth"
            onDateChange={(newDates) => setDates(newDates)}
          />

          <ReportKPICards cards={dreKPICards} columns={4} />

          <ReportTable
            title="Demonstrativo do Resultado do Exercício (DRE Gerencial)"
            columns={dreColumns}
            data={dreData?.dre_statement || []}
            loading={loading}
            onExportPdf={handleExportDREPdf}
            onExportExcel={handleExportDREExcel}
            initialPageSize={50}
          />
        </div>
      )}

      {/* Aging List */}
      {subTab === 'aging' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              padding: '12px 18px',
              borderRadius: '14px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
              Filtrar Ótica Cliente:
            </span>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              style={{
                background: 'rgba(248, 250, 252, 0.9)',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                color: 'hsl(var(--text-primary))',
                fontWeight: 600,
                outline: 'none',
                maxWidth: '280px',
                cursor: 'pointer'
              }}
            >
              <option value="">Todas as Óticas em Aberto</option>
              {opticalStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.trade_name || s.corporate_name}
                </option>
              ))}
            </select>
          </div>

          <ReportKPICards cards={agingKPICards} columns={4} />

          {/* Cards de Resumo por Faixa */}
          {agingData?.bucket_summaries && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {agingData.bucket_summaries.map((b) => (
                <div 
                  key={b.bucket} 
                  className="glass-panel" 
                  style={{ padding: '14px 16px', background: 'rgba(255, 255, 255, 0.9)' }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'hsl(var(--text-primary))', marginTop: '4px' }}>
                    {fmt(b.total_amount)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
                    {b.count} {b.count === 1 ? 'título' : 'títulos'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <ReportTable
            title="Aging List de Títulos em Aberto (Contas a Receber)"
            columns={agingColumns}
            data={agingData?.titles || []}
            loading={loading}
            onExportPdf={handleExportAgingPdf}
            onExportExcel={handleExportAgingExcel}
            initialPageSize={25}
          />
        </div>
      )}
    </div>
  );
}
