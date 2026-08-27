import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign, Plus, Search, Edit2, Trash2, Clock, Check,
  X, AlertCircle, RefreshCw, Filter, ShieldAlert, History, Layers, FileText, Box, Barcode, Scan
} from 'lucide-react';
import { ProductService, TreatmentService, TechnicalServiceService, BlockService } from '../services/api';

const CatalogoFinanceiro = ({ onOpenManualLensInsert }) => {
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

  const [isTreatmentEdited, setIsTreatmentEdited] = useState(false);
  const skuInputRef = useRef(null);
  const [skuScannedAlert, setSkuScannedAlert] = useState(false);

  // Formulário estendido com suporte a Blocos e Grades de Lente
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
    additions_config: '0.00, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25',
    matrix_type: 'MF_ACB',
    quantity: '1',
    eye_side: 'AMBOS',
    base_curve: '4.00',
    addition: '1.00',
    spherical: '0.00',
    cylindrical: '0.00'
  });

  const [originalPrices, setOriginalPrices] = useState({
    sale_price: null,
    cost_price: null,
    price: null
  });

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');

  // Lista Padrão de Tratamentos LP
  const LP_TREATMENTS_OPTIONS = [
    { id: 'LP incolor 1.50', label: 'LP incolor 1.50', material: 'Resina', refractive_index: '1.50', defaultCost: '15.00', defaultSale: '60.00' },
    { id: 'LP Ar 1.56', label: 'LP Ar 1.56', material: 'Resina', refractive_index: '1.56', defaultCost: '25.00', defaultSale: '75.00' },
    { id: 'LP filtro Azul AR 1.56', label: 'LP filtro Azul AR 1.56', material: 'Resina', refractive_index: '1.56', defaultCost: '35.00', defaultSale: '95.00' },
    { id: 'LP POLY AR 1.59', label: 'LP POLY AR 1.59', material: 'Policarbonato', refractive_index: '1.59', defaultCost: '40.00', defaultSale: '110.00' },
    { id: 'LP POLY FILTRO AZUL AR 1.59', label: 'LP POLY FILTRO AZUL AR 1.59', material: 'Policarbonato', refractive_index: '1.59', defaultCost: '50.00', defaultSale: '130.00' },
    { id: 'LP PHOTO AR 1.56', label: 'LP PHOTO AR 1.56', material: 'Fotocromática', refractive_index: '1.56', defaultCost: '55.00', defaultSale: '145.00' },
    { id: 'LP PHOTO FILTRO AZUL AR 1.56', label: 'LP PHOTO FILTRO AZUL AR 1.56', material: 'Fotocromática', refractive_index: '1.56', defaultCost: '65.00', defaultSale: '170.00' }
  ];

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

  const handleNameInputChange = (newName) => {
    setFormData(prev => ({
      ...prev,
      name: newName,
      treatment: isTreatmentEdited ? prev.treatment : newName
    }));
  };

  // Abre formulário para criação
  const handleOpenCreate = (targetTab = null) => {
    const subTab = targetTab || activeSubTab;
    if (targetTab) {
      setActiveSubTab(subTab);
    }
    setFormData({
      id: null,
      name: '',
      description: '',
      sku: '',
      cost_price: subTab === 'blocks' ? '35.00' : '25.00',
      sale_price: subTab === 'blocks' ? '95.00' : '75.00',
      price: '',
      is_active: true,
      change_reason: '',
      is_lens: subTab === 'products',
      brand: '',
      material: 'CR-39',
      refractive_index: '1.56',
      treatment: '',
      diameter: '70',
      base_curves_config: '2.00, 4.00, 6.00',
      additions_config: '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00',
      matrix_type: 'MF_ACB',
      quantity: '1',
      eye_side: 'AMBOS',
      base_curve: '4.00',
      addition: '1.00',
      spherical: '0.00',
      cylindrical: '0.00'
    });
    setIsTreatmentEdited(false);
    setOriginalPrices({ sale_price: null, cost_price: null, price: null });
    setFormError('');
    setIsFormModalOpen(true);
    if (subTab === 'products') {
      setTimeout(() => skuInputRef.current?.focus(), 150);
    }
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
      treatment: isProd ? (item.treatment || item.name || '') : '',
      diameter: isProd && item.diameter ? String(item.diameter) : '',
      base_curves_config: item.base_curves_config || '2.00, 4.00, 6.00',
      additions_config: item.additions_config || '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00',
      matrix_type: item.matrix_type || item.lens_model?.matrix_type || 'MF_ACB',
      quantity: item.quantity ? String(item.quantity) : '1',
      eye_side: item.eye_side || 'AMBOS',
      base_curve: item.base_curve ? String(item.base_curve) : '4.00',
      addition: item.addition ? String(item.addition) : '1.00',
      spherical: item.spherical ? String(item.spherical) : '0.00',
      cylindrical: item.cylindrical ? String(item.cylindrical) : '0.00'
    });

    setIsTreatmentEdited(Boolean(item.treatment && item.treatment !== item.name));

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
        const parseNum = (val) => {
          if (val === null || val === undefined || val === '') return null;
          const num = parseFloat(String(val).replace(',', '.'));
          return isNaN(num) ? null : num;
        };

        const finalSku = (formData.sku || '').trim() || `LENT-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        const matrix = formData.matrix_type || 'MF_ACB';
        const isMF = matrix === 'MF_ACB' || matrix === 'MF_BLOCO';
        const isBlocoVS = matrix === 'BLOCO_VS';
        const is167 = matrix === 'GRADE_167';

        const payload = {
          name: formData.name,
          description: formData.description || null,
          sku: finalSku,
          cost_price: parseNum(formData.cost_price) || 0,
          sale_price: parseNum(formData.sale_price) || 0,
          is_active: formData.is_active,
          change_reason: formData.change_reason || null,
          is_lens: formData.is_lens,
          brand: formData.is_lens ? (formData.brand || 'Lente') : null,
          material: formData.is_lens ? (formData.material || 'CR-39') : null,
          refractive_index: formData.is_lens ? parseNum(formData.refractive_index) || 1.56 : null,
          treatment: formData.treatment || formData.name || null,
          diameter: formData.is_lens ? parseInt(formData.diameter) || 70 : null,
          matrix_type: matrix,
          quantity: parseInt(formData.quantity) || 1,
          eye_side: isMF ? (formData.eye_side || 'AMBOS') : null,
          base_curve: (isMF || isBlocoVS) ? parseNum(formData.base_curve) : null,
          addition: isMF ? parseNum(formData.addition) : null,
          spherical: is167 ? (parseNum(formData.spherical) ?? 0) : parseNum(formData.spherical),
          cylindrical: is167 ? (parseNum(formData.cylindrical) ?? 0) : parseNum(formData.cylindrical)
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
      const detailMsg = err.response?.data?.detail;
      if (Array.isArray(detailMsg)) {
        setFormError(detailMsg.map(d => `${d.loc ? d.loc.join(' > ') + ': ' : ''}${d.msg}`).join(' | '));
      } else if (typeof detailMsg === 'string') {
        setFormError(detailMsg);
      } else {
        setFormError('Erro ao salvar o item.');
      }
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenCreate('products')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={16} /> Cadastrar Lente
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleOpenCreate('services')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={16} /> Cadastrar Serviço
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
                  {activeSubTab === 'blocks' ? 'Especificação Técnica' : activeSubTab === 'products' ? 'Código de Barras (SKU)' : 'Descrição'}
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
                    {activeSubTab === 'products' && item.matrix_type && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: item.matrix_type === 'BLOCO_VS' ? 'rgba(59, 130, 246, 0.12)' : item.matrix_type === 'GRADE_167' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                          color: item.matrix_type === 'BLOCO_VS' ? '#2563eb' : item.matrix_type === 'GRADE_167' ? '#9333ea' : '#0891b2',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}>
                          {item.matrix_type === 'BLOCO_VS' ? 'Bloco Visão Simples' : item.matrix_type === 'GRADE_167' ? '1.67 Lentes Prontas' : item.matrix_type === 'MF_ACB' ? 'Multifocal Acabado' : item.matrix_type}
                        </span>
                        {item.base_curve !== null && item.base_curve !== undefined && (
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                            Base: {Number(item.base_curve).toFixed(2)}
                          </span>
                        )}
                        {item.addition !== null && item.addition !== undefined && (
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                            Ad: +{Number(item.addition).toFixed(2)}
                          </span>
                        )}
                      </div>
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
                    onChange={(e) => handleNameInputChange(e.target.value)}
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
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Barcode size={18} style={{ color: '#2563eb' }} />
                        Código de Barras (SKU) / Leitor Óptico *
                      </span>
                      {skuScannedAlert ? (
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} /> Código lido via bipador!
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📡 Suporta Bipador USB
                        </span>
                      )}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        ref={skuInputRef}
                        type="text"
                        className="form-control"
                        placeholder="Bipe o código com o leitor ou digite (deixe em branco para auto-gerar)"
                        value={formData.sku}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault(); // Evita envio prematuro do formulário ao bipar
                            if (formData.sku?.trim()) {
                              setSkuScannedAlert(true);
                              setTimeout(() => setSkuScannedAlert(false), 2500);
                            }
                          }
                        }}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        style={{
                          color: 'black',
                          backgroundColor: 'white',
                          cursor: 'text',
                          paddingRight: '40px',
                          fontWeight: 600
                        }}
                      />
                      <button
                        type="button"
                        title="Clique para focar e bipar com o leitor de código de barras"
                        onClick={() => skuInputRef.current?.focus()}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#2563eb',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Scan size={20} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' }}>
                      💡 Ao utilizar um leitor de código de barras USB/Bluetooth, o código será inserido automaticamente sem submeter o formulário antes da hora.
                    </div>
                  </div>
                )}
                {activeSubTab === 'products' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Grade de Destino (Matriz) *
                    </label>
                    <select
                      className="form-control"
                      value={formData.matrix_type || 'MF_ACB'}
                      onChange={(e) => setFormData({ ...formData, matrix_type: e.target.value })}
                      style={{ color: 'black', fontWeight: 600 }}
                    >
                      <option value="MF_ACB">Multifocal Acabado (MF_ACB)</option>
                      <option value="GRADE_167">1.67 Lentes Prontas (GRADE_167)</option>
                      <option value="BLOCO_VS">Bloco Visão Simples (BLOCO_VS)</option>
                      <option value="MF_BLOCO">Multifocal Bloco (MF_BLOCO)</option>
                    </select>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' }}>
                      ℹ️ Lentes cadastradas no Catálogo Financeiro não participam da política de preços por grau e <strong>não podem</strong> ser cadastradas na grade <em>Visão Simples LP</em>.
                    </div>
                  </div>
                )}
              </div>

              {(activeSubTab === 'products' || activeSubTab === 'treatments') && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Selecione / Digite o Tratamento Padrão *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Digite ou selecione o tratamento padrão..."
                    list="treatments-preset-list"
                    value={formData.treatment}
                    onChange={(e) => {
                      setIsTreatmentEdited(true);
                      setFormData({ ...formData, treatment: e.target.value });
                    }}
                    style={{ color: 'black', fontWeight: 600 }}
                  />
                  <datalist id="treatments-preset-list">
                    {LP_TREATMENTS_OPTIONS.map((lp) => (
                      <option key={lp.id} value={lp.label} />
                    ))}
                  </datalist>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' }}>
                    ℹ️ Preenchido automaticamente com a informação do campo <strong>Nome</strong> (editável pelo operador).
                  </div>
                </div>
              )}

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Preço de Custo (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      required
                      placeholder="0.00"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      style={{
                        color: 'black',
                        backgroundColor: 'white',
                        cursor: 'text'
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Preço de Venda (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      required
                      placeholder="0.00"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      style={{
                        color: 'black',
                        backgroundColor: 'white',
                        cursor: 'text'
                      }}
                    />
                  </div>

                  {activeSubTab === 'products' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>
                        Quantidade (Estoque) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        required
                        placeholder="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        style={{ color: 'black', fontWeight: 600 }}
                      />
                    </div>
                  )}
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

              {/* Especificações e Particularidades por Grade de Destino */}
              {activeSubTab === 'products' && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  padding: '16px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎯 Particularidades da Grade de Destino (
                    {formData.matrix_type === 'BLOCO_VS'
                      ? 'Bloco Visão Simples'
                      : formData.matrix_type === 'GRADE_167'
                      ? '1.67 Lentes Prontas'
                      : 'Multifocal'}
                    )
                  </span>

                  {/* Multifocal Acabado e Multifocal Bloco: Informar Olho, Curva Base e Adição */}
                  {(formData.matrix_type === 'MF_ACB' || formData.matrix_type === 'MF_BLOCO' || !formData.matrix_type) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                          Lado / Olho *
                        </label>
                        <select
                          className="form-control"
                          value={formData.eye_side || 'AMBOS'}
                          onChange={(e) => setFormData({ ...formData, eye_side: e.target.value })}
                          style={{ color: 'black', fontWeight: 600 }}
                        >
                          <option value="AMBOS">Ambos (OD / OE)</option>
                          <option value="OD">Olho Direito (OD)</option>
                          <option value="OE">Olho Esquerdo (OE)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                          Curva Base *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Ex: 2.00, 4.00, 6.00"
                          value={formData.base_curve}
                          onChange={(e) => setFormData({ ...formData, base_curve: e.target.value })}
                          style={{ color: 'black', fontWeight: 600 }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                          Adição (Ad) *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Ex: 1.00 ou 1,00"
                          value={formData.addition}
                          onChange={(e) => setFormData({ ...formData, addition: e.target.value })}
                          style={{ color: 'black', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Bloco Visão Simples: Informar a Base */}
                  {formData.matrix_type === 'BLOCO_VS' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                        Curva Base do Bloco *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="Ex: 2.00 ou Base 4.00"
                        value={formData.base_curve}
                        onChange={(e) => setFormData({ ...formData, base_curve: e.target.value })}
                        style={{ color: 'black', fontWeight: 600 }}
                      />
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' }}>
                        Informe a base da curva do bloco visão simples.
                      </div>
                    </div>
                  )}

                  {/* 1.67 Lentes Prontas: Informar Esférico e Cilíndrico */}
                  {formData.matrix_type === 'GRADE_167' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                          Grau Esférico (Esf) *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Ex: -2.00 ou -2,00"
                          value={formData.spherical}
                          onChange={(e) => setFormData({ ...formData, spherical: e.target.value })}
                          style={{ color: 'black', fontWeight: 600 }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                          Grau Cilíndrico (Cil) *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Ex: -0.75 ou -0,75"
                          value={formData.cylindrical}
                          onChange={(e) => setFormData({ ...formData, cylindrical: e.target.value })}
                          style={{ color: 'black', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isPriceChanged() && (
                <div className="form-group" style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '12px', borderRadius: '8px' }}>
                  <label className="form-label" style={{ color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Justificativa da Alteração / Reajuste de Preço *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Reajuste anual de tabela do fornecedor / Desconto comercial"
                    value={formData.change_reason || ''}
                    onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                    style={{ color: 'black', background: 'white' }}
                    required
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
