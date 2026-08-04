import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Search, Edit2, Trash2, Calendar, Percent, 
  Check, X, AlertCircle, RefreshCw, Filter, ShieldAlert, Layers, Calculator, Play
} from 'lucide-react';
import { 
  CustomerPriceService, 
  OpticalStoreService, 
  ProductService, 
  TreatmentService, 
  TechnicalServiceService 
} from '../services/api';

const TabelaPrecos = () => {
  const [tables, setTables] = useState([]);
  const [stores, setStores] = useState([]);
  const [catalogItems, setCatalogItems] = useState({ products: [], treatments: [], services: [] });
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [selectedTable, setSelectedTable] = useState(null);
  const [tableItems, setTableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [userRole] = useState(() => localStorage.getItem('factory_user_role') || 'Operador');

  // Estados dos Modais
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isDeleteTableModalOpen, setIsDeleteTableModalOpen] = useState(false);

  // Formulário Tabela
  const [tableFormData, setTableFormData] = useState({
    id: null,
    name: '',
    optical_store_id: '',
    discount_percent: '0',
    start_date: '',
    end_date: '',
    is_active: true
  });

  // Formulário Item
  const [itemFormData, setItemFormData] = useState({
    id: null,
    entity_type: 'product',
    entity_id: '',
    custom_price: ''
  });

  const [tableToDelete, setTableToDelete] = useState(null);

  // Estados de Toast e Feedback
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');
  const [itemFormError, setItemFormError] = useState('');

  // Simulador de Cálculo
  const [simulator, setSimulator] = useState({
    optical_store_id: '',
    entity_type: 'product',
    entity_id: '',
    result: null,
    calculating: false,
    error: null
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await CustomerPriceService.listTables();
      setTables(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar as tabelas de preços.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    setLoadingStores(true);
    try {
      const response = await OpticalStoreService.list('', true); // Apenas óticas ativas
      setStores(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingStores(false);
    }
  };

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const [pRes, tRes, sRes] = await Promise.all([
        ProductService.list('', true),
        TreatmentService.list('', true),
        TechnicalServiceService.list('', true)
      ]);
      setCatalogItems({
        products: pRes.data,
        treatments: tRes.data,
        services: sRes.data
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadTables();
    loadStores();
    loadCatalog();
  }, []);

  // Busca itens da tabela selecionada
  const loadTableItems = async (tableId) => {
    setLoadingItems(true);
    try {
      const response = await CustomerPriceService.listItems(tableId);
      setTableItems(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar os itens específicos da tabela.', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    loadTableItems(table.id);
  };

  // Abre formulário para criação de tabela
  const handleOpenCreateTable = () => {
    // Formata data atual em formato datetime-local para o input
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);

    setTableFormData({
      id: null,
      name: '',
      optical_store_id: stores[0]?.id || '',
      discount_percent: '0',
      start_date: localISOTime,
      end_date: '',
      is_active: true
    });
    setFormError('');
    setIsTableModalOpen(true);
  };

  // Abre formulário para edição de tabela
  const handleOpenEditTable = (table) => {
    // Formata datas de vigência
    const formatToLocalISO = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const tzoffset = d.getTimezoneOffset() * 60000;
      return (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    };

    setTableFormData({
      id: table.id,
      name: table.name,
      optical_store_id: table.optical_store_id,
      discount_percent: String(table.discount_percent),
      start_date: formatToLocalISO(table.start_date),
      end_date: formatToLocalISO(table.end_date),
      is_active: table.is_active
    });
    setFormError('');
    setIsTableModalOpen(true);
  };

  // Salvar Tabela
  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!tableFormData.name.trim() || !tableFormData.optical_store_id || !tableFormData.start_date) {
      setFormError('Preencha os campos obrigatórios (*).');
      return;
    }

    try {
      const payload = {
        name: tableFormData.name,
        optical_store_id: tableFormData.optical_store_id,
        discount_percent: parseFloat(tableFormData.discount_percent) || 0.00,
        start_date: new Date(tableFormData.start_date).toISOString(),
        end_date: tableFormData.end_date ? new Date(tableFormData.end_date).toISOString() : null,
        is_active: tableFormData.is_active
      };

      if (tableFormData.id) {
        const res = await CustomerPriceService.updateTable(tableFormData.id, payload);
        showToast('Tabela de preços atualizada com sucesso!', 'success');
        setTables(tables.map(t => t.id === tableFormData.id ? res.data : t));
        if (selectedTable && selectedTable.id === tableFormData.id) {
          setSelectedTable(res.data);
        }
      } else {
        const res = await CustomerPriceService.createTable(payload);
        showToast('Tabela de preços criada com sucesso!', 'success');
        setTables([res.data, ...tables]);
      }
      setIsTableModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Erro ao salvar a tabela de preços.');
    }
  };

  // Exclusão de Tabela
  const handleOpenDeleteTable = (table) => {
    setTableToDelete(table);
    setIsDeleteTableModalOpen(true);
  };

  const handleDeleteTable = async () => {
    if (!tableToDelete) return;
    try {
      await CustomerPriceService.deleteTable(tableToDelete.id);
      showToast('Tabela de preços removida com sucesso!', 'success');
      setTables(tables.filter(t => t.id !== tableToDelete.id));
      if (selectedTable && selectedTable.id === tableToDelete.id) {
        setSelectedTable(null);
        setTableItems([]);
      }
      setIsDeleteTableModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Erro ao remover a tabela de preços.', 'error');
    }
  };

  // --- CRUD ITENS ESPECÍFICOS DE PREÇO ---

  const handleOpenCreateItem = () => {
    if (!selectedTable) return;
    
    // Lista de entidades dependente do tipo selecionado
    const defaultEntityType = 'product';
    const firstEntityId = catalogItems.products[0]?.id || '';

    setItemFormData({
      id: null,
      entity_type: defaultEntityType,
      entity_id: firstEntityId,
      custom_price: ''
    });
    setItemFormError('');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormData.entity_id || !itemFormData.custom_price) {
      setItemFormError('Preencha os campos obrigatórios (*).');
      return;
    }

    try {
      const payload = {
        entity_type: itemFormData.entity_type,
        entity_id: itemFormData.entity_id,
        custom_price: parseFloat(itemFormData.custom_price) || 0.00
      };

      const res = await CustomerPriceService.createItem(selectedTable.id, payload);
      showToast('Preço específico associado à tabela!', 'success');
      
      // Atualiza listagem de itens da tabela
      // Se for substituição de um existente:
      const exists = tableItems.some(i => i.id === res.data.id);
      if (exists) {
        setTableItems(tableItems.map(i => i.id === res.data.id ? res.data : i));
      } else {
        setTableItems([...tableItems, res.data]);
      }
      
      setIsItemModalOpen(false);
    } catch (err) {
      console.error(err);
      setItemFormError(err.response?.data?.detail || 'Erro ao salvar o preço do item.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedTable) return;
    try {
      await CustomerPriceService.deleteItem(selectedTable.id, itemId);
      showToast('Preço específico removido. O item retorna ao preço padrão da tabela.', 'success');
      setTableItems(tableItems.filter(i => i.id !== itemId));
    } catch (err) {
      console.error(err);
      showToast('Erro ao remover o item de preço.', 'error');
    }
  };

  // --- SIMULAÇÃO DE CÁLCULO FINANCEIRO ---

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!simulator.optical_store_id || !simulator.entity_id) {
      setSimulator({ ...simulator, error: 'Selecione a Ótica e o Item para simular.' });
      return;
    }

    setSimulator({ ...simulator, calculating: true, error: null, result: null });
    try {
      const response = await CustomerPriceService.calculatePrice(
        simulator.optical_store_id,
        simulator.entity_type,
        simulator.entity_id
      );
      setSimulator({ ...simulator, calculating: false, result: response.data });
    } catch (err) {
      console.error(err);
      setSimulator({ 
        ...simulator, 
        calculating: false, 
        error: err.response?.data?.detail || 'Erro ao processar cálculo financeiro.' 
      });
    }
  };

  // Auxiliares de interface
  const getCatalogItemName = (type, id) => {
    let list = [];
    if (type === 'product') list = catalogItems.products;
    else if (type === 'treatment') list = catalogItems.treatments;
    else if (type === 'service') list = catalogItems.services;

    const found = list.find(item => item.id === id);
    return found ? found.name : 'Item Desconhecido';
  };

  const getCatalogItemOriginalPrice = (type, id) => {
    let list = [];
    if (type === 'product') list = catalogItems.products;
    else if (type === 'treatment') list = catalogItems.treatments;
    else if (type === 'service') list = catalogItems.services;

    const found = list.find(item => item.id === id);
    if (!found) return 0;
    return type === 'product' ? found.sale_price : found.price;
  };

  const getVigenciaStatus = (table) => {
    if (!table.is_active) return { text: 'Inativa', color: 'hsl(var(--danger))', bg: 'hsl(var(--danger) / 0.12)' };
    const now = new Date();
    const start = new Date(table.start_date);
    const end = table.end_date ? new Date(table.end_date) : null;

    if (now < start) return { text: 'Agendada', color: 'hsl(var(--warning))', bg: 'hsl(var(--warning) / 0.12)' };
    if (end && now > end) return { text: 'Expirada', color: 'hsl(var(--text-muted))', bg: 'rgba(255,255,255,0.06)' };
    return { text: 'Vigente', color: 'hsl(var(--success))', bg: 'hsl(var(--success) / 0.12)' };
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Percent size={28} style={{ color: 'hsl(var(--primary))' }} />
            Tabelas de Preços por Ótica
          </h2>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Gerencie listas de preços customizadas, descontos por cliente e vigências de contrato.
          </p>
        </div>
        
        <div>
          <button className="btn btn-primary" onClick={handleOpenCreateTable}>
            <Plus size={18} /> Criar Tabela de Preços
          </button>
        </div>
      </div>

      {/* Grid Principal: Listagem e Itens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '25px', alignItems: 'start' }}>
        
        {/* Lado Esquerdo: Tabelas de Preço */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Layers size={18} style={{ color: 'hsl(var(--primary))' }} />
              Tabelas de Clientes
            </h3>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {loading && tables.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'hsl(var(--text-muted))', gap: '8px' }}>
                <RefreshCw size={18} className="animate-spin" />
                <span>Carregando tabelas de preços...</span>
              </div>
            ) : tables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'hsl(var(--text-muted))' }}>
                <Percent size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhuma tabela de preço cadastrada.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {tables.map(table => {
                  const isSelected = selectedTable && selectedTable.id === table.id;
                  const status = getVigenciaStatus(table);
                  
                  return (
                    <div 
                      key={table.id}
                      onClick={() => handleSelectTable(table)}
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent',
                        borderLeft: isSelected ? '4px solid hsl(var(--primary))' : '4px solid transparent',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                      className="table-row-hover"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{table.name}</span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: status.bg,
                          color: status.color,
                          textTransform: 'uppercase'
                        }}>{status.text}</span>
                      </div>
                      
                      {table.optical_store && (
                        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                          Cliente: <strong>{table.optical_store.trade_name}</strong>
                        </span>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Vigência: {new Date(table.start_date).toLocaleDateString()}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: table.discount_percent > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-muted))' }}>
                            Desc: {table.discount_percent}%
                          </span>

                          <div style={{ display: 'inline-flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 6px', borderRadius: '4px' }}
                              onClick={() => handleOpenEditTable(table)}
                              title="Editar Cabeçalho/Vigência"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '4px 6px', 
                                borderRadius: '4px',
                                color: userRole === 'Administrador' ? 'hsl(var(--danger))' : 'hsl(var(--text-muted))'
                              }}
                              disabled={userRole !== 'Administrador'}
                              onClick={() => handleOpenDeleteTable(table)}
                              title="Excluir Tabela"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Itens de Preço Específico da Tabela Selecionada */}
        <div className="glass-panel" style={{ padding: '0', minHeight: '320px', overflow: 'hidden' }}>
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border-glass)', 
            background: 'rgba(255,255,255,0.01)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <DollarSign size={18} style={{ color: 'hsl(var(--primary))' }} />
              Preços Específicos
            </h3>
            
            {selectedTable && (
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleOpenCreateItem}>
                <Plus size={14} /> Add Preço Especial
              </button>
            )}
          </div>

          {!selectedTable ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'hsl(var(--text-muted))' }}>
              <Layers size={40} style={{ opacity: 0.2, marginBottom: '15px' }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Selecione uma tabela de preços ao lado para gerenciar seus itens.</p>
            </div>
          ) : loadingItems ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'hsl(var(--text-muted))', gap: '8px' }}>
              <RefreshCw size={18} className="animate-spin" />
              <span>Carregando itens de preço...</span>
            </div>
          ) : tableItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
              <DollarSign size={36} style={{ opacity: 0.2, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum preço específico cadastrado nesta tabela.</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                Todos os itens cobrados seguirão o preço padrão de catálogo (ou com o desconto global de {selectedTable.discount_percent}%).
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Tipo</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Item de Catálogo</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço Orig.</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Preço Tabela</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>Remover</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map(item => {
                  const origPrice = getCatalogItemOriginalPrice(item.entity_type, item.entity_id);
                  const itemName = getCatalogItemName(item.entity_type, item.entity_id);
                  
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          fontSize: '0.7rem',
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
                      <td style={{ padding: '12px 20px', color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>{itemName}</td>
                      <td style={{ padding: '12px 20px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>{formatCurrency(origPrice)}</td>
                      <td style={{ padding: '12px 20px', color: 'hsl(var(--success))', fontWeight: 700, fontSize: '0.9rem' }}>{formatCurrency(item.custom_price)}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', borderRadius: '4px', color: 'hsl(var(--danger))' }}
                          title="Remover preço específico"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Seção 2: Simulador/Calculadora de Preços (Premium Visuals) */}
      <div className="glass-panel" style={{ padding: '25px', background: 'radial-gradient(ellipse at top right, rgba(124, 58, 237, 0.08), transparent 60%)' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
          <Calculator size={22} style={{ color: 'hsl(var(--primary))' }} />
          Simulador de Cálculo Financeiro (Checkout OS)
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
          Teste dinamicamente qual regra de precificação (padrão, específica ou desconto geral) será aplicada no faturamento de ordens de serviço.
        </p>

        <form onSubmit={handleSimulate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          
          <div className="form-group">
            <label className="form-label">Ótica Comercial (Cliente)</label>
            <select 
              className="form-control"
              value={simulator.optical_store_id}
              onChange={(e) => setSimulator({ ...simulator, optical_store_id: e.target.value, result: null })}
              required
            >
              <option value="">Selecione uma ótica...</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.trade_name} ({store.cnpj})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Item</label>
            <select 
              className="form-control"
              value={simulator.entity_type}
              onChange={(e) => setSimulator({ 
                ...simulator, 
                entity_type: e.target.value, 
                entity_id: e.target.value === 'product' ? catalogItems.products[0]?.id || '' : e.target.value === 'treatment' ? catalogItems.treatments[0]?.id || '' : catalogItems.services[0]?.id || '',
                result: null 
              })}
            >
              <option value="product">Produto / Lente</option>
              <option value="treatment">Tratamento</option>
              <option value="service">Serviço de Laboratório</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Item de Catálogo</label>
            <select 
              className="form-control"
              value={simulator.entity_id}
              onChange={(e) => setSimulator({ ...simulator, entity_id: e.target.value, result: null })}
              required
            >
              <option value="">Selecione...</option>
              {simulator.entity_type === 'product' && catalogItems.products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
              ))}
              {simulator.entity_type === 'treatment' && catalogItems.treatments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {simulator.entity_type === 'service' && catalogItems.services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={simulator.calculating}>
            {simulator.calculating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            Calcular Preço Final
          </button>
        </form>

        {/* Exibição do Resultado da Simulação */}
        {simulator.result && (
          <div className="glass-panel animate-fade-in" style={{ 
            marginTop: '25px', 
            padding: '20px', 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '20px',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Preço do Catálogo Base</span>
              <span style={{ fontSize: '1.1rem', color: 'white', fontWeight: 500, textDecoration: simulator.result.discount_applied > 0 ? 'line-through' : 'none', opacity: simulator.result.discount_applied > 0 ? 0.6 : 1 }}>
                {formatCurrency(simulator.result.original_price)}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Desconto Aplicado</span>
              <span style={{ fontSize: '1.1rem', color: simulator.result.discount_applied > 0 ? 'hsl(var(--warning))' : 'white', fontWeight: 600 }}>
                {formatCurrency(simulator.result.discount_applied)}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Valor Final a Cobrar</span>
              <span style={{ fontSize: '1.6rem', color: 'hsl(var(--success))', fontWeight: 900 }}>
                {formatCurrency(simulator.result.calculated_price)}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>Regra Aplicada</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '5px 12px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                backgroundColor: simulator.result.rule_applied === 'specific_customer_price' ? 'rgba(34,197,94,0.12)' : simulator.result.rule_applied === 'customer_general_discount' ? 'rgba(234,179,8,0.12)' : 'rgba(59,130,246,0.12)',
                color: simulator.result.rule_applied === 'specific_customer_price' ? 'hsl(var(--success))' : simulator.result.rule_applied === 'customer_general_discount' ? 'hsl(var(--warning))' : '#3b82f6'
              }}>
                {simulator.result.rule_applied === 'specific_customer_price' ? 'Preço Específico' : simulator.result.rule_applied === 'customer_general_discount' ? 'Desconto de Cliente' : 'Preço de Catálogo'}
              </span>
            </div>
          </div>
        )}

        {simulator.error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '12px',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.85rem',
            marginTop: '20px'
          }}>
            <AlertCircle size={16} />
            <span>{simulator.error}</span>
          </div>
        )}
      </div>

      {/* --- MODAIS DE EDICAO --- */}

      {/* MODAL: Criar / Editar Tabela */}
      {isTableModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTableModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsTableModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Percent size={20} style={{ color: 'hsl(var(--primary))' }} />
              {tableFormData.id ? 'Editar Tabela de Preços' : 'Nova Tabela de Preços'}
            </h3>

            <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">Nome da Tabela *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  placeholder="Ex: Tabela Promocional Diniz, Tabela Ouro..."
                  value={tableFormData.name}
                  onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Ótica Comercial *</label>
                  <select 
                    className="form-control"
                    value={tableFormData.optical_store_id}
                    onChange={(e) => setTableFormData({ ...tableFormData, optical_store_id: e.target.value })}
                    required
                    disabled={tableFormData.id !== null} // Trava alteração de ótica se já criada
                  >
                    <option value="">Selecione...</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>{store.trade_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Desconto Geral da Ótica (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-control" 
                    value={tableFormData.discount_percent}
                    onChange={(e) => setTableFormData({ ...tableFormData, discount_percent: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Início de Vigência *</label>
                  <input 
                    type="datetime-local" 
                    className="form-control" 
                    required
                    value={tableFormData.start_date}
                    onChange={(e) => setTableFormData({ ...tableFormData, start_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fim da Vigência (Opcional)</label>
                  <input 
                    type="datetime-local" 
                    className="form-control" 
                    value={tableFormData.end_date}
                    onChange={(e) => setTableFormData({ ...tableFormData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="checkbox" 
                  id="table-active-checkbox"
                  checked={tableFormData.is_active}
                  onChange={(e) => setTableFormData({ ...tableFormData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="table-active-checkbox" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: 'white' }}>
                  Tabela Ativa (Aplicável a vendas atuais se dentro da vigência)
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
                <button type="button" className="btn btn-secondary" onClick={() => setIsTableModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {tableFormData.id ? 'Salvar Alterações' : 'Criar Tabela'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Preço Especial (Item) */}
      {isItemModalOpen && selectedTable && (
        <div className="modal-overlay" onClick={() => setIsItemModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsItemModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Plus size={20} style={{ color: 'hsl(var(--primary))' }} />
              Associar Preço Customizado
            </h3>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="form-label">Tipo de Item comercial</label>
                <select 
                  className="form-control"
                  value={itemFormData.entity_type}
                  onChange={(e) => setItemFormData({ 
                    ...itemFormData, 
                    entity_type: e.target.value,
                    entity_id: e.target.value === 'product' ? catalogItems.products[0]?.id || '' : e.target.value === 'treatment' ? catalogItems.treatments[0]?.id || '' : catalogItems.services[0]?.id || ''
                  })}
                >
                  <option value="product">Produto / Lente</option>
                  <option value="treatment">Tratamento</option>
                  <option value="service">Serviço Laboratorial</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Item de Catálogo *</label>
                <select 
                  className="form-control"
                  value={itemFormData.entity_id}
                  onChange={(e) => setItemFormData({ ...itemFormData, entity_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {itemFormData.entity_type === 'product' && catalogItems.products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Catálogo: {formatCurrency(p.sale_price)})</option>
                  ))}
                  {itemFormData.entity_type === 'treatment' && catalogItems.treatments.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Catálogo: {formatCurrency(t.price)})</option>
                  ))}
                  {itemFormData.entity_type === 'service' && catalogItems.services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Catálogo: {formatCurrency(s.price)})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Preço Customizado (R$) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="form-control" 
                  value={itemFormData.custom_price}
                  onChange={(e) => setItemFormData({ ...itemFormData, custom_price: e.target.value })}
                />
              </div>

              {itemFormError && (
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
                  <span>{itemFormError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '15px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsItemModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Vincular Preço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão de Tabela */}
      {isDeleteTableModalOpen && tableToDelete && (
        <div className="modal-overlay" onClick={() => setIsDeleteTableModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsDeleteTableModalOpen(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '15px', color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={22} />
              Remover Tabela de Preços
            </h3>

            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px', color: 'hsl(var(--text-secondary))' }}>
              Você está prestes a excluir definitivamente a tabela de preços <strong>{tableToDelete.name}</strong>.
              <br /><br />
              Esta ação <strong style={{ color: 'hsl(var(--danger))' }}>removerá de forma irreversível</strong> todos os preços especiais cadastrados nela. As ordens de serviço do cliente retornarão às regras e tabelas de catálogo padrão.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteTableModalOpen(false)}>
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ backgroundColor: 'hsl(var(--danger))', color: 'white', fontWeight: 600 }}
                onClick={handleDeleteTable}
              >
                Excluir Tabela
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

export default TabelaPrecos;
