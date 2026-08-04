import React, { useState, useEffect } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Calendar, CheckCircle, Clock, FileText, Plus, RefreshCw, Filter, 
  ArrowUpRight, ArrowDownRight, Search, Download, CreditCard, ShieldAlert
} from 'lucide-react';
import api from '../services/api';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default function FinanceiroCorporativo() {
  const [activeTab, setActiveTab] = useState('receivables');
  const [loading, setLoading] = useState(true);
  
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [kpis, setKpis] = useState(null);
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [payableModalOpen, setPayableModalOpen] = useState(false);
  const [newPayable, setNewPayable] = useState({
    description: '', supplier_name: '', document_number: '', amount: '', due_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRec, resPay, resFlow, resKpi] = await Promise.all([
        api.get('/finance-corp/receivables'),
        api.get('/finance-corp/payables'),
        api.get('/finance-corp/cash-flow'),
        api.get('/finance-corp/kpis-executive')
      ]);

      setReceivables(resRec.data || []);
      setPayables(resPay.data || []);
      setCashFlow(resFlow.data || []);
      setKpis(resKpi.data || null);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cadastrar conta a pagar.');
    }
  };

  const handlePayPayable = async (payableId, amount) => {
    if (!window.confirm(`Confirmar pagamento no valor de R$ ${amount.toFixed(2)}?`)) return;
    try {
      await api.post(`/finance-corp/payables/${payableId}/pay`, { amount });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao baixar conta a pagar.');
    }
  };

  const totalInflow = receivables.reduce((acc, r) => acc + (r.amount_received || 0), 0);
  const totalOutflow = payables.reduce((acc, p) => acc + (p.amount_paid || 0), 0);
  const netBalance = totalInflow - totalOutflow;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 style={{ color: '#2563eb' }} size={28} />
            Financeiro Corporativo Enterprise
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Gestão administrativa centralizada de Contas a Receber, Contas a Pagar, Fluxo de Caixa e Inadimplência.
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar Dados
        </button>
      </div>

      {/* Cards de KPIs Principais (Clicáveis para atalho rápido) */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div 
            onClick={() => setActiveTab('receivables')}
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02))', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s' }}
          >
            <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>Faturado Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--text-primary))', marginTop: '4px' }}>
              {formatCurrency(kpis?.total_billed)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, marginTop: '4px' }}>Clique para abrir Contas a Receber ➔</div>
          </div>

          <div 
            onClick={() => setActiveTab('receivables')}
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s' }}
          >
            <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Recebido (Liquidado)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              {formatCurrency(kpis?.total_received)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>Clique para ver recebimentos ➔</div>
          </div>

          <div 
            onClick={() => setActiveTab('receivables')}
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s' }}
          >
            <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Vencido (Inadimplência)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
              {formatCurrency(kpis?.total_overdue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
              Taxa de Inadimplência: {kpis?.delinquency_rate || 0}% ➔
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('payables')}
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s' }}
          >
            <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Contas a Pagar Pendentes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
              {formatCurrency(kpis?.payables_summary?.total_pending)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginTop: '4px' }}>Clique para abrir Contas a Pagar ➔</div>
          </div>
        </div>
      )}

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid rgba(224,230,240,0.8)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('receivables')}
          style={{
            padding: '12px 20px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeTab === 'receivables' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'receivables' ? '#2563eb' : 'hsl(var(--text-muted))'
          }}
        >
          Contas a Receber ({receivables.length})
        </button>
        <button
          onClick={() => setActiveTab('payables')}
          style={{
            padding: '12px 20px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeTab === 'payables' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'payables' ? '#2563eb' : 'hsl(var(--text-muted))'
          }}
        >
          Contas a Pagar ({payables.length})
        </button>
        <button
          onClick={() => setActiveTab('cashflow')}
          style={{
            padding: '12px 20px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeTab === 'cashflow' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'cashflow' ? '#2563eb' : 'hsl(var(--text-muted))'
          }}
        >
          Fluxo de Caixa
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          style={{
            padding: '12px 20px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: activeTab === 'ranking' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'ranking' ? '#2563eb' : 'hsl(var(--text-muted))'
          }}
        >
          Ranking & Indicadores
        </button>
      </div>

      {/* Conteúdo da Aba 1: Contas a Receber */}
      {activeTab === 'receivables' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>Gestão de Contas a Receber por Ótica</h3>
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
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Nenhum título a receber pendente no momento. As faturas fechadas aparecerão aqui automaticamente.
                  </td>
                </tr>
              ) : (
                receivables.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid rgba(224,230,240,0.5)', background: rec.status === 'ATRASADO' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{rec.optical_store_name}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{rec.description}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{new Date(rec.due_date).toLocaleDateString('pt-BR')}</td>
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

      {/* Conteúdo da Aba 2: Contas a Pagar */}
      {activeTab === 'payables' && (
        <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Contas a Pagar da Fábrica</h3>
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
              {payables.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Nenhuma conta a pagar registrada. Clique no botão acima para cadastrar novos compromissos financeiros.
                  </td>
                </tr>
              ) : (
                payables.map((pay) => (
                  <tr key={pay.id} style={{ borderBottom: '1px solid rgba(224,230,240,0.5)' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{pay.supplier_name}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{pay.description} {pay.document_number ? `(${pay.document_number})` : ''}</td>
                    <td style={{ padding: '10px', color: '#334155' }}>{new Date(pay.due_date).toLocaleDateString('pt-BR')}</td>
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

      {/* Conteúdo da Aba 3: Fluxo de Caixa */}
      {activeTab === 'cashflow' && (
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

      {/* Conteúdo da Aba 4: Ranking & Indicadores */}
      {activeTab === 'ranking' && (
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
              {kpis?.ranking_by_store ? kpis.ranking_by_store.map((st, idx) => (
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
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      {/* Modal Baixa de Recebimento */}
      {paymentModalOpen && selectedReceivable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '450px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>Dar Baixa em Título a Receber</h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '16px' }}>
              Ótica: <strong>{selectedReceivable.optical_store_name}</strong><br/>
              Valor em Aberto: <strong>{formatCurrency(selectedReceivable.balance_due)}</strong>
            </p>
            <form onSubmit={handleReceivePayment}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Valor do Pagamento (R$)</label>
                <input
                  type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Observações da Baixa</label>
                <textarea
                  value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', height: '80px' }}
                  placeholder="Ex: Pix confirmado, depósito bancário..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setPaymentModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Confirmar Baixa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Conta a Pagar */}
      {payableModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Cadastrar Nova Conta a Pagar</h3>
            <form onSubmit={handleCreatePayable}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Fornecedor</label>
                <input type="text" value={newPayable.supplier_name} onChange={(e) => setNewPayable({...newPayable, supplier_name: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Descrição</label>
                <input type="text" value={newPayable.description} onChange={(e) => setNewPayable({...newPayable, description: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Valor (R$)</label>
                  <input type="number" step="0.01" value={newPayable.amount} onChange={(e) => setNewPayable({...newPayable, amount: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Vencimento</label>
                  <input type="date" value={newPayable.due_date} onChange={(e) => setNewPayable({...newPayable, due_date: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setPayableModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Salvar Conta a Pagar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
