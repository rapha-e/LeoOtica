import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Check, X, AlertCircle, RefreshCw, Shield, ToggleLeft, ToggleRight, Database, Download, RotateCcw } from 'lucide-react';
import api, { UserService } from '../services/api';

const GerenciamentoUsuarios = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados dos Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Estados do Modal de Backup Automático
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [generatingBackup, setGeneratingBackup] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    email: '',
    password: '',
    role_id: '',
    is_active: true
  });

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await api.get('/admin/backups/list');
      setBackups(res.data);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar histórico de backups.', 'error');
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackupNow = async () => {
    setGeneratingBackup(true);
    try {
      const res = await api.post('/admin/backups/create');
      showToast(`Backup ${res.data.filename} gerado com sucesso! (${res.data.size_mb} MB)`, 'success');
      loadBackups();
    } catch (err) {
      console.error(err);
      showToast('Falha ao gerar cópia de segurança.', 'error');
    } finally {
      setGeneratingBackup(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Tem certeza que deseja restaurar o banco a partir do backup "${filename}"?`)) return;
    try {
      const res = await api.post(`/admin/backups/restore/${filename}`);
      showToast(res.data.message, 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      showToast('Erro ao restaurar backup selecionado.', 'error');
    }
  };


  // Carrega os usuários e cargos da fábrica
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Carrega perfis de acesso (roles)
      const rolesRes = await UserService.listRoles();
      setRoles(rolesRes.data);
      
      // Carrega usuários
      const usersRes = await UserService.list(searchQuery);
      setUsers(usersRes.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar a lista de usuários e perfis.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Busca de usuários
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await UserService.list(searchQuery);
      setUsers(response.data);
    } catch (error) {
      console.error(error);
      showToast('Falha ao pesquisar usuários.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar senha aleatória alfanumérica de 8 caracteres
  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Abre formulário para criação
  const handleOpenCreate = () => {
    const randomPassword = generateRandomPassword();
    setFormData({
      id: null,
      name: '',
      email: '', // Aqui armazena o login alfanumérico
      password: randomPassword,
      role_id: roles[0]?.id || '',
      is_active: true,
      must_change_password: true
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Abre formulário para edição
  const handleOpenEdit = (user) => {
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '', // Senha em branco para edição (opcional)
      role_id: user.role_id || '',
      is_active: user.is_active,
      must_change_password: user.must_change_password || false
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Salva ou atualiza os dados do formulário
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || (!formData.id && !formData.password.trim())) {
      setFormError('Preencha todos os campos obrigatórios (*).');
      return;
    }

    if (!formData.id && formData.password.length < 4) {
      setFormError('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    setFormError('');
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        role_id: formData.role_id || null,
        is_active: formData.is_active,
        must_change_password: formData.must_change_password
      };

      // Só envia a senha se estiver criando OU se informou uma nova senha na edição
      if (!formData.id) {
        payload.password = formData.password;
        payload.must_change_password = true; // Força primeiro acesso
      } else if (formData.password) {
        payload.password = formData.password;
      }

      if (formData.id) {
        // Atualizar
        const res = await UserService.update(formData.id, payload);
        showToast('Dados do usuário atualizados com sucesso!', 'success');
        setUsers(users.map(u => u.id === formData.id ? res.data : u));
      } else {
        // Criar
        const res = await UserService.create(payload);
        showToast('Usuário cadastrado com sucesso!', 'success');
        setUsers([res.data, ...users]);
      }
      setIsFormModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao salvar os dados do usuário.');
    }
  };

  // Confirmação de exclusão
  const handleOpenDelete = (user) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await UserService.delete(userToDelete.id);
      showToast('Usuário removido do sistema com sucesso!', 'success');
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Erro ao excluir o usuário.', 'error');
    }
  };

  // Retorna a cor/estilo da tag da Role
  const getRoleBadgeStyle = (roleName) => {
    if (roleName === 'Administrador') {
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      };
    }
    return {
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.2)'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} style={{ color: 'hsl(var(--primary))' }} />
            Gerenciamento de Usuários
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Gerencie os operadores e administradores de fábrica da Nova Lab.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setIsBackupModalOpen(true);
              loadBackups();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Database size={18} style={{ color: 'hsl(var(--primary))' }} />
            Backups Automáticos
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Novo Usuário
          </button>
        </div>

      </div>

      {/* Painel de Filtros e Busca */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por nome ou login..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '45px' }}
            />
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={loading}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Pesquisar'}
          </button>
        </form>
      </div>

      {/* Tabela de Listagem */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', minHeight: '250px' }}>
        {loading && users.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'hsl(var(--text-muted))', gap: '10px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
            <span>Carregando usuários...</span>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
            <Users size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Nome</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Login</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Perfil</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr 
                  key={user.id} 
                  style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: user.is_active ? 'transparent' : 'rgba(0,0,0,0.02)' 
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '16px 20px', color: 'white', fontWeight: 600 }}>{user.name}</td>
                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))' }}>{user.email}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      ...getRoleBadgeStyle(user.role?.name || 'Operador')
                    }}>
                      <Shield size={12} />
                      {user.role?.name || 'Operador'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: user.is_active ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--danger) / 0.12)',
                      color: user.is_active ? 'hsl(var(--success))' : 'hsl(var(--danger))'
                    }}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => handleOpenEdit(user)}
                        title="Editar Usuário"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '0.8rem', 
                          borderRadius: '6px',
                          color: 'hsl(var(--danger))',
                          borderColor: 'rgba(239, 68, 68, 0.15)'
                        }}
                        onClick={() => handleOpenDelete(user)}
                        title="Excluir Usuário"
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsFormModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Users size={22} style={{ color: 'hsl(var(--primary))' }} />
              {formData.id ? 'Editar Usuário' : 'Novo Usuário de Fábrica'}
            </h3>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  placeholder="Ex: João da Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Login de Acesso *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  placeholder="Ex: joaosilva ou admin12"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Senha {formData.id ? '(Deixe em branco para não alterar)' : 'Temporária Gerada *'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type={formData.id ? "password" : "text"} 
                    className="form-control" 
                    required={!formData.id}
                    disabled={!formData.id}
                    placeholder={formData.id ? "Nova senha" : "Senha de acesso"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ flexGrow: 1 }}
                  />
                  {!formData.id && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.password);
                        showToast('Senha copiada para a área de transferência!', 'success');
                      }}
                      style={{ whiteSpace: 'nowrap', padding: '10px 15px' }}
                    >
                      Copiar
                    </button>
                  )}
                </div>
                {!formData.id && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
                    Esta senha temporária deve ser informada ao usuário. Ela será alterada no primeiro acesso.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Perfil de Acesso (Cargo)</label>
                <select 
                  className="form-control" 
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="user-active-checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="user-active-checkbox" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', color: 'white' }}>
                    Usuário Ativo (Acesso autorizado ao sistema)
                  </label>
                </div>

                {formData.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="checkbox" 
                      id="user-must-change-password"
                      checked={formData.must_change_password}
                      onChange={(e) => setFormData({ ...formData, must_change_password: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="user-must-change-password" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', color: 'white' }}>
                      Forçar alteração de senha no próximo acesso
                    </label>
                  </div>
                )}
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
                  {formData.id ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão */}
      {isDeleteModalOpen && userToDelete && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '15px', color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={22} />
              Excluir Usuário
            </h3>

            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px', color: 'hsl(var(--text-secondary))' }}>
              Você está prestes a excluir definitivamente o usuário <strong>{userToDelete.name}</strong> (Login: {userToDelete.email}).
              <br /><br />
              <strong style={{ color: 'hsl(var(--danger))' }}>Esta ação é irreversível!</strong> O acesso desse usuário será cancelado e o registro será removido permanentemente.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: 'hsl(var(--danger))', color: 'white', fontWeight: 600 }}
                onClick={handleDeleteUser}
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BACKUPS AUTOMÁTICOS & SEGURANÇA */}
      {isBackupModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container" style={{ maxWidth: '650px', width: '90%', padding: '28px', background: 'white', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(224,230,240,0.8)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={24} style={{ color: 'hsl(var(--primary))' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'hsl(var(--text-primary))' }}>Backups Automáticos & Cópias de Segurança</h3>
              </div>
              <button onClick={() => setIsBackupModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#15803d' }}>
              <Check size={18} />
              <span><strong>Backup Automático Ativo:</strong> O sistema realiza uma cópia completa de segurança a cada 6 horas automaticamente.</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Histórico de Cópias Salvas em Disco ({backups.length})</span>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleCreateBackupNow}
                disabled={generatingBackup}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {generatingBackup ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                Gerar Backup Agora
              </button>
            </div>

            {loadingBackups ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'hsl(var(--text-muted))' }}>
                <RefreshCw size={20} className="spin" style={{ margin: 'auto' }} />
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Carregando histórico de backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>Nenhum backup encontrado em disco.</p>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {backups.map((item) => (
                  <div key={item.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(224,230,240,0.6)' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block', color: 'hsl(var(--text-primary))' }}>{item.filename}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                        Tamanho: {item.size_mb} MB &bull; Criado em: {new Date(item.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <button 
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleRestoreBackup(item.filename)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'hsl(var(--primary))' }}
                      title="Restaura esta versão do banco de dados"
                    >
                      <RotateCcw size={12} /> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(224,230,240,0.8)', paddingTop: '16px', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setIsBackupModalOpen(false)}>
                Fechar
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

export default GerenciamentoUsuarios;
