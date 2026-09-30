import React, { useState, useEffect } from 'react';
import { AlertTriangle, DollarSign, Building2, Calendar, X, ArrowRight, Bell, BellOff, CheckCircle } from 'lucide-react';

export default function CentralAlertasFinanceiros({ isOpen, onClose, onNavigateToFinance }) {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'receivables' | 'payables'
  const [dismissingId, setDismissingId] = useState(null);

  const fetchAlerts = () => {
    const token = localStorage.getItem('factory_token') || localStorage.getItem('token');
    const hostname = window.location.hostname;
    fetch(`http://${hostname}:8000/api/v1/finance-corp/overdue-alerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(d => setData(d))
      .catch(err => console.error('Erro ao carregar alertas financeiros:', err));
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const handleDismissPayable = async (payableId, e) => {
    e.stopPropagation();
    setDismissingId(payableId);
    try {
      const token = localStorage.getItem('factory_token') || localStorage.getItem('token');
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:8000/api/v1/finance-corp/payables/${payableId}/dismiss-alert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Erro ao dispensar alerta:', err);
    } finally {
      setDismissingId(null);
    }
  };

  const totalAlerts = (data?.overdue_count || 0) + (data?.payable_alerts_count || 0);

  if (!isOpen || !data || totalAlerts === 0) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '640px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
        
        {/* Header do Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Central de Alertas Financeiros</h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Pendências administrativas e alertas de vencimento da fábrica</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Resumo de Indicadores da Central */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Contas a Receber Vencidas</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
              {formatCurrency(data.total_overdue_amount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              {data.overdue_count} fatura(s) em {data.delinquent_stores_count} ótica(s)
            </div>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Contas a Pagar em Alerta</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
              {formatCurrency(data.payable_total_alert_amount || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              {data.payable_alerts_count || 0} conta(s) ({data.payable_overdue_count || 0} vencida(s), {data.payable_due_today_count || 0} hoje)
            </div>
          </div>
        </div>

        {/* Seção 1: Contas a Pagar em Alerta (com Dispensa do Operador) */}
        {data.payable_alerts && data.payable_alerts.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Bell size={14} color="#d97706" /> Contas a Pagar com Alerta Ativo ({data.payable_alerts.length}):
              </h4>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Controle de dispensa pelo operador</span>
            </div>

            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.payable_alerts.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{item.supplier_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.description}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: item.days_until_due < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: item.days_until_due < 0 ? '#ef4444' : '#d97706'
                      }}>
                        {item.alert_status_text}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontWeight: 700, color: item.days_until_due < 0 ? '#ef4444' : '#0f172a', textAlign: 'right' }}>
                      {formatCurrency(item.balance_due)}
                    </div>
                    <button
                      onClick={(e) => handleDismissPayable(item.id, e)}
                      disabled={dismissingId === item.id}
                      title="Dispensar alerta (não alertar mais)"
                      style={{
                        padding: '4px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <BellOff size={12} /> {dismissingId === item.id ? 'Silenciando...' : 'Não alertar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção 2: Contas a Receber / Faturas Críticas */}
        {data.overdue_items && data.overdue_items.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}>
              Óticas Inadimplentes (Contas a Receber):
            </h4>
            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.overdue_items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{item.optical_store_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Atraso de {item.days_overdue} dia(s)</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#ef4444' }}>
                    {formatCurrency(item.balance_due)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações do Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
            Lembrar Mais Tarde
          </button>
          <button
            onClick={() => { onClose(); if (onNavigateToFinance) onNavigateToFinance(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Ir para Gestão Financeira <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
