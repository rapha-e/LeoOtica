import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Package, Sliders, Save, CheckCircle, RefreshCw } from 'lucide-react';

export default function ParametrosSistema() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [params, setParams] = useState({
    financial_delinquency_policy: 'POLICY_ALERT',
    inventory_critical_qty: '0',
    inventory_low_qty: '5',
    inventory_ideal_qty: '15',
    inventory_desired_coverage_days: '30',
    inventory_lead_time_days: '10',
    inventory_safety_stock_days: '7'
  });

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/system-parameters/', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setParams(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Erro ao carregar parâmetros do sistema:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParameters();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/v1/system-parameters/', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params)
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        alert('Erro ao salvar configurações do sistema.');
      }
    } catch (err) {
      alert('Erro de conexão ao salvar parâmetros.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings style={{ color: '#2563eb' }} size={28} />
            Parâmetros Gerais do Sistema
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Centralização de regras de inadimplência, motor preditivo de estoque e políticas operacionais.
          </p>
        </div>
        {savedSuccess && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '8px', fontWeight: 600 }}>
            <CheckCircle size={18} /> Configurações salvas!
          </div>
        )}
      </div>

      <form onSubmit={handleSave}>
        {/* Bloco 1: Política de Inadimplência */}
        <div style={{ background: '#fff', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '16px' }}>
            <ShieldAlert size={20} /> Configurações → Financeiro (Política de Inadimplência)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '16px' }}>
            Defina o comportamento do sistema quando um operador tentar abrir uma nova OS para uma ótica com faturas vencidas:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(224,230,240,0.8)', cursor: 'pointer', background: params.financial_delinquency_policy === 'POLICY_ALERT' ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
              <input
                type="radio"
                name="delinquency_policy"
                value="POLICY_ALERT"
                checked={params.financial_delinquency_policy === 'POLICY_ALERT'}
                onChange={(e) => setParams({ ...params, financial_delinquency_policy: e.target.value })}
              />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Política 1: Apenas alertar</strong>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Exibe alerta de débitos pendentes na tela, mas permite a criação da OS normalmente.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(224,230,240,0.8)', cursor: 'pointer', background: params.financial_delinquency_policy === 'POLICY_AUTHORIZE' ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
              <input
                type="radio"
                name="delinquency_policy"
                value="POLICY_AUTHORIZE"
                checked={params.financial_delinquency_policy === 'POLICY_AUTHORIZE'}
                onChange={(e) => setParams({ ...params, financial_delinquency_policy: e.target.value })}
              />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Política 2: Solicitar autorização de um Administrador</strong>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>A criação fica bloqueada até que um Administrador aprove a liberação de crédito.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(224,230,240,0.8)', cursor: 'pointer', background: params.financial_delinquency_policy === 'POLICY_BLOCK' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
              <input
                type="radio"
                name="delinquency_policy"
                value="POLICY_BLOCK"
                checked={params.financial_delinquency_policy === 'POLICY_BLOCK'}
                onChange={(e) => setParams({ ...params, financial_delinquency_policy: e.target.value })}
              />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Política 3: Bloquear completamente</strong>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Bloqueia 100% a criação de novas Ordens de Serviço enquanto houver faturas em atraso.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Bloco 2: Motor Preditivo de Estoque */}
        <div style={{ background: '#fff', border: '1px solid rgba(224,230,240,0.8)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', marginBottom: '16px' }}>
            <Package size={20} /> Configurações → Estoque (Parâmetros de Reposição & Motor Preditivo)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Estoque Crítico (Unidades)</label>
              <input
                type="number"
                value={params.inventory_critical_qty}
                onChange={(e) => setParams({ ...params, inventory_critical_qty: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Alerta vermelho imediato de risco de paralisação.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Estoque Baixo (Unidades)</label>
              <input
                type="number"
                value={params.inventory_low_qty}
                onChange={(e) => setParams({ ...params, inventory_low_qty: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Gera sugestão amarela no relatório de compras.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Quantidade Ideal (Unidades)</label>
              <input
                type="number"
                value={params.inventory_ideal_qty}
                onChange={(e) => setParams({ ...params, inventory_ideal_qty: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Nível desejado de preenchimento da grade.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Lead Time Fornecedor (Dias)</label>
              <input
                type="number"
                value={params.inventory_lead_time_days}
                onChange={(e) => setParams({ ...params, inventory_lead_time_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Tempo médio de entrega do pedido pelo fabricante.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Estoque de Segurança (Dias)</label>
              <input
                type="number"
                value={params.inventory_safety_stock_days}
                onChange={(e) => setParams({ ...params, inventory_safety_stock_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Margem para variações ou atrasos de transporte.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Cobertura Desejada (Dias)</label>
              <input
                type="number"
                value={params.inventory_desired_coverage_days}
                onChange={(e) => setParams({ ...params, inventory_desired_coverage_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Período planejado de autonomia do estoque.</div>
            </div>
          </div>
        </div>

        {/* Botão de Gravação */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}
          >
            <Save size={18} /> {saving ? 'Salvando Parâmetros...' : 'Salvar Parâmetros Gerais'}
          </button>
        </div>
      </form>
    </div>
  );
}
