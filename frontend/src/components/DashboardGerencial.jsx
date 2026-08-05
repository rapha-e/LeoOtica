import React, { useEffect, useState } from 'react';
import { AnalyticsService } from '../services/api';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  ArcElement, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { 
  DollarSign, 
  TrendingUp, 
  Store, 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  RefreshCcw, 
  ShoppingCart, 
  ShieldAlert,
  ArrowUpRight,
  TrendingDown,
  ExternalLink
} from 'lucide-react';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  ArcElement, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
);

const DashboardGerencial = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isManual = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await AnalyticsService.getDashboardAnalytics();
      setData(response.data);
      if (isManual) {
        showToast("Dados do Dashboard Gerencial atualizados com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao carregar dados do painel gerencial:", err);
      setError("Não foi possível carregar os dados consolidados do painel gerencial. Por favor, tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', minHeight: '400px' }}>
        <RefreshCcw className="animate-spin" size={40} style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
        <p style={{ color: 'hsl(var(--text-secondary))', fontWeight: '500' }}>Consolidando indicadores de vendas, produção e estoque...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', border: '1px solid hsl(var(--danger) / 0.3)', background: 'hsl(var(--danger) / 0.02)' }}>
        <ShieldAlert size={48} style={{ color: 'hsl(var(--danger))', marginBottom: '16px' }} />
        <h3 style={{ color: 'white', marginBottom: '8px' }}>Erro de Conexão</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px auto' }}>{error}</p>
        <button className="btn btn-primary" onClick={loadDashboardData} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
          <RefreshCcw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { comercial, producao, estoque } = data;

  // --- CONFIGURAÇÕES DOS GRÁFICOS ---

  // 1. Gráfico de Linha (Faturamento)
  // Como temos os dados consolidados (Pago e Pendente), criamos uma evolução com o total acumulado
  const lineChartData = {
    labels: ['Inicial', 'Faturamento Pago', 'Faturamento Pendente', 'Faturamento Total'],
    datasets: [
      {
        label: 'Consolidado Financeiro (R$)',
        data: [0, comercial.faturamento_pago, comercial.faturamento_pendente, comercial.faturamento],
        fill: true,
        backgroundColor: 'rgba(147, 51, 234, 0.1)', /* Roxo com opacidade */
        borderColor: 'rgb(147, 51, 234)',
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: 'rgb(147, 51, 234)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${formatCurrency(context.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: 'hsl(var(--text-secondary))',
          font: { family: 'Outfit', size: 11 }
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: 'hsl(var(--text-secondary))',
          callback: (value) => `R$ ${value}`,
          font: { family: 'Outfit', size: 10 }
        }
      }
    }
  };

  // 2. Gráfico de Rosca (Status de OS)
  const doughnutChartData = {
    labels: ['OS Abertas (Esteira)', 'OS Concluídas (Expedição)'],
    datasets: [
      {
        data: [producao.os_abertas, producao.os_concluidas],
        backgroundColor: [
          'rgba(245, 158, 11, 0.75)', /* Laranja / Abertas */
          'rgba(16, 185, 129, 0.75)'  /* Verde / Concluídas */
        ],
        borderColor: [
          'rgb(245, 158, 11)',
          'rgb(16, 185, 129)'
        ],
        borderWidth: 1.5
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'hsl(var(--text-secondary))',
          font: { family: 'Outfit', size: 11, weight: '500' },
          padding: 15
        }
      }
    },
    cutout: '70%'
  };

  // 3. Gráfico de Barras (Saúde do Estoque)
  const totalDioptriasSaudaveis = Math.max(0, estoque.total_stock_qty - estoque.rupturas);
  const barChartData = {
    labels: ['Estoque Saudável', 'Dioptrias em Ruptura', 'Alertas de Compra'],
    datasets: [
      {
        label: 'Quantidade de Lentes',
        data: [totalDioptriasSaudaveis, estoque.rupturas, estoque.compras],
        backgroundColor: [
          'rgba(6, 182, 212, 0.75)',  /* Ciano / Saudável */
          'rgba(239, 68, 68, 0.75)',   /* Vermelho / Ruptura */
          'rgba(168, 85, 247, 0.75)'   /* Roxo / Compras sugeridas */
        ],
        borderColor: [
          'rgb(6, 182, 212)',
          'rgb(239, 68, 68)',
          'rgb(168, 85, 247)'
        ],
        borderWidth: 1.5,
        borderRadius: 6,
        barThickness: 32
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: 'hsl(var(--text-secondary))',
          font: { family: 'Outfit', size: 11, weight: '600' }
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: 'hsl(var(--text-secondary))',
          font: { family: 'Outfit', size: 11 }
        }
      }
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toastMessage}
        </div>
      )}
      {/* Header do Painel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '28px', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: 'hsl(var(--text-primary))', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Dashboard Gerencial
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
            Painel consolidado com a saúde financeira, esteira de produção e cadeia de suprimentos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 16px',
              borderRadius: '10px'
            }}
          >
            <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
        </div>
      </div>


      {/* Grid de Seções de KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* Bloco 1: COMERCIAL */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('billing')}
          style={{ borderLeft: '4px solid hsl(142, 75%, 35%)', cursor: 'pointer', transition: 'all 0.2s' }}
          title="Clique para acessar Fechamento Financeiro"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} style={{ color: 'hsl(142, 75%, 35%)' }} /> Saúde Comercial
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: 'hsl(142, 75%, 35%)' }}>
              Período 30d ➔
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Faturamento Geral:</span>
              <strong style={{ color: 'hsl(var(--text-primary))', fontSize: '1.1rem' }}>{formatCurrency(comercial.faturamento)}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Faturamento Pago:</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <ArrowUpRight size={12} /> Recebido
                </span>
              </div>
              <strong style={{ color: 'hsl(var(--success))', fontSize: '1.05rem' }}>{formatCurrency(comercial.faturamento_pago)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Saldo Pendente:</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--warning))', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Clock size={12} /> A Faturar/Vencer
                </span>
              </div>
              <strong style={{ color: 'hsl(var(--warning))', fontSize: '1.05rem' }}>{formatCurrency(comercial.faturamento_pendente)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Ticket Médio por OS:</span>
              <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.1rem' }}>{formatCurrency(comercial.ticket_medio)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Store size={16} /> Óticas Ativas no Sistema:
              </span>
              <strong style={{ color: 'white', background: 'hsl(var(--primary))', padding: '2px 10px', borderRadius: '20px', fontSize: '0.9rem' }}>
                {comercial.oticas_ativas} lojas
              </strong>
            </div>
          </div>
        </div>

        {/* Bloco 2: PRODUÇÃO */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('os-workflow')}
          style={{ borderLeft: '4px solid hsl(35, 85%, 40%)', cursor: 'pointer', transition: 'all 0.2s' }}
          title="Clique para acessar a Esteira de Produção de OS"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'hsl(35, 85%, 40%)' }} /> Esteira de Produção
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: 'rgba(217, 119, 6, 0.1)', color: 'hsl(35, 85%, 40%)' }}>
              Fábrica Ativa ➔
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>OS em Andamento:</span>
              <strong style={{ color: 'hsl(var(--warning))', fontSize: '1.1rem' }}>{producao.os_abertas} abertas</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>OS Finalizadas (Expedidas):</span>
              <strong style={{ color: 'hsl(var(--success))', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> {producao.os_concluidas} concluídas
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>SLA Médio da Fábrica:</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Tempo de ciclo da triagem ao envio</span>
              </div>
              <strong style={{ color: 'hsl(var(--text-primary))', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={16} style={{ color: 'hsl(var(--primary))' }} /> {producao.sla_average_days > 0 ? `${producao.sla_average_days.toFixed(1)} dias` : 'Sem dados'}
              </strong>
            </div>

            <div style={{ padding: '10px', background: 'rgba(217, 119, 6, 0.03)', border: '1px dashed rgba(217, 119, 6, 0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
              <strong>Nota do Chão de Fábrica:</strong> O SLA médio é calculated com base nas OSs entregues nos últimos 30 dias, comparando a data de recebimento do pedido com a saída para expedição.
            </div>
          </div>
        </div>

        {/* Bloco 3: ESTOQUE */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('alerts')}
          style={{ borderLeft: '4px solid hsl(190, 85%, 35%)', cursor: 'pointer', transition: 'all 0.2s' }}
          title="Clique para acessar Alertas e Saúde do Estoque"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCcw size={18} style={{ color: 'hsl(190, 85%, 35%)' }} /> Logística de Estoque
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.1)', color: 'hsl(190, 85%, 35%)' }}>
              Giro de Lentes ➔
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Rupturas (Itens Zerados):</span>
                <span style={{ fontSize: '0.75rem', color: estoque.rupturas > 0 ? 'hsl(var(--danger))' : 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {estoque.rupturas > 0 ? 'Requer atenção imediata' : 'Nível saudável'}
                </span>
              </div>
              <strong style={{ color: estoque.rupturas > 0 ? 'hsl(var(--danger))' : 'hsl(var(--success))', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {estoque.rupturas > 0 && <AlertOctagon size={16} />} {estoque.rupturas} dioptrias
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Giro de Estoque (30d):</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Consumo vs Estoque físico</span>
              </div>
              <strong style={{ color: 'hsl(var(--text-primary))', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {estoque.giro > 0 ? (
                  <>
                    {estoque.giro > 0.1 ? <TrendingUp size={16} style={{ color: 'hsl(var(--success))' }} /> : <TrendingDown size={16} style={{ color: 'hsl(var(--warning))' }} />}
                    {(estoque.giro * 100).toFixed(2)}% ao mês
                  </>
                ) : '0.00%'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Sugestões de Compra Ativas:</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Calculadas pelo motor preditivo</span>
              </div>
              <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShoppingCart size={16} /> {estoque.compras} itens
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Estoque Físico Total:</span>
              <strong style={{ color: 'hsl(var(--text-primary))', fontSize: '1rem' }}>{estoque.total_stock_qty} unidades</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Painel de Gráficos Analíticos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* Gráfico 1: Evolução Financeira */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('billing')}
          style={{ height: '350px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
          title="Clique para abrir Fechamento Financeiro e Faturamento"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: 'hsl(var(--primary))' }} /> Evolução Financeira Consolidada
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--primary))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver Faturamento <ExternalLink size={14} />
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Gráfico 2: Saúde do Estoque e Alertas */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('alerts')}
          style={{ height: '350px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
          title="Clique para abrir Saúde do Estoque e Alertas Preditivos"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} style={{ color: 'hsl(190, 85%, 35%)' }} /> Saúde do Estoque & Alertas Preditivos
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'hsl(190, 85%, 35%)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver Alertas <ExternalLink size={14} />
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

        {/* Gráfico 3: Distribuição da Esteira (Status de OS) */}
        <div 
          className="glass-panel" 
          onClick={() => onNavigate && onNavigate('os-workflow')}
          style={{ height: '320px', display: 'flex', flexDirection: 'column', gridColumn: 'span 1', cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
          title="Clique para abrir a Esteira de Produção de OS na Fábrica"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'hsl(35, 85%, 40%)' }} /> Distribuição de Status de OS na Fábrica
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'hsl(35, 85%, 40%)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver Esteira <ExternalLink size={14} />
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '220px', height: '220px', position: 'relative' }}>
              <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
              <div style={{
                position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Ordens</span>
                <strong style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>{producao.os_abertas + producao.os_concluidas}</strong>
                <span style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', display: 'block' }}>totais</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quadro Informativo Adicional */}
        <div className="glass-panel" style={{ height: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--text-primary))', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} style={{ color: 'hsl(142, 75%, 35%)' }} /> Resumo do Planejamento Gerencial
          </h3>
          <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Este painel consolida em tempo real dados transacionais e de fluxo logístico de forma a auxiliar nas decisões de compras e faturamento da fábrica Nova Lab.
            </p>
            <div 
              onClick={() => onNavigate && onNavigate('billing')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(147, 51, 234, 0.04)', border: '1px solid rgba(147, 51, 234, 0.18)', borderRadius: '8px', transition: 'all 0.2s' }}
              title="Clique para ir para Fechamento Financeiro"
            >
              <span style={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}>Comercial:</span>
              <span style={{ flex: 1 }}>Monitoramento do faturamento líquido e do ticket médio das OSs.</span>
              <span style={{ fontSize: '0.78rem', color: 'hsl(var(--primary))', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                Acessar ➔
              </span>
            </div>
            <div 
              onClick={() => onNavigate && onNavigate('os-workflow')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(217, 119, 6, 0.04)', border: '1px solid rgba(217, 119, 6, 0.18)', borderRadius: '8px', transition: 'all 0.2s' }}
              title="Clique para ir para Esteira de Produção de OS"
            >
              <span style={{ color: 'hsl(35, 85%, 40%)', fontWeight: 'bold' }}>Produção:</span>
              <span style={{ flex: 1 }}>Visualização da velocidade de escoamento e SLA médio da fábrica.</span>
              <span style={{ fontSize: '0.78rem', color: 'hsl(35, 85%, 40%)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                Acessar ➔
              </span>
            </div>
            <div 
              onClick={() => onNavigate && onNavigate('alerts')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(6, 182, 212, 0.04)', border: '1px solid rgba(6, 182, 212, 0.18)', borderRadius: '8px', transition: 'all 0.2s' }}
              title="Clique para ir para Alertas & Estoque"
            >
              <span style={{ color: 'hsl(190, 85%, 35%)', fontWeight: 'bold' }}>Estoque:</span>
              <span style={{ flex: 1 }}>Previsão de rupturas e cálculo de compras automáticas.</span>
              <span style={{ fontSize: '0.78rem', color: 'hsl(190, 85%, 35%)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                Acessar ➔
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};


export default DashboardGerencial;

