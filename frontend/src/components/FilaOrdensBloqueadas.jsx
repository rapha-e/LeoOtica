import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle, Search, Filter, RefreshCw, FileText, Lock, ArrowRight, UserCheck } from 'lucide-react';

export default function FilaOrdensBloqueadas() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedOS, setSelectedOS] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authNotes, setAuthNotes] = useState('');
  const [authorizing, setAuthorizing] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchBlockedOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/os/financial-blocked', { headers: getHeaders() });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (err) {
      console.error('Erro ao carregar fila de ordens bloqueadas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedOrders();
  }, []);

  const handleAuthorize = async (e) => {
    e.preventDefault();
    if (!selectedOS) return;
    setAuthorizing(true);
    try {
      const res = await fetch(`/api/v1/os/${selectedOS.id}/authorize-financial`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ notes: authNotes })
      });
      if (res.ok) {
        setAuthModalOpen(false);
        setSelectedOS(null);
        setAuthNotes('');
        fetchBlockedOrders();
      } else {
        const err = await res.json();
        alert(`Erro ao liberar OS: ${err.detail || 'Falha na operação'}`);
      }
    } catch (err) {
      alert('Erro de conexão ao liberar Ordem de Serviço.');
    } finally {
      setAuthorizing(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const filteredOrders = orders.filter(o => 
    o.os_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.client_name && o.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.optical_store_name && o.optical_store_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock style={{ color: '#ef4444' }} size={28} />
            Fila Administrativa — Ordens Retidas por Inadimplência
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Gestão de Ordens de Serviço persistidas com restrição financeira aguardando liberação de crédito pelo Administrador.
          </p>
        </div>
        <button
          onClick={fetchBlockedOrders}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fff', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar Fila
        </button>
      </div>

      {/* Barra de Pesquisa */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por Nº da OS, Cliente ou Ótica..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid rgba(224,230,240,0.8)', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Tabela de Ordens Retidas */}
      <div style={{ background: '#fff', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.03)', borderBottom: '2px solid rgba(224,230,240,0.8)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Nº da OS</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Ótica Solicitante</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Paciente / Cliente</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Débito Pendente</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Maior Atraso</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status Restritivo</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Ação Administrativa</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <CheckCircle size={32} style={{ color: '#10b981', marginBottom: '8px' }} />
                  <div>Nenhuma Ordem de Serviço bloqueada no momento. Todas as entradas estão regulares!</div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((os) => (
                <tr key={os.id} style={{ borderBottom: '1px solid rgba(224,230,240,0.5)', background: 'rgba(239,68,68,0.02)' }}>
                  <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{os.os_number}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{os.optical_store_name || 'Ótica Parceira'}</td>
                  <td style={{ padding: '12px' }}>{os.client_name || 'Consumidor Final'}</td>
                  <td style={{ padding: '12px', color: '#ef4444', fontWeight: 700 }}>
                    {formatCurrency(os.financial_overdue_amount || 0)} ({os.financial_overdue_count || 1} fatura)
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>
                    {os.financial_max_overdue_days || 0} dias
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                      background: os.status.includes('Aguardando') ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                      color: os.status.includes('Aguardando') ? '#d97706' : '#ef4444'
                    }}>
                      {os.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => { setSelectedOS(os); setAuthModalOpen(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                    >
                      <UserCheck size={14} /> Liberar OS
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Liberação por Administrador */}
      {authModalOpen && selectedOS && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={20} /> Liberação Administrativa de Crédito
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '16px' }}>
              Ordem de Serviço: <strong>{selectedOS.os_number}</strong> ({selectedOS.optical_store_name})<br/>
              Valor em Atraso: <strong style={{ color: '#ef4444' }}>{formatCurrency(selectedOS.financial_overdue_amount)}</strong> ({selectedOS.financial_max_overdue_days} dias de atraso)
            </p>
            <form onSubmit={handleAuthorize}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Justificativa / Motivo da Liberação (Obrigatório)</label>
                <textarea
                  value={authNotes}
                  onChange={(e) => setAuthNotes(e.target.value)}
                  required
                  placeholder="Ex: Acordo comercial firmado, promessa de pagamento para hoje, liberação excepcional da diretoria..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', height: '90px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setAuthModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={authorizing} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  {authorizing ? 'Liberando OS...' : 'Confirmar & Encaminhar à Produção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
