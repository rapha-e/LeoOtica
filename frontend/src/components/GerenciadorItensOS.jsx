import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Layers, RefreshCw, DollarSign, AlertCircle, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { OSService, ProductService, TreatmentService, TechnicalServiceService, CustomerPriceService } from '../services/api';

const GerenciadorItensOS = ({ osId, opticalStoreId, onItemsUpdated }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [catalog, setCatalog] = useState({ products: [], treatments: [], services: [] });
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [formData, setFormData] = useState({
    entity_type: 'product', // 'product', 'treatment', 'service'
    entity_id: '',
    quantity: 1,
    override_price: '',
    price_override_reason: ''
  });

  const [hasOverride, setHasOverride] = useState(false);
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);

  // Estados da autorização de administrador
  const [showingAuthModal, setShowingAuthModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [pendingItemData, setPendingItemData] = useState(null);

  // Carrega os itens já faturados na OS
  const loadOSItems = async () => {
    setLoading(true);
    try {
      const response = await OSService.get(osId);
      setItems(response.data.items || []);
      if (onItemsUpdated) {
        onItemsUpdated(response.data.total_amount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega o catálogo ativo para seleção
  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const [pRes, tRes, sRes] = await Promise.all([
        ProductService.list('', true),
        TreatmentService.list('', true),
        TechnicalServiceService.list('', true)
      ]);
      setCatalog({
        products: pRes.data,
        treatments: tRes.data,
        services: sRes.data
      });
      // Define valor padrão do ID do primeiro produto
      if (pRes.data.length > 0) {
        setFormData(prev => ({ ...prev, entity_id: pRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (osId) {
      loadOSItems();
    }
    loadCatalog();
  }, [osId]);

  // Altera o tipo de entidade e reseta o ID padrão correspondente
  const handleTypeChange = (e) => {
    const type = e.target.value;
    let defaultId = '';
    if (type === 'product' && catalog.products.length > 0) defaultId = catalog.products[0].id;
    else if (type === 'treatment' && catalog.treatments.length > 0) defaultId = catalog.treatments[0].id;
    else if (type === 'service' && catalog.services.length > 0) defaultId = catalog.services[0].id;

    setFormData({
      entity_type: type,
      entity_id: defaultId,
      quantity: 1,
      override_price: '',
      price_override_reason: ''
    });
    setHasOverride(false);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!formData.entity_id) {
      setFormError('Selecione um item do catálogo.');
      return;
    }

    let overridePrice = null;
    let priceOverrideReason = null;

    if (hasOverride) {
      if (!formData.override_price || formData.override_price.toString().trim() === '') {
        setFormError('Informe o valor sobrescrito.');
        return;
      }
      if (!formData.price_override_reason || formData.price_override_reason.trim() === '') {
        setFormError('Informe a justificativa para alteração de preço.');
        return;
      }
      overridePrice = parseFloat(formData.override_price);
      if (isNaN(overridePrice) || overridePrice < 0) {
        setFormError('O valor unitário deve ser maior ou igual a zero.');
        return;
      }
      priceOverrideReason = formData.price_override_reason.trim();
    }

    setFormError('');
    setAdding(true);

    try {
      // Validar se o desconto manual ultrapassa 10%
      if (hasOverride && opticalStoreId) {
        const priceRes = await CustomerPriceService.calculatePrice(opticalStoreId, formData.entity_type, formData.entity_id);
        const calculatedPrice = priceRes.data.calculated_price;
        
        const isGreater10Percent = overridePrice < (calculatedPrice * 0.9);
        const currentUserRole = localStorage.getItem('factory_user_role');

        if (isGreater10Percent && currentUserRole !== 'Administrador') {
          // Interrompe e abre modal de autenticação admin
          setPendingItemData({
            overridePrice,
            priceOverrideReason
          });
          setAdminEmail('');
          setAdminPassword('');
          setAuthError('');
          setShowingAuthModal(true);
          setAdding(false);
          return;
        }
      }

      await OSService.addItem(
        osId, 
        formData.entity_type, 
        formData.entity_id, 
        formData.quantity,
        overridePrice,
        priceOverrideReason
      );
      showLocalToast('Item adicionado à OS com sucesso!');
      
      // Reseta o formulário
      setFormData(prev => ({
        ...prev,
        quantity: 1,
        override_price: '',
        price_override_reason: ''
      }));
      setHasOverride(false);
      
      await loadOSItems();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao adicionar item.');
    } finally {
      setAdding(false);
    }
  };

  const handleAdminAuthConfirm = async (e) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setAuthError('Preencha o e-mail e a senha do Administrador.');
      return;
    }
    setAuthenticating(true);
    setAuthError('');
    const hostname = window.location.hostname;
    try {
      const response = await axios.post(`http://${hostname}:8000/api/v1/auth/login`, {
        email: adminEmail,
        password: adminPassword,
      });

      const { role } = response.data;
      if (role !== 'Administrador') {
        setAuthError('Apenas usuários com perfil de Administrador podem autorizar este desconto.');
        setAuthenticating(false);
        return;
      }

      setShowingAuthModal(false);
      setAdding(true);

      await OSService.addItem(
        osId, 
        formData.entity_type, 
        formData.entity_id, 
        formData.quantity,
        pendingItemData.overridePrice,
        pendingItemData.priceOverrideReason
      );
      showLocalToast('Item adicionado à OS com autorização de Administrador!');
      
      // Reseta o formulário
      setFormData(prev => ({
        ...prev,
        quantity: 1,
        override_price: '',
        price_override_reason: ''
      }));
      setHasOverride(false);
      setPendingItemData(null);
      
      await loadOSItems();
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setAuthError(err.response.data.detail);
      } else {
        setAuthError('Falha ao autenticar o Administrador.');
      }
    } finally {
      setAuthenticating(false);
      setAdding(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await OSService.removeItem(osId, itemId);
      showLocalToast('Item de faturamento removido.');
      await loadOSItems();
    } catch (err) {
      console.error(err);
    }
  };

  // Helpers visuais
  const getItemName = (type, id) => {
    let list = [];
    if (type === 'product') list = catalog.products;
    else if (type === 'treatment') list = catalog.treatments;
    else if (type === 'service') list = catalog.services;

    const found = list.find(item => item.id === id);
    return found ? found.name : 'Carregando...';
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Toast flutuante local rápido
  const [toastMessage, setToastMessage] = useState(null);
  const showLocalToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const totalAmount = items.reduce((acc, curr) => acc + curr.total_price, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Formulário de Adição */}
      <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.01)' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
          <Plus size={16} style={{ color: 'hsl(var(--primary))' }} />
          Faturamento: Adicionar Itens de OS
        </h4>

        <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'end' }}>
            
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-control" value={formData.entity_type} onChange={handleTypeChange}>
                <option value="product">Lente / Produto</option>
                <option value="treatment">Tratamento</option>
                <option value="service">Serviço Técnico</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Item do Catálogo *</label>
              <select 
                className="form-control" 
                value={formData.entity_id} 
                onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                required
              >
                {formData.entity_type === 'product' && catalog.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (v{p.current_version})</option>
                ))}
                {formData.entity_type === 'treatment' && catalog.treatments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {formData.entity_type === 'service' && catalog.services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantidade</label>
              <input 
                type="number" 
                className="form-control" 
                min="1" 
                value={formData.quantity} 
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            {!hasOverride && (
              <button type="submit" className="btn btn-primary" style={{ padding: '12px', height: '40px', fontWeight: 700 }} disabled={adding}>
                {adding ? <RefreshCw size={14} className="animate-spin" /> : 'Adicionar'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input 
              type="checkbox" 
              id="chk-has-override" 
              checked={hasOverride} 
              onChange={(e) => {
                setHasOverride(e.target.checked);
                setFormData(prev => ({ ...prev, override_price: '', price_override_reason: '' }));
              }}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: 'hsl(var(--primary))'
              }}
            />
            <label htmlFor="chk-has-override" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DollarSign size={14} style={{ color: 'hsl(var(--primary))' }} />
              Aplicar Preço Manual Autorizado
            </label>
          </div>

          {hasOverride && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '15px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              alignItems: 'end'
            }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'hsl(var(--primary))' }}>Valor Unitário Sobrescrito (R$) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  step="0.01" 
                  min="0" 
                  placeholder="R$ 0,00"
                  value={formData.override_price || ''} 
                  onChange={(e) => setFormData({ ...formData, override_price: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ color: 'hsl(var(--primary))' }}>Justificativa da Alteração *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: Desconto de campanha comercial autorizado pela gerência."
                  value={formData.price_override_reason || ''} 
                  onChange={(e) => setFormData({ ...formData, price_override_reason: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 1' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px', height: '40px', fontWeight: 700, width: '100%' }} disabled={adding}>
                  {adding ? <RefreshCw size={14} className="animate-spin" /> : 'Adicionar com Preço'}
                </button>
              </div>
            </div>
          )}
        </form>

        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '10px',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '0.8rem',
            marginTop: '12px'
          }}>
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
      </div>

      {/* Lista de Itens Faturados */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'hsl(var(--text-muted))', gap: '8px' }}>
            <RefreshCw size={16} className="animate-spin" />
            <span>Carregando itens faturados...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'hsl(var(--text-muted))' }}>
            <Layers size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Nenhum item comercial inserido nesta OS.</p>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Adicione lentes, tratamentos ou serviços acima.</p>
          </div>
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Categoria</th>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Nome</th>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'center' }}>Qtd</th>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço Unit.</th>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Subtotal</th>
                  <th style={{ padding: '10px 15px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 15px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        backgroundColor: item.entity_type === 'product' ? 'rgba(59,130,246,0.12)' : item.entity_type === 'treatment' ? 'rgba(168,85,247,0.12)' : 'rgba(34,197,94,0.12)',
                        color: item.entity_type === 'product' ? '#3b82f6' : item.entity_type === 'treatment' ? '#a855f7' : '#22c55e'
                      }}>
                        {item.entity_type === 'product' ? 'Produto' : item.entity_type === 'treatment' ? 'Tratamento' : 'Serviço'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 15px', color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                      {getItemName(item.entity_type, item.entity_id)}
                      {item.custom_price_applied && (
                        <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span 
                            title={`Preço original: ${formatCurrency(item.original_price)} | Justificativa: ${item.price_override_reason}`}
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(249, 115, 22, 0.15)',
                              color: '#f97316',
                              border: '1px solid rgba(249, 115, 22, 0.3)',
                              cursor: 'help'
                            }}
                          >
                            Preço Manual
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', fontStyle: 'italic', fontWeight: 400 }}>
                            (Original: {formatCurrency(item.original_price)} - {item.price_override_reason})
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 15px', color: 'white', textAlign: 'center', fontSize: '0.85rem' }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '10px 15px', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td style={{ padding: '10px 15px', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                      {formatCurrency(item.total_price)}
                    </td>
                    <td style={{ padding: '10px 15px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 6px', borderRadius: '4px', color: 'hsl(var(--danger))' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Consolidade */}
            <div style={{ 
              padding: '15px 20px', 
              background: 'rgba(255,255,255,0.01)', 
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Total Acumulado (OS)</span>
              <span style={{ fontSize: '1.25rem', color: 'hsl(var(--success))', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <DollarSign size={18} />
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Toast flutuante local rápido */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '6px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          {toastMessage}
        </div>
      )}

      {/* Modal de Autenticação do Administrador */}
      {showingAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'rgba(255, 255, 255, 0.98)', color: 'hsl(var(--text-primary))' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--primary))', marginBottom: '15px' }}>
              <ShieldCheck style={{ color: 'hsl(var(--primary))' }} />
              Autorização do Administrador
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'hsl(var(--text-secondary))' }}>
              O preço sobrescrito representa um desconto superior a 10% em relação ao preço contratual de tabela. Digite as credenciais de um Administrador para autorizar a operação.
            </p>
            
            <form onSubmit={handleAdminAuthConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  placeholder="admin@novalab.com.br"
                  className="form-control"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="form-control"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {authError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '10px',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.8rem'
                }}>
                  <AlertCircle size={14} />
                  <span>{authError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowingAuthModal(false);
                    setPendingItemData(null);
                  }}
                  disabled={authenticating}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary" 
                  disabled={authenticating}
                >
                  {authenticating ? 'Validando...' : 'Autorizar Desconto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciadorItensOS;
