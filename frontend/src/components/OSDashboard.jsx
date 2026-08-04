import React, { useEffect, useState } from 'react';
import api, { OSService } from '../services/api';
import { DollarSign, RefreshCw, BarChart2, ShieldAlert, CheckCircle, Activity, Hourglass, FileText } from 'lucide-react';
import FunnelChart from './FunnelChart';
import HeatmapMatrix from './HeatmapMatrix';

const OSDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadKpis();

    const hostname = window.location.hostname;
    const ws = new WebSocket(`ws://${hostname}:8000/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'os_status_updated') {
          console.log("WebSocket (Dashboard): atualização de status detectada, recarregando KPIs...");
          loadKpis();
          setRefreshTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.error("Erro ao ler mensagem do WebSocket no Dashboard:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const loadKpis = async () => {
    setLoading(true);
    try {
      const response = await OSService.getDashboardKpis();
      setKpis(response.data);
    } catch (err) {
      console.error("Erro ao carregar KPIs de OS:", err);
    } finally {
      setLoading(false);
    }
  };


  const handleDownloadPDF = async () => {
    try {
      const url = `${getBaseUrl()}/alerts/export-pdf?lead_time_days=7&safety_days=5&coverage_days=15`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    }
  };

  if (loading && !kpis) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Carregando dados gerenciais...</div>;
  }

  if (!kpis) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
        <p>Não foi possível carregar as métricas do painel.</p>
        <button className="btn btn-primary" onClick={loadKpis} style={{ marginTop: '15px' }}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const {
    total_orders,
    status_distribution,
    financial_loss,
    reprocess_count,
    reproduction_rate,
    average_minutes_by_stage
  } = kpis;

  const activeOrders = 
    (status_distribution["Recebida"] || 0) + 
    (status_distribution["Separação"] || 0) + 
    (status_distribution["Produção"] || 0) + 
    (status_distribution["Montagem"] || 0) + 
    (status_distribution["CQ"] || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      {/* Header do Painel */}
      <div className="glass-panel" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'between', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px' }}>Dashboard do Laboratório & KPIs</h2>
            <p style={{ fontSize: '0.85rem' }}>Acompanhamento de produtividade, gargalos, perdas financeiras e giro de estoque.</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleDownloadPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={16} style={{ color: 'hsl(var(--secondary))' }} /> Exportar Relatório PDF
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => { loadKpis(); setRefreshTrigger(prev => prev + 1); }}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={16} /> Atualizar Indicadores
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="dashboard-grid">
        {/* Card 1: Perda Financeira */}
        <div className="alert-card rupture" style={{ borderLeft: '4px solid hsl(var(--danger))' }}>
          <div className="alert-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Prejuízo Acumulado (Quebras)</span>
            <strong style={{ display: 'block', fontSize: '1.7rem', color: 'white', marginTop: '4px' }}>
              R$ {financial_loss.toFixed(2)}
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              {reprocess_count} lentes quebradas no corte
            </span>
          </div>
        </div>

        {/* Card 2: Taxa de Quebra */}
        <div className="alert-card warning" style={{ borderLeft: '4px solid hsl(var(--warning))' }}>
          <div className="alert-icon-wrapper">
            <ShieldAlert size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Taxa de Quebra / Facetamento</span>
            <strong style={{ display: 'block', fontSize: '1.7rem', color: 'white', marginTop: '4px' }}>
              {reproduction_rate}%
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              Em relação às ordens faturadas
            </span>
          </div>
        </div>

        {/* Card 3: Ordens Ativas */}
        <div className="alert-card" style={{ borderLeft: '4px solid hsl(var(--primary))', background: 'rgba(147, 51, 234, 0.03)' }}>
          <div className="alert-icon-wrapper" style={{ background: 'rgba(147, 51, 234, 0.1)', color: 'hsl(var(--primary))' }}>
            <Activity size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Ordens Ativas (Chão de Fábrica)</span>
            <strong style={{ display: 'block', fontSize: '1.7rem', color: 'white', marginTop: '4px' }}>
              {activeOrders} OSs
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              Total de {total_orders} cadastradas
            </span>
          </div>
        </div>

        {/* Card 4: Concluídos */}
        <div className="alert-card" style={{ borderLeft: '4px solid hsl(var(--success))', background: 'rgba(34, 197, 94, 0.03)' }}>
          <div className="alert-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'hsl(var(--success))' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Ordens Entregues (Expedidas)</span>
            <strong style={{ display: 'block', fontSize: '1.7rem', color: 'white', marginTop: '4px' }}>
              {status_distribution["Expedição"] || 0} OSs
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              Taxa de sucesso: {total_orders > 0 ? (((status_distribution["Expedição"] || 0) / total_orders) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos de Chão de Fábrica e Gargalos de Tempo */}
      <div className="form-grid" style={{ gap: '30px' }}>
        {/* Distribuição Operacional */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart2 size={18} style={{ color: 'hsl(var(--secondary))' }} /> Carga de Trabalho por Bancada
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(status_distribution).map(([statusName, count]) => {
              const maxVal = Math.max(...Object.values(status_distribution), 1);
              const pct = (count / maxVal) * 100;
              
              const statusLabels = {
                RECEBIDA: 'Recebida',
                SEPARACAO: 'Separação',
                PRODUCAO: 'Produção',
                MONTAGEM: 'Montagem',
                CQ: 'CQ',
                EXPEDICAO: 'Expedição',
                CANCELADA: 'Cancelada',
                'Recebida': 'Recebida',
                'Separação': 'Separação',
                'Produção': 'Produção',
                'Montagem': 'Montagem',
                'CQ': 'CQ',
                'Expedição': 'Expedição',
                'Cancelada': 'Cancelada'
              };
              const label = statusLabels[statusName] || statusName;
              
              return (
                <div key={statusName}>
                  <div style={{ display: 'flex', justifyContent: 'between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{count} OS</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${pct}%`, 
                      height: '100%', 
                      background: (statusName === 'CANCELADA' || statusName === 'Cancelada') ? 'hsl(var(--danger))' : (statusName === 'EXPEDICAO' || statusName === 'Expedição') ? 'hsl(var(--success))' : 'hsl(var(--primary))',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gargalos de Tempo */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Hourglass size={18} style={{ color: 'hsl(var(--secondary))' }} /> Tempo Médio de Processamento (Ciclos)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(average_minutes_by_stage).map(([stageName, minutes]) => {
              let displayTime = '';
              if (minutes < 1.0) {
                displayTime = `${(minutes * 60).toFixed(0)} segs`;
              } else if (minutes < 60.0) {
                displayTime = `${minutes.toFixed(1)} mins`;
              } else {
                const hours = Math.floor(minutes / 60);
                const mins = Math.round(minutes % 60);
                displayTime = `${hours}h ${mins}m`;
              }

              return (
                <div key={stageName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'white', display: 'block' }}>{stageName}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Média de trânsito</span>
                  </div>
                  <strong style={{ fontSize: '1rem', color: minutes > 120 ? 'hsl(var(--warning))' : 'hsl(var(--secondary))' }}>
                    {displayTime}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Módulo 3: Funil Logístico (Físico vs Lógico) */}
      <FunnelChart refreshTrigger={refreshTrigger} />

      {/* Módulo 3: Mapa Térmico do Giro da Grade */}
      <HeatmapMatrix refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default OSDashboard;
