import React, { useState, useEffect } from 'react';
import { 
  BarChart3, DollarSign, Package, Factory, ShoppingCart, TrendingUp, 
  AlertTriangle, RefreshCw, Clock, CheckCircle, ShieldAlert, Cpu, ArrowRight, X,
  Plus, Building2, TrendingDown, Filter, Calendar, CreditCard
} from 'lucide-react';
import api from '../services/api';

export default function DashboardExecutivo({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'receivables' | 'payables' | 'cashflow' | 'ranking'
  
  const [finKpis, setFinKpis] = useState(null);
  const [predictiveEngine, setPredictiveEngine] = useState(null);
  const [productionKpis, setProductionKpis] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const [receivablesFilter, setReceivablesFilter] = useState('ALL'); // 'ALL' | 'RECEBIDO' | 'ATRASADO'
  const [payablesFilter, setPayablesFilter] = useState('ALL'); // 'ALL' | 'PENDENTE' | 'PAGO'

  const [selectedModalStatus, setSelectedModalStatus] = useState(null);
  const [selectedFinCategory, setSelectedFinCategory] = useState(null); // 'RECEBIDOS' | 'VENCIDOS' | 'INADIMPLENCIA' | 'A_PAGAR'

  // Modais de Operação Financeira
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [payableModalOpen, setPayableModalOpen] = useState(false);
  const [newPayable, setNewPayable] = useState({
    description: '', supplier_name: '', document_number: '', amount: '', due_date: new Date().toISOString().split('T')[0]
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resFin, resEngine, resProd, resRec, resPay, resFlow] = await Promise.allSettled([
        api.get('/finance-corp/kpis-executive'),
        api.get('/inventory/predictive-report'),
        api.get('/os/dashboard/kpis'),
        api.get('/finance-corp/receivables'),
        api.get('/finance-corp/payables'),
        api.get('/finance-corp/cash-flow')
      ]);

      if (resFin.status === 'fulfilled' && resFin.value?.data) {
        setFinKpis(resFin.value.data);
      }
      if (resEngine.status === 'fulfilled' && resEngine.value?.data) {
        setPredictiveEngine(resEngine.value.data);
      }
      if (resProd.status === 'fulfilled' && resProd.value?.data) {
        setProductionKpis(resProd.value.data);
      }
      if (resRec.status === 'fulfilled' && resRec.value?.data) {
        setReceivables(resRec.value.data);
      }
      if (resPay.status === 'fulfilled' && resPay.value?.data) {
        setPayables(resPay.value.data);
      }
      if (resFlow.status === 'fulfilled' && resFlow.value?.data) {
        setCashFlow(resFlow.value.data);
      }

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

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!selectedReceivable || !paymentAmount) return;
    try {
      await api.post(`/finance-corp/receivables/${selectedReceivable.id}/pay`, {
        amount: parseFloat(paymentAmount),
        notes: paymentNotes
      });
      setPaymentModalOpen(false);
      setSelectedReceivable(null);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchData();
      showToast('Baixa de recebimento registrada!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao registrar recebimento.');
    }
  };

  const handleCreatePayable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance-corp/payables', {
        ...newPayable,
        amount: parseFloat(newPayable.amount)
      });
      setPayableModalOpen(false);
      setNewPayable({ description: '', supplier_name: '', document_number: '', amount: '', due_date: new Date().toISOString().split('T')[0] });
      fetchData();
      showToast('Conta a pagar cadastrada com sucesso!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cadastrar conta a pagar.');
    }
  };

  const handlePayPayable = async (payableId, amount) => {
    if (!window.confirm(`Confirmar pagamento no valor de R$ ${amount.toFixed(2)}?`)) return;
    try {
      await api.post(`/finance-corp/payables/${payableId}/pay`, { amount });
      fetchData();
      showToast('Pagamento registrado com sucesso!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao baixar conta a pagar.');
    }
  };

  const filteredReceivables = receivables.filter(rec => {
    if (receivablesFilter === 'RECEBIDO') return rec.status === 'RECEBIDO' || rec.amount_received >= rec.amount;
    if (receivablesFilter === 'ATRASADO') return rec.status === 'ATRASADO' || rec.days_overdue > 0;
    return true;
  });

  const filteredPayables = payables.filter(pay => {
    if (payablesFilter === 'PENDENTE') return pay.status !== 'PAGO';
    if (payablesFilter === 'PAGO') return pay.status === 'PAGO';
    return true;
  });

  const totalInflow = receivables.reduce((acc, r) => acc + (r.amount_received || 0), 0);
  const totalOutflow = payables.reduce((acc, p) => acc + (p.amount_paid || 0), 0);
  const netBalance = totalInflow - totalOutflow;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toastMessage}
        </div>
      )}

      {/* Cabeçalho Unificado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 style={{ color: '#2563eb' }} size={32} />
            Dashboard Executivo Administrativo
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Hub Centralizado de Gestão Financeira Corporativa, Motor Preditivo de Estoque (Lentes & Blocos), Produção Fabril e Compras IA.
          </p>
        </div>
        <button onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Atualizando...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* Navegação por Sub-Abas do Dashboard Executivo Aprimorado */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid rgba(224,230,240,0.8)', marginBottom: '24px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveSubTab('overview')}
          style={{
            padding: '12px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeSubTab === 'overview' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'overview' ? '#2563eb' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <BarChart3 size={18} /> Visão Geral Executiva
        </button>
        <button
          onClick={() => setActiveSubTab('receivables')}
          style={{
            padding: '12px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeSubTab === 'receivables' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'receivables' ? '#2563eb' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <DollarSign size={18} /> Contas a Receber ({receivables.length})
        </button>
        <button
          onClick={() => setActiveSubTab('payables')}
          style={{
            padding: '12px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeSubTab === 'payables' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'payables' ? '#2563eb' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Building2 size={18} /> Contas a Pagar ({payables.length})
        </button>
        <button
          onClick={() => setActiveSubTab('cashflow')}
          style={{
            padding: '12px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeSubTab === 'cashflow' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'cashflow' ? '#2563eb' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <TrendingUp size={18} /> Fluxo de Caixa
        </button>
        <button
          onClick={() => setActiveSubTab('ranking')}
          style={{
            padding: '12px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeSubTab === 'ranking' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'ranking' ? '#2563eb' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <ShieldAlert size={18} /> Ranking & Inadimplência
        </button>
      </div>

      {/* SUB-ABA 1: VISÃO GERAL EXECUTIVA */}
      {activeSubTab === 'overview' && (
        <>
          {/* Seção 1: Financeiro Executivo (Clicáveis para Navegação / Detalhamento) */}
          {finKpis && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'hsl(var(--text-primary))' }}>
                <DollarSign size={20} color="#2563eb" /> 1. Visão Financeira Corporativa Centralizada
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {/* Card 1: Recebimentos */}
                <div 
                  onClick={() => { setActiveSubTab('receivables'); setReceivablesFilter('RECEBIDO'); }}
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
                  onClick={() => { setActiveSubTab('receivables'); setReceivablesFilter('ATRASADO'); }}
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
                  onClick={() => setActiveSubTab('ranking')}
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
                  onClick={() => { setActiveSubTab('payables'); setPayablesFilter('PENDENTE'); }}
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

          {/* Seção 2: Estoque Preditivo (Lentes & Blocos) */}
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

          {/* Seção 3: Produção & Sugestões IA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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

            <div style={{ background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#0f172a' }}>
                  <Cpu size={20} color="#ec4899" /> Sugestões de Compras (Lentes & Blocos)
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
        </>
      )}

      {/* SUB-ABA 2: CONTAS A RECEBER */}
      {activeSubTab === 'receivables' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Gestão de Contas a Receber por Ótica</h3>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Filtrar:</span>
              <button onClick={() => setReceivablesFilter('ALL')} style={{ padding: '5px 12px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: receivablesFilter === 'ALL' ? '#2563eb' : '#e2e8f0', color: receivablesFilter === 'ALL' ? '#fff' : '#475569' }}>
                Todos ({receivables.length})
              </button>
              <button onClick={() => setReceivablesFilter('RECEBIDO')} style={{ padding: '5px 12px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: receivablesFilter === 'RECEBIDO' ? '#10b981' : '#e2e8f0', color: receivablesFilter === 'RECEBIDO' ? '#fff' : '#475569' }}>
                Liquidados ({receivables.filter(r => r.status === 'RECEBIDO' || r.amount_received >= r.amount).length})
              </button>
              <button onClick={() => setReceivablesFilter('ATRASADO')} style={{ padding: '5px 12px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: receivablesFilter === 'ATRASADO' ? '#ef4444' : '#e2e8f0', color: receivablesFilter === 'ATRASADO' ? '#fff' : '#475569' }}>
                Vencidos / Inadimplentes ({receivables.filter(r => r.status === 'ATRASADO' || r.days_overdue > 0).length})
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.04)', borderBottom: '2px solid rgba(224,230,240,0.8)', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Ótica Cliente</th>
                <th style={{ padding: '10px' }}>Descrição / Fatura</th>
                <th style={{ padding: '10px' }}>Vencimento</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Valor Total</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Valor Recebido</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Nenhum título localizado para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid rgba(224,230,240,0.5)', background: rec.status === 'ATRASADO' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{rec.optical_store_name}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{rec.description}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{rec.due_date ? new Date(rec.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(rec.amount)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(rec.amount_received)}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: rec.status === 'RECEBIDO' ? 'rgba(16,185,129,0.1)' : rec.status === 'ATRASADO' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: rec.status === 'RECEBIDO' ? '#10b981' : rec.status === 'ATRASADO' ? '#ef4444' : '#d97706'
                      }}>
                        {rec.status === 'ATRASADO' ? `ATRASADO (${rec.days_overdue}d)` : rec.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {rec.status !== 'RECEBIDO' && (
                        <button
                          onClick={() => { setSelectedReceivable(rec); setPaymentAmount(rec.balance_due); setPaymentModalOpen(true); }}
                          style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          Dar Baixa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-ABA 3: CONTAS A PAGAR */}
      {activeSubTab === 'payables' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Contas a Pagar da Fábrica</h3>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Filtrar:</span>
                <button onClick={() => setPayablesFilter('ALL')} style={{ padding: '4px 10px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: payablesFilter === 'ALL' ? '#2563eb' : '#e2e8f0', color: payablesFilter === 'ALL' ? '#fff' : '#475569' }}>
                  Todas ({payables.length})
                </button>
                <button onClick={() => setPayablesFilter('PENDENTE')} style={{ padding: '4px 10px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: payablesFilter === 'PENDENTE' ? '#d97706' : '#e2e8f0', color: payablesFilter === 'PENDENTE' ? '#fff' : '#475569' }}>
                  Somente Pendentes ({payables.filter(p => p.status !== 'PAGO').length})
                </button>
                <button onClick={() => setPayablesFilter('PAGO')} style={{ padding: '4px 10px', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: payablesFilter === 'PAGO' ? '#10b981' : '#e2e8f0', color: payablesFilter === 'PAGO' ? '#fff' : '#475569' }}>
                  Somente Pagas ({payables.filter(p => p.status === 'PAGO').length})
                </button>
              </div>
            </div>
            <button
              onClick={() => setPayableModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={16} /> Nova Conta a Pagar
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.04)', borderBottom: '2px solid rgba(224,230,240,0.8)', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Fornecedor</th>
                <th style={{ padding: '10px' }}>Descrição / Doc</th>
                <th style={{ padding: '10px' }}>Vencimento</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Valor Total</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Valor Pago</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Nenhuma conta localizada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredPayables.map((pay) => (
                  <tr key={pay.id} style={{ borderBottom: '1px solid rgba(224,230,240,0.5)' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{pay.supplier_name}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{pay.description} {pay.document_number ? `(${pay.document_number})` : ''}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{pay.due_date ? new Date(pay.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(pay.amount)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(pay.amount_paid)}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: pay.status === 'PAGO' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        color: pay.status === 'PAGO' ? '#10b981' : '#d97706'
                      }}>
                        {pay.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {pay.status !== 'PAGO' && (
                        <button
                          onClick={() => handlePayPayable(pay.id, pay.balance_due)}
                          style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-ABA 4: FLUXO DE CAIXA */}
      {activeSubTab === 'cashflow' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            <TrendingUp size={20} color="#10b981" /> Fluxo de Caixa Projetado vs Realizado
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.05)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>Total Entradas (Recebidos)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{formatCurrency(totalInflow)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.05)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>Total Saídas (Pagas)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{formatCurrency(totalOutflow)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>Saldo Líquido em Caixa</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{formatCurrency(netBalance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 5: RANKING & INADIMPLÊNCIA */}
      {activeSubTab === 'ranking' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            <ShieldAlert size={20} color="#2563eb" /> Ranking & Indicadores de Performance por Ótica
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.04)', borderBottom: '2px solid rgba(224,230,240,0.8)', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px' }}>Ótica Comercial</th>
                <th style={{ padding: '10px' }}>Faturamento Acumulado</th>
                <th style={{ padding: '10px' }}>Total Recebido</th>
                <th style={{ padding: '10px' }}>Ticket Médio</th>
                <th style={{ padding: '10px' }}>Status de Inadimplência</th>
              </tr>
            </thead>
            <tbody>
              {finKpis?.ranking_by_store ? finKpis.ranking_by_store.map((st, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{st.optical_store_name}</td>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(st.total_amount)}</td>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#334155' }}>{formatCurrency(st.total_received)}</td>
                  <td style={{ padding: '10px', color: '#334155' }}>{formatCurrency(st.ticket_medio)}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: st.total_overdue > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: st.total_overdue > 0 ? '#ef4444' : '#10b981' }}>
                      {st.total_overdue > 0 ? `INADIMPLENTE (${formatCurrency(st.total_overdue)})` : 'EM DIA'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    Carregando ranking comercial...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Baixa de Recebimento */}
      {paymentModalOpen && selectedReceivable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '480px', width: '90%', color: '#0f172a' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>Confirmar Recebimento de Título</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Registrando baixa para <strong>{selectedReceivable.optical_store_name}</strong> ({selectedReceivable.description}).
            </p>
            <form onSubmit={handleReceivePayment}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Valor Recebido (R$)</label>
                <input 
                  type="number" step="0.01" required
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Observações / Comprovante</label>
                <input 
                  type="text" 
                  value={paymentNotes} 
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex: Pix efetuado via Banco do Brasil"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setPaymentModalOpen(false)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cadastrar Nova Conta a Pagar */}
      {payableModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '480px', width: '90%', color: '#0f172a' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>Nova Conta a Pagar da Fábrica</h3>
            <form onSubmit={handleCreatePayable}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Fornecedor</label>
                <input type="text" required value={newPayable.supplier_name} onChange={(e) => setNewPayable({ ...newPayable, supplier_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Descrição do Compromisso</label>
                <input type="text" required value={newPayable.description} onChange={(e) => setNewPayable({ ...newPayable, description: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Nº Nota / Doc</label>
                  <input type="text" value={newPayable.document_number} onChange={(e) => setNewPayable({ ...newPayable, document_number: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Valor Total (R$)</label>
                  <input type="number" step="0.01" required value={newPayable.amount} onChange={(e) => setNewPayable({ ...newPayable, amount: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>Data de Vencimento</label>
                <input type="date" required value={newPayable.due_date} onChange={(e) => setNewPayable({ ...newPayable, due_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setPayableModalOpen(false)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Interativo de Detalhamento de Estoque Preditivo (Lentes & Blocos) */}
      {selectedModalStatus && predictiveEngine && (
        <div onClick={() => setSelectedModalStatus(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '850px', width: '90%', color: '#0f172a' }} onClick={(e) => e.stopPropagation()}>
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
              <button onClick={() => setSelectedModalStatus(null)} style={{ padding: '8px 20px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
