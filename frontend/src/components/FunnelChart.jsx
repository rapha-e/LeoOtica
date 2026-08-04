import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Package, Layers } from 'lucide-react';

// Registra módulos do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const FunnelChart = ({ refreshTrigger }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const getBaseUrl = () => {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000/api/v1`;
  };

  useEffect(() => {
    loadFunnelData();
  }, [refreshTrigger]);

  const loadFunnelData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${getBaseUrl()}/analytics/funnel`);
      setData(response.data);
    } catch (err) {
      console.error("Erro ao carregar dados do funil:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: '15px' }}>Carregando dados logísticos...</div>;
  }

  if (!data) return null;

  const total = data.free + data.reserved + data.discarded;

  // 1. Configuração do Gráfico de Funil (Barras Horizontais)
  const barChartData = {
    labels: ['Lentes Livres (Gavetas)', 'Lentes Reservadas (OS)', 'Lentes Descartadas (Quebras)'],
    datasets: [
      {
        label: 'Quantidade de Lentes',
        data: [data.free, data.reserved, data.discarded],
        backgroundColor: [
          'rgba(6, 182, 212, 0.75)',  /* Ciano / Células livres */
          'rgba(168, 85, 247, 0.75)',  /* Roxo / OS em curso */
          'rgba(239, 68, 68, 0.75)'   /* Vermelho / Quebras */
        ],
        borderColor: [
          'rgb(6, 182, 212)',
          'rgb(168, 85, 247)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 1.5,
        borderRadius: 8,
        barThickness: 24,
      },
    ],
  };

  const barChartOptions = {
    indexAxis: 'y', // Inverte para barra horizontal (Funil)
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Oculta legenda redundante
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return ` ${val} unidades (${pct}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
        }
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'white',
          font: {
            weight: 'bold'
          }
        }
      }
    }
  };

  // 2. Configuração do Gráfico Doughnut (Distribuição de Inventário)
  const doughnutData = {
    labels: ['Livres', 'Reservadas', 'Descartadas'],
    datasets: [
      {
        data: [data.free, data.reserved, data.discarded],
        backgroundColor: [
          'rgba(6, 182, 212, 0.5)',
          'rgba(168, 85, 247, 0.5)',
          'rgba(239, 68, 68, 0.5)'
        ],
        borderColor: [
          'rgb(6, 182, 212)',
          'rgb(168, 85, 247)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 1,
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11
          }
        }
      }
    },
    cutout: '65%'
  };

  return (
    <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '20px' }}>
      <h3 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Package size={18} style={{ color: 'hsl(var(--secondary))' }} /> Funil Logístico (Físico vs Lógico)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Gráfico de Barras Horizontal */}
        <div style={{ height: '220px', position: 'relative' }}>
          <Bar data={barChartData} options={barChartOptions} />
        </div>

        {/* Gráfico Doughnut com Resumo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '150px', height: '150px', position: 'relative' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase' }}>Total</span>
              <strong style={{ fontSize: '1.25rem', color: 'white' }}>{total}</strong>
              <span style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))' }}>unids</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgb(6, 182, 212)', marginRight: '6px' }} />
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Disponível: </span>
              <strong style={{ color: 'white' }}>{data.free} unids</strong>
            </div>
            <div>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgb(168, 85, 247)', marginRight: '6px' }} />
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Em Produção: </span>
              <strong style={{ color: 'white' }}>{data.reserved} unids</strong>
            </div>
            <div>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgb(239, 68, 68)', marginRight: '6px' }} />
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Quebras/Descarte: </span>
              <strong style={{ color: 'white' }}>{data.discarded} unids</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunnelChart;
