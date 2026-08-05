import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, DollarSign, TrendingUp, Package, CheckCircle, RefreshCw, Cpu, FileText, Eye, Pencil, Trash2, X, Layers, Box } from 'lucide-react';
import api, { LensService, BlockService } from '../services/api';

const LENS_DIOPTRIA_OPTIONS = [
  'Sph 0.00 / Cyl 0.00',
  'Sph -0.50 / Cyl 0.00',
  'Sph -1.00 / Cyl 0.00',
  'Sph -1.50 / Cyl 0.00',
  'Sph -2.00 / Cyl 0.00',
  'Sph -2.00 / Cyl -0.50',
  'Sph -2.00 / Cyl -1.00',
  'Sph -2.00 / Cyl -1.50',
  'Sph -2.00 / Cyl -2.00',
  'Sph -2.50 / Cyl -0.50',
  'Sph -2.50 / Cyl -1.00',
  'Sph -3.00 / Cyl -0.50',
  'Sph -3.00 / Cyl -1.00',
  'Sph -3.50 / Cyl -1.00',
  'Sph -4.00 / Cyl -1.00',
  'Sph +0.50 / Cyl 0.00',
  'Sph +1.00 / Cyl 0.00',
  'Sph +1.50 / Cyl 0.00',
  'Sph +2.00 / Cyl 0.00',
  'Sph +2.00 / Cyl -0.50',
  'Sph +2.00 / Cyl -1.00',
  'Sph +3.00 / Cyl -1.00',
  'Outra Dioptria (Digitar)'
];

const BLOCK_DIOPTRIA_OPTIONS = [
  'Base 2.00 / Add +0.75 (Lado D)',
  'Base 2.00 / Add +0.75 (Lado E)',
  'Base 2.00 / Add +1.00 (Lado D)',
  'Base 2.00 / Add +1.00 (Lado E)',
  'Base 2.00 / Add +1.25 (Lado D)',
  'Base 2.00 / Add +1.25 (Lado E)',
  'Base 4.00 / Add +1.50 (Lado D)',
  'Base 4.00 / Add +1.50 (Lado E)',
  'Base 4.00 / Add +1.75 (Lado D)',
  'Base 4.00 / Add +1.75 (Lado E)',
  'Base 4.00 / Add +2.00 (Lado D)',
  'Base 4.00 / Add +2.00 (Lado E)',
  'Base 4.00 / Add +2.25 (Lado D)',
  'Base 4.00 / Add +2.25 (Lado E)',
  'Base 6.00 / Add +2.50 (Lado D)',
  'Base 6.00 / Add +2.50 (Lado E)',
  'Base 6.00 / Add +2.75 (Lado D)',
  'Base 6.00 / Add +2.75 (Lado E)',
  'Base 6.00 / Add +3.00 (Lado D)',
  'Base 6.00 / Add +3.00 (Lado E)',
  'Base 6.00 / Add +3.25 (Lado D)',
  'Base 6.00 / Add +3.25 (Lado E)',
  'Outra Dioptria (Digitar)'
];

