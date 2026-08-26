import React, { useState, useEffect } from 'react';
import { 
  FileText, DollarSign, CheckCircle2, Calendar, Search, 
  X, Printer, Eye, Check, ChevronRight, AlertCircle, RefreshCw, Landmark, BarChart2
} from 'lucide-react';
import { BillingService } from '../services/api';
const FechamentoFinanceiro = ({ laboratory }) => {
  // Tabs: 'pendentes' | 'historico'
  const [activeTab, setActiveTab] = useState('pendentes');

  
  // Estados de dados
  const [pendingGroups, setPendingGroups] = useState([]);

  const [historyCycles, setHistoryCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Estados de Contas a Receber
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [kpis, setKpis] = useState({
    total_paid: 0.0,
    total_pending: 0.0,
    total_overdue: 0.0,
    count_paid: 0,
    count_pending: 0,
    count_overdue: 0
  });
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAGO' | 'PENDENTE' | 'ATRASADO'

  // Estados de Integração Fiscal (Sprint 12)
  const [emittingNfe, setEmittingNfe] = useState(false);
  const [cancellingNfe, setCancellingNfe] = useState(false);
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [downloadingDanfe, setDownloadingDanfe] = useState(false);

  // Estado de seleção de ótica para detalhamento
  const [selectedStore, setSelectedStore] = useState(null); // { id, name, pending_os_count, estimated_total_amount }
  const [storeOrders, setStoreOrders] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Datas para geração de fechamento
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modal de visualização de fatura
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Filtros rápidos de busca no histórico
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Toast local
  const [toast, setToast] = useState(null);
  
  // Estados de exportação
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carregar os grupos de faturamento pendente
  const loadPendingGroups = async () => {
    setLoading(true);
    try {
      const response = await BillingService.getPendingGroups();
      setPendingGroups(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar faturamentos pendentes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico de faturamentos gerados
  const loadHistoryCycles = async () => {
    setLoadingHistory(true);
    try {
      const response = await BillingService.listCycles();
      setHistoryCycles(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar histórico de fechamentos.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Carregar indicadores de contas a receber
  const loadKpis = async () => {
    setLoadingKpis(true);
    try {
      const response = await BillingService.getBillingKpis();
      setKpis(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar indicadores de contas a receber.', 'error');
    } finally {
      setLoadingKpis(false);
    }
  };
 
  // Efeito inicial e de troca de aba
  useEffect(() => {
    if (activeTab === 'pendentes') {
      loadPendingGroups();
    } else {
      loadHistoryCycles();
      loadKpis();
    }
  }, [activeTab]);

  // Carrega OSs elegíveis da ótica aberta para detalhamento
  const handleOpenStoreDetails = async (store) => {
    setSelectedStore(store);
    setLoadingOrders(true);
    setSelectedOrderIds([]);
    try {
      const response = await BillingService.getPendingOrdersByStore(store.optical_store_id);
      setStoreOrders(response.data);
      // Seleciona todas por padrão
      setSelectedOrderIds(response.data.map(o => o.id));
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar ordens de serviço da ótica.', 'error');
      setSelectedStore(null);
    } finally {
      setLoadingOrders(false);
    }
  };

  const [showUnifyPromptModal, setShowUnifyPromptModal] = useState(false);

  // Executar criação do ciclo de faturamento
  const executeBilling = async (orderIdsToBill) => {
    if (!orderIdsToBill || orderIdsToBill.length === 0) {
      showToast('Selecione pelo menos uma Ordem de Serviço para faturar.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        optical_store_id: selectedStore.optical_store_id,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        service_order_ids: orderIdsToBill
      };
      
      const response = await BillingService.createCycle(payload);
      showToast('Fechamento financeiro gerado com sucesso!', 'success');
      
      // Fecha a gaveta lateral e recarrega pendências
      setSelectedStore(null);
      loadPendingGroups();
      
      // Resetar a data de vencimento para hoje + 10 dias
      const d = new Date();
      d.setDate(d.getDate() + 10);
      setDueDate(d.toISOString().split('T')[0]);
      
      // Abre a fatura recém-criada
      setInvoiceDetail(response.data);
      setIsInvoiceModalOpen(true);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || 'Erro ao gerar fechamento.';
      showToast(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Gerar ciclo de faturamento (com pergunta de unificação para todas as OSs da ótica)
  const handleGenerateBilling = async () => {
    if (selectedOrderIds.length === 0) {
      showToast('Selecione pelo menos uma Ordem de Serviço para faturar.', 'error');
      return;
    }

    if (selectedOrderIds.length < storeOrders.length) {
      setShowUnifyPromptModal(true);
    } else {
      executeBilling(selectedOrderIds);
    }
  };


  // Liquidar/Quitar cobrança
  const handlePayCycle = async (cycleId, e) => {
    if (e) e.stopPropagation();
    
    try {
      const response = await BillingService.payCycle(cycleId);
      showToast('Cobrança quitada com sucesso!', 'success');
      
      // Se a fatura visualizada estiver aberta no modal, atualiza ela
      if (invoiceDetail && invoiceDetail.id === cycleId) {
        setInvoiceDetail(response.data);
      }
      
      // Recarrega listagem e KPIs se estiver na aba histórico
      if (activeTab === 'historico') {
        loadHistoryCycles();
        loadKpis();
      } else {
        loadKpis();
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao liquidar cobrança.', 'error');
    }
  };

  // Funções Fiscais da Sprint 12 (NF-e)
  const handleEmitNfe = async (cycleId) => {
    setEmittingNfe(true);
    try {
      const response = await BillingService.emitNfe(cycleId);
      showToast('NF-e emitida e autorizada com sucesso!', 'success');
      
      // Atualiza o detalhe do modal
      setInvoiceDetail(prev => ({ ...prev, nfe_saida: response.data }));
      
      // Recarrega listagem de ciclos se estiver no histórico
      if (activeTab === 'historico') {
        loadHistoryCycles();
      }
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || 'Erro ao emitir NF-e.';
      showToast(detail, 'error');
    } finally {
      setEmittingNfe(false);
    }
  };

  const handleCancelNfe = async (cycleId) => {
    if (!window.confirm('Tem certeza de que deseja CANCELAR esta Nota Fiscal? Esta ação é irreversível.')) {
      return;
    }
    setCancellingNfe(true);
    try {
      const response = await BillingService.cancelNfe(cycleId);
      showToast('NF-e cancelada fiscalmente com sucesso!', 'success');
      
      // Atualiza o detalhe do modal
      setInvoiceDetail(prev => ({ ...prev, nfe_saida: response.data }));
      
      if (activeTab === 'historico') {
        loadHistoryCycles();
      }
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || 'Erro ao cancelar NF-e.';
      showToast(detail, 'error');
    } finally {
      setCancellingNfe(false);
    }
  };

  const handleDownloadXml = async (cycleId, nfeNumber) => {
    setDownloadingXml(true);
    try {
      const response = await BillingService.getNfeXml(cycleId);
      const blob = new Blob([response.data], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nfe_${String(nfeNumber).padStart(6, '0')}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('XML da NF-e baixado com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao baixar XML da NF-e.', 'error');
    } finally {
      setDownloadingXml(false);
    }
  };

  const handleDownloadDanfe = async (cycleId, nfeNumber) => {
    setDownloadingDanfe(true);
    try {
      const response = await BillingService.getNfeDanfe(cycleId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `danfe_${String(nfeNumber).padStart(6, '0')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('DANFE em PDF baixado com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao baixar DANFE.', 'error');
    } finally {
      setDownloadingDanfe(false);
    }
  };

  // Abrir modal de Fatura
  const handleViewInvoice = async (cycleId) => {
    setLoadingInvoice(true);
    setIsInvoiceModalOpen(true);
    setInvoiceDetail(null);
    try {
      const response = await BillingService.getCycle(cycleId);
      setInvoiceDetail(response.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar detalhes do fechamento.', 'error');
      setIsInvoiceModalOpen(false);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleExportPdf = async () => {
    if (!invoiceDetail) return;
    setExportingPdf(true);
    try {
      const response = await BillingService.exportPdf(invoiceDetail.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orcamento_${invoiceDetail.optical_store_name || 'otica'}_${invoiceDetail.id.substring(0,8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Orçamento em PDF exportado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PDF do orçamento.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!invoiceDetail) return;
    setExportingExcel(true);
    try {
      const response = await BillingService.exportExcel(invoiceDetail.id);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `faturamento_${invoiceDetail.optical_store_name || 'otica'}_${invoiceDetail.id.substring(0,8)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Faturamento em Excel exportado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar planilha Excel.', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  // Seleção de itens individuais nas pendências
  const handleToggleOrderSelect = (orderId) => {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === storeOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(storeOrders.map(o => o.id));
    }
  };

  // Seletor dinâmico da quantidade de OSs a faturar
  const handleSetQuantityToBill = (qty) => {
    const validQty = Math.max(0, Math.min(qty, storeOrders.length));
    const selected = storeOrders.slice(0, validQty).map(o => o.id);
    setSelectedOrderIds(selected);
  };

  // Formatadores
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filtragem local do histórico
  const filteredCycles = historyCycles.filter(c => {
    // 1. Filtro de Status
    if (statusFilter === 'PAGO' && c.status !== 'PAGO') return false;
    if (statusFilter === 'PENDENTE' && (c.status !== 'FECHADO' || c.is_overdue)) return false;
    if (statusFilter === 'ATRASADO' && (c.status !== 'FECHADO' || !c.is_overdue)) return false;

    // 2. Filtro de Texto
    const search = historySearchQuery.toLowerCase();
    const storeName = c.optical_store_name ? c.optical_store_name.toLowerCase() : '';
    const statusText = c.status === 'PAGO' ? 'pago' : c.is_overdue ? 'atrasado' : 'pendente';
    const id = c.id.substring(0, 8).toLowerCase();
    
    return storeName.includes(search) || statusText.includes(search) || id.includes(search);
  });

  return (
    <div className="app-container" style={{ paddingBottom: '80px' }}>
      
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '16px 24px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'modal-appear 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toast.type === 'error' ? (
            <AlertCircle size={20} style={{ color: 'white' }} />
          ) : (
            <CheckCircle2 size={20} style={{ color: 'white' }} />
          )}
          <span style={{ color: 'white', fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}

      {/* Header Premium */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Landmark style={{ color: 'hsl(var(--primary))' }} size={32} /> Fechamento Financeiro
          </h1>
          <p style={{ margin: '5px 0 0 0', color: 'hsl(var(--text-secondary))' }}>
            Consolide ordens de serviço faturadas, emita relatórios de faturamento e registre a quitação de óticas parceiras.
          </p>
        </div>

        {/* Tabs */}
        <div className="nav-tabs" style={{ display: 'flex', gap: '10px' }}>

          <button 
            className={`tab-btn ${activeTab === 'pendentes' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pendentes'); setSelectedStore(null); }}
          >
            <DollarSign size={18} />
            Faturamentos Pendentes
          </button>
          <button 
            className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
            onClick={() => { setActiveTab('historico'); setSelectedStore(null); }}
          >
            <FileText size={18} />
            Histórico de Ciclos
          </button>
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: selectedStore ? '1fr 400px' : '1fr', gap: '30px', transition: 'all 0.3s ease' }}>
        
        {/* Lado Esquerdo: Listagem de Pendentes ou Histórico */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {activeTab === 'pendentes' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Óticas Parceiras com OSs prontas para Faturamento</h3>
                <button 
                  onClick={loadPendingGroups} 
                  className="btn btn-secondary" 
                  disabled={loading} 
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
                </button>
              </div>

              {loading && pendingGroups.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <RefreshCw size={32} className="spin" style={{ color: 'hsl(var(--primary))', margin: '0 auto 16px' }} />
                  <p>Buscando ordens de serviço elegíveis na expedição...</p>
                </div>
              ) : pendingGroups.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '20px', borderRadius: '50%', background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))' }}>
                    <CheckCircle2 size={48} />
                  </div>
                  <h4 style={{ margin: 0 }}>Tudo em Dia!</h4>
                  <p style={{ maxWidth: '400px', margin: 0 }}>
                    Nenhuma ordem de serviço no status <strong>Expedição</strong> está aguardando fechamento financeiro neste momento.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {pendingGroups.map(group => (
                    <div 
                      key={group.optical_store_id} 
                      className="glass-panel"
                      style={{ 
                        padding: '20px', 
                        cursor: 'pointer',
                        borderColor: selectedStore?.optical_store_id === group.optical_store_id ? 'hsl(var(--primary))' : 'rgba(224, 230, 240, 0.8)',
                        background: selectedStore?.optical_store_id === group.optical_store_id ? 'hsl(var(--primary) / 0.03)' : 'rgba(255, 255, 255, 0.75)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '16px',
                        transform: selectedStore?.optical_store_id === group.optical_store_id ? 'translateY(-2px)' : 'none',
                        boxShadow: selectedStore?.optical_store_id === group.optical_store_id ? '0 12px 30px rgba(147, 51, 234, 0.1)' : '0 8px 32px 0 rgba(15, 23, 42, 0.05)'
                      }}
                      onClick={() => handleOpenStoreDetails(group)}
                    >
                      <div>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          color: 'hsl(var(--primary))', 
                          background: 'hsl(var(--primary) / 0.1)', 
                          padding: '4px 10px', 
                          borderRadius: '20px',
                          textTransform: 'uppercase'
                        }}>
                          {group.pending_os_count} OS{group.pending_os_count > 1 ? 's' : ''} Elegível{group.pending_os_count > 1 ? 's' : ''}
                        </span>
                        <h4 style={{ margin: '12px 0 6px 0', fontSize: '1.2rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {group.optical_store_name}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(224,230,240,0.5)', paddingTop: '12px', marginTop: '8px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Valor Acumulado</span>
                          <strong style={{ fontSize: '1.25rem', color: 'hsl(var(--text-primary))' }}>
                            {formatCurrency(group.estimated_total_amount)}
                          </strong>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenStoreDetails(group)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Faturar Ótica</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                  ))}
                </div>
              )}
            </>
          ) : (
            // HISTÓRICO DE CICLOS
            <>
              {/* Cards de KPIs de Recebíveis */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '20px', 
                marginBottom: '25px' 
              }}>
                {/* Card Recebido (Verde) */}
                <div className="glass-panel" style={{
                  padding: '20px',
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderColor: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.05)'
                }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'rgb(16, 185, 129)'
                  }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'block' }}>Total Recebido</span>
                    <strong style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>
                      {formatCurrency(kpis.total_paid)}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '2px' }}>
                      {kpis.count_paid} fatura{kpis.count_paid !== 1 ? 's' : ''} paga{kpis.count_paid !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Card Pendente (Amarelo) */}
                <div className="glass-panel" style={{
                  padding: '20px',
                  background: 'rgba(245, 158, 11, 0.05)',
                  borderColor: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 8px 32px 0 rgba(245, 158, 11, 0.05)'
                }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: 'rgb(245, 158, 11)'
                  }}>
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'block' }}>Total Pendente</span>
                    <strong style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>
                      {formatCurrency(kpis.total_pending)}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '2px' }}>
                      {kpis.count_pending} fatura{kpis.count_pending !== 1 ? 's' : ''} em aberto
                    </span>
                  </div>
                </div>

                {/* Card Inadimplente (Vermelho) */}
                <div className="glass-panel" style={{
                  padding: '20px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.05)'
                }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'rgb(239, 68, 68)'
                  }}>
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'block' }}>Total Atrasado</span>
                    <strong style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>
                      {formatCurrency(kpis.total_overdue)}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'rgb(239, 68, 68)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                      {kpis.count_overdue} fatura{kpis.count_overdue !== 1 ? 's' : ''} inadimplente{kpis.count_overdue !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '16px',
                borderBottom: '1px solid rgba(224, 230, 240, 0.5)',
                paddingBottom: '16px'
              }}>
                <h3 style={{ margin: 0 }}>Histórico de Fechamentos Emitidos</h3>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Filtros rápidos de Status */}
                  <div style={{ 
                    display: 'flex', 
                    background: 'rgba(15, 23, 42, 0.05)', 
                    padding: '4px', 
                    borderRadius: '8px',
                    gap: '4px'
                  }}>
                    {['ALL', 'PAGO', 'PENDENTE', 'ATRASADO'].map((filter) => {
                      const label = filter === 'ALL' ? 'Todos' : filter === 'PAGO' ? 'Pagos' : filter === 'PENDENTE' ? 'Pendentes' : 'Atrasados';
                      const isActive = statusFilter === filter;
                      return (
                        <button
                          key={filter}
                          onClick={() => setStatusFilter(filter)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: isActive ? 'white' : 'transparent',
                            color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                            boxShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.05)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Busca rápida */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    <input 
                      type="text" 
                      placeholder="Buscar por ótica..." 
                      className="form-control"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      style={{ paddingLeft: '38px', height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {loadingHistory && historyCycles.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <RefreshCw size={32} className="spin" style={{ color: 'hsl(var(--primary))', margin: '0 auto 16px' }} />
                  <p>Carregando histórico de ciclos...</p>
                </div>
              ) : filteredCycles.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <FileText size={40} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px' }} />
                  <p>Nenhum faturamento encontrado com os critérios de busca.</p>
                </div>
              ) : (
                <div className="grid-container">
                  <table className="optical-grid">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Fechamento ID</th>
                        <th style={{ textAlign: 'left' }}>Ótica Comercial</th>
                        <th>Período</th>
                        <th>Emissão</th>
                        <th>Vencimento</th>
                        <th>Valor Total</th>
                        <th>Status</th>
                        <th style={{ width: '130px' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCycles.map(cycle => (
                        <tr key={cycle.id}>
                          <td style={{ textAlign: 'left', paddingLeft: '16px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            #{cycle.id.substring(0, 8).toUpperCase()}
                          </td>
                          <td style={{ textAlign: 'left', fontWeight: 600 }}>
                            {cycle.optical_store_name || 'Ótica Desconhecida'}
                          </td>
                          <td>
                            {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                          </td>
                          <td>
                            {formatDate(cycle.created_at)}
                          </td>
                          <td>
                            {formatDate(cycle.due_date)}
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {formatCurrency(cycle.total_amount)}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: cycle.status === 'PAGO' 
                                ? 'hsl(var(--success) / 0.1)' 
                                : cycle.is_overdue 
                                  ? 'rgba(239, 68, 68, 0.1)' 
                                  : 'hsl(var(--warning) / 0.1)',
                              color: cycle.status === 'PAGO' 
                                ? 'hsl(var(--success))' 
                                : cycle.is_overdue 
                                  ? 'rgb(239, 68, 68)' 
                                  : 'hsl(var(--warning))'
                            }}>
                              {cycle.status === 'PAGO' 
                                ? 'Pago' 
                                : cycle.is_overdue 
                                  ? 'Atrasado' 
                                  : 'Pendente'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', borderRadius: '6px' }}
                                onClick={() => handleViewInvoice(cycle.id)}
                                title="Visualizar Fatura"
                              >
                                <Eye size={14} />
                              </button>
                              
                              {cycle.status === 'FECHADO' && (
                                <button 
                                  className="btn btn-accent" 
                                  style={{ padding: '6px 10px', borderRadius: '6px', background: 'hsl(var(--success))' }}
                                  onClick={(e) => handlePayCycle(cycle.id, e)}
                                  title="Liquidar/Marcar como Pago"
                                >
                                  <Check size={14} style={{ color: 'white' }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>

        {/* Lado Direito: Detalhes da Ótica Selecionada / Painel Lateral de Geração */}
        {selectedStore && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start', animation: 'modal-appear 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(224,230,240,0.8)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Detalhes do Lote</h3>
              <button 
                onClick={() => setSelectedStore(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Ótica selecionada:</span>
              <h4 style={{ margin: '4px 0 0 0', color: 'hsl(var(--text-primary))' }}>{selectedStore.optical_store_name}</h4>
            </div>

            {/* Intervalo de Fechamento */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(15,23,42,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.5)' }}>
              <h5 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período do Ciclo</h5>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Data Inicial</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  style={{ height: '36px', padding: '6px 12px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Data Final</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ height: '36px', padding: '6px 12px' }}
                />
              </div>
            </div>

            {/* Vencimento da Fatura */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(15,23,42,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.5)' }}>
              <h5 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados de Cobrança</h5>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Vencimento da Fatura</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)} 
                  style={{ height: '36px', padding: '6px 12px' }}
                />
              </div>
            </div>

            {/* Controle de Seleção da Quantidade a Faturar */}
            {!loadingOrders && storeOrders.length > 0 && (
              <div style={{
                background: 'rgba(147, 51, 234, 0.04)',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(147, 51, 234, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                    Quantas OSs deseja faturar?
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleSetQuantityToBill(selectedOrderIds.length - 1)}
                      disabled={selectedOrderIds.length <= 0}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid rgba(224,230,240,0.8)',
                        background: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >-</button>
                    <input
                      type="number"
                      min={0}
                      max={storeOrders.length}
                      value={selectedOrderIds.length}
                      onChange={(e) => handleSetQuantityToBill(parseInt(e.target.value) || 0)}
                      style={{
                        width: '50px',
                        height: '28px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSetQuantityToBill(selectedOrderIds.length + 1)}
                      disabled={selectedOrderIds.length >= storeOrders.length}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid rgba(224,230,240,0.8)',
                        background: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >+</button>
                  </div>
                </div>

                {/* Seleção Rápida */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 3, 5, storeOrders.length].filter((val, idx, self) => val <= storeOrders.length && self.indexOf(val) === idx).map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSetQuantityToBill(num)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: selectedOrderIds.length === num ? '1px solid hsl(var(--primary))' : '1px solid rgba(224,230,240,0.8)',
                        background: selectedOrderIds.length === num ? 'hsl(var(--primary))' : 'white',
                        color: selectedOrderIds.length === num ? 'white' : 'hsl(var(--text-secondary))',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {num === storeOrders.length ? `Todas (${num})` : `${num} OS${num > 1 ? 's' : ''}`}
                    </button>
                  ))}
                  {selectedOrderIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetQuantityToBill(0)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.05)',
                        color: 'rgb(239, 68, 68)',
                        cursor: 'pointer'
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Listagem de OSs elegíveis da ótica */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>OSs Disponíveis ({storeOrders.length})</span>
                <button 
                  onClick={handleToggleSelectAll} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--primary))', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  {selectedOrderIds.length === storeOrders.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>

              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <RefreshCw size={20} className="spin" style={{ color: 'hsl(var(--primary))', margin: 'auto' }} />
                </div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {storeOrders.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => handleToggleOrderSelect(order.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: selectedOrderIds.includes(order.id) ? 'hsl(var(--primary) / 0.3)' : 'rgba(224,230,240,0.6)',
                        background: selectedOrderIds.includes(order.id) ? 'hsl(var(--primary) / 0.05)' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => {}} // Tratado no onClick da div
                        style={{ cursor: 'pointer', accentColor: 'hsl(var(--primary))' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.85rem' }}>{order.os_number}</strong>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                            {formatCurrency(order.total_amount)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          Cliente: {order.client_name || 'Não informado'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totalizadores de Seleção e Ação */}
            <div style={{ borderTop: '1px solid rgba(224,230,240,0.8)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Itens Selecionados:</span>
                <strong>{selectedOrderIds.length} de {storeOrders.length}</strong>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1rem', color: 'hsl(var(--text-secondary))' }}>Total do Lote:</span>
                <strong style={{ fontSize: '1.5rem', color: 'hsl(var(--primary))' }}>
                  {formatCurrency(
                    storeOrders
                      .filter(o => selectedOrderIds.includes(o.id))
                      .reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
                  )}
                </strong>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '14px 20px', borderRadius: '10px' }}
                onClick={handleGenerateBilling}
                disabled={loading || selectedOrderIds.length === 0}
              >
                {loading ? (
                  <RefreshCw size={16} className="spin" />
                ) : (
                  <>
                    <Check size={18} /> Gerar Fechamento
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal Premium de Fatura/Orçamento (Faturamento Detalhado) */}
      {isInvoiceModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '40px' }}>
            
            {/* Fechar modal */}
            <button 
              onClick={() => setIsInvoiceModalOpen(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              className="no-print"
            >
              <X size={24} />
            </button>

            {loadingInvoice ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <RefreshCw size={36} className="spin" style={{ color: 'hsl(var(--primary))', margin: '0 auto 16px' }} />
                <p>Carregando fatura detalhada...</p>
              </div>
            ) : invoiceDetail ? (
              <div id="invoice-print-area">
                
                {/* Cabeçalho da Fatura */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid hsl(var(--primary) / 0.2)', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {laboratory?.name?.toUpperCase() || "NOVA LAB LABORATÓRIO"}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      {laboratory?.address || "Av. Principal de Ópticas, 1000 - Centro"} - CEP {laboratory?.cep || "01234-567"}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      CNPJ: {laboratory?.cnpj || "00.123.456/0001-99"} | Tel: {laboratory?.telephone || "(11) 5555-1234"}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '30px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: invoiceDetail.status === 'PAGO' ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--warning) / 0.15)',
                      color: invoiceDetail.status === 'PAGO' ? 'hsl(var(--success))' : 'hsl(var(--warning))',
                      marginBottom: '10px'
                    }}>
                      {invoiceDetail.status === 'PAGO' ? 'PAGO' : 'AGUARDANDO QUITAÇÃO'}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'hsl(var(--text-secondary))' }}>
                      FATURA DE FECHAMENTO
                    </h4>
                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'hsl(var(--text-muted))' }}>
                      #{invoiceDetail.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Informações da Ótica Comercial */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', background: 'rgba(15,23,42,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(224,230,240,0.5)' }}>
                  <div>
                    <h5 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Destinatário</h5>
                    <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
                      {invoiceDetail.optical_store_name || 'Ótica Parceira'}
                    </strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                      ID Comercial: {invoiceDetail.optical_store_id}
                    </p>
                  </div>

                  <div>
                    <h5 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Dados do Fechamento</h5>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      <strong>Período:</strong> {formatDate(invoiceDetail.start_date)} a {formatDate(invoiceDetail.end_date)}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>
                      <strong>Emissão:</strong> {formatDateTime(invoiceDetail.created_at)}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: invoiceDetail.status !== 'PAGO' && invoiceDetail.is_overdue ? 'rgb(239, 68, 68)' : 'inherit' }}>
                      <strong>Vencimento:</strong> {formatDate(invoiceDetail.due_date)} {invoiceDetail.status !== 'PAGO' && invoiceDetail.is_overdue && ' (Atrasado)'}
                    </p>
                    {invoiceDetail.status === 'PAGO' && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'hsl(var(--success))' }}>
                        <strong>Liquidação:</strong> {formatDateTime(invoiceDetail.paid_at)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tabela de Ordens de Serviço Consolidadas (Detalhamento Anexo 1 & Anexo 2) */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '1rem', borderBottom: '2px solid hsl(var(--primary) / 0.2)', paddingBottom: '8px', marginBottom: '16px', color: 'hsl(var(--text-primary))' }}>
                    Detalhamento de Ordens de Serviço e Serviços Técnicos ({invoiceDetail.items.length} OS{invoiceDetail.items.length > 1 ? 's' : ''})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {invoiceDetail.items.map((item) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          border: '1px solid rgba(224,230,240,0.8)', 
                          borderRadius: '10px', 
                          overflow: 'hidden', 
                          background: 'white',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Header da OS */}
                        <div style={{ 
                          background: 'rgba(15,23,42,0.03)', 
                          padding: '10px 16px', 
                          display: 'flex', 
                          justify: 'space-between', 
                          alignItems: 'center', 
                          borderBottom: '1px solid rgba(224,230,240,0.8)' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontWeight: 700, 
                              fontSize: '0.9rem', 
                              color: 'hsl(var(--primary))',
                              background: 'hsl(var(--primary) / 0.08)',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {item.os_number || 'OS-N/A'}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'hsl(var(--text-primary))' }}>
                              Paciente / Cliente: <strong>{item.client_name || 'Consumidor Final'}</strong>
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                            Subtotal OS: <strong style={{ color: 'hsl(var(--text-primary))', fontSize: '1rem', marginLeft: '4px' }}>{formatCurrency(item.amount)}</strong>
                          </div>
                        </div>

                        {/* Tabela de Itens e Serviços da OS (Layout Anexo 1) */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(15,23,42,0.015)', color: 'hsl(var(--text-secondary))' }}>
                              <th style={{ padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid rgba(224,230,240,0.6)', width: '30%' }}>Item / Serviço</th>
                              <th style={{ padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid rgba(224,230,240,0.6)', width: '35%' }}>Descrição do Catálogo</th>
                              <th style={{ padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid rgba(224,230,240,0.6)', width: '12%' }}>Tipo</th>
                              <th style={{ padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid rgba(224,230,240,0.6)', width: '10%' }}>Qtd</th>
                              <th style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid rgba(224,230,240,0.6)', width: '13%' }}>Valor (R$)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.detailed_items && item.detailed_items.length > 0 ? (
                              item.detailed_items.map((detail, idx) => {
                                const isLens = detail.item_type === 'Lente';
                                const isService = detail.item_type === 'Serviço';
                                const isTreatment = detail.item_type === 'Tratamento';

                                const typeBg = isLens ? 'rgba(147, 51, 234, 0.1)' : isService ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                                const typeColor = isLens ? '#7e22ce' : isService ? '#1d4ed8' : '#047857';

                                return (
                                  <tr key={idx} style={{ borderBottom: idx === item.detailed_items.length - 1 ? 'none' : '1px solid rgba(224,230,240,0.4)' }}>
                                    <td style={{ padding: '8px 16px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                                      {detail.name}
                                    </td>
                                    <td style={{ padding: '8px 16px', color: 'hsl(var(--text-secondary))' }}>
                                      {detail.description || '-'}
                                    </td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                      <span style={{ 
                                        display: 'inline-block',
                                        padding: '2px 8px', 
                                        borderRadius: '12px', 
                                        fontSize: '0.72rem', 
                                        fontWeight: 700,
                                        background: typeBg,
                                        color: typeColor
                                      }}>
                                        {detail.item_type}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                                      {detail.quantity} {isLens ? 'un' : ''}
                                    </td>
                                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                                      {formatCurrency(detail.total_price ?? (detail.unit_price * detail.quantity))}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              /* Fallback para OSs legadas */
                              <>
                                <tr style={{ borderBottom: '1px solid rgba(224,230,240,0.4)' }}>
                                  <td style={{ padding: '8px 16px', fontWeight: 600 }}>{item.lens_type || 'Lente Padrão Laboratorial'}</td>
                                  <td style={{ padding: '8px 16px', color: 'hsl(var(--text-secondary))' }}>Lente Oftálmica Visão Simples / Digital</td>
                                  <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(147, 51, 234, 0.1)', color: '#7e22ce' }}>Lente</span>
                                  </td>
                                  <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600 }}>2 un</td>
                                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.lens_price ?? item.amount ?? 0)}</td>
                                </tr>
                                {item.services && (
                                  <tr style={{ borderBottom: '1px solid rgba(224,230,240,0.4)' }}>
                                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{item.services}</td>
                                    <td style={{ padding: '8px 16px', color: 'hsl(var(--text-secondary))' }}>Montagem e Acabamento de Precisão</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8' }}>Serviço</span>
                                    </td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600 }}>1</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.service_price ?? 0)}</td>
                                  </tr>
                                )}
                                {item.treatments && item.treatments !== 'Incolor / Sem Tratamento' && (
                                  <tr>
                                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{item.treatments}</td>
                                    <td style={{ padding: '8px 16px', color: 'hsl(var(--text-secondary))' }}>Tratamento de Superfície Lente</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>Tratamento</span>
                                    </td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600 }}>1</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.treatment_price ?? 0)}</td>
                                  </tr>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>


                {/* Resumo Financeiro */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid rgba(224,230,240,0.8)', paddingTop: '16px' }}>
                  <div style={{ width: '300px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Subtotal:</span>
                      <strong>{formatCurrency(invoiceDetail.total_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Descontos:</span>
                      <span>R$ 0,00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', borderTop: '1px solid rgba(224,230,240,0.5)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>Total Faturado:</span>
                      <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.4rem' }}>{formatCurrency(invoiceDetail.total_amount)}</strong>
                    </div>
                  </div>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}


      {/* MODAL DE CONFIRMAÇÃO DE UNIFICAÇÃO DE FATURA POR ÓTICA */}
      {showUnifyPromptModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container" style={{ maxWidth: '520px', width: '90%', padding: '28px', background: 'white', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ padding: '16px', borderRadius: '50%', background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', width: 'fit-content', margin: '0 auto 16px' }}>
              <AlertCircle size={40} />
            </div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem' }}>Há Outras OSs desta Ótica Pendentes!</h3>
            <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6, marginBottom: '20px' }}>
              A ótica <strong>{selectedStore?.optical_store_name}</strong> possui <strong>{storeOrders.length} Ordens de Serviço elegíveis</strong> no total. Você selecionou <strong>{selectedOrderIds.length} OSs</strong>.
            </p>
            <div style={{ background: 'rgba(147, 51, 234, 0.05)', border: '1px dashed rgba(147, 51, 234, 0.3)', padding: '14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'left', color: 'hsl(var(--text-primary))' }}>
              💡 <strong>Dica Comercial:</strong> Unir todas as OSs da mesma ótica em uma única fatura simplifica o fechamento e facilita o controle financeiro para a loja.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px 18px', fontWeight: 'bold' }}
                onClick={() => {
                  const allIds = storeOrders.map(o => o.id);
                  setSelectedOrderIds(allIds);
                  setShowUnifyPromptModal(false);
                  executeBilling(allIds);
                }}
              >
                ✨ Sim, Emitir 1 Fatura Única com TODAS as {storeOrders.length} OSs
              </button>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '10px 18px' }}
                onClick={() => {
                  setShowUnifyPromptModal(false);
                  executeBilling(selectedOrderIds);
                }}
              >
                Manter Fatura Apenas com as {selectedOrderIds.length} OSs Selecionadas
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Adiciona Estilo para Impressão */}
      <style>{`
        @media print {
          /* Esconde tudo no body */
          body {
            visibility: hidden !important;
            background: white !important;
            color: black !important;
          }
          
          /* Garante a visibilidade de toda a cadeia de contêineres pais e da fatura em si */
          #root, 
          .modal-overlay, 
          .modal-content, 
          #invoice-print-area, 
          #invoice-print-area * {
            visibility: visible !important;
          }
          
          /* Remove limites restritivos de altura e rolagem dos pais para evitar folhas em branco */
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          #root {
            height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
          
          /* Modifica o overlay do modal para se esticar e renderizar normalmente */
          .modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Adapta a caixa do modal para ocupar a página cheia na impressão */
          .modal-content {
            position: static !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          /* Posiciona o contêiner de impressão no topo esquerdo */
          #invoice-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            box-shadow: none !important;
          }
          
          /* Oculta os botões e painéis indesejados da folha impressa */
          .no-print {
            display: none !important;
          }
        }
        .spin {
          animation: spin-animation 1s infinite linear;
        }
        @keyframes spin-animation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};


export default FechamentoFinanceiro;

