import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Package, Sliders, Save, CheckCircle, RefreshCw } from 'lucide-react';
import api, { DegreePolicyService } from '../services/api';

const lpLensTypes = [
  { key: 'lp_incolor_150', title: 'LP Incolor 1.50', badge: 'Resina / Incolor 1.50', defaultBase: '60.00', defaultOver: '80.00' },
  { key: 'lp_ar_156', title: 'LP AR 1.56', badge: 'Resina / Antirreflexo 1.56', defaultBase: '75.00', defaultOver: '95.00' },
  { key: 'lp_filtro_azul_ar_156', title: 'LP Filtro Azul AR 1.56', badge: 'Resina / Blue Cut + AR 1.56', defaultBase: '95.00', defaultOver: '125.00' },
  { key: 'lp_poly_ar_159', title: 'LP POLY AR 1.59', badge: 'Policarbonato / AR 1.59', defaultBase: '110.00', defaultOver: '140.00' },
  { key: 'lp_poly_filtro_azul_ar_159', title: 'LP POLY Filtro Azul AR 1.59', badge: 'Policarbonato / Blue Cut + AR 1.59', defaultBase: '130.00', defaultOver: '165.00' },
  { key: 'lp_photo_ar_156', title: 'LP PHOTO AR 1.56', badge: 'Fotocromática / AR 1.56', defaultBase: '145.00', defaultOver: '185.00' },
  { key: 'lp_photo_filtro_azul_ar_156', title: 'LP PHOTO Filtro Azul AR 1.56', badge: 'Fotocromática / Blue Cut + AR 1.56', defaultBase: '170.00', defaultOver: '215.00' }
];

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
    inventory_safety_stock_days: '7',

    // 1. LP Incolor 1.50
    lp_incolor_150_cyl_threshold: '2.00',
    lp_incolor_150_price_base: '60.00',
    lp_incolor_150_price_over: '80.00',

    // 2. LP AR 1.56
    lp_ar_156_cyl_threshold: '2.00',
    lp_ar_156_price_base: '75.00',
    lp_ar_156_price_over: '95.00',

    // 3. LP Filtro Azul AR 1.56
    lp_filtro_azul_ar_156_cyl_threshold: '2.00',
    lp_filtro_azul_ar_156_price_base: '95.00',
    lp_filtro_azul_ar_156_price_over: '125.00',

    // 4. LP POLY AR 1.59
    lp_poly_ar_159_cyl_threshold: '2.00',
    lp_poly_ar_159_price_base: '110.00',
    lp_poly_ar_159_price_over: '140.00',

    // 5. LP POLY Filtro Azul AR 1.59
    lp_poly_filtro_azul_ar_159_cyl_threshold: '2.00',
    lp_poly_filtro_azul_ar_159_price_base: '130.00',
    lp_poly_filtro_azul_ar_159_price_over: '165.00',

    // 6. LP PHOTO AR 1.56
    lp_photo_ar_156_cyl_threshold: '2.00',
    lp_photo_ar_156_price_base: '145.00',
    lp_photo_ar_156_price_over: '185.00',

    // 7. LP PHOTO Filtro Azul AR 1.56
    lp_photo_filtro_azul_ar_156_cyl_threshold: '2.00',
    lp_photo_filtro_azul_ar_156_price_base: '170.00',
    lp_photo_filtro_azul_ar_156_price_over: '215.00'
  });

  const [degreePolicy, setDegreePolicy] = useState({
    degree_threshold: '2.00',
    default_sale_price_le: '75.00',
    default_sale_price_gt: '95.00',
    is_active: true,
    cascade_update: false
  });

  const parseNum = (val, fallback = 2.00) => {
    if (val === '' || val === null || val === undefined) return fallback;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? fallback : parsed;
  };

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system-parameters/');
      if (res.data) {
        setParams(prev => ({ ...prev, ...res.data }));
      }

      const policyRes = await DegreePolicyService.getPolicy();
      if (policyRes.data) {
        const polData = policyRes.data;
        setDegreePolicy({
          degree_threshold: parseNum(polData.degree_threshold, 2.00).toFixed(2),
          default_sale_price_le: parseNum(polData.default_sale_price_le, 75.00).toFixed(2),
          default_sale_price_gt: parseNum(polData.default_sale_price_gt, 95.00).toFixed(2),
          is_active: polData.is_active,
          cascade_update: false
        });
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
      await api.post('/system-parameters/', params);

      const policyPayload = {
        degree_threshold: parseNum(params.lp_incolor_150_cyl_threshold, 2.00),
        default_sale_price_le: parseNum(params.lp_incolor_150_price_base, 60.00),
        default_sale_price_gt: parseNum(params.lp_incolor_150_price_over, 80.00),
        is_active: true
      };

      await DegreePolicyService.savePolicy(policyPayload, degreePolicy.cascade_update);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Erro ao salvar parâmetros.';
      alert(`Erro ao salvar parâmetros: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteCascadeUpdate = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      // 1. Salva todos os parâmetros do sistema e sincroniza os preços do catálogo de lentes
      await api.post('/system-parameters/', params);

      const policyPayload = {
        degree_threshold: parseNum(params.lp_incolor_150_cyl_threshold, 2.00),
        default_sale_price_le: parseNum(params.lp_incolor_150_price_base, 60.00),
        default_sale_price_gt: parseNum(params.lp_incolor_150_price_over, 80.00),
        is_active: true
      };

      await DegreePolicyService.savePolicy(policyPayload, true);

      setSavedSuccess(true);
      alert('Preços reajustados em lote para todo o catálogo de lentes e atualizados em todo o sistema!');
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Erro ao aplicar reajuste em lote.';
      alert(`Erro ao aplicar reajuste em lote: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
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
        {/* Formulários de Precificação Individuais para cada Tipo de Lente LP */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6d28d9', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={24} style={{ color: '#8b5cf6' }} />
              Formulários de Precificação por Tipo de Lente (Regra por Grau)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
              Configure a regra geral de revenda e os preços base vs ajustados por dioptria para cada família de lentes.
            </p>
          </div>

          {lpLensTypes.map((lens) => {
            const threshKey = `${lens.key}_cyl_threshold`;
            const baseKey = `${lens.key}_price_base`;
            const overKey = `${lens.key}_price_over`;

            const cylThresh = params[threshKey] || '2.00';
            const priceBase = params[baseKey] || lens.defaultBase;
            const priceOver = params[overKey] || lens.defaultOver;

            return (
              <div 
                key={lens.key} 
                style={{ 
                  background: '#fff', 
                  border: '1px solid rgba(168, 85, 247, 0.4)', 
                  borderRadius: '12px', 
                  padding: '24px', 
                  marginBottom: '20px', 
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.08)' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', margin: 0 }}>
                    <Sliders size={20} /> Tabela de Precificação Global por Grau — {lens.title}
                  </h3>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: 'rgba(139, 92, 246, 0.1)', color: '#6d28d9', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                    {lens.badge}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '20px' }}>
                  Regra de Precificação: Lentes com Esférico de 0 a 4.00 e Cilíndrico de 0 a 2.00 utilizam o preço base. Cilíndrico acima de 2.00 utiliza o preço ajustado.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'flex', alignItems: 'center', minHeight: '26px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Cilíndrico Padrão (D)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={cylThresh}
                      onChange={(e) => setParams({ ...params, [threshKey]: e.target.value })}
                      style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontWeight: 600 }}
                      required
                    />
                    <div style={{ minHeight: '36px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '6px', display: 'flex', alignItems: 'center' }}>
                      Limite de Cilíndrico padrão (2.00D).
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'flex', alignItems: 'center', minHeight: '26px', fontSize: '0.85rem', fontWeight: 600, color: '#10b981', marginBottom: '6px' }}>Preço Base (Sph 0-4 | Cyl 0-2)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceBase}
                      onChange={(e) => setParams({ ...params, [baseKey]: e.target.value })}
                      style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #10b981', fontWeight: 600, color: '#047857' }}
                      required
                    />
                    <div style={{ minHeight: '36px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '6px', display: 'flex', alignItems: 'center' }}>
                      Valor para Esférico 0 a 4 e Cilíndrico até 2.00D.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'flex', alignItems: 'center', minHeight: '26px', fontSize: '0.85rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '6px' }}>Preço Ajustado (Cyl &gt; 2.00D)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceOver}
                      onChange={(e) => setParams({ ...params, [overKey]: e.target.value })}
                      style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #8b5cf6', fontWeight: 600, color: '#6d28d9' }}
                      required
                    />
                    <div style={{ minHeight: '36px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '6px', display: 'flex', alignItems: 'center' }}>
                      Valor para Cilíndrico acima de 2.00D (ou Esférico &gt; 4.00D).
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Caixa de Confirmação & Reajuste em Lote para Lentes Cadastradas (Cascade Update) */}
          <div style={{ background: 'rgba(139, 92, 246, 0.06)', padding: '20px 24px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: '24px', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.08)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', color: '#4c1d95', fontWeight: 700, marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={degreePolicy.cascade_update}
                onChange={(e) => setDegreePolicy({ ...degreePolicy, cascade_update: e.target.checked })}
                style={{ width: '20px', height: '20px', accentColor: '#8b5cf6', cursor: 'pointer' }}
              />
              Replicar estes novos preços em lote para todo o catálogo de lentes já cadastrado (Cascade Update)
            </label>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'hsl(var(--text-muted))', paddingLeft: '32px', lineHeight: '1.4' }}>
              Ao ativar esta caixa ou clicar no botão de reajuste, o sistema atualizará automaticamente os preços de venda de todas as lentes físicas e produtos no catálogo financeiro.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleExecuteCascadeUpdate}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.92rem', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
              >
                <RefreshCw className={saving ? 'spin' : ''} size={18} />
                {saving ? 'Atualizando Todo o Sistema...' : 'Aplicar Reajuste em Lote em Todo o Catálogo Existente Agora'}
              </button>
            </div>
          </div>
        </div>

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