export default function GestaoPedidosFornecedor() {
  const [orders, setOrders] = useState([]);
  const [lensModels, setLensModels] = useState([]);
  const [blockModels, setBlockModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Modal Novo Pedido
  const [showModal, setShowModal] = useState(false);
  const [supplierName, setSupplierName] = useState('Distribuidora de Lentes Matriz');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { item_type: 'lente', model_name: 'Lente Essilor Crizal 1.56', dioptria: 'Sph -2.00 / Cyl -1.00', quantity: 10, unit_cost_price: 35.00, unit_resale_price: 120.00 }
  ]);

  // Modal Ver Pedido
  const [viewOrder, setViewOrder] = useState(null);

  // Modal Editar Pedido
  const [editOrder, setEditOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/supplier-orders/');
      setOrders(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar pedidos do fornecedor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCatalogModels();
  }, []);

  const fetchCatalogModels = async () => {
    try {
      const [lensRes, blockRes] = await Promise.all([
        LensService.getModels().catch(() => ({ data: [] })),
        BlockService.getModels().catch(() => ({ data: [] }))
      ]);
      setLensModels(lensRes.data || []);
      setBlockModels(blockRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar modelos para pedidos:", err);
    }
  };

  const handleAddItem = (type = 'lente') => {
    setItems(prev => [
      ...prev,
      { 
        item_type: type, 
        model_name: type === 'bloco' ? 'Bloco Transitions Gen8 1.56' : 'Lente Essilor Crizal 1.56', 
        dioptria: type === 'bloco' ? 'Base 4.00 / Add +2.00 (Lado D)' : 'Sph -2.00 / Cyl -1.00', 
        quantity: 5, 
        unit_cost_price: type === 'bloco' ? 45.00 : 35.00, 
        unit_resale_price: type === 'bloco' ? 150.00 : 120.00 
      }
    ]);
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleSelectModel = (idx, modelId, isEdit = false) => {
    const updateFn = isEdit ? setEditOrder : setItems;

    if (isEdit) {
      setEditOrder(prev => {
        if (!prev) return null;
        const currentItem = prev.items[idx];
        const isBloco = currentItem.item_type === 'bloco';
        let found = null;
        if (isBloco) {
          found = blockModels.find(m => m.id.toString() === modelId.toString());
        } else {
          found = lensModels.find(m => m.id.toString() === modelId.toString());
        }

        const newItems = [...prev.items];
        newItems[idx] = {
          ...currentItem,
          model_id: modelId,
          model_name: found ? `${found.brand || found.name} ${found.name || ''}`.trim() : currentItem.model_name,
          unit_cost_price: found?.cost_price ? parseFloat(found.cost_price) : currentItem.unit_cost_price,
          unit_resale_price: found?.sale_price ? parseFloat(found.sale_price) : currentItem.unit_resale_price
        };
        return { ...prev, items: newItems };
      });
    } else {
      setItems(prev => prev.map((item, i) => {
        if (i !== idx) return item;
        const isBloco = item.item_type === 'bloco';
        let found = null;
        if (isBloco) {
          found = blockModels.find(m => m.id.toString() === modelId.toString());
        } else {
          found = lensModels.find(m => m.id.toString() === modelId.toString());
        }
        return {
          ...item,
          model_id: modelId,
          model_name: found ? `${found.brand || found.name} ${found.name || ''}`.trim() : item.model_name,
          unit_cost_price: found?.cost_price ? parseFloat(found.cost_price) : item.unit_cost_price,
          unit_resale_price: found?.sale_price ? parseFloat(found.sale_price) : item.unit_resale_price
        };
      }));
    }
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        supplier_name: supplierName,
        notes,
        items: items.map(i => ({
          model_name: i.model_name,
          dioptria: i.dioptria,
          quantity: parseInt(i.quantity) || 1,
          unit_cost_price: parseFloat(i.unit_cost_price) || 0,
          unit_resale_price: parseFloat(i.unit_resale_price) || 0
        }))
      };

      await api.post('/supplier-orders/', payload);
      setShowModal(false);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao criar pedido no fornecedor.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditOrder = (order) => {
    setEditOrder({
      id: order.id,
      order_number: order.order_number,
      supplier_name: order.supplier_name,
      status: order.status || 'RASCUNHO',
      notes: order.notes || '',
      items: order.items ? order.items.map(i => ({
        model_name: i.model_name,
        dioptria: i.dioptria || '',
        quantity: i.quantity,
        unit_cost_price: parseFloat(i.unit_cost_price) || 0,
        unit_resale_price: parseFloat(i.unit_resale_price) || 0
      })) : []
    });
  };

  const handleAddEditItem = () => {
    setEditOrder(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { model_name: 'Novo Item / Lente', dioptria: 'Sph 0.00 / Cyl 0.00', quantity: 1, unit_cost_price: 40.00, unit_resale_price: 150.00 }
      ]
    }));
  };

  const handleRemoveEditItem = (idx) => {
    setEditOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleEditItemChange = (idx, field, val) => {
    setEditOrder(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: val } : item)
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editOrder) return;
    setUpdating(true);
    try {
      const payload = {
        supplier_name: editOrder.supplier_name,
        status: editOrder.status,
        notes: editOrder.notes,
        items: editOrder.items.map(i => ({
          model_name: i.model_name,
          dioptria: i.dioptria,
          quantity: parseInt(i.quantity) || 1,
          unit_cost_price: parseFloat(i.unit_cost_price) || 0,
          unit_resale_price: parseFloat(i.unit_resale_price) || 0
        }))
      };

      await api.put(`/supplier-orders/${editOrder.id}`, payload);
      setEditOrder(null);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao atualizar pedido no fornecedor.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOrder = async (id, orderNumber) => {
    if (!window.confirm(`Tem certeza que deseja excluir o pedido ${orderNumber}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/supplier-orders/${id}`);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao excluir pedido no fornecedor.');
    }
  };

  const handleGenerateFromAI = async () => {
    setLoading(true);
    try {
      const res = await api.get('/alerts/predictive');
      const alerts = res.data || [];
      
      const suggestions = alerts.filter(a => (a.suggested_purchase || a.suggested_buy_qty || 0) > 0);

      let newItems = [];
      if (suggestions.length > 0) {
        newItems = suggestions.map(a => ({
          model_name: `[${a.item_type || 'LENTE'}] ${a.brand || a.treatment || 'Lente'} ${a.material || ''}`.trim(),
          dioptria: `Sph ${(a.spherical || 0) >= 0 ? '+' : ''}${(a.spherical || 0).toFixed(2)} / Cyl ${(a.cylindrical || 0).toFixed(2)}`,
          quantity: a.suggested_purchase || a.suggested_buy_qty || 1,
          unit_cost_price: parseFloat(a.cost_price) || 35.00,
          unit_resale_price: parseFloat(a.sale_price) || 105.00
        }));
      } else {
        newItems = [
          { model_name: '[LENTE] Essilor Crizal 1.56', dioptria: 'Sph -2.00 / Cyl -1.00', quantity: 10, unit_cost_price: 35.00, unit_resale_price: 120.00 }
        ];
      }

      setSupplierName('Distribuidora de Lentes Matriz');
      setNotes('Pedido gerado automaticamente pela IA de Compras Preditivas');
      setItems(newItems);
      setShowModal(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao carregar sugestões da IA.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Totais agregados
  const totalCostAll = orders.reduce((sum, o) => sum + parseFloat(o.total_cost || 0), 0);
  const totalResaleAll = orders.reduce((sum, o) => sum + parseFloat(o.total_estimated_resale || 0), 0);
  const totalMarginAmtAll = totalResaleAll - totalCostAll;
  const totalMarginPctAll = totalResaleAll > 0 ? (totalMarginAmtAll / totalResaleAll * 100) : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingCart style={{ color: '#2563eb' }} size={28} />
            Gestão de Pedidos no Fornecedor & Margem (Custo vs. Revenda)
          </h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginTop: '4px' }}>
            Emissão de Ordens de Compra para Fornecedores de Lentes, controle de Custo Pago e projeção de Margem Bruta de Revenda.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleGenerateFromAI}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Cpu size={16} /> Gerar Pedido via IA de Compras (1-Clique)
          </button>
          <button 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Plus size={16} /> Novo Pedido de Fornecedor
          </button>
        </div>
      </div>

      {/* Cards de Resumo Financeiro Custo x Revenda */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)' }}>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Custo Total em Pedidos</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{formatCurrency(totalCostAll)}</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)' }}>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Projeção de Venda (Faturamento)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{formatCurrency(totalResaleAll)}</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)' }}>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Margem Bruta (R$)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{formatCurrency(totalMarginAmtAll)}</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)' }}>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Margem Média (%)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>{totalMarginPctAll.toFixed(1)}%</div>
        </div>
      </div>

      {/* Tabela de Pedidos Emitidos com Coluna de Ações */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.8)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Histórico de Pedidos no Fornecedor</h3>
          <button onClick={fetchOrders} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Cód. Pedido</th>
              <th style={{ padding: '12px 16px' }}>Fornecedor</th>
              <th style={{ padding: '12px 16px' }}>Itens / Dioptrias</th>
              <th style={{ padding: '12px 16px' }}>Custo Pago</th>
              <th style={{ padding: '12px 16px' }}>Estimado Revenda</th>
              <th style={{ padding: '12px 16px' }}>Margem Bruta</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Nenhum pedido de fornecedor registrado.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>{order.order_number}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{order.supplier_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569' }}>
                    {order.items.map(i => `${i.model_name} (${i.quantity}un)`).join(', ')}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ef4444' }}>{formatCurrency(order.total_cost)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#10b981' }}>{formatCurrency(order.total_estimated_resale)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{formatCurrency(order.gross_margin_amount)}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>({parseFloat(order.gross_margin_percent).toFixed(1)}%)</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: order.status === 'RECEBIDO' ? 'rgba(16,185,129,0.1)' : order.status === 'CANCELADO' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: order.status === 'RECEBIDO' ? '#10b981' : order.status === 'CANCELADO' ? '#ef4444' : '#2563eb' }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Botão Ver */}
                      <button 
                        onClick={() => setViewOrder(order)}
                        title="Ver Pedido Completo"
                        style={{ padding: '6px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Eye size={16} />
                      </button>

                      {/* Botão Editar */}
                      <button 
                        onClick={() => handleEditOrder(order)}
                        title="Editar Pedido"
                        style={{ padding: '6px', background: 'rgba(245,158,11,0.1)', color: '#d97706', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Pencil size={16} />
                      </button>

                      {/* Botão Excluir */}
                      <button 
                        onClick={() => handleDeleteOrder(order.id, order.order_number)}
                        title="Excluir Pedido"
                        style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Pedido Completo */}
      {viewOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '800px', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Detalhes do Pedido {viewOrder.order_number}</h2>
              <button onClick={() => setViewOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div><strong>Fornecedor:</strong> {viewOrder.supplier_name}</div>
              <div><strong>Status:</strong> <span style={{ fontWeight: 700, color: '#2563eb' }}>{viewOrder.status}</span></div>
              <div><strong>Data Emissão:</strong> {new Date(viewOrder.created_at).toLocaleDateString('pt-BR')}</div>
            </div>

            {viewOrder.notes && (
              <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#475569', background: '#fffbe3', padding: '10px', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <strong>Observações:</strong> {viewOrder.notes}
              </div>
            )}

            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px' }}>Itens Solicitados</h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Modelo</th>
                    <th style={{ padding: '8px' }}>Dioptria</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qtd</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Custo Un.</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Custo Total</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Revenda Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrder.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{item.model_name}</td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{item.dioptria || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{item.quantity} un</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unit_cost_price)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{formatCurrency(item.total_cost_price)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(item.total_resale_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div><strong>Custo Total:</strong> <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(viewOrder.total_cost)}</span></div>
              <div><strong>Faturamento Est.:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{formatCurrency(viewOrder.total_estimated_resale)}</span></div>
              <div><strong>Margem Bruta:</strong> <span style={{ color: '#2563eb', fontWeight: 700 }}>{formatCurrency(viewOrder.gross_margin_amount)} ({parseFloat(viewOrder.gross_margin_percent).toFixed(1)}%)</span></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewOrder(null)} style={{ padding: '8px 18px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Pedido (Com Layout Responsivo e Descrição Clara dos Campos) */}
      {editOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', width: '95%', maxWidth: '850px', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Editar Pedido {editOrder.order_number}</h2>
              <button onClick={() => setEditOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Fornecedor / Distribuidora</label>
                  <input 
                    type="text"
                    value={editOrder.supplier_name}
                    onChange={e => setEditOrder({ ...editOrder, supplier_name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Status do Pedido</label>
                  <select 
                    value={editOrder.status}
                    onChange={e => setEditOrder({ ...editOrder, status: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, boxSizing: 'border-box' }}
                  >
                    <option value="RASCUNHO">RASCUNHO</option>
                    <option value="ENVIADO">ENVIADO</option>
                    <option value="RECEBIDO">RECEBIDO</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Observações</label>
                <input 
                  type="text"
                  value={editOrder.notes}
                  onChange={e => setEditOrder({ ...editOrder, notes: e.target.value })}
                  placeholder="Ex: Pedido com entrega prevista para sexta-feira"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', marginTop: '16px' }}>Itens do Pedido (Lentes / Blocos)</h4>
              
              {/* Descrição Limpa e Clara dos Cabeçalhos das Colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr 1.8fr 0.8fr 1fr 1fr 36px', gap: '8px', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', paddingRight: '6px' }}>
                <div>Tipo Item</div>
                <div>Modelo do Banco</div>
                <div>Dioptria (Dropdown)</div>
                <div>Qtd</div>
                <div>Custo (R$)</div>
                <div>Venda (R$)</div>
                <div></div>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
                {editOrder.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr 1.8fr 0.8fr 1fr 1fr 36px', gap: '8px', alignItems: 'start', marginBottom: '10px', background: item.item_type === 'bloco' ? 'rgba(192,132,252,0.06)' : 'rgba(0,242,254,0.04)', padding: '6px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    
                    {/* Campo 1: Tipo do Item (Lente vs Bloco) */}
                    <select 
                      value={item.item_type || 'lente'} 
                      onChange={e => handleEditItemChange(idx, 'item_type', e.target.value)}
                      style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, background: '#fff' }}
                    >
                      <option value="lente">🔍 Lente</option>
                      <option value="bloco">📦 Bloco</option>
                    </select>

                    {/* Campo 2: Modelo do Banco (Puxado via API) */}
                    <div>
                      <select
                        value={item.model_id || ''}
                        onChange={e => handleSelectModel(idx, e.target.value, true)}
                        style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="">Selecione o Modelo...</option>
                        {(item.item_type === 'bloco' ? blockModels : lensModels).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.brand} - {m.name}
                          </option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="Nome do Modelo" 
                        value={item.model_name} 
                        onChange={e => handleEditItemChange(idx, 'model_name', e.target.value)} 
                        required 
                        style={{ marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box' }} 
                      />
                    </div>

                    {/* Campo 3: Dioptria Puxada em Dropdown */}
                    <div>
                      <select
                        value={item.dioptria_select || ((item.item_type === 'bloco' ? BLOCK_DIOPTRIA_OPTIONS : LENS_DIOPTRIA_OPTIONS).includes(item.dioptria) ? item.dioptria : 'Outra Dioptria (Digitar)')}
                        onChange={e => {
                          const val = e.target.value;
                          handleEditItemChange(idx, 'dioptria_select', val);
                          if (val !== 'Outra Dioptria (Digitar)') {
                            handleEditItemChange(idx, 'dioptria', val);
                          }
                        }}
                        style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="">Selecione a Dioptria...</option>
                        {(item.item_type === 'bloco' ? BLOCK_DIOPTRIA_OPTIONS : LENS_DIOPTRIA_OPTIONS).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="Dioptria manual..." 
                        value={item.dioptria} 
                        onChange={e => handleEditItemChange(idx, 'dioptria', e.target.value)} 
                        style={{ marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box' }} 
                      />
                    </div>

                    <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => handleEditItemChange(idx, 'quantity', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <input type="number" step="0.01" placeholder="Custo Pago" value={item.unit_cost_price} onChange={e => handleEditItemChange(idx, 'unit_cost_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <input type="number" step="0.01" placeholder="Venda Est." value={item.unit_resale_price} onChange={e => handleEditItemChange(idx, 'unit_resale_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => handleRemoveEditItem(idx)} title="Remover item" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '34px', fontWeight: 700 }}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button type="button" onClick={() => {
                  setEditOrder(prev => ({
                    ...prev,
                    items: [...prev.items, { item_type: 'lente', model_name: 'Lente Essilor Crizal 1.56', dioptria: 'Sph -2.00 / Cyl -1.00', quantity: 5, unit_cost_price: 35.00, unit_resale_price: 120.00 }]
                  }));
                }} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  + Adicionar Lente Acabada
                </button>
                <button type="button" onClick={() => {
                  setEditOrder(prev => ({
                    ...prev,
                    items: [...prev.items, { item_type: 'bloco', model_name: 'Bloco Transitions Gen8 1.56', dioptria: 'Base 4.00 / Add +2.00 (Lado D)', quantity: 5, unit_cost_price: 45.00, unit_resale_price: 150.00 }]
                  }));
                }} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px dashed #9333ea', color: '#9333ea', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  + Adicionar Bloco Semiacabado
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setEditOrder(null)} style={{ padding: '10px 18px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={updating} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  {updating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido (Com Diferenciação de Lente / Bloco e Dropdown de Dioptria do Banco) */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', width: '95%', maxWidth: '980px', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Novo Pedido de Compra no Fornecedor</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveOrder}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Nome do Fornecedor / Distribuidora</label>
                <input 
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', marginTop: '16px' }}>Itens do Pedido (Lentes / Blocos)</h4>
              
              {/* Descrição Limpa e Clara dos Cabeçalhos das Colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr 1.8fr 0.8fr 1fr 1fr 36px', gap: '8px', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', paddingRight: '6px' }}>
                <div>Tipo Item</div>
                <div>Modelo do Banco</div>
                <div>Dioptria (Dropdown)</div>
                <div>Qtd</div>
                <div>Custo (R$)</div>
                <div>Venda (R$)</div>
                <div></div>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr 1.8fr 0.8fr 1fr 1fr 36px', gap: '8px', alignItems: 'start', marginBottom: '10px', background: item.item_type === 'bloco' ? 'rgba(192,132,252,0.06)' : 'rgba(0,242,254,0.04)', padding: '6px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    
                    {/* Campo 1: Tipo do Item (Lente vs Bloco) */}
                    <select 
                      value={item.item_type || 'lente'} 
                      onChange={e => handleItemChange(idx, 'item_type', e.target.value)}
                      style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, background: '#fff' }}
                    >
                      <option value="lente">🔍 Lente</option>
                      <option value="bloco">📦 Bloco</option>
                    </select>

                    {/* Campo 2: Modelo do Banco (Puxado via API) */}
                    <div>
                      <select
                        value={item.model_id || ''}
                        onChange={e => handleSelectModel(idx, e.target.value)}
                        style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="">Selecione o Modelo...</option>
                        {(item.item_type === 'bloco' ? blockModels : lensModels).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.brand} - {m.name}
                          </option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="Nome do Modelo" 
                        value={item.model_name} 
                        onChange={e => handleItemChange(idx, 'model_name', e.target.value)} 
                        required 
                        style={{ marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box' }} 
                      />
                    </div>

                    {/* Campo 3: Dioptria Puxada em Dropdown */}
                    <div>
                      <select
                        value={item.dioptria_select || ((item.item_type === 'bloco' ? BLOCK_DIOPTRIA_OPTIONS : LENS_DIOPTRIA_OPTIONS).includes(item.dioptria) ? item.dioptria : 'Outra Dioptria (Digitar)')}
                        onChange={e => {
                          const val = e.target.value;
                          handleItemChange(idx, 'dioptria_select', val);
                          if (val !== 'Outra Dioptria (Digitar)') {
                            handleItemChange(idx, 'dioptria', val);
                          }
                        }}
                        style={{ padding: '8px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="">Selecione a Dioptria...</option>
                        {(item.item_type === 'bloco' ? BLOCK_DIOPTRIA_OPTIONS : LENS_DIOPTRIA_OPTIONS).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        placeholder="Dioptria manual..." 
                        value={item.dioptria} 
                        onChange={e => handleItemChange(idx, 'dioptria', e.target.value)} 
                        style={{ marginTop: '4px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem', width: '100%', boxSizing: 'border-box' }} 
                      />
                    </div>

                    <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <input type="number" step="0.01" placeholder="Custo Pago" value={item.unit_cost_price} onChange={e => handleItemChange(idx, 'unit_cost_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <input type="number" step="0.01" placeholder="Venda Est." value={item.unit_resale_price} onChange={e => handleItemChange(idx, 'unit_resale_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => handleRemoveItem(idx)} title="Remover item" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '34px', fontWeight: 700 }}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button type="button" onClick={() => handleAddItem('lente')} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  + Adicionar Lente Acabada
                </button>
                <button type="button" onClick={() => handleAddItem('bloco')} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px dashed #9333ea', color: '#9333ea', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  + Adicionar Bloco Semiacabado
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 18px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  {creating ? 'Salvando...' : 'Salvar Pedido no Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
