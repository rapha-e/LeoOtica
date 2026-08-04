import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, DollarSign, TrendingUp, Package, CheckCircle, RefreshCw, Cpu, FileText } from 'lucide-react';

export default function GestaoPedidosFornecedor() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [supplierName, setSupplierName] = useState('Distribuidora de Lentes Matriz');
  const [notes, setNotes] = useState('');
  
  // Lista de itens do novo pedido
  const [items, setItems] = useState([
    { model_name: 'Lente Essilor Crizal 1.56', dioptria: 'Sph -2.00 / Cyl -1.00', quantity: 10, unit_cost_price: 35.00, unit_resale_price: 120.00 }
  ]);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/supplier-orders/', { headers: getHeaders() });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (err) {
      console.error('Erro ao carregar pedidos do fornecedor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { model_name: 'Lente Hoya BlueControl 1.59', dioptria: 'Sph 0.00 / Cyl -1.00', quantity: 5, unit_cost_price: 55.00, unit_resale_price: 210.00 }
    ]);
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
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

      const res = await fetch('/api/v1/supplier-orders/', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        fetchOrders();
      } else {
        alert('Erro ao criar pedido no fornecedor.');
      }
    } catch (err) {
      alert('Erro de conexão ao criar pedido.');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateFromAI = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/supplier-orders/from-predictive-ai?lead_time_days=7&safety_days=30&coverage_days=15', {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        fetchOrders();
      } else {
        alert('Erro ao converter sugestão da IA em pedido.');
      }
    } catch (err) {
      alert('Erro de conexão com o servidor.');
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

      {/* Tabela de Pedidos Emitidos */}
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
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
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
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Pedido */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '750px', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px' }}>Novo Pedido de Compra no Fornecedor</h2>
            <form onSubmit={handleSaveOrder}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Nome do Fornecedor / Distribuidora</label>
                <input 
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', marginTop: '20px' }}>Itens do Pedido (Lentes / Bloco / Dioptria)</h4>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 40px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input type="text" placeholder="Nome do Modelo/Lente" value={item.model_name} onChange={e => handleItemChange(idx, 'model_name', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="Dioptria" value={item.dioptria} onChange={e => handleItemChange(idx, 'dioptria', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <input type="number" step="0.01" placeholder="Custo Pago" value={item.unit_cost_price} onChange={e => handleItemChange(idx, 'unit_cost_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <input type="number" step="0.01" placeholder="Venda Est." value={item.unit_resale_price} onChange={e => handleItemChange(idx, 'unit_resale_price', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '34px', fontWeight: 700 }}>✕</button>
                </div>
              ))}

              <button type="button" onClick={handleAddItem} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px dashed #94a3b8', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '20px' }}>
                + Adicionar Item ao Pedido
              </button>

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
