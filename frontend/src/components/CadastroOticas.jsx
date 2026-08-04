import React, { useState, useEffect } from 'react';
import { 
  Store, Plus, Search, Edit2, Trash2, FileText, Check, 
  X, AlertCircle, RefreshCw, Filter, ShieldAlert 
} from 'lucide-react';
import { OpticalStoreService } from '../services/api';

const CadastroOticas = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  
  // Controle do usuário atual (para travar ações de deleção)
  const [userRole] = useState(() => localStorage.getItem('factory_user_role') || 'Operador');

  // Estados dos Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    id: null,
    corporate_name: '',
    trade_name: '',
    cnpj: '',
    ie: '',
    telephone: '',
    email: '',
    address: '',
    is_active: true
  });

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');
  const [exporting, setExporting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carrega as óticas baseadas nos filtros e busca
  const loadStores = async () => {
    setLoading(true);
    try {
      const activeParam = statusFilter === 'ALL' ? null : (statusFilter === 'ACTIVE');
      const response = await OpticalStoreService.list(searchQuery, activeParam);
      setStores(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar a lista de óticas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, [statusFilter]);

  // Executa busca ao pressionar enter ou clicar no botão
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadStores();
  };

  // Formata CNPJ dinamicamente
  const formatCNPJ = (val) => {
    const clean = val.replace(/\D/g, '').substring(0, 14);
    if (clean.length <= 14) {
      return clean
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/\/(\d{4})(\d)/, '/$1-$2');
    }
    return clean;
  };

  // Formata Telefone dinamicamente
  const formatPhone = (val) => {
    const clean = val.replace(/\D/g, '').substring(0, 11);
    if (clean.length <= 10) {
      return clean
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      return clean
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  const handleCnpjChange = (e) => {
    setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) });
  };

  const handlePhoneChange = (e) => {
    setFormData({ ...formData, telephone: formatPhone(e.target.value) });
  };

  // Abre formulário para criação
  const handleOpenCreate = () => {
    setFormData({
      id: null,
      corporate_name: '',
      trade_name: '',
      cnpj: '',
      ie: '',
      telephone: '',
      email: '',
      address: '',
      is_active: true
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Abre formulário para edição
  const handleOpenEdit = (store) => {
    setFormData({
      id: store.id,
      corporate_name: store.corporate_name,
      trade_name: store.trade_name,
      cnpj: store.cnpj,
      ie: store.ie || '',
      telephone: store.telephone || '',
      email: store.email || '',
      address: store.address || '',
      is_active: store.is_active
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Salva ou atualiza os dados do formulário
  const handleSaveStore = async (e) => {
    e.preventDefault();
    if (!formData.corporate_name.trim() || !formData.trade_name.trim() || !formData.cnpj.trim()) {
      setFormError('Preencha os campos obrigatórios (*).');
      return;
    }

    setFormError('');
    try {
      const payload = {
        corporate_name: formData.corporate_name,
        trade_name: formData.trade_name,
        cnpj: formData.cnpj,
        ie: formData.ie || null,
        telephone: formData.telephone || null,
        email: formData.email || null,
        address: formData.address || null,
        is_active: formData.is_active
      };

      if (formData.id) {
        // Editar
        const res = await OpticalStoreService.update(formData.id, payload);
        showToast('Dados da ótica atualizados com sucesso!', 'success');
        setStores(stores.map(s => s.id === formData.id ? res.data : s));
      } else {
        // Criar
        const res = await OpticalStoreService.create(payload);
        showToast('Ótica cadastrada com sucesso!', 'success');
        setStores([res.data, ...stores]);
      }
      setIsFormModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao salvar os dados da ótica.');
    }
  };

  // Confirmação de exclusão
  const handleOpenDelete = (store) => {
    setStoreToDelete(store);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    try {
      await OpticalStoreService.delete(storeToDelete.id);
      showToast('Ótica removida do cadastro com sucesso!', 'success');
      setStores(stores.filter(s => s.id !== storeToDelete.id));
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Erro ao excluir a ótica comercial.', 'error');
    }
  };

  // Exportação para CSV (Blob)
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const activeParam = statusFilter === 'ALL' ? null : (statusFilter === 'ACTIVE');
      const response = await OpticalStoreService.export(searchQuery, activeParam);
      
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cadastro_oticas_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showToast('Relatório de óticas exportado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Falha ao exportar relatório CSV.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Store size={28} style={{ color: 'hsl(var(--primary))' }} />
            Cadastro de Óticas
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Gerencie o cadastro de lojas de ótica parceiras do laboratório oftálmico.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={exporting}>
            <FileText size={18} /> {exporting ? 'Exportando...' : 'Exportar Relatório'}
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Cadastrar Ótica
          </button>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Busca Textual */}
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por Nome Fantasia, Razão Social ou CNPJ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '45px' }}
            />
          </div>

          {/* Filtro de Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={16} style={{ color: 'hsl(var(--text-muted))' }} />
            <select 
              className="form-control" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '160px', padding: '8px 12px' }}
            >
              <option value="ALL">Todos os Status</option>
              <option value="ACTIVE">Apenas Ativas</option>
              <option value="INACTIVE">Apenas Inativas</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={loading}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Filtrar'}
          </button>
        </form>
      </div>

      {/* Tabela de Listagem */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', minHeight: '300px' }}>
        {loading && stores.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'hsl(var(--text-muted))', gap: '10px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
            <span>Carregando dados das óticas...</span>
          </div>
        ) : stores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
            <Store size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>Nenhuma ótica encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Nome Fantasia</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Razão Social</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>CNPJ</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Inscrição Est.</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Contato</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr 
                  key={store.id} 
                  style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: store.is_active ? 'transparent' : 'rgba(0,0,0,0.1)' 
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '16px 20px', color: 'white', fontWeight: 600 }}>{store.trade_name}</td>
                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))' }}>{store.corporate_name}</td>
                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>{store.cnpj}</td>
                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>{store.ie || '-'}</td>
                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{store.telephone || '-'}</span>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>{store.email || ''}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: store.is_active ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--danger) / 0.12)',
                      color: store.is_active ? 'hsl(var(--success))' : 'hsl(var(--danger))'
                    }}>
                      {store.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => handleOpenEdit(store)}
                        title="Editar Ótica"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '0.8rem', 
                          borderRadius: '6px',
                          color: userRole === 'Administrador' ? 'hsl(var(--danger))' : 'hsl(var(--text-muted))',
                          borderColor: userRole === 'Administrador' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                          cursor: userRole === 'Administrador' ? 'pointer' : 'not-allowed'
                        }}
                        disabled={userRole !== 'Administrador'}
                        onClick={() => handleOpenDelete(store)}
                        title={userRole === 'Administrador' ? 'Excluir Ótica' : 'Exclusão permitida apenas para Administradores'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: Formulário de Cadastro / Edição */}
      {isFormModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFormModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsFormModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Store size={22} style={{ color: 'hsl(var(--primary))' }} />
              {formData.id ? 'Editar Cadastro de Ótica' : 'Cadastrar Nova Ótica'}
            </h3>

            <form onSubmit={handleSaveStore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nome Fantasia *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required
                    placeholder="Ex: Óticas Modelo - Centro"
                    value={formData.trade_name}
                    onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Razão Social *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required
                    placeholder="Ex: Óticas Modelo Ltda"
                    value={formData.corporate_name}
                    onChange={(e) => setFormData({ ...formData, corporate_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">CNPJ *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={handleCnpjChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Inscrição Estadual (IE)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Inscrição Estadual"
                    value={formData.ie}
                    onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Telefone de Contato</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="(00) 00000-0000"
                    value={formData.telephone}
                    onChange={handlePhoneChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">E-mail Comercial</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="contato@otica.com.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Endereço Comercial</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="checkbox" 
                  id="store-active-checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="store-active-checkbox" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', color: 'white' }}>
                  Ótica Ativa (Parceria operacional ativa)
                </label>
              </div>

              {formError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '12px',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '15px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {formData.id ? 'Salvar Alterações' : 'Cadastrar Ótica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão de Ótica */}
      {isDeleteModalOpen && storeToDelete && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '15px', color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={22} />
              Excluir Registro de Ótica
            </h3>

            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px', color: 'hsl(var(--text-secondary))' }}>
              Você está prestes a excluir definitivamente a ótica <strong>{storeToDelete.trade_name}</strong> (CNPJ: {storeToDelete.cnpj}) do banco de dados.
              <br /><br />
              <strong style={{ color: 'hsl(var(--danger))' }}>Esta ação é irreversível!</strong> Todos os dados cadastrais serão removidos permanentemente.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: 'hsl(var(--danger))', color: 'white', fontWeight: 600 }}
                onClick={handleDeleteStore}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flutuante local para feedbacks */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(12px)',
          border: toast.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
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

export default CadastroOticas;
