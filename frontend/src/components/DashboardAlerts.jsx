import React, { useEffect, useState } from 'react';
import { AlertService } from '../services/api';
import { AlertOctagon, TrendingDown, CheckSquare, Download, Settings2, BarChart2 } from 'lucide-react';

const DashboardAlerts = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leadTime, setLeadTime] = useState(7);
  const [safetyDays, setSafetyDays] = useState(5);
  const [coverageDays, setCoverageDays] = useState(15);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedModalStatus, setSelectedModalStatus] = useState(null); // 'RUPTURA', 'ALERTA', 'NORMAL' ou null


  useEffect(() => {
    loadPredictions();
  }, [leadTime, safetyDays, coverageDays]);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const response = await AlertService.getPredictions(leadTime, safetyDays, coverageDays);
      setPredictions(response.data);
    } catch (err) {
      console.error("Erro ao carregar dados preditivos:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSummary = () => {
    const ruptureCount = predictions.filter(p => p.status === 'RUPTURA').length;
    const alertCount = predictions.filter(p => p.status === 'ALERTA').length;
    const normalCount = predictions.filter(p => p.status === 'NORMAL').length;
    const purchaseRecommendations = predictions.filter(p => p.suggested_purchase > 0).length;

    return { ruptureCount, alertCount, normalCount, purchaseRecommendations };
  };

  const { ruptureCount, alertCount, normalCount, purchaseRecommendations } = getSummary();

  const handleDownloadPdf = async () => {
    try {
      const response = await AlertService.exportPdf(leadTime, safetyDays, coverageDays);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error("Erro ao baixar PDF:", err);
    }
  };

  // Filtra itens sugeridos para compras
  const purchaseSuggestions = predictions.filter(p => p.suggested_purchase > 0);

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'between', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px' }}>Motor Preditivo & Reposição de Estoque</h2>
          <p style={{ fontSize: '0.85rem' }}>Projeção inteligente de consumo baseada nas saídas físicas diárias.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowConfig(!showConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Settings2 size={16} /> Configurações do Motor
          </button>
          
          <button 
            className="btn btn-accent btn-sm" 
            onClick={handleDownloadPdf}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} /> Exportar Pedido PDF
          </button>
        </div>
      </div>

      {/* Painel de Configurações das Variáveis do Lead Time */}
      {showConfig && (
        <div className="glass-panel" style={{ background: 'rgba(3, 7, 18, 0.4)', marginBottom: '24px', padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings2 size={16} style={{ color: 'hsl(var(--primary))' }} /> Parâmetros de Cálculo da Cadeia de Suprimentos
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Lead Time do Fornecedor (Dias)</label>
              <input 
                type="number" 
                className="form-control" 
                value={leadTime} 
                onChange={(e) => setLeadTime(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Dias necessários desde o pedido até a entrega física.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Estoque de Segurança (Dias)</label>
              <input 
                type="number" 
                className="form-control" 
                value={safetyDays} 
                onChange={(e) => setSafetyDays(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Dias de estoque de reserva para amortecer picos de consumo.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Dias de Cobertura de Pedido</label>
              <input 
                type="number" 
                className="form-control" 
                value={coverageDays} 
                onChange={(e) => setCoverageDays(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Prazo de consumo para o qual a quantidade comprada deve durar.</span>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="dashboard-grid" style={{ marginBottom: '30px' }}>
        <div 
          className="alert-card rupture" 
          onClick={() => setSelectedModalStatus('RUPTURA')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div className="alert-icon-wrapper">
            <AlertOctagon size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Dioptrias em Ruptura (Zeradas)</span>
            <strong style={{ display: 'block', fontSize: '1.6rem', color: 'white', marginTop: '4px' }}>{ruptureCount}</strong>
            <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>Clique para ver lentes ➔</span>
          </div>
        </div>

        <div 
          className="alert-card warning"
          onClick={() => setSelectedModalStatus('ALERTA')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div className="alert-icon-wrapper">
            <TrendingDown size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Dioptrias com Ruptura Próxima</span>
            <strong style={{ display: 'block', fontSize: '1.6rem', color: 'white', marginTop: '4px' }}>{alertCount}</strong>
            <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 700 }}>Clique para ver lentes ➔</span>
          </div>
        </div>

        <div 
          className="alert-card" 
          onClick={() => setSelectedModalStatus('NORMAL')}
          style={{ borderLeft: '4px solid hsl(var(--success))', background: 'rgba(34, 197, 94, 0.03)', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div className="alert-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'hsl(var(--success))' }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Dioptrias com Nível Seguro</span>
            <strong style={{ display: 'block', fontSize: '1.6rem', color: 'white', marginTop: '4px' }}>{normalCount}</strong>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Clique para ver lentes ➔</span>
          </div>
        </div>
      </div>


      {/* Sugestões Semanais de Compras */}
      <div>
        <h3 style={{ fontSize: '1.1rem', color: 'white', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BarChart2 size={18} style={{ color: 'hsl(var(--secondary))' }} /> Sugestões Semanais de Compra ({purchaseRecommendations} itens)
        </h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>Processando taxas de saída do estoque...</div>
        ) : purchaseSuggestions.length > 0 ? (
          <div className="grid-container">
            <table className="optical-grid" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '15px' }}>Modelo da Lente</th>
                  <th>Dioptria (Esf / Cil)</th>
                  <th>Estoque Atual</th>
                  <th>Consumo Diário (30d)</th>
                  <th>Ponto Ressuprimento (ROP)</th>
                  <th>Status</th>
                  <th style={{ color: 'hsl(var(--secondary))' }}>Comprar (Unidades)</th>
                </tr>
              </thead>
              <tbody>
                {purchaseSuggestions.map((item) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'left', paddingLeft: '15px', color: 'white' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', background: item.item_type === 'BLOCO' ? 'rgba(147,51,234,0.3)' : 'rgba(37,99,235,0.3)', color: item.item_type === 'BLOCO' ? '#c084fc' : '#60a5fa', marginRight: '8px' }}>
                        {item.item_type || 'LENTE'}
                      </span>
                      {item.brand} | {item.material} | Ind {item.refractive_index ? parseFloat(item.refractive_index).toFixed(2) : ''} | {item.treatment}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {item.spherical > 0 ? `+${item.spherical.toFixed(2)}` : item.spherical.toFixed(2)} Esf / {item.cylindrical.toFixed(2)} Cil
                    </td>
                    <td style={{ color: item.quantity_available === 0 ? 'hsl(var(--danger))' : 'white' }}>
                      {item.quantity_available}
                    </td>
                    <td>{item.daily_consumption_rate.toFixed(3)}/dia</td>
                    <td>{item.reorder_point.toFixed(1)}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: item.status === 'RUPTURA' ? 'hsl(var(--danger) / 0.2)' : 'hsl(var(--warning) / 0.2)',
                        color: item.status === 'RUPTURA' ? 'hsl(var(--danger))' : 'hsl(var(--warning))'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'hsl(var(--secondary))' }}>
                      + {item.suggested_purchase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
            <p>Excelente! Não há recomendações de compra no momento. Todas as dioptrias possuem estoques seguros baseados nos critérios atuais.</p>
          </div>
        )}
      </div>

      {/* Modal Interativo de Detalhamento por Categoria de Alerta */}
      {selectedModalStatus && (
        <div className="modal-overlay" onClick={() => setSelectedModalStatus(null)}>
          <div className="modal-content" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={22} style={{ color: selectedModalStatus === 'RUPTURA' ? '#ef4444' : selectedModalStatus === 'ALERTA' ? '#d97706' : '#10b981' }} />
              Dioptrias no Nível: <span style={{ color: selectedModalStatus === 'RUPTURA' ? '#ef4444' : selectedModalStatus === 'ALERTA' ? '#d97706' : '#10b981', fontWeight: 800 }}>{selectedModalStatus}</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Listagem das lentes cadastradas na categoria <strong>{selectedModalStatus}</strong> (Total: {predictions.filter(p => p.status === selectedModalStatus).length} dioptrias).
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Modelo da Lente</th>
                    <th style={{ padding: '10px' }}>Grau (Esf / Cil)</th>
                    <th style={{ padding: '10px' }}>Saldo Atual</th>
                    <th style={{ padding: '10px' }}>Consumo/Dia</th>
                    <th style={{ padding: '10px' }}>Sugestão Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.filter(p => p.status === selectedModalStatus).map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {item.brand} | {item.material} | Ind {item.refractive_index ? parseFloat(item.refractive_index).toFixed(2) : ''} | {item.treatment}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>
                        {item.spherical > 0 ? `+${item.spherical.toFixed(2)}` : item.spherical.toFixed(2)} / {item.cylindrical.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700, color: item.quantity_available === 0 ? '#ef4444' : '#10b981' }}>
                        {item.quantity_available} un
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{item.daily_consumption_rate ? item.daily_consumption_rate.toFixed(2) : '0.00'}/dia</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#ec4899' }}>
                        +{item.suggested_purchase || 0} un
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedModalStatus(null)}>
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default DashboardAlerts;
