import React, { useState, useEffect } from 'react';
import { 
  BarChart3, DollarSign, Package, Factory, ShoppingCart, TrendingUp, 
  AlertTriangle, RefreshCw, Clock, CheckCircle, ShieldAlert, Cpu, ArrowRight, X
} from 'lucide-react';

export default function DashboardExecutivo({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [finKpis, setFinKpis] = useState(null);
  const [predictiveEngine, setPredictiveEngine] = useState(null);
  const [productionKpis, setProductionKpis] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const [selectedModalStatus, setSelectedModalStatus] = useState(null);
  const [selectedFinCategory, setSelectedFinCategory] = useState(null); // 'RECEBIDOS' | 'VENCIDOS' | 'INADIMPLENCIA' | 'A_PAGAR'

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000/api/v1`;
  };

  const getHeaders = () => {
    const token = localStorage.getItem('factory_token') || localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const baseUrl = getApiBaseUrl();
      const [resFin, resEngine, resProd, resRec, resPay] = await Promise.all([
        fetch(`${baseUrl}/finance-corp/kpis-executive`, { headers }),
        fetch(`${baseUrl}/inventory/predictive-report`, { headers }),
        fetch(`${baseUrl}/os/dashboard/kpis`, { headers }),
        fetch(`${baseUrl}/finance-corp/receivables`, { headers }),
        fetch(`${baseUrl}/finance-corp/payables`, { headers })
      ]);

      if (resFin.ok) setFinKpis(await resFin.json());
      if (resEngine.ok) setPredictiveEngine(await resEngine.json());
      if (resProd.ok) setProductionKpis(await resProd.json());
      if (resRec.ok) setReceivables(await resRec.json());
      if (resPay.ok) setPayables(await resPay.json());

      showToast('Dashboard Executivo atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao carregar Dashboard Executivo:', err);
      showToast('Falha ao carregar dados do Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toastMessage}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 style={{ color: '#2563eb' }} size={28} />
            Dashboard Executivo Administrativo
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Visão gerencial em tempo real do Financeiro, Estoque Preditivo (Lentes & Blocos), Produção Fabril e Compras IA.
          </p>
        </div>
        <button onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Atualizando...' : 'Atualizar Dashboard'}
        </button>
      </div>

      {/* Grid Seção 1: Financeiro Executivo (Clicáveis) */}
      {finKpis && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'hsl(var(--text-primary))' }}>
            <DollarSign size={20} color="#2563eb" /> 1. Visão Financeira Corporativa (Clique para Detalhar)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Card 1: Recebimentos */}
            <div 
              onClick={() => setSelectedFinCategory('RECEBIDOS')}
              style={{ background: 'rgba(16,185,129,0.06)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Recebimentos do Mês</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{formatCurrency(finKpis.total_received)}</div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Ver títulos liquidados <ArrowRight size={12} />
              </div>
            </div>

            {/* Card 2: Faturas Vencidas */}
            <div 
              onClick={() => setSelectedFinCategory('VENCIDOS')}
              style={{ background: 'rgba(239,68,68,0.06)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Faturas Vencidas</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{formatCurrency(finKpis.total_overdue)}</div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Ver faturas em atraso <ArrowRight size={12} />
              </div>
            </div>

            {/* Card 3: Taxa de Inadimplência */}
            <div 
              onClick={() => setSelectedFinCategory('INADIMPLENCIA')}
              style={{ background: 'rgba(245,158,11,0.06)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.25)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Taxa de Inadimplência</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>{finKpis.delinquency_rate}%</div>
              <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Ver óticas inadimplentes <ArrowRight size={12} />
              </div>
            </div>

            {/* Card 4: Contas a Pagar */}
            <div 
              onClick={() => setSelectedFinCategory('A_PAGAR')}
              style={{ background: 'rgba(99,102,241,0.06)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>Contas a Pagar Pendentes</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#6366f1', marginTop: '4px' }}>{formatCurrency(finKpis.payables_summary?.total_pending)}</div>
              <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Ver compromissos a liquidar <ArrowRight size={12} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Seção 2: Estoque Preditivo */}
      {predictiveEngine && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'hsl(var(--text-primary))' }}>
            <Package size={20} color="#10b981" /> 2. Motor Preditivo de Estoque & Reposição (Lentes Acabadas & Blocos Semiacabados)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div 
              onClick={() => setSelectedModalStatus('RUPTURA')}
              style={{ background: 'rgba(239,68,68,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>Ruptura (Saldo 0)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444' }}>{predictiveEngine.counts?.RUPTURA || 0} dioptrias</div>
              <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>Clique para detalhar ➔</span>
            </div>

            <div 
              onClick={() => setSelectedModalStatus('CRITICO')}
              style={{ background: 'rgba(245,158,11,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700 }}>Estoque Crítico</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d97706' }}>{predictiveEngine.counts?.CRITICO || 0} dioptrias</div>
              <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 700 }}>Clique para detalhar ➔</span>
            </div>

            <div 
              onClick={() => setSelectedModalStatus('BAIXO')}
              style={{ background: 'rgba(59,130,246,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>Estoque Baixo</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563eb' }}>{predictiveEngine.counts?.BAIXO || 0} dioptrias</div>
              <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>Clique para detalhar ➔</span>
            </div>

            <div 
              onClick={() => setSelectedModalStatus('NORMAL')}
              style={{ background: 'rgba(16,185,129,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>Normal / Saudável</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>{predictiveEngine.counts?.NORMAL || 0} dioptrias</div>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Clique para detalhar ➔</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Seção 3: Produção & Sugestões IA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Subseção Produção Fabril & Qualidade */}
        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#0f172a' }}>
            <Factory size={20} color="#8b5cf6" /> Produção Fabril & Qualidade
          </h3>
          {productionKpis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(15,23,42,0.04)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Total de OSs no Fluxo:</span>
                <strong style={{ color: '#0f172a' }}>{productionKpis.total_orders || 0} OSs</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(147,51,234,0.05)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#7e22ce' }}>Surfaçagem (Produção):</span>
                <strong style={{ color: '#7e22ce' }}>{productionKpis.status_counts?.SURFACAGEM || 0} OSs</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(37,99,235,0.05)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Montagem & Corte:</span>
                <strong style={{ color: '#1d4ed8' }}>{productionKpis.status_counts?.MONTAGEM || 0} OSs</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245,158,11,0.05)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#b45309' }}>Controle de Qualidade (CQ):</span>
                <strong style={{ color: '#b45309' }}>{productionKpis.status_counts?.CQ_FINAL || 0} OSs</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16,185,129,0.05)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600, color: '#047857' }}>Expedição Final:</span>
                <strong style={{ color: '#047857' }}>{productionKpis.status_counts?.EXPEDICAO || 0} OSs</strong>
              </div>
              {productionKpis.total_loss_cost !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#b91c1c' }}>Perdas por Refugo (Custo):</span>
                  <strong style={{ color: '#b91c1c' }}>{formatCurrency(productionKpis.total_loss_cost)} ({productionKpis.reproduction_rate || 0}% erros)</strong>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando dados fabris...</div>
          )}
        </div>

        {/* Subseção Sugestões de Compra IA */}
        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#0f172a' }}>
              <Cpu size={20} color="#ec4899" /> Sugestões Geradas pela IA de Compras
            </h3>
            {predictiveEngine && (
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {predictiveEngine.purchase_suggestions.slice(0, 4).map((sug, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>{sug.model_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sug.dioptria}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#ec4899', fontWeight: 700 }}>Comprar +{sug.suggested_buy_qty} un</span>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Est. {formatCurrency(sug.estimated_cost)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/v1/alerts/export-purchases?lead_time_days=7&safety_days=30&coverage_days=15', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sugestao_compras_novalab_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } else {
                  alert('Erro ao exportar sugestão de compras.');
                }
              } catch (err) {
                alert('Erro de conexão ao exportar compras.');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginTop: '16px' }}
          >
            <ShoppingCart size={16} /> Exportar Ordens de Compra Preditivas (Excel)
          </button>
        </div>
      </div>

      {/* Modal Interativo para os KPIs Financeiros */}
      {selectedFinCategory && (
        <div onClick={() => setSelectedFinCategory(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '850px', width: '90%', color: '#0f172a' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {selectedFinCategory === 'RECEBIDOS' && '💰 Recebimentos do Mês (Títulos Liquidados)'}
                {selectedFinCategory === 'VENCIDOS' && '🚨 Faturas Vencidas em Atraso'}
                {selectedFinCategory === 'INADIMPLENCIA' && '📉 Óticas com Inadimplência'}
                {selectedFinCategory === 'A_PAGAR' && '🏦 Contas a Pagar Pendentes'}
              </h3>
              <button onClick={() => setSelectedFinCategory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Cliente / Fornecedor</th>
                    <th style={{ padding: '10px' }}>Descrição / Fatura</th>
                    <th style={{ padding: '10px' }}>Vencimento</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Valor Total</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFinCategory === 'RECEBIDOS' && receivables.filter(r => r.status === 'RECEBIDO' || r.amount_received > 0).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{r.optical_store_name}</td>
                      <td style={{ padding: '10px' }}>{r.description}</td>
                      <td style={{ padding: '10px' }}>{new Date(r.due_date).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatCurrency(r.amount_received || r.amount)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>LIQUIDADO</span></td>
                    </tr>
                  ))}

                  {selectedFinCategory === 'VENCIDOS' && receivables.filter(r => r.status === 'ATRASADO' || r.days_overdue > 0).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: 'rgba(239,68,68,0.02)' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{r.optical_store_name}</td>
                      <td style={{ padding: '10px' }}>{r.description}</td>
                      <td style={{ padding: '10px', color: '#ef4444', fontWeight: 600 }}>{new Date(r.due_date).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(r.balance_due || r.amount)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }}>{r.days_overdue} DIAS ATRASO</span></td>
                    </tr>
                  ))}

                  {selectedFinCategory === 'INADIMPLENCIA' && (finKpis?.ranking_by_store || []).filter(s => s.total_overdue > 0).map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{s.optical_store_name}</td>
                      <td style={{ padding: '10px' }}>Faturamento Acumulado: {formatCurrency(s.total_amount)}</td>
                      <td style={{ padding: '10px' }}>-</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(s.total_overdue)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }}>INADIMPLENTE</span></td>
                    </tr>
                  ))}

                  {selectedFinCategory === 'A_PAGAR' && payables.filter(p => p.status !== 'PAGO').map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{p.supplier_name}</td>
                      <td style={{ padding: '10px' }}>{p.description}</td>
                      <td style={{ padding: '10px' }}>{new Date(p.due_date).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{formatCurrency(p.balance_due || p.amount)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700 }}>PENDENTE</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {onNavigate && (
                <button 
                  onClick={() => { setSelectedFinCategory(null); onNavigate('finance-corp'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Abrir Financeiro Corporativo Completo <ArrowRight size={14} />
                </button>
              )}
              <button onClick={() => setSelectedFinCategory(null)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interativo de Detalhamento por Categoria de Alerta (Lentes & Blocos) */}
      {selectedModalStatus && predictiveEngine && (
        <div className="modal-overlay" onClick={() => setSelectedModalStatus(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '850px', width: '90%', color: '#0f172a' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={22} style={{ color: selectedModalStatus === 'RUPTURA' ? '#ef4444' : selectedModalStatus === 'CRITICO' ? '#d97706' : selectedModalStatus === 'BAIXO' ? '#2563eb' : '#10b981' }} />
              Detalhamento de Dioptrias em Estoque: <span style={{ color: selectedModalStatus === 'RUPTURA' ? '#ef4444' : selectedModalStatus === 'CRITICO' ? '#d97706' : selectedModalStatus === 'BAIXO' ? '#2563eb' : '#10b981', fontWeight: 800 }}>{selectedModalStatus}</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Listagem das lentes acabadas e blocos semiacabados na categoria <strong>{selectedModalStatus}</strong> (Total: {predictiveEngine.purchase_suggestions.filter(s => s.status === selectedModalStatus).length} dioptrias).
            </p>

            <div style={{ maxHeight: '380px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Tipo</th>
                    <th style={{ padding: '10px' }}>Modelo</th>
                    <th style={{ padding: '10px' }}>Grau / Dioptria</th>
                    <th style={{ padding: '10px' }}>Saldo Atual</th>
                    <th style={{ padding: '10px' }}>Sugestão Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {predictiveEngine.purchase_suggestions.filter(s => s.status === selectedModalStatus).length > 0 ? (
                    predictiveEngine.purchase_suggestions.filter(s => s.status === selectedModalStatus).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: item.item_type === 'BLOCO' ? 'rgba(147,51,234,0.1)' : 'rgba(37,99,235,0.1)', color: item.item_type === 'BLOCO' ? '#9333ea' : '#2563eb' }}>
                            {item.item_type || 'LENTE'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{item.model_name}</td>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{item.dioptria}</td>
                        <td style={{ padding: '10px', fontWeight: 700, color: item.current_qty === 0 ? '#ef4444' : '#10b981' }}>{item.current_qty} un</td>
                        <td style={{ padding: '10px', fontWeight: 700, color: '#ec4899' }}>+{item.suggested_buy_qty} un</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        Nenhum item nesta categoria de status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedModalStatus(null)} style={{ padding: '8px 20px' }}>
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


