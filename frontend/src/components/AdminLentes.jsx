import React, { useState, useEffect } from 'react';
import { LensService, DegreePolicyService } from '../services/api';
import { Plus, Edit2, Trash2, Search, AlertTriangle, X, Layers, Percent, DollarSign, ShieldAlert, CheckCircle, RefreshCw, Sliders } from 'lucide-react';

const AdminLentes = () => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');
  const [userRole] = useState(() => localStorage.getItem('factory_user_role') || 'Operador');

  // Política Global de Precificação por Grau
  const [policy, setPolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isCascadeConfirmOpen, setIsCascadeConfirmOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    degree_threshold: '2.00',
    default_sale_price_le: '75.00',
    default_sale_price_gt: '95.00',
    is_active: true,
    cascade_update: false
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Estados do Modal de Lente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' ou 'edit'
  const [editingId, setEditingId] = useState(null);
  
  // Estado do formulário
  const [form, setForm] = useState({
    brand: '',
    material: '',
    refractive_index: '',
    treatment: '',
    diameter: '',
    cost_price: '',
    sale_price: '',
    degree_threshold: '2.00',
    sale_price_over_threshold: '95.00'
  });
  
  // Estado de confirmação de exclusão
  const [deleteId, setDeleteId] = useState(null);

  // Mensagens de Feedback
  const [message, setMessage] = useState(null);
  const [systemParams, setSystemParams] = useState({});

  const showFeedback = (text, type = 'success') => {
    setMessage({ text, type });
  };
const LP_TREATMENTS_OPTIONS = [
  { id: 'LP incolor 1.50', label: 'LP incolor 1.50', material: 'Resina', refractive_index: '1.50', keyPrefix: 'lp_incolor_150', defaultBase: '60.00', defaultOver: '80.00' },
  { id: 'LP Ar 1.56', label: 'LP Ar 1.56', material: 'Resina', refractive_index: '1.56', keyPrefix: 'lp_ar_156', defaultBase: '75.00', defaultOver: '95.00' },
  { id: 'LP filtro Azul AR 1.56', label: 'LP filtro Azul AR 1.56', material: 'Resina', refractive_index: '1.56', keyPrefix: 'lp_filtro_azul_ar_156', defaultBase: '95.00', defaultOver: '125.00' },
  { id: 'LP POLY AR 1.59', label: 'LP POLY AR 1.59', material: 'Policarbonato', refractive_index: '1.59', keyPrefix: 'lp_poly_ar_159', defaultBase: '110.00', defaultOver: '140.00' },
  { id: 'LP POLY FILTRO AZUL AR 1.59', label: 'LP POLY FILTRO AZUL AR 1.59', material: 'Policarbonato', refractive_index: '1.59', keyPrefix: 'lp_poly_filtro_azul_ar_159', defaultBase: '130.00', defaultOver: '165.00' },
  { id: 'LP PHOTO AR 1.56', label: 'LP PHOTO AR 1.56', material: 'Fotocromática', refractive_index: '1.56', keyPrefix: 'lp_photo_ar_156', defaultBase: '145.00', defaultOver: '185.00' },
  { id: 'LP PHOTO FILTRO AZUL AR 1.56', label: 'LP PHOTO FILTRO AZUL AR 1.56', material: 'Fotocromática', refractive_index: '1.56', keyPrefix: 'lp_photo_filtro_azul_ar_156', defaultBase: '170.00', defaultOver: '215.00' }
];

  useEffect(() => {
    loadModels();
    loadPolicy();
    loadSystemParams();
  }, []);

  const loadSystemParams = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('factory_token');
      const res = await fetch('/api/v1/system-parameters/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSystemParams(data);
      }
    } catch (err) {
      console.warn("Erro ao buscar parâmetros do sistema:", err);
    }
  };

  const applyLpTreatment = (treatmentId, currentParams = systemParams) => {
    const item = LP_TREATMENTS_OPTIONS.find(t => t.id === treatmentId) || LP_TREATMENTS_OPTIONS[0];
    const baseKey = `${item.keyPrefix}_price_base`;
    const overKey = `${item.keyPrefix}_price_over`;
    const threshKey = `${item.keyPrefix}_cyl_threshold`;

    const priceBase = currentParams[baseKey] || item.defaultBase;
    const priceOver = currentParams[overKey] || item.defaultOver;
    const cylThresh = currentParams[threshKey] || '2.00';

    setForm(prev => ({
      ...prev,
      treatment: item.id,
      material: item.material,
      refractive_index: item.refractive_index,
      sale_price: parseFloat(priceBase).toFixed(2),
      sale_price_over_threshold: parseFloat(priceOver).toFixed(2),
      degree_threshold: parseFloat(cylThresh).toFixed(2)
    }));
  };

  const loadPolicy = async () => {
    setLoadingPolicy(true);
    try {
      const response = await DegreePolicyService.getPolicy();
      if (response.data) {
        setPolicy(response.data);
        setPolicyForm({
          degree_threshold: parseFloat(response.data.degree_threshold || 2.00).toFixed(2),
          default_sale_price_le: parseFloat(response.data.default_sale_price_le || 75.00).toFixed(2),
          default_sale_price_gt: parseFloat(response.data.default_sale_price_gt || 95.00).toFixed(2),
          is_active: response.data.is_active,
          cascade_update: false
        });
      }
    } catch (err) {
      console.error("Erro ao carregar política global de precificação:", err);
    } finally {
      setLoadingPolicy(false);
    }
  };

  useEffect(() => {
    filterData();
  }, [searchTerm, filterBrand, filterTreatment, models]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await LensService.getModels();
      setModels(response.data);
    } catch (err) {
      console.error("Erro ao buscar modelos de lentes:", err);
      showFeedback("Erro ao carregar os modelos de lentes.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let result = [...models];

    // Busca textual global
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.brand.toLowerCase().includes(term) ||
        m.material.toLowerCase().includes(term) ||
        m.treatment.toLowerCase().includes(term)
      );
    }

    // Filtro por marca
    if (filterBrand) {
      const brandLower = filterBrand.trim().toLowerCase();
      result = result.filter(m => (m.brand || '').trim().toLowerCase() === brandLower);
    }

    // Filtro por tratamento
    if (filterTreatment) {
      const treatmentLower = filterTreatment.trim().toLowerCase();
      result = result.filter(m => (m.treatment || '').trim().toLowerCase() === treatmentLower);
    }

    setFilteredModels(result);
  };

  const handleSavePolicyClick = (e) => {
    e.preventDefault();
    if (policyForm.cascade_update) {
      setIsCascadeConfirmOpen(true);
    } else {
      executeSavePolicy(false);
    }
  };

  const executeSavePolicy = async (shouldCascade) => {
    setSavingPolicy(true);
    try {
      const payload = {
        degree_threshold: parseFloat(policyForm.degree_threshold || 2.00),
        default_sale_price_le: parseFloat(policyForm.default_sale_price_le || 75.00),
        default_sale_price_gt: parseFloat(policyForm.default_sale_price_gt || 95.00),
        is_active: policyForm.is_active
      };
      const response = await DegreePolicyService.savePolicy(payload, shouldCascade);
      setPolicy(response.data);
      setIsPolicyModalOpen(false);
      setIsCascadeConfirmOpen(false);
      showFeedback(
        shouldCascade 
          ? "Política Global de Precificação por Grau salva e replicada em lote para todo o catálogo com sucesso!"
          : "Política Global de Precificação por Grau atualizada com sucesso!",
        "success"
      );
      loadModels();
    } catch (err) {
      console.error(err);
      showFeedback(err.response?.data?.detail || "Erro ao salvar política global de precificação.", "danger");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setForm({
      lens_type: 'VISAO_SIMPLES_ESTOQUE',
      brand: '',
      name: '',
      matrix_type: 'LP_GRADE',
      material: '',
      refractive_index: '1.56',
      treatment: '',
      diameter: '70',
      cost_price: '25.00',
      sale_price: policy?.default_sale_price_le ? parseFloat(policy.default_sale_price_le).toFixed(2) : '75.00',
      degree_threshold: policy?.degree_threshold ? parseFloat(policy.degree_threshold).toFixed(2) : '2.00',
      sale_price_over_threshold: policy?.default_sale_price_gt ? parseFloat(policy.default_sale_price_gt).toFixed(2) : '95.00',
      sim_sph: '2.00',
      sim_cyl: '1.50'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (model) => {
    setModalMode('edit');
    setEditingId(model.id);
    let fetchedCost = parseFloat(model.cost_price).toFixed(2);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/supplier-orders/last-cost/${model.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.last_purchased_cost > 0) {
          fetchedCost = parseFloat(data.last_purchased_cost).toFixed(2);
        }
      }
    } catch (err) {
      console.warn("Custo no fornecedor mantido.");
    }

    setForm({
      brand: model.brand,
      name: model.name || model.brand,
      matrix_type: model.matrix_type || 'LP_GRADE',
      material: model.material,
      refractive_index: model.refractive_index.toString(),
      treatment: model.treatment,
      diameter: model.diameter.toString(),
      cost_price: fetchedCost,
      sale_price: parseFloat(model.sale_price || 0.00).toFixed(2),
      degree_threshold: parseFloat(model.degree_threshold || 2.00).toFixed(2),
      sale_price_over_threshold: parseFloat(model.sale_price_over_threshold || 95.00).toFixed(2)
    });
    setIsModalOpen(true);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações básicas
    if (!form.brand || !form.material || !form.treatment || !form.refractive_index || !form.cost_price || !form.sale_price) {
      showFeedback("Por favor, preencha todos os campos obrigatórios.", "danger");
      return;
    }

    const payload = {
      brand: form.brand,
      name: form.name || form.brand,
      matrix_type: form.matrix_type || 'LP_GRADE',
      material: form.material,
      refractive_index: parseFloat(form.refractive_index),
      treatment: form.treatment,
      diameter: parseInt(form.diameter || 70),
      cost_price: parseFloat(form.cost_price),
      sale_price: parseFloat(form.sale_price),
      degree_threshold: parseFloat(form.degree_threshold || 2.00),
      sale_price_over_threshold: parseFloat(form.sale_price_over_threshold || 95.00)
    };

    try {
      if (modalMode === 'create') {
        await LensService.createModel(payload);
        showFeedback("Modelo de lente cadastrado com sucesso!");
      } else {
        await LensService.updateModel(editingId, payload);
        showFeedback("Modelo de lente atualizado com sucesso!");
      }
      setIsModalOpen(false);
      loadModels();
    } catch (err) {
      console.error(err);
      showFeedback(err.response?.data?.detail || "Erro ao salvar o modelo de lente.", "danger");
    }
  };

  const handleDelete = async (id) => {
    try {
      await LensService.deleteModel(id);
      showFeedback("Modelo de lente e grade de estoque vinculados removidos com sucesso!", "success");
      setDeleteId(null);
      loadModels();
    } catch (err) {
      console.error(err);
      showFeedback(err.response?.data?.detail || "Erro ao remover o modelo de lente.", "danger");
      setDeleteId(null);
    }
  };

  // Coleta valores únicos para os filtros do cabeçalho
  const getUniqueNormalizedItems = (list) => {
    const map = new Map();
    list.filter(Boolean).forEach(raw => {
      const trimmed = String(raw).trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, trimmed);
      } else {
        const existing = map.get(lower);
        if (existing === existing.toLowerCase() && trimmed !== trimmed.toLowerCase()) {
          map.set(lower, trimmed);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  };

  const uniqueBrands = getUniqueNormalizedItems(models.map(m => m.brand));
  const uniqueTreatments = getUniqueNormalizedItems(models.map(m => m.treatment));

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers style={{ color: 'hsl(var(--primary))' }} /> Administração de Lentes & Precificação por Grau
          </h2>
          <p style={{ fontSize: '0.85rem' }}>Visualização de catálogo, edição de preços e regras de precificação por grau (para cadastrar novas lentes, utilize o Cadastrador Unificado).</p>
        </div>
      </div>

      {/* Card de Política Global de Precificação por Grau */}
      <div style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Percent size={18} style={{ color: '#a855f7' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#e9d5ff', fontWeight: 600 }}>Política Global de Precificação por Grau</h3>
            {policy && policy.is_active ? (
              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>ATIVA</span>
            ) : (
              <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>NÃO CONFIGURADA / INATIVA</span>
            )}
          </div>
          {policy && policy.is_active ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
              Regra Vigente: Limite de <strong>{parseFloat(policy.degree_threshold).toFixed(2)} D</strong> | 
              Graus Baixos (≤ {parseFloat(policy.degree_threshold).toFixed(2)}D): <strong style={{ color: 'hsl(var(--success))' }}>R$ {parseFloat(policy.default_sale_price_le).toFixed(2)}</strong> | 
              Graus Altos (&gt; {parseFloat(policy.degree_threshold).toFixed(2)}D): <strong style={{ color: '#a855f7' }}>R$ {parseFloat(policy.default_sale_price_gt).toFixed(2)}</strong>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--danger))' }}>
              ⚠️ A regra global de precificação por grau deve ser parametrizada pelo Administrador antes do cadastro de lentes.
            </p>
          )}
        </div>

        {userRole === 'Administrador' && (
          <button className="btn btn-secondary" onClick={() => setIsPolicyModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#e9d5ff' }}>
            <Edit2 size={16} /> Editar Regra Global
          </button>
        )}
      </div>

      {/* Banner de Bloqueio por Precedência de Configuração */}
      {(!policy || !policy.is_active) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert style={{ color: 'hsl(var(--danger))', flexShrink: 0 }} size={22} />
          <div style={{ fontSize: '0.88rem', color: '#fca5a5' }}>
            <strong>Precedência de Configuração Obrigatória:</strong> A Política de Precificação por Grau deve ser parametrizada pelo Administrador antes que qualquer lente possa ser cadastrada no sistema.
          </div>
        </div>
      )}

      {/* Banner de Feedback */}
      {message && (
        <div style={{ 
          padding: '12px 15px', 
          borderRadius: '8px', 
          background: message.type === 'danger' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)', 
          border: message.type === 'danger' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)',
          color: message.type === 'danger' ? 'hsl(var(--danger))' : 'hsl(var(--success))',
          marginBottom: '20px',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{
        background: 'rgba(8, 10, 18, 0.3)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        padding: '15px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ flex: '1 1 250px', position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Pesquisar por marca, material ou tratamento..." 
            className="form-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '35px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        </div>

        <div style={{ width: '180px' }}>
          <select className="form-control" value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
            <option value="">Todas as Marcas</option>
            {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ width: '180px' }}>
          <select className="form-control" value={filterTreatment} onChange={(e) => setFilterTreatment(e.target.value)}>
            <option value="">Todos os Tratamentos</option>
            {uniqueTreatments.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela de Dados */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>Carregando dados da fábrica...</div>
      ) : filteredModels.length > 0 ? (
        <div style={{ overflowX: 'auto', background: 'rgba(8, 10, 18, 0.2)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Marca</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Modelo / Nome</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Grade / Matriz</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Material</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Índice</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Tratamento</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Diâmetro</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Custo</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Preço (≤ Limite)</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Preço (&gt; Limite)</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => {
                const limitStr = parseFloat(model.degree_threshold || 2.00).toFixed(2);
                return (
                  <tr key={model.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '14px 18px', color: 'white', fontWeight: 500 }}>{model.brand}</td>
                    <td style={{ padding: '14px 18px', color: 'white', fontWeight: 600 }}>{model.name || model.brand}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {model.matrix_type || 'LP_GRADE'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>{model.material}</td>
                    <td style={{ padding: '14px 18px' }}>{parseFloat(model.refractive_index).toFixed(2)}</td>
                    <td style={{ padding: '14px 18px' }}>{model.treatment}</td>
                    <td style={{ padding: '14px 18px' }}>Ø {model.diameter} mm</td>
                    <td style={{ padding: '14px 18px', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                      R$ {parseFloat(model.cost_price).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'hsl(var(--success))', fontWeight: 600 }}>
                      R$ {parseFloat(model.sale_price || 0.00).toFixed(2)}
                      <span style={{ fontSize: '0.72rem', display: 'block', color: 'hsl(var(--text-muted))' }}>até Grau {limitStr}</span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#a855f7', fontWeight: 600 }}>
                      R$ {parseFloat(model.sale_price_over_threshold || 95.00).toFixed(2)}
                      <span style={{ fontSize: '0.72rem', display: 'block', color: 'hsl(var(--text-muted))' }}>acima Grau {limitStr}</span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'end' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 8px' }}
                          onClick={() => handleOpenEditModal(model)}
                          title="Editar Regra de Preços e Grau"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 8px', borderColor: 'hsl(var(--danger) / 0.2)', color: 'hsl(var(--danger))' }}
                          onClick={() => setDeleteId(model.id)}
                          title="Excluir Lente"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-glass)', borderRadius: '12px', color: 'hsl(var(--text-muted))' }}>
          Nenhum modelo de lente encontrado para os filtros selecionados.
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', border: '1px solid hsl(var(--danger) / 0.3)' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setDeleteId(null)}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', gap: '15px', color: 'hsl(var(--danger))', marginBottom: '15px', marginTop: '10px' }}>
              <AlertTriangle size={36} style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 5px 0', color: 'hsl(var(--danger))', fontWeight: 800 }}>Exclusão em Cascata Detectada!</h3>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                  Ao deletar este modelo base de lente, <strong style={{ color: 'hsl(var(--text-primary))' }}>todos os itens físicos e grades correspondentes em estoque serão permanentemente excluídos</strong> do banco de dados. 
                </p>
              </div>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '20px' }}>
              Esta ação não pode ser desfeita e afeta o controle de estoque global. Tem certeza que deseja prosseguir?
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'hsl(var(--danger))', border: 'none' }} onClick={() => handleDelete(deleteId)}>
                Sim, Excluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Modelo de Lente por Tipo */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Layers size={22} style={{ color: 'hsl(var(--primary))' }} />
              {modalMode === 'create' ? "Cadastro por Tipo de Lente" : "Editar Lente & Regra de Preços"}
            </h3>

            {/* Seletor de Tipo de Lente */}
            {modalMode === 'create' && (
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '8px', display: 'block' }}>
                  SELECIONE O TIPO / CATEGORIA DA LENTE:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'VISAO_SIMPLES_ESTOQUE', label: 'VS Pronta', desc: 'Estoque Grade' },
                    { id: 'VISAO_SIMPLES_RX', label: 'VS Surfaçada', desc: 'Sob Medida RX' },
                    { id: 'MULTIFOCAL', label: 'Multifocal', desc: 'Freeform / Conv.' },
                    { id: 'BIFOCAL', label: 'Bifocal', desc: 'Flattop / Ultex' },
                    { id: 'BLOCO_SEMIACABADO', label: 'Bloco', desc: 'Semiacabado' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, lens_type: t.id }))}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: (form.lens_type || 'VISAO_SIMPLES_ESTOQUE') === t.id ? '2px solid #a855f7' : '1px solid var(--border-glass)',
                        background: (form.lens_type || 'VISAO_SIMPLES_ESTOQUE') === t.id ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: (form.lens_type || 'VISAO_SIMPLES_ESTOQUE') === t.id ? '#e9d5ff' : 'hsl(var(--text-muted))',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem' }}>{t.label}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Campos Globais: Marca, Modelo e Grade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Marca da Lente *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Essilor, Hoya, Kodak, NovaLab" 
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo / Nome da Lente *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Crizal Sapphire, Visão Simples AR 1.56" 
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>Grade / Matriz Óptica *</label>
                  <select 
                    className="form-control"
                    value={form.matrix_type || 'LP_GRADE'}
                    onChange={(e) => setForm({ ...form, matrix_type: e.target.value })}
                    required
                    style={{ fontWeight: 600 }}
                  >
                    <option value="LP_GRADE">Visão Simples Lente Pronta (LP_GRADE)</option>
                    <option value="GRADE_167">Grade 1.67 Alto Índice (GRADE_167)</option>
                    <option value="MF_ACB">Multifocal Acabado (MF_ACB)</option>
                    <option value="BLOCO_VS">Bloco Visão Simples (BLOCO_VS)</option>
                    <option value="MF_BLOCO">Bloco Multifocal (MF_BLOCO)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Material *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Resina, Policarbonato, Trivex, 1.67" 
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Índice de Refração e Diâmetro / Curva Base */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Índice de Refração *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="Ex: 1.56" 
                    value={form.refractive_index}
                    onChange={(e) => setForm({ ...form, refractive_index: e.target.value })}
                    required
                  />
                </div>
                {form.lens_type === 'BLOCO_SEMIACABADO' ? (
                  <div className="form-group">
                    <label className="form-label">Curva Base (D) *</label>
                    <input 
                      type="number" 
                      step="0.25"
                      className="form-control" 
                      placeholder="Ex: 4.00" 
                      value={form.base_curve || '4.00'}
                      onChange={(e) => setForm({ ...form, base_curve: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Diâmetro (mm) *</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Ex: 70" 
                      value={form.diameter}
                      onChange={(e) => setForm({ ...form, diameter: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Campos específicos por Tipo de Lente */}
              {form.lens_type === 'MULTIFOCAL' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'rgba(168, 85, 247, 0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                  <div className="form-group">
                    <label className="form-label">Desenho / Tecnologia</label>
                    <select 
                      className="form-control"
                      value={form.design || 'Freeform Digital'}
                      onChange={(e) => setForm({ ...form, design: e.target.value })}
                    >
                      <option value="Freeform Digital">Freeform Digital</option>
                      <option value="Convencional">Convencional</option>
                      <option value="Ocupacional">Ocupacional (Regressiva)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Faixa de Adição (D)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: +0.75 a +3.50" 
                      value={form.addition_range || '+0.75 a +3.50'}
                      onChange={(e) => setForm({ ...form, addition_range: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {form.lens_type === 'BIFOCAL' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'rgba(59, 130, 246, 0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Segmento</label>
                    <select 
                      className="form-control"
                      value={form.segment_type || 'Flattop 28'}
                      onChange={(e) => setForm({ ...form, segment_type: e.target.value })}
                    >
                      <option value="Flattop 28">Flattop 28</option>
                      <option value="Flattop 35">Flattop 35</option>
                      <option value="Ultex 40">Ultex 40</option>
                      <option value="Executive">Executive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Faixa de Adição (D)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: +1.00 a +3.00" 
                      value={form.addition_range || '+1.00 a +3.00'}
                      onChange={(e) => setForm({ ...form, addition_range: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Tratamento e Preço de Custo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: '#8b5cf6' }}>Tratamento / Família LP *</label>
                  <select 
                    className="form-control" 
                    value={form.treatment || 'LP Ar 1.56'}
                    onChange={(e) => applyLpTreatment(e.target.value)}
                    required
                    style={{ border: '1px solid #8b5cf6', fontWeight: 600, color: '#4c1d95' }}
                  >
                    {LP_TREATMENTS_OPTIONS.map((lp) => (
                      <option key={lp.id} value={lp.id}>
                        {lp.label}
                      </option>
                    ))}
                  </select>
                  <small style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '4px', display: 'block' }}>
                    Ajusta automaticamente Material, Índice e Regra de Preços do Parâmetro do Sistema.
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Preço Custo Fornecedor (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="25.00" 
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Painel do Anexo: Regra de Precificação por Grau & Simulador Dinâmico */}
              <div style={{
                background: '#fff',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.06)'
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={18} /> Tabela de Precificação Global por Grau (Regra Geral)
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '14px', lineHeight: '1.4' }}>
                  Regra de Precificação: Lentes com Esférico de 0 a 4.00 e Cilíndrico de 0 a 2.00 utilizam o preço base. Cilíndrico acima de 2.00 utiliza o preço ajustado.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Cilíndrico Padrão (D)</label>
                    <input 
                      type="number" 
                      step="0.25"
                      className="form-control"
                      value={form.degree_threshold || '2.00'}
                      onChange={(e) => setForm({ ...form, degree_threshold: e.target.value })}
                      style={{ fontSize: '0.88rem', fontWeight: 600 }}
                    />
                    <small style={{ fontSize: '0.68rem', color: '#64748b' }}>Limite padrão (2.00D)</small>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#10b981', marginBottom: '4px' }}>Preço Base (Sph 0-4 | Cyl 0-2)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control"
                      value={form.sale_price || '75.00'}
                      onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                      style={{ border: '1px solid #10b981', color: '#047857', fontSize: '0.88rem', fontWeight: 700 }}
                    />
                    <small style={{ fontSize: '0.68rem', color: '#64748b' }}>Esférico 0 a 4 e Cilíndrico ≤ 2.00D</small>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '4px' }}>Preço Ajustado (Cyl &gt; 2.00D)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control"
                      value={form.sale_price_over_threshold || '95.00'}
                      onChange={(e) => setForm({ ...form, sale_price_over_threshold: e.target.value })}
                      style={{ border: '1px solid #8b5cf6', color: '#6d28d9', fontSize: '0.88rem', fontWeight: 700 }}
                    />
                    <small style={{ fontSize: '0.68rem', color: '#64748b' }}>Cilíndrico &gt; 2.00D (ou Esférico &gt; 4.00D)</small>
                  </div>
                </div>

                {/* Simulador Interativo em Tempo Real */}
                <div style={{ background: 'rgba(139, 92, 246, 0.06)', borderRadius: '8px', padding: '10px 14px', border: '1px dashed rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', marginBottom: '6px' }}>⚡ SIMULADOR DE DIOPTRIA E PREÇO EM TEMPO REAL:</div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Esférico:</span>
                      <input 
                        type="number" 
                        step="0.25" 
                        style={{ width: '70px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                        value={form.sim_sph || '2.00'}
                        onChange={(e) => setForm({ ...form, sim_sph: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Cilíndrico:</span>
                      <input 
                        type="number" 
                        step="0.25" 
                        style={{ width: '70px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                        value={form.sim_cyl || '1.50'}
                        onChange={(e) => setForm({ ...form, sim_cyl: e.target.value })}
                      />
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      {(() => {
                        const s = Math.abs(parseFloat(form.sim_sph || 0));
                        const c = Math.abs(parseFloat(form.sim_cyl || 0));
                        const isBase = s <= 4.00 && c <= 2.00;
                        const price = isBase ? (form.sale_price || '75.00') : (form.sale_price_over_threshold || '95.00');
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${isBase ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.72rem', background: isBase ? '#10b981' : '#8b5cf6', color: '#fff' }}>
                              {isBase ? 'PREÇO BASE' : 'PREÇO AJUSTADO'}
                            </span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: isBase ? '#047857' : '#6d28d9' }}>
                              R$ {parseFloat(price || 0).toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!policy || !policy.is_active}>
                  {modalMode === 'create' ? "Cadastrar Lente" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição da Política Global de Precificação por Grau */}
      {isPolicyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.3)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent style={{ color: '#a855f7' }} /> Editar Política Global de Preços por Grau
              </h3>
              <button onClick={() => setIsPolicyModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePolicyClick} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Grau Limite de Corte (Dioptrias)</label>
                <input 
                  type="number" 
                  step="0.25" 
                  className="form-control" 
                  value={policyForm.degree_threshold} 
                  onChange={e => setPolicyForm({ ...policyForm, degree_threshold: e.target.value })}
                  required 
                />
                <small style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Exemplo: 2.00 D (Diferencia lentes de grau baixo vs grau alto)</small>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'hsl(var(--success))', fontWeight: 600 }}>Preço (≤ Limite)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={policyForm.default_sale_price_le} 
                    onChange={e => setPolicyForm({ ...policyForm, default_sale_price_le: e.target.value })}
                    required 
                    style={{ border: '1px solid hsl(var(--success) / 0.4)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#a855f7', fontWeight: 600 }}>Preço (&gt; Limite)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={policyForm.default_sale_price_gt} 
                    onChange={e => setPolicyForm({ ...policyForm, default_sale_price_gt: e.target.value })}
                    required 
                    style={{ border: '1px solid rgba(168, 85, 247, 0.4)' }}
                  />
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem', color: 'white', fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={policyForm.cascade_update} 
                    onChange={e => setPolicyForm({ ...policyForm, cascade_update: e.target.checked })} 
                    style={{ width: '18px', height: '18px', accentColor: '#a855f7' }}
                  />
                  Replicar e atualizar preços em lote para todo o catálogo (Cascade Update)
                </label>
                <p style={{ margin: '6px 0 0 28px', fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                  Aplica estes novos valores retroativamente a todas as {models.length} lentes cadastradas e seus produtos comerciais.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPolicyModalOpen(false)} disabled={savingPolicy}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#a855f7', borderColor: '#a855f7' }} disabled={savingPolicy}>
                  {savingPolicy ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw className="spin" size={16} /> Salvando...</span>
                  ) : "Salvar Política Global"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Impacto Financeiro (Cascade Update Alert) */}
      {isCascadeConfirmOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', border: '1px solid rgba(239, 68, 68, 0.4)', background: '#0f0814' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <ShieldAlert style={{ color: 'hsl(var(--danger))' }} size={32} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'white' }}>Confirmação de Impacto Financeiro</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: '#fca5a5', lineHeight: '1.5', marginBottom: '20px' }}>
              Atenção: Esta ação reajustará os preços de venda de <strong>{models.length} lentes ativas</strong> no estoque de forma irreversível e atualizará a tabela de preços do catálogo financeiro. Deseja continuar?
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCascadeConfirmOpen(false)} disabled={savingPolicy}>
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={() => executeSavePolicy(true)} 
                disabled={savingPolicy}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {savingPolicy ? <RefreshCw className="spin" size={16} /> : <CheckCircle size={16} />}
                Sim, Reajustar {models.length} Lentes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLentes;
