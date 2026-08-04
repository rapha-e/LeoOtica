import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Search, Edit2, Trash2, Clock, Check, 
  X, AlertCircle, RefreshCw, Filter, ShieldAlert, History
} from 'lucide-react';
import { TechnicalServiceService } from '../services/api';

const CadastroServicos = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE

  const [userRole] = useState(() => localStorage.getItem('factory_user_role') || 'Operador');

  // Estados dos Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Formulário
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    is_active: true,
    change_reason: ''
  });

  const [originalPrice, setOriginalPrice] = useState(null);

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const activeParam = statusFilter === 'ALL' ? null : (statusFilter === 'ACTIVE');
      const response = await TechnicalServiceService.list(searchQuery, activeParam);
      setItems(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar os serviços.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadItems();
  };

  // Abre formulário para criação
  const handleOpenCreate = () => {
    setFormData({
      id: null,
      name: '',
      description: '',
      price: '',
      is_active: true,
      change_reason: ''
    });
    setOriginalPrice(null);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Abre formulário para edição
  const handleOpenEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      is_active: item.is_active,
      change_reason: ''
    });
    setOriginalPrice(item.price);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Verifica se o preço mudou na edição
  const isPriceChanged = () => {
    if (!formData.id) return false;
    const currentPrice = parseFloat(formData.price) || 0;
    const origPrice = parseFloat(originalPrice) || 0;
    return currentPrice !== origPrice;
  };

  // Salvar Item
  const handleSaveItem = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError('O nome do serviço é obrigatório.');
      return;
    }

    const priceVal = parseFloat(formData.price);
    if (isNaN(priceVal) || priceVal < 0) {
      setFormError('Informe um valor de preço válido (maior ou igual a zero).');
      return;
    }

    const priceChanged = isPriceChanged();
    if (priceChanged && !formData.change_reason.trim()) {
      setFormError('É obrigatório informar a justificativa do reajuste de preço.');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        price: priceVal,
        is_active: formData.is_active,
        change_reason: formData.change_reason || null
      };

      if (formData.id) {
        const res = await TechnicalServiceService.update(formData.id, payload);
        showToast('Serviço técnico atualizado com sucesso!', 'success');
        setItems(items.map(i => i.id === formData.id ? res.data : i));
      } else {
        const res = await TechnicalServiceService.create(payload);
        showToast('Serviço técnico adicionado com sucesso!', 'success');
        setItems([res.data, ...items]);
      }
      setIsFormModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao salvar o serviço.');
    }
  };

  // Exclusão
  const handleOpenDelete = (item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    try {
      await TechnicalServiceService.delete(selectedItem.id);
      showToast('Serviço excluído com sucesso!', 'success');
      setItems(items.filter(i => i.id !== selectedItem.id));
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Erro ao excluir o serviço.', 'error');
    }
  };

  // Histórico de Versões
  const handleOpenHistory = async (item) => {
    setSelectedItem(item);
    setHistoryData([]);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const response = await TechnicalServiceService.getPriceHistory(item.id);
      setHistoryData(response.data);
    } catch (err) {
      console.error(err);
      showToast('Falha ao carregar o histórico de preços.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={28} style={{ color: 'hsl(var(--primary))' }} />
            Cadastro de Serviços & Valores
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Gerencie os serviços prestados pela fábrica (ex: Montagem, Nylon, Surfaçagem) e seus respectivos valores.
          </p>
        </div>
        
        <div>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Cadastrar Serviço
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="glass-panel" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input 
                type="text" 
                className="form-control"
                style={{ paddingLeft: '44px' }}
                placeholder="Buscar serviço por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              Buscar
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Filter size={16} /> FILTRAR STATUS:
            </span>
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.03)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setStatusFilter('ALL')}
                className="btn btn-sm"
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: statusFilter === 'ALL' ? 'white' : 'transparent',
                  color: statusFilter === 'ALL' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                  boxShadow: statusFilter === 'ALL' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  fontWeight: statusFilter === 'ALL' ? 700 : 500
                }}
              >
                Todos
              </button>
              <button 
                onClick={() => setStatusFilter('ACTIVE')}
                className="btn btn-sm"
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: statusFilter === 'ACTIVE' ? 'white' : 'transparent',
                  color: statusFilter === 'ACTIVE' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                  boxShadow: statusFilter === 'ACTIVE' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  fontWeight: statusFilter === 'ACTIVE' ? 700 : 500
                }}
              >
                Ativos
              </button>
              <button 
                onClick={() => setStatusFilter('INACTIVE')}
                className="btn btn-sm"
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: statusFilter === 'INACTIVE' ? 'white' : 'transparent',
                  color: statusFilter === 'INACTIVE' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                  boxShadow: statusFilter === 'INACTIVE' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  fontWeight: statusFilter === 'INACTIVE' ? 700 : 500
                }}
              >
                Inativos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Serviços */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
          <p>Carregando serviços...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border-glass)' }}>
          <Wrench size={40} style={{ color: 'hsl(var(--text-muted))', marginBottom: '15px' }} />
          <p style={{ fontWeight: 600 }}>Nenhum serviço técnico encontrado.</p>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '5px' }}>Adicione novos serviços clicando no botão no topo.</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {items.map(item => (
            <div key={item.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative', border: item.is_active ? '1px solid var(--border-glass)' : '1px dashed var(--border-glass)', opacity: item.is_active ? 1 : 0.75 }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{item.name}</h3>
                  <span style={{ 
                    display: 'inline-block',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    marginTop: '5px',
                    background: item.is_active ? 'hsl(var(--success) / 0.1)' : 'rgba(0,0,0,0.06)',
                    color: item.is_active ? 'hsl(var(--success))' : 'hsl(var(--text-muted))'
                  }}>
                    {item.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'hsl(var(--primary))', display: 'block' }}>
                    {formatCurrency(item.price)}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>v{item.current_version}</span>
                </div>
              </div>

              {item.description ? (
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', minHeight: '40px', margin: 0 }}>
                  {item.description}
                </p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic', minHeight: '40px', margin: 0 }}>
                  Sem descrição informada.
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: 'auto' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => handleOpenEdit(item)}
                >
                  <Edit2 size={14} /> Editar
                </button>
                
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Histórico de Preços"
                  onClick={() => handleOpenHistory(item)}
                >
                  <History size={14} />
                </button>

                {userRole === 'Administrador' && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '8px 12px', color: 'hsl(var(--danger))', borderColor: 'rgba(239,68,68,0.2)' }}
                    title="Excluir Serviço"
                    onClick={() => handleOpenDelete(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Modal de Formulário (Criar / Editar) */}
      {isFormModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFormModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button 
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
              onClick={() => setIsFormModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '15px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              {formData.id ? 'Editar Serviço Técnico' : 'Cadastrar Novo Serviço'}
            </h3>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Serviço</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Ex: Montagem Aro Fechado"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea 
                  className="form-control"
                  rows="3"
                  placeholder="Descreva detalhes ou especificações sobre a execução..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Preço de Tabela (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                {formData.id && (
                  <div className="form-group" style={{ justifyContent: 'center' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '15px' }}>
                      <input 
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>Serviço Ativo</span>
                    </label>
                  </div>
                )}
              </div>

              {isPriceChanged() && (
                <div className="form-group" style={{ background: 'hsl(var(--warning) / 0.05)', border: '1px solid hsl(var(--warning) / 0.2)', padding: '12px', borderRadius: '10px' }}>
                  <label className="form-label" style={{ color: 'hsl(var(--warning))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Justificativa do Reajuste de Preço
                  </label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Ex: Ajuste de custo de insumos ou maquinário"
                    value={formData.change_reason}
                    onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                    style={{ background: 'white' }}
                  />
                </div>
              )}

              {formError && (
                <div style={{ color: 'hsl(var(--danger))', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsFormModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal de Histórico de Preços */}
      {isHistoryModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <button 
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}
              onClick={() => setIsHistoryModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History style={{ color: 'hsl(var(--primary))' }} /> Histórico de Preços: {selectedItem.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '20px' }}>
              Confira a evolução e os reajustes deste serviço registrados no sistema.
            </p>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <RefreshCw className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.85rem' }}>Carregando histórico...</p>
              </div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--text-muted))' }}>
                Nenhum histórico de reajuste encontrado para este serviço.
              </div>
            ) : (
              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {historyData.map((hist, index) => (
                  <div key={hist.id} className="glass-panel" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                        Versão {hist.version} {index === 0 && <span style={{ color: 'hsl(var(--success))', marginLeft: '4px' }}>(Vigente)</span>}
                      </span>
                      <strong style={{ fontSize: '1.1rem', color: 'hsl(var(--primary))' }}>
                        {formatCurrency(hist.price)}
                      </strong>
                    </div>

                    <p style={{ fontSize: '0.85rem', margin: '4px 0', color: 'hsl(var(--text-secondary))' }}>
                      Motivo: <strong>{hist.change_reason || 'Não informado'}</strong>
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '8px', borderTop: '1px dashed var(--border-glass)', paddingTop: '6px' }}>
                      <span>Início: {formatDate(hist.start_date)}</span>
                      {hist.end_date && <span>Fim: {formatDate(hist.end_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => setIsHistoryModalOpen(false)}>
              Fechar Histórico
            </button>
          </div>
        </div>
      )}

      {/* 3. Modal de Confirmação de Exclusão */}
      {isDeleteModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <ShieldAlert style={{ color: 'hsl(var(--danger))' }} /> Confirmar Exclusão
            </h3>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
              Tem certeza que deseja excluir permanentemente o serviço técnico <strong>{selectedItem.name}</strong> e todo o seu histórico de reajustes?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '8px' }}>
              Esta ação é irreversível e pode afetar ordens de serviço anteriores.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'hsl(var(--danger))', color: 'white' }} onClick={handleDeleteItem}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flutuante premium de feedback */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(12px)',
          border: toast.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
          color: 'white',
          padding: '14px 28px',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          fontSize: '0.9rem',
          fontWeight: 600,
          transition: 'all 0.3s ease-in-out'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default CadastroServicos;
