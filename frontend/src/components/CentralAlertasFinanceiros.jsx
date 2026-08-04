import React, { useState, useEffect } from 'react';
import { AlertTriangle, DollarSign, Building2, Calendar, X, ArrowRight, Mail } from 'lucide-react';

export default function CentralAlertasFinanceiros({ isOpen, onClose, onNavigateToFinance }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('factory_token') || localStorage.getItem('token');
      const hostname = window.location.hostname;
      fetch(`http://${hostname}:8000/api/v1/finance-corp/overdue-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(d => setData(d))
        .catch(err => console.error('Erro ao carregar alertas financeiros:', err));
    }
  }, [isOpen]);

  if (!isOpen || !data || data.overdue_count === 0) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '560px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Central de Alertas Financeiros</h2>
              <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Pendências administrativas identificadas no sistema</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Resumo de Indicadores da Central */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Faturas Vencidas</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
              {formatCurrency(data.total_overdue_amount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              {data.overdue_count} fatura(s) em {data.delinquent_stores_count} ótica(s)
            </div>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Vencimentos Próximos</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
              {data.due_today_count} Hoje
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
              + {data.due_in_7_days_count} faturas nos próximos 7 dias
            </div>
          </div>
        </div>

        {/* Lista de Faturas Críticas */}
        <div style={{ marginBottom: '20px', maxHeight: '180px', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '8px' }}>Óticas com Inadimplência Crítica:</h4>
          {data.overdue_items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '8px', marginBottom: '6px', fontSize: '0.85rem' }}>
              <div>
                <strong>{item.optical_store_name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Atraso de {item.days_overdue} dias</div>
              </div>
              <div style={{ fontWeight: 700, color: '#ef4444' }}>
                {formatCurrency(item.balance_due)}
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            Lembrar Mais Tarde
          </button>
          <button
            onClick={() => { onClose(); if (onNavigateToFinance) onNavigateToFinance(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Ir para Financeiro Corporativo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
