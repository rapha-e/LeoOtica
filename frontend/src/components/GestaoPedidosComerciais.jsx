import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Plus, Search, Filter, RefreshCw, FileText, CheckCircle, 
  Lock, AlertTriangle, Printer, Layers, DollarSign, Eye, X, ShieldAlert, ArrowRight
} from 'lucide-react';
import { OrderService, OpticalStoreService, ProductService, TreatmentService, TechnicalServiceService } from '../services/api';

const GestaoPedidosComerciais = () => {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  const [currentUserRole] = useState(() => localStorage.getItem('factory_user_role') || 'Operador');

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [toast, setToast] = useState(null);

  // Formulário do Pedido
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogTreatments, setCatalogTreatments] = useState([]);

  const [orderForm, setOrderForm] = useState({
    optical_store_id: '',
    client_name: '',
    doctor_name: '',
    frame_type: 'METAL',
    payment_terms: 'A_VISTA',
    od_spherical: '0.00',
    od_cylindrical: '0.00',
    od_axis: '0',
    od_addition: '0.00',
    od_dnp: '30.00',
    od_height: '18.00',
    oe_spherical: '0.00',
    oe_cylindrical: '0.00',
    oe_axis: '0',
    oe_addition: '0.00',
    oe_dnp: '30.00',
    oe_height: '18.00',
    notes: '',
    items: [
      { item_type: 'LENTE_ACABADA', item_name: 'Lente CR-39 1.56 AR', quantity: 2, unit_price: 65.00, total_price: 130.00 }
    ]
  });

  const [selectedStoreObj, setSelectedStoreObj] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, storesRes, prodsRes, treatRes] = await Promise.all([
        OrderService.list(statusFilter, storeFilter, searchQuery),
        OpticalStoreService.getAll(),
        ProductService.list(),
        TreatmentService.list()
      ]);
      setOrders(ordersRes.data || []);
      setStores(storesRes.data || []);
      setCatalogProducts(prodsRes.data || []);
      setCatalogTreatments(treatRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar pedidos comerciais.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, storeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleSelectStore = (storeId) => {
    const st = stores.find(s => s.id === storeId);
    setSelectedStoreObj(st || null);
    setOrderForm(prev => ({ ...prev, optical_store_id: storeId }));
  };

  const handleAddItem = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { item_type: 'TRATAMENTO', item_name: 'Antirreflexo Premium Crizal', quantity: 2, unit_price: 35.00, total_price: 70.00 }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setOrderForm(prev => {
      const updated = [...prev.items];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = parseFloat(field === 'quantity' ? value : item.quantity) || 0;
        const u = parseFloat(field === 'unit_price' ? value : item.unit_price) || 0;
        item.total_price = q * u;
      }
      updated[index] = item;
      return { ...prev, items: updated };
    });
  };

  const calculateOrderTotal = () => {
    return orderForm.items.reduce((acc, item) => acc + (parseFloat(item.total_price) || 0), 0);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.optical_store_id) {
      setFormError('Selecione uma Ótica Parceira.');
      return;
    }
    if (orderForm.items.length === 0) {
      setFormError('Adicione pelo menos 1 item ao pedido.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        ...orderForm,
        od_spherical: parseFloat(orderForm.od_spherical) || 0,
        od_cylindrical: parseFloat(orderForm.od_cylindrical) || 0,
        od_axis: parseInt(orderForm.od_axis) || 0,
        od_addition: parseFloat(orderForm.od_addition) || 0,
        od_dnp: parseFloat(orderForm.od_dnp) || 30,
        od_height: parseFloat(orderForm.od_height) || 18,
        oe_spherical: parseFloat(orderForm.oe_spherical) || 0,
        oe_cylindrical: parseFloat(orderForm.oe_cylindrical) || 0,
        oe_axis: parseInt(orderForm.oe_axis) || 0,
        oe_addition: parseFloat(orderForm.oe_addition) || 0,
        oe_dnp: parseFloat(orderForm.oe_dnp) || 30,
        oe_height: parseFloat(orderForm.oe_height) || 18,
      };

      const res = await OrderService.create(payload);
      if (res.data.status === 'BLOQUEADO_FINANCEIRO') {
        showToast(`Pedido ${res.data.order_number} gerado com Restrição Financeira! (Ótica Inadimplente/Limite Excedido)`, 'error');
      } else {
        showToast(`Pedido ${res.data.order_number} criado e enviado para Produção MES!`, 'success');
      }
      setIsCreateModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao criar pedido comercial.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveFinancial = async (orderId) => {
    try {
      const res = await OrderService.approveFinancial(orderId);
      showToast(`Pedido ${res.data.order_number} liberado e enviado para Produção MES!`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Falha ao aprovar crédito do pedido.', 'error');
    }
  };

  const handleBillOrder = async (orderId) => {
    try {
      const res = await OrderService.bill(orderId);
      showToast(`Pedido ${res.data.order_number} Faturado com Sucesso! Título gerado no Contas a Receber.`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Falha ao faturar pedido.', 'error');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Estatísticas Rápidas
  const totalAmountSum = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
  const blockedCount = orders.filter(o => o.status === 'BLOQUEADO_FINANCEIRO').length;
  const inProductionCount = orders.filter(o => o.status === 'EM_PRODUCAO').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* Toast Feedback */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '14px 22px',
          borderRadius: '12px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}>
          {toast.message}
        </div>
      )}

      {/* Cabeçalho de Vendas & Pedidos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={30} style={{ color: 'hsl(var(--primary))' }} />
            Pedidos de Venda da Fábrica (Óticas Parceiras)
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Recebimento de pedidos, verificação automática de crédito, envio para a Produção MES e faturamento.
          </p>
        </div>
        
        <div>
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)} style={{ padding: '12px 24px', fontWeight: 800 }}>
            <Plus size={18} /> + Emitir Novo Pedido de Venda
          </button>
        </div>
      </div>

      {/* Cards de KPIs Rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(147, 51, 234, 0.1)', color: 'hsl(var(--primary))' }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Total de Pedidos</span>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{orders.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Volume Comercial</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{formatCurrency(totalAmountSum)}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Layers size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Em Produção MES</span>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{inProductionCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Lock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Bloqueados Fin.</span>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{blockedCount}</h3>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por Nº do Pedido, Cliente ou Médico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '45px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={16} style={{ color: 'hsl(var(--text-muted))' }} />
            <select 
              className="form-control" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">Todos os Status</option>
              <option value="BLOQUEADO_FINANCEIRO">🔒 Bloqueado Financeiro</option>
              <option value="EM_PRODUCAO">⚙️ Em Produção MES</option>
              <option value="FATURADO">💰 Faturado</option>
              <option value="CONCLUIDO">✅ Concluído</option>
            </select>

            <select 
              className="form-control" 
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">Todas as Óticas</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.trade_name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={loading}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Filtrar'}
          </button>
        </form>
      </div>

      {/* Tabela de Pedidos Comerciais */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', minHeight: '300px' }}>
        {loading && orders.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'hsl(var(--text-muted))', gap: '10px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
            <span>Carregando pedidos de venda...</span>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
            <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>Nenhum pedido de venda localizado com esses filtros.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Nº Pedido</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Ótica Parceira</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Consumidor / Médico</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Graus (OD / OE)</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Valor Total</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(ord => (
                <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }} className="table-row-hover">
                  <td style={{ padding: '16px 20px', fontWeight: 800, color: 'hsl(var(--primary))' }}>
                    {ord.order_number}
                  </td>

                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                    {ord.optical_store?.trade_name || 'Ótica Parceira'}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 400 }}>
                      CNPJ: {ord.optical_store?.cnpj || 'N/A'}
                    </span>
                  </td>

                  <td style={{ padding: '16px 20px' }}>
                    <strong style={{ fontSize: '0.9rem', display: 'block' }}>{ord.client_name}</strong>
                    {ord.doctor_name && (
                      <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Dr(a): {ord.doctor_name}</span>
                    )}
                  </td>

                  <td style={{ padding: '16px 20px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                    <div>OD: {ord.od_spherical > 0 ? `+${ord.od_spherical}` : ord.od_spherical} / {ord.od_cylindrical}</div>
                    <div>OE: {ord.oe_spherical > 0 ? `+${ord.oe_spherical}` : ord.oe_spherical} / {ord.oe_cylindrical}</div>
                  </td>

                  <td style={{ padding: '16px 20px', fontWeight: 800, fontSize: '1rem', color: '#10b981' }}>
                    {formatCurrency(ord.total_amount)}
                  </td>

                  <td style={{ padding: '16px 20px' }}>
                    {ord.status === 'BLOQUEADO_FINANCEIRO' ? (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Lock size={12} /> Bloqueado Fin.
                      </span>
                    ) : ord.status === 'EM_PRODUCAO' ? (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                        backgroundColor: 'rgba(147, 51, 234, 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Layers size={12} /> Em Produção MES
                      </span>
                    ) : ord.status === 'FATURADO' ? (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <DollarSign size={12} /> Faturado (AR)
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6'
                      }}>
                        {ord.status}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {ord.status === 'BLOQUEADO_FINANCEIRO' && currentUserRole === 'Administrador' && (
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          onClick={() => handleApproveFinancial(ord.id)}
                          title="Aprovar Crédito Manualmente"
                        >
                          <CheckCircle size={13} style={{ marginRight: '4px' }} /> Liberação Fin.
                        </button>
                      )}

                      {ord.status === 'EM_PRODUCAO' && (
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                          onClick={() => handleBillOrder(ord.id)}
                          title="Faturar Pedido e Gerar Contas a Receber"
                        >
                          <DollarSign size={13} style={{ marginRight: '4px' }} /> Faturar
                        </button>
                      )}

                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => setSelectedOrderDetails(ord)}
                        title="Ver Espelho do Pedido"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: Emissão de Novo Pedido de Venda */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px', width: '92%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsCreateModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={22} style={{ color: 'hsl(var(--primary))' }} />
              Emitir Novo Pedido de Venda (Ótica Parceira)
            </h3>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Seleção de Ótica com Banner de Crédito */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Ótica Parceira (Faturamento) *</label>
                <select 
                  className="form-control"
                  required
                  value={orderForm.optical_store_id}
                  onChange={(e) => handleSelectStore(e.target.value)}
                  style={{ color: 'black', fontWeight: 600 }}
                >
                  <option value="">-- Selecione a Ótica Cliente --</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.trade_name} (CNPJ: {s.cnpj}) - Limite: R$ {parseFloat(s.credit_limit || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStoreObj && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: selectedStoreObj.has_overdue_invoices ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: selectedStoreObj.has_overdue_invoices ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedStoreObj.has_overdue_invoices ? (
                      <AlertTriangle size={18} color="#ef4444" />
                    ) : (
                      <CheckCircle size={18} color="#10b981" />
                    )}
                    <span>
                      {selectedStoreObj.has_overdue_invoices 
                        ? <strong>Atenção: Ótica possui faturas VENCIDAS! Pedido será retido no Financeiro.</strong>
                        : <strong>Crédito Aprovado! Ótica adimplente com saldo disponível.</strong>}
                    </span>
                  </div>
                  <div>
                    <span>Débito Atual: <strong>R$ {parseFloat(selectedStoreObj.current_debt || 0).toFixed(2)}</strong></span>
                  </div>
                </div>
              )}

              {/* Dados do Consumidor e Médico */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Nome do Consumidor *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    required
                    placeholder="Ex: João da Silva"
                    value={orderForm.client_name}
                    onChange={(e) => setOrderForm({ ...orderForm, client_name: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Médico Oftalmologista</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Dr. Carlos Eduardo"
                    value={orderForm.doctor_name}
                    onChange={(e) => setOrderForm({ ...orderForm, doctor_name: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Tipo de Armação</label>
                  <select 
                    className="form-control"
                    value={orderForm.frame_type}
                    onChange={(e) => setOrderForm({ ...orderForm, frame_type: e.target.value })}
                    style={{ color: 'black' }}
                  >
                    <option value="METAL">Metal (Fechada)</option>
                    <option value="ACETATO">Acetato (Fechada)</option>
                    <option value="NYLON">Fio de Nylon (Semi-Abert)</option>
                    <option value="PARAFUSO">Parafuso (Balgriff)</option>
                  </select>
                </div>
              </div>

              {/* Prescrição Óptica de Graus */}
              <div style={{ background: 'rgba(15, 23, 42, 0.03)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'block', marginBottom: '10px', color: 'hsl(var(--primary))' }}>
                  👓 Receita Oftálmica (Prescrição)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ gridColumn: 'span 6', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Olho Direito (OD)</div>
                  <input type="number" step="0.25" placeholder="Esférico" className="form-control" value={orderForm.od_spherical} onChange={(e) => setOrderForm({ ...orderForm, od_spherical: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.25" placeholder="Cilíndrico" className="form-control" value={orderForm.od_cylindrical} onChange={(e) => setOrderForm({ ...orderForm, od_cylindrical: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" placeholder="Eixo °" className="form-control" value={orderForm.od_axis} onChange={(e) => setOrderForm({ ...orderForm, od_axis: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.25" placeholder="Adição" className="form-control" value={orderForm.od_addition} onChange={(e) => setOrderForm({ ...orderForm, od_addition: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.5" placeholder="DNP mm" className="form-control" value={orderForm.od_dnp} onChange={(e) => setOrderForm({ ...orderForm, od_dnp: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.5" placeholder="Altura mm" className="form-control" value={orderForm.od_height} onChange={(e) => setOrderForm({ ...orderForm, od_height: e.target.value })} style={{ color: 'black' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  <div style={{ gridColumn: 'span 6', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Olho Esquerdo (OE)</div>
                  <input type="number" step="0.25" placeholder="Esférico" className="form-control" value={orderForm.oe_spherical} onChange={(e) => setOrderForm({ ...orderForm, oe_spherical: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.25" placeholder="Cilíndrico" className="form-control" value={orderForm.oe_cylindrical} onChange={(e) => setOrderForm({ ...orderForm, oe_cylindrical: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" placeholder="Eixo °" className="form-control" value={orderForm.oe_axis} onChange={(e) => setOrderForm({ ...orderForm, oe_axis: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.25" placeholder="Adição" className="form-control" value={orderForm.oe_addition} onChange={(e) => setOrderForm({ ...orderForm, oe_addition: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.5" placeholder="DNP mm" className="form-control" value={orderForm.oe_dnp} onChange={(e) => setOrderForm({ ...orderForm, oe_dnp: e.target.value })} style={{ color: 'black' }} />
                  <input type="number" step="0.5" placeholder="Altura mm" className="form-control" value={orderForm.oe_height} onChange={(e) => setOrderForm({ ...orderForm, oe_height: e.target.value })} style={{ color: 'black' }} />
                </div>
              </div>

              {/* Itens do Pedido */}
              <div style={{ background: 'rgba(147, 51, 234, 0.04)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(147, 51, 234, 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'hsl(var(--primary))' }}>
                    📦 Itens do Pedido (Lentes, Blocos & Tratamentos)
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem} style={{ fontSize: '0.78rem' }}>
                    + Adicionar Item
                  </button>
                </div>

                {orderForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2.5fr 1fr 1fr 1fr 40px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select 
                      className="form-control" 
                      value={item.item_type} 
                      onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                      style={{ color: 'black', fontSize: '0.82rem' }}
                    >
                      <option value="LENTE_ACABADA">Lente Acabada</option>
                      <option value="BLOCO_SEMIACABADO">Bloco Semiacabado</option>
                      <option value="TRATAMENTO">Tratamento</option>
                      <option value="SERVICO_SURFACAGEM">Surfaçagem</option>
                      <option value="SERVICO_MONTAGEM">Montagem</option>
                    </select>

                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Descrição do Item..."
                      value={item.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      style={{ color: 'black', fontSize: '0.85rem' }}
                    />

                    <input 
                      type="number" 
                      min="1" 
                      className="form-control" 
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ color: 'black', textAlign: 'center', fontSize: '0.85rem' }}
                    />

                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="R$ Unit"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      style={{ color: 'black', fontSize: '0.85rem' }}
                    />

                    <span style={{ fontWeight: 800, fontSize: '0.88rem', textAlign: 'right', color: 'hsl(var(--primary))' }}>
                      {formatCurrency(item.total_price)}
                    </span>

                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-glass)' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 900 }}>Total do Pedido: <span style={{ color: '#10b981' }}>{formatCurrency(calculateOrderTotal())}</span></span>
                </div>
              </div>

              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancelar</button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 800 }}>
                  {submitting ? 'Emitindo Pedido...' : 'Emitir Pedido de Venda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Espelho de Pedido Comercial em PDF / Impressão */}
      {selectedOrderDetails && (
        <div className="modal-overlay" onClick={() => setSelectedOrderDetails(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setSelectedOrderDetails(null)}
            >
              <X size={20} />
            </button>

            <div style={{ borderBottom: '2px solid var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'hsl(var(--primary))' }}>
                Espelho de Pedido {selectedOrderDetails.order_number}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'hsl(var(--text-muted))' }}>
                Ótica Faturada: <strong>{selectedOrderDetails.optical_store?.trade_name}</strong> | Data: {new Date(selectedOrderDetails.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(15, 23, 42, 0.03)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', display: 'block' }}>CONSUMIDOR</span>
                  <strong>{selectedOrderDetails.client_name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', display: 'block' }}>MÉDICO OFTALMOLOGISTA</span>
                  <strong>{selectedOrderDetails.doctor_name || 'Não informado'}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(var(--primary))', display: 'block', marginBottom: '8px' }}>
                  ITENS DO PEDIDO
                </span>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Qtd</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>R$ Unit</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>R$ Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderDetails.items?.map((it, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px' }}>{it.item_name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', padding: '12px 16px', borderRadius: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>VALOR TOTAL DO PEDIDO:</span>
                <strong style={{ fontSize: '1.3rem', color: '#10b981' }}>{formatCurrency(selectedOrderDetails.total_amount)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={16} style={{ marginRight: '6px' }} /> Imprimir Pedido
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedOrderDetails(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoPedidosComerciais;
