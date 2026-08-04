import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Search, Edit2, Trash2, Clock, Check, 
  X, AlertCircle, RefreshCw, Filter, ShieldAlert, History, Layers, FileText, Box
} from 'lucide-react';
import { ProductService, TreatmentService, TechnicalServiceService, BlockService } from '../services/api';

const CatalogoFinanceiro = () => {
  const [activeSubTab, setActiveSubTab] = useState('products'); // products, blocks, treatments, services
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

  // Formulário estendido com suporte a Blocos
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    description: '',
    sku: '', // apenas produtos
    cost_price: '', // produtos e blocos
    sale_price: '', // produtos e blocos
    price: '', // tratamentos e serviços
    is_active: true,
    change_reason: '',
    is_lens: false,
    brand: '',
    material: 'CR-39',
    refractive_index: '1.56',
    treatment: '',
    diameter: '',
    base_curves_config: '2.00, 4.00, 6.00',
    additions_config: '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
  });

  const [originalPrices, setOriginalPrices] = useState({
    sale_price: null,
    cost_price: null,
    price: null
  });

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carrega os itens baseados na aba ativa e filtros
  const loadItems = async () => {
    setLoading(true);
    try {
      const activeParam = statusFilter === 'ALL' ? null : (statusFilter === 'ACTIVE');
      let response;
      if (activeSubTab === 'products') {
        response = await ProductService.list(searchQuery, activeParam);
        setItems(response.data);
      } else if (activeSubTab === 'blocks') {
        response = await BlockService.getModels(activeParam === true);
        let list = response.data || [];
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          list = list.filter(m => 
            m.name.toLowerCase().includes(q) || 
            m.brand.toLowerCase().includes(q) || 
            m.material.toLowerCase().includes(q)
          );
        }
        if (statusFilter === 'INACTIVE') {
          list = list.filter(m => !m.is_active);
        }
        setItems(list);
      } else if (activeSubTab === 'treatments') {
        response = await TreatmentService.list(searchQuery, activeParam);
        setItems(response.data);
      } else {
        response = await TechnicalServiceService.list(searchQuery, activeParam);
        setItems(response.data);
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar os itens do catálogo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeSubTab, statusFilter]);

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
      sku: '',
      cost_price: activeSubTab === 'blocks' ? '35.00' : '25.00',
      sale_price: activeSubTab === 'blocks' ? '95.00' : '75.00',
      price: '',
      is_active: true,
      change_reason: '',
      is_lens: activeSubTab === 'products',
      brand: '',
      material: 'CR-39',
      refractive_index: '1.56',
      treatment: '',
      diameter: '70',
      base_curves_config: '2.00, 4.00, 6.00',
      additions_config: '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
    });
    setOriginalPrices({ sale_price: null, cost_price: null, price: null });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Abre formulário para edição
  const handleOpenEdit = (item) => {
    const isProd = activeSubTab === 'products';
    const isBlock = activeSubTab === 'blocks';

    setFormData({
      id: item.id,
      name: item.name,
      description: item.description || '',
      sku: isProd ? item.sku : '',
      cost_price: (isProd || isBlock) ? String(item.cost_price || 0) : '',
      sale_price: (isProd || isBlock) ? String(item.sale_price || 0) : '',
      price: (!isProd && !isBlock) ? String(item.price || 0) : '',
      is_active: item.is_active !== undefined ? item.is_active : true,
      change_reason: '',
      is_lens: isProd ? (item.is_lens || false) : false,
      brand: item.brand || '',
      material: item.material || 'CR-39',
      refractive_index: item.refractive_index ? String(item.refractive_index) : '1.56',
      treatment: isProd ? (item.treatment || '') : '',
      diameter: isProd && item.diameter ? String(item.diameter) : '',
      base_curves_config: item.base_curves_config || '2.00, 4.00, 6.00',
      additions_config: item.additions_config || '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
    });

    setOriginalPrices({
      sale_price: (isProd || isBlock) ? item.sale_price : null,
      cost_price: (isProd || isBlock) ? item.cost_price : null,
      price: (!isProd && !isBlock) ? item.price : null
    });

    setFormError('');
    setIsFormModalOpen(true);
  };

  // Verifica se o preço mudou na edição
  const isPriceChanged = () => {
    if (!formData.id) return false;
    if (activeSubTab === 'products' || activeSubTab === 'blocks') {
      const currentSale = parseFloat(formData.sale_price) || 0;
      const currentCost = parseFloat(formData.cost_price) || 0;
      const origSale = parseFloat(originalPrices.sale_price) || 0;
      const origCost = parseFloat(originalPrices.cost_price) || 0;
      return currentSale !== origSale || currentCost !== origCost;
    } else {
      const currentPrice = parseFloat(formData.price) || 0;
      const origPrice = parseFloat(originalPrices.price) || 0;
      return currentPrice !== origPrice;
    }
  };

  // Salvar Item (Produtos, Blocos, Tratamentos ou Serviços)
  const handleSaveItem = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError('O nome é obrigatório.');
      return;
    }

    const priceChanged = isPriceChanged();
    if (priceChanged && !formData.change_reason.trim()) {
      setFormError('É obrigatório informar a justificativa do reajuste de preço.');
      return;
    }

    try {
      if (activeSubTab === 'products') {
        const payload = {
          name: formData.name,
          description: formData.description || null,
          sku: formData.sku,
          cost_price: parseFloat(formData.cost_price) || 0,
          sale_price: parseFloat(formData.sale_price) || 0,
          is_active: formData.is_active,
          change_reason: formData.change_reason || null,
          is_lens: formData.is_lens,
          brand: formData.is_lens ? formData.brand : null,
          material: formData.is_lens ? formData.material : null,
          refractive_index: formData.is_lens ? parseFloat(formData.refractive_index) || null : null,
          treatment: formData.is_lens ? formData.treatment : null,
          diameter: formData.is_lens ? parseInt(formData.diameter) || null : null
        };

        if (formData.id) {
          const res = await ProductService.update(formData.id, payload);
          showToast('Produto atualizado com sucesso!', 'success');
          setItems(items.map(i => i.id === formData.id ? res.data : i));
        } else {
          const res = await ProductService.create(payload);
          showToast('Produto adicionado com sucesso!', 'success');
          setItems([res.data, ...items]);
        }
      } else if (activeSubTab === 'blocks') {
        const payload = {
          brand: formData.brand.trim() || 'Generico',
          name: formData.name.trim(),
          material: formData.material || 'CR-39',
          refractive_index: parseFloat(formData.refractive_index) || 1.56,
          cost_price: parseFloat(formData.cost_price) || 0,
          sale_price: parseFloat(formData.sale_price) || 0,
          is_active: formData.is_active,
          base_curves_config: formData.base_curves_config || '2.00, 4.00, 6.00',
          additions_config: formData.additions_config || '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
        };

        if (formData.id) {
          const res = await BlockService.updateModel(formData.id, payload);
          showToast('Modelo de bloco atualizado com sucesso!', 'success');
          setItems(items.map(i => i.id === formData.id ? res.data : i));
        } else {
          const res = await BlockService.createModel(payload);
          showToast('Modelo de bloco cadastrado com sucesso!', 'success');
          setItems([res.data, ...items]);
        }
      } else if (activeSubTab === 'treatments') {
        const payload = {
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price) || 0,
          is_active: formData.is_active,
          change_reason: formData.change_reason || null
        };

        if (formData.id) {
          const res = await TreatmentService.update(formData.id, payload);
          showToast('Tratamento atualizado com sucesso!', 'success');
          setItems(items.map(i => i.id === formData.id ? res.data : i));
        } else {
          const res = await TreatmentService.create(payload);
          showToast('Tratamento adicionado com sucesso!', 'success');
          setItems([res.data, ...items]);
        }
      } else {
        const payload = {
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price) || 0,
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
      }
      setIsFormModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao salvar o item.');
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
      if (activeSubTab === 'products') {
        await ProductService.delete(selectedItem.id);
      } else if (activeSubTab === 'blocks') {
        await BlockService.deleteModel(selectedItem.id);
      } else if (activeSubTab === 'treatments') {
        await TreatmentService.delete(selectedItem.id);
      } else {
        await TechnicalServiceService.delete(selectedItem.id);
      }
      showToast('Item excluído permanentemente!', 'success');
      setItems(items.filter(i => i.id !== selectedItem.id));
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Erro ao excluir o item.', 'error');
    }
  };

  // Histórico de Versões
  const handleOpenHistory = async (item) => {
    setSelectedItem(item);
    setHistoryData([]);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      let response;
      if (activeSubTab === 'products') {
        response = await ProductService.getPriceHistory(item.id);
        setHistoryData(response.data);
      } else if (activeSubTab === 'treatments') {
        response = await TreatmentService.getPriceHistory(item.id);
        setHistoryData(response.data);
      } else if (activeSubTab === 'services') {
        response = await TechnicalServiceService.getPriceHistory(item.id);
        setHistoryData(response.data);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Falha ao carregar o histórico de preços.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Toast Feedback */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '10px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}>
          {toast.message}
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={28} style={{ color: 'hsl(var(--primary))' }} />
            Catálogo Financeiro
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Defina preços, gerencie versões e monitore custos e vendas para faturamento seguro.
          </p>
        </div>
        
        <div>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Cadastrar {activeSubTab === 'products' ? 'Lente' : activeSubTab === 'blocks' ? 'Bloco Semiacabado' : activeSubTab === 'treatments' ? 'Tratamento' : 'Serviço'}
          </button>
        </div>
      </div>

      {/* Sub-Abas do Catálogo */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '2px',
        gap: '8px'
      }}>
        <button 
          onClick={() => { setActiveSubTab('products'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'products' ? '3px solid hsl(var(--primary))' : '3px solid transparent',
            color: activeSubTab === 'products' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
            fontWeight: activeSubTab === 'products' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
        >
          Lentes
        </button>

        <button 
          onClick={() => { setActiveSubTab('blocks'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'blocks' ? '3px solid hsl(var(--primary))' : '3px solid transparent',
            color: activeSubTab === 'blocks' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
            fontWeight: activeSubTab === 'blocks' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Box size={16} /> Blocos Semiacabados
        </button>

        <button 
          onClick={() => { setActiveSubTab('treatments'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'treatments' ? '3px solid hsl(var(--primary))' : '3px solid transparent',
            color: activeSubTab === 'treatments' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
            fontWeight: activeSubTab === 'treatments' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
        >
          Tratamentos de Lentes
        </button>

        <button 
          onClick={() => { setActiveSubTab('services'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'services' ? '3px solid hsl(var(--primary))' : '3px solid transparent',
            color: activeSubTab === 'services' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
            fontWeight: activeSubTab === 'services' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
        >
          Serviços de Laboratório
        </button>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder={`Buscar por nome${activeSubTab === 'products' ? ' ou SKU' : activeSubTab === 'blocks' ? ' ou Marca' : ''}...`}
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
              style={{ width: '160px', padding: '8px 12px' }}
            >
              <option value="ALL">Todos os Status</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="INACTIVE">Apenas Inativos</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={loading}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Filtrar'}
          </button>
        </form>
      </div>

      {/* Tabela de Listagem */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', minHeight: '300px' }}>
        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'hsl(var(--text-muted))', gap: '10px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
            <span>Carregando catálogo...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
            <Layers size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>Nenhum item cadastrado com esses filtros.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Nome / Modelo</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                  {activeSubTab === 'blocks' ? 'Especificação Técnica' : activeSubTab === 'products' ? 'SKU' : 'Descrição'}
                </th>
                
                {(activeSubTab === 'products' || activeSubTab === 'blocks') ? (
                  <>
                    <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço Custo</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço Venda</th>
                  </>
                ) : (
                  <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço</th>
                )}
                
                {activeSubTab === 'blocks' && (
                  <>
                    <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Curvas Base</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Adições</th>
                  </>
                )}

                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr 
                  key={item.id} 
                  style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: item.is_active !== false ? 'transparent' : 'rgba(0,0,0,0.05)' 
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                    {item.name}
                    {activeSubTab === 'blocks' && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 400 }}>
                        Marca: {item.brand}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
                    {activeSubTab === 'blocks' ? (
                      <span>{item.material} (Ind. {item.refractive_index})</span>
                    ) : activeSubTab === 'products' ? (
                      <span style={{ fontFamily: 'monospace' }}>{item.sku}</span>
                    ) : (
                      item.description || '-'
                    )}
                  </td>
                  
                  {(activeSubTab === 'products' || activeSubTab === 'blocks') ? (
                    <>
                      <td style={{ padding: '16px 20px', color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>{formatCurrency(item.cost_price)}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: 'hsl(var(--primary))' }}>{formatCurrency(item.sale_price)}</td>
                    </>
                  ) : (
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: 'hsl(var(--primary))' }}>{formatCurrency(item.price)}</td>
                  )}

                  {activeSubTab === 'blocks' && (
                    <>
                      <td style={{ padding: '16px 20px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                        {item.base_curves_config || '2.00, 4.00, 6.00'}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                        {item.additions_config || '0.00 a 3.00'}
                      </td>
                    </>
                  )}

                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: item.is_active !== false ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--danger) / 0.12)',
                      color: item.is_active !== false ? 'hsl(var(--success))' : 'hsl(var(--danger))'
                    }}>
                      {item.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {activeSubTab !== 'blocks' && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                          onClick={() => handleOpenHistory(item)}
                          title="Histórico de Preços"
                        >
                          <Clock size={13} style={{ marginRight: '4px' }} /> Histórico
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => handleOpenEdit(item)}
                        title="Editar Item"
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
                        onClick={() => handleOpenDelete(item)}
                        title={userRole === 'Administrador' ? 'Excluir Item' : 'Exclusão permitida apenas para Administradores'}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsFormModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={22} style={{ color: 'hsl(var(--primary))' }} />
              {formData.id 
                ? `Editar ${activeSubTab === 'products' ? 'Lente' : activeSubTab === 'blocks' ? 'Modelo de Bloco' : activeSubTab === 'treatments' ? 'Tratamento' : 'Serviço'}` 
                : `Cadastrar ${activeSubTab === 'products' ? 'Lente' : activeSubTab === 'blocks' ? 'Modelo de Bloco' : activeSubTab === 'treatments' ? 'Tratamento' : 'Serviço'}`}
            </h3>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    {activeSubTab === 'blocks' ? 'Nome do Modelo de Bloco *' : 'Nome *'}
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required
                    placeholder={activeSubTab === 'blocks' ? 'Ex: Bloco Freeform 1.56' : 'Ex: Antirreflexo Premium...'}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>

                {activeSubTab === 'blocks' && (
                  <div className="form-group">
                    <label className="form-label">Marca / Fabricante *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required
                      placeholder="Ex: Essilor, Hoya, Zeiss"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ color: 'black' }}
                    />
                  </div>
                )}

                {activeSubTab === 'products' && (
                  <div className="form-group">
                    <label className="form-label">SKU (Código único) *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required
                      placeholder="Ex: LENT-CR39-AR"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      style={{ color: 'black' }}
                    />
                  </div>
                )}
              </div>

              {activeSubTab === 'blocks' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Material *</label>
                    <select
                      className="form-control"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      style={{ color: 'black' }}
                    >
                      <option value="CR-39">CR-39</option>
                      <option value="Policarbonato">Policarbonato</option>
                      <option value="Trivex">Trivex</option>
                      <option value="Resina Alto Índice">Resina Alto Índice</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Índice Refração *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      required
                      placeholder="Ex: 1.56"
                      value={formData.refractive_index}
                      onChange={(e) => setFormData({ ...formData, refractive_index: e.target.value })}
                      style={{ color: 'black' }}
                    />
                  </div>
                </div>
              )}

              {(activeSubTab === 'products' || activeSubTab === 'blocks') ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Preço de Custo (R$) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      required
                      placeholder="0.00"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      style={{ color: 'black' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Preço de Venda (R$) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-control" 
                      required
                      placeholder="0.00"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      style={{ color: 'black' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ maxWidth: '270px' }}>
                  <label className="form-label">Preço de Venda (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    required
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>
              )}

              {(activeSubTab === 'treatments' || activeSubTab === 'services' || activeSubTab === 'products') && (
                <div className="form-group">
                  <label className="form-label">Descrição / Observações Técnicas</label>
                  <textarea
                    className="form-control"
                    placeholder="Informe detalhes, garantias ou especificações técnicas..."
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>
              )}

              {/* Opções de Cadastro de Curva Base e Adição (Específico para Blocos Semiacabados) */}
              {activeSubTab === 'blocks' && (
                <div style={{
                  background: 'rgba(147, 51, 234, 0.05)',
                  border: '1px solid rgba(147, 51, 234, 0.2)',
                  padding: '16px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>
                    📐 Configuração de Curvas Base & Adições da Grade de Blocos
                  </span>
                  
                  {/* Curvas Base: Exatamente 3 Opções (Base 2, 4 e 6) */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                      Curvas Base da Grade (3 Opções *):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px' }}>
                      {['2.00', '4.00', '6.00'].map(bVal => {
                        const currList = (formData.base_curves_config || '').split(',').map(s => s.trim());
                        const isSel = currList.includes(bVal);
                        return (
                          <button
                            key={bVal}
                            type="button"
                            onClick={() => {
                              const curr = (formData.base_curves_config || '').split(',').map(s => s.trim()).filter(Boolean);
                              const next = isSel ? curr.filter(x => x !== bVal) : [...curr, bVal];
                              next.sort((a, b) => parseFloat(a) - parseFloat(b));
                              setFormData({ ...formData, base_curves_config: next.join(', ') });
                            }}
                            style={{
                              padding: '10px',
                              borderRadius: '8px',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              border: isSel ? '2px solid hsl(var(--primary))' : '1px solid #cbd5e1',
                              background: isSel ? 'hsl(var(--primary))' : '#f8fafc',
                              color: isSel ? '#fff' : '#475569',
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            Base {bVal} {isSel ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Adições da Grade: Exatamente 10 Opções (0.00, +1.00 a +3.00 com passo de 0.25) */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                      Adições da Grade (10 Opções *):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '6px' }}>
                      {['0.00', '1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00'].map(aVal => {
                        const currList = (formData.additions_config || '').split(',').map(s => s.trim());
                        const isSel = currList.includes(aVal);
                        const labelText = aVal === '0.00' ? '0.00' : `+${aVal}`;
                        return (
                          <button
                            key={aVal}
                            type="button"
                            onClick={() => {
                              const curr = (formData.additions_config || '').split(',').map(s => s.trim()).filter(Boolean);
                              const next = isSel ? curr.filter(x => x !== aVal) : [...curr, aVal];
                              next.sort((a, b) => parseFloat(a) - parseFloat(b));
                              setFormData({ ...formData, additions_config: next.join(', ') });
                            }}
                            style={{
                              padding: '8px 4px',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              border: isSel ? '2px solid #10b981' : '1px solid #cbd5e1',
                              background: isSel ? '#10b981' : '#f8fafc',
                              color: isSel ? '#fff' : '#475569',
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            {labelText} {isSel ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="checkbox" 
                  id="catalog-active-checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="catalog-active-checkbox" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                  Item Ativo (Disponível no catálogo e grade)
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
                  color: '#dc2626',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão */}
      {isDeleteModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', marginBottom: '12px' }}>
              Confirmar Exclusão
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
              Tem certeza que deseja excluir o item <strong>{selectedItem.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              <button onClick={handleDeleteItem} className="btn btn-primary btn-sm" style={{ background: '#dc2626' }}>Excluir Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoFinanceiro;
