import React, { useState, useEffect } from 'react';
import { LensService } from '../services/api';
import { Plus, Edit2, Trash2, Search, AlertTriangle, X, Layers, Percent, DollarSign } from 'lucide-react';

const AdminLentes = () => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');

  // Estados do Modal
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
    sale_price: ''
  });
  
  // Estado de confirmação de exclusão
  const [deleteId, setDeleteId] = useState(null);

  // Mensagens de Feedback
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadModels();
  }, []);

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

  const showFeedback = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setForm({
      brand: '',
      material: '',
      refractive_index: '1.56',
      treatment: '',
      diameter: '70',
      cost_price: '25.00',
      sale_price: '75.00'
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
      material: model.material,
      refractive_index: model.refractive_index.toString(),
      treatment: model.treatment,
      diameter: model.diameter.toString(),
      cost_price: fetchedCost,
      sale_price: parseFloat(model.sale_price || 0.00).toFixed(2)
    });
    setIsModalOpen(true);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações básicas
    if (!form.brand || !form.material || !form.treatment || !form.refractive_index || !form.diameter || !form.cost_price || !form.sale_price) {
      showFeedback("Por favor, preencha todos os campos.", "danger");
      return;
    }

    const payload = {
      brand: form.brand,
      material: form.material,
      refractive_index: parseFloat(form.refractive_index),
      treatment: form.treatment,
      diameter: parseInt(form.diameter),
      cost_price: parseFloat(form.cost_price),
      sale_price: parseFloat(form.sale_price)
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
            <Layers style={{ color: 'hsl(var(--primary))' }} /> Administração de Lentes & Preços
          </h2>
          <p style={{ fontSize: '0.85rem' }}>Cadastre, edite preços de custo e gerencie os modelos base de lentes oferecidos pela fábrica.</p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Novo Modelo de Lente
        </button>
      </div>

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
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Material</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Índice de Refração</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Tratamento</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Diâmetro</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Preço de Custo</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>Preço de Venda</th>
                <th style={{ padding: '12px 18px', color: 'hsl(var(--secondary))', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => (
                <tr key={model.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '14px 18px', color: 'white', fontWeight: 500 }}>{model.brand}</td>
                  <td style={{ padding: '14px 18px' }}>{model.material}</td>
                  <td style={{ padding: '14px 18px' }}>{parseFloat(model.refractive_index).toFixed(2)}</td>
                  <td style={{ padding: '14px 18px' }}>{model.treatment}</td>
                  <td style={{ padding: '14px 18px' }}>Ø {model.diameter} mm</td>
                  <td style={{ padding: '14px 18px', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                    R$ {parseFloat(model.cost_price).toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'hsl(var(--success))', fontWeight: 600 }}>
                    R$ {parseFloat(model.sale_price || 0.00).toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'end' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 8px' }}
                        onClick={() => handleOpenEditModal(model)}
                        title="Editar Preço e Modelo"
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-glass)', borderRadius: '12px', color: 'hsl(var(--text-muted))' }}>
          Nenhum modelo de lente encontrado para os filtros selecionados.
        </div>
      )}

      {/* Modal de Confirmação de Exclusão (Alerta de Cascata) */}
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

      {/* Modal de Criação / Edição de Modelo de Lente */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Layers size={22} style={{ color: 'hsl(var(--primary))' }} />
              {modalMode === 'create' ? "Novo Modelo de Lente" : "Editar Modelo & Preço"}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Marca *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Essilor, Hoya, Kodak" 
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Material *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Resina, Policarbonato, 1.67" 
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
              </div>

              <div className="form-group">
                <label className="form-label">Tratamento *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: Antirreflexo HMC, Blue Cut, Incolor" 
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <DollarSign size={14} style={{ color: 'hsl(var(--primary))' }} /> Preço de Custo *
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="0.00" 
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    required
                    style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <DollarSign size={14} style={{ color: 'hsl(var(--success))' }} /> Preço de Venda *
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="0.00" 
                    value={form.sale_price}
                    onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                    required
                    style={{ border: '1px solid hsl(var(--success) / 0.4)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'end', marginTop: '15px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? "Cadastrar Lente" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLentes;
