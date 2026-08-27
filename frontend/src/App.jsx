import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Grid, FileUp, ShieldAlert, Smartphone, FileText, Activity, BarChart2, Store, Key, Layers, DollarSign, Percent, Keyboard } from 'lucide-react';
import UsbScanner from './components/UsbScanner';
import GradeOptica from './components/GradeOptica';
import GradeBlocos from './components/GradeBlocos';
import GradeLentes167 from './components/GradeLentes167';
import GradeMultifocalAcabado from './components/GradeMultifocalAcabado';
// App.jsx - Updated version for Unified Lens Register & Grade Filtering
import UnifiedLensRegister from './components/UnifiedLensRegister';
import MatrizVisaoSimples from './components/MatrizVisaoSimples';
import XMLUpload from './components/XMLUpload';
import DashboardAlerts from './components/DashboardAlerts';
import FallbackModal from './components/FallbackModal';
import OSUpload from './components/OSUpload';
import OSWorkflow from './components/OSWorkflow';
import OSDashboard from './components/OSDashboard';
import AdminLentes from './components/AdminLentes';
import Login from './components/Login';
import api from './services/api';
import CadastroOticas from './components/CadastroOticas';
import CatalogoFinanceiro from './components/CatalogoFinanceiro';
import TabelaPrecos from './components/TabelaPrecos';
import FechamentoFinanceiro from './components/FechamentoFinanceiro';
import DashboardGerencial from './components/DashboardGerencial';
import AssistenteIA from './components/AssistenteIA';
import GerenciamentoUsuarios from './components/GerenciamentoUsuarios';
import GlobalSearch from './components/GlobalSearch';
import SmartMenuBar from './components/SmartMenu';
import DashboardExecutivo from './components/DashboardExecutivo';
import ParametrosSistema from './components/ParametrosSistema';
import GestaoPedidosFornecedor from './components/GestaoPedidosFornecedor';
import CentralAlertasFinanceiros from './components/CentralAlertasFinanceiros';
import OSRegistrationForm from './components/OSRegistrationForm';
import OSDetail from './components/OSDetail';

import FilaOrdensBloqueadas from './components/FilaOrdensBloqueadas';
import DashboardDRE from './components/DashboardDRE';
import RelatoriosHub from './pages/reports/RelatoriosHub';
import { TrendingUp, Sparkles, Users, ChevronDown, Plus, Wrench, Settings, Building2, BarChart3, Lock } from 'lucide-react';




function App() {
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedOSIdForModal, setSelectedOSIdForModal] = useState(null);
  const [toast, setToast] = useState(null);






  
  // Estado para controle do modal de fallback global
  const [fallbackData, setFallbackData] = useState(null); // { barcode, quantity }

  const [openDropdown, setOpenDropdown] = useState(null); // 'estoque', 'os', 'comercial', 'sistema' ou null

  // Estado de autenticação do operador da fábrica
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('factory_token');
    const role = localStorage.getItem('factory_user_role');
    const name = localStorage.getItem('factory_user_name');
    if (token && role && name) {
      return { token, role, name };
    }
    return null;
  });

  const [showAlertsModal, setShowAlertsModal] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role === 'Administrador') {
      setShowAlertsModal(true);
    }
  }, [currentUser]);


  // Escuta o evento global de logout disparado pelo interceptor do axios (ex: 401 token expirado)
  useEffect(() => {
    const handleAuthLogout = (e) => {
      setCurrentUser(null);
      const reason = e.detail?.reason;
      if (reason && reason !== 'logout_manual') {
        showToast(`Sessão encerrada: ${reason}`, 'error');
      }
    };
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);


  // Estado para os dados cadastrais dinâmicos do laboratório
  const [laboratory, setLaboratory] = useState({
    name: 'Nova LAB',
    cep: '71572-302',
    telephone: '61 99266-7281',
    cnpj: '58.032.958/0001-44',
    address: 'Avenida transversal quadra 23 conjunto B lote 27 apartamento 201'
  });
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [labForm, setLabForm] = useState({
    name: '',
    cep: '',
    telephone: '',
    cnpj: '',
    address: ''
  });

  // Busca dados do laboratório do backend ao carregar
  useEffect(() => {
    if (currentUser) {
      const fetchLab = async () => {
        try {
          const response = await api.get('/laboratory/');
          setLaboratory(response.data);
        } catch (err) {
          console.error("Erro ao carregar dados do laboratório:", err);
        }
      };
      fetchLab();
    }
  }, [currentUser]);

  const handleOpenLabModal = () => {
    if (!currentUser) return;
    setLabForm({
      name: laboratory.name,
      cep: laboratory.cep,
      telephone: laboratory.telephone,
      cnpj: laboratory.cnpj,
      address: laboratory.address
    });
    setIsLabModalOpen(true);
  };

  const handleSaveLab = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put('/laboratory/', labForm);
      setLaboratory(response.data);
      setIsLabModalOpen(false);
      showToast("Dados do laboratório atualizados com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || "Erro ao salvar dados do laboratório.", "error");
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('factory_token');
    localStorage.removeItem('factory_user_role');
    localStorage.removeItem('factory_user_name');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Configura interceptores do axios para injetar o JWT e tratar 401
  useEffect(() => {
    // Interceptor da instância personalizada de api
    const interceptor = api.interceptors.request.use((config) => {
      if (currentUser) {
        config.headers['Authorization'] = `Bearer ${currentUser.token}`;
      }
      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    // Interceptor do axios global (fallback para chamadas diretas)
    const globalInterceptor = axios.interceptors.request.use((config) => {
      if (currentUser) {
        config.headers['Authorization'] = `Bearer ${currentUser.token}`;
      }
      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    // Interceptor de resposta para api
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    // Interceptor de resposta para axios global
    const globalResponseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(interceptor);
      axios.interceptors.request.eject(globalInterceptor);
      api.interceptors.response.eject(responseInterceptor);
      axios.interceptors.response.eject(globalResponseInterceptor);
    };
  }, [currentUser]);


  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e) => {
      const currentTime = Date.now();
      
      // Se passar mais de 50ms entre teclas, limpa o buffer (evita digitação humana lenta)
      if (currentTime - lastKeyTime > 50) {
        buffer = "";
      }
      
      lastKeyTime = currentTime;

      // Se pressionar Enter, processa o buffer
      if (e.key === 'Enter') {
        if (buffer.length >= 4 && buffer.startsWith('OS-')) {
          console.log("Scanner detectou código de OS:", buffer);
          e.preventDefault();
          
          try {
            const hostname = window.location.hostname;
            const response = await axios.post(`http://${hostname}:8000/api/v1/factory/os/bip-bancada`, {
              os_number: buffer
            });
            showToast(`OS ${buffer} bipada e transicionada para ${response.data.status} com sucesso!`, 'success');
          } catch (err) {
            console.error(err);
            showToast(`Falha ao bipar OS ${buffer}: ${err.response?.data?.detail || err.message}`, 'error');
          }
        }
        buffer = "";
        return;
      }

      // Apenas acumula caracteres imprimíveis
      if (e && e.key && e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleIneditoBarcode = (barcode, initialQty = 1) => {
    setFallbackData({ barcode, quantity: initialQty });
    setActiveTab('unified-lens-register');
  };

  const handleOpenUnifiedRegister = (initialData = null) => {
    setFallbackData(initialData || { barcode: '', quantity: 1 });
    setActiveTab('unified-lens-register');
  };

  const handleFallbackSuccess = (newItem) => {
    setFallbackData(null);
    // Vibe de sucesso
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    // Opcionalmente força recarga da aba ativa se necessário
    if (activeTab === 'grid') {
      setActiveTab('scanner');
      setTimeout(() => setActiveTab('grid'), 50);
    } else if (activeTab === 'alerts') {
      setActiveTab('scanner');
      setTimeout(() => setActiveTab('alerts'), 50);
    } else {
      setActiveTab('grid'); // Navega para a grade para ver o item cadastrado
    }
  };

  // Se não estiver logado na fábrica, exibe o Login
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Overlay invisível para fechar dropdown ao clicar fora */}
      {openDropdown && (
        <div 
          onClick={() => setOpenDropdown(null)} 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 140,
            background: 'transparent',
          }}
        />
      )}
      {/* Cabeçalho Premium */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="logo-container" onClick={handleOpenLabModal} style={{ cursor: 'pointer' }} title="Clique para editar dados do laboratório">
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {laboratory.name.split(' ')[0]}<span style={{ color: 'hsl(var(--secondary))' }}>{laboratory.name.split(' ').slice(1).join(' ') || ''}</span>
            </span>
            <span className="logo-badge">Fábrica</span>
          </div>
          {/* Pesquisa Global */}
          <GlobalSearch onNavigate={(tab, result) => {
            if (tab) setActiveTab(tab);
            if (result && result.type === 'os' && result.id) {
              setSelectedOSIdForModal(result.id);
            }
          }} />
        </div>

        <nav className="nav-tabs" style={{ gap: '15px', background: 'transparent', border: 'none', boxShadow: 'none', overflow: 'visible' }}>








          {/* GRUPO 1: Estoque & Grade */}
          <div className="header-dropdown">
            <button 
              type="button"
              className={`dropdown-trigger ${['scanner', 'grid', 'grid-blocos', 'grid-167', 'grid-multifocal-acabado', 'matriz-visao-simples', 'nfe', 'alerts', 'admin-lentes'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'estoque' ? null : 'estoque')}
            >
              <Layers size={16} /> Estoque & Grade <ChevronDown size={14} />
            </button>
            {openDropdown === 'estoque' && (
              <div className="dropdown-menu">
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'unified-lens-register' || activeTab === 'scanner' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unified-lens-register'); setOpenDropdown(null); }}
                >
                  <Plus size={14} style={{ color: 'hsl(var(--primary))' }} /> Cadastrador Unificado & Bipador USB
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'grid' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('grid'); setOpenDropdown(null); }}
                >
                  <Grid size={14} /> Visão Simples LP
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'grid-167' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('grid-167'); setOpenDropdown(null); }}
                >
                  <Sparkles size={14} style={{ color: '#a855f7' }} /> 1.67 Lentes Prontas
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'grid-multifocal-acabado' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('grid-multifocal-acabado'); setOpenDropdown(null); }}
                >
                  <Sparkles size={14} style={{ color: '#06b6d4' }} /> Multifocal Acabado
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'grid-blocos' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('grid-blocos'); setOpenDropdown(null); }}
                >
                  <Layers size={14} /> Multifocal
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'matriz-visao-simples' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('matriz-visao-simples'); setOpenDropdown(null); }}
                >
                  <Layers size={14} style={{ color: 'hsl(var(--secondary))' }} /> Bloco Visão Simples
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'nfe' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('nfe'); setOpenDropdown(null); }}
                >
                  <FileUp size={14} /> Importar NF-e
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'alerts' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('alerts'); setOpenDropdown(null); }}
                >
                  <ShieldAlert size={14} /> Motor Preditivo
                </button>
              </div>
            )}
          </div>

          {/* GRUPO 2: Bancada OS */}
          <div className="header-dropdown">
            <button 
              type="button"
              className={`dropdown-trigger ${['os-upload', 'os-workflow', 'os-dashboard', 'os-factory-register', 'financial-blocked-orders'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'os' ? null : 'os')}
            >
              <Activity size={16} /> Bancada OS <ChevronDown size={14} />
            </button>
            {openDropdown === 'os' && (
              <div className="dropdown-menu">
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'os-factory-register' || activeTab === 'os-upload' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('os-factory-register'); setOpenDropdown(null); }}
                >
                  <Plus size={14} style={{ color: 'hsl(var(--primary))' }} /> Nova OS de Fábrica (Com OCR & Manual)
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'os-workflow' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('os-workflow'); setOpenDropdown(null); }}
                >
                  <Activity size={14} /> Bancada OS
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'os-dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('os-dashboard'); setOpenDropdown(null); }}
                >
                  <BarChart2 size={14} /> Indicadores
                </button>
                {currentUser.role === 'Administrador' && (
                  <button 
                    type="button"
                    className={`dropdown-item ${activeTab === 'financial-blocked-orders' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('financial-blocked-orders'); setOpenDropdown(null); }}
                  >
                    <Lock size={14} /> Ordens Retidas por Inadimplência
                  </button>
                )}
              </div>
            )}


          </div>

          {/* GRUPO 3: Comercial & Finanças */}
          <div className="header-dropdown">
            <button 
              type="button"
              className={`dropdown-trigger ${['crm-pipeline', 'catalog', 'price-tables', 'billing', 'dashboard-gerencial'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'comercial' ? null : 'comercial')}
            >
              <DollarSign size={16} /> Comercial & Finanças <ChevronDown size={14} />
            </button>
            {openDropdown === 'comercial' && (
              <div className="dropdown-menu">
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'catalog' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('catalog'); setOpenDropdown(null); }}
                >
                  <DollarSign size={14} /> Catálogo Financeiro
                </button>

                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'price-tables' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('price-tables'); setOpenDropdown(null); }}
                >
                  <Percent size={14} /> Tabela de Preços
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'billing' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('billing'); setOpenDropdown(null); }}
                >
                  <DollarSign size={14} /> Financeiro (Fechamento)
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'supplier-orders' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('supplier-orders'); setOpenDropdown(null); }}
                >
                  <DollarSign size={14} /> Pedidos no Fornecedor (Compras)
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'dashboard-gerencial' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard-gerencial'); setOpenDropdown(null); }}
                >
                  <TrendingUp size={14} /> Dashboard Gerencial
                </button>

                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'dre-consolidado' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dre-consolidado'); setOpenDropdown(null); }}
                >
                  <BarChart3 size={14} style={{ color: '#22c55e' }} /> DRE Consolidado
                </button>

                {currentUser.role === 'Administrador' && (
                  <button 
                    type="button"
                    className={`dropdown-item ${['executive-dashboard', 'finance-corp'].includes(activeTab) ? 'active' : ''}`}
                    onClick={() => { setActiveTab('executive-dashboard'); setOpenDropdown(null); }}
                  >
                    <BarChart3 size={14} /> Dashboard Executivo Aprimorado
                  </button>
                )}
              </div>
            )}
          </div>

          {/* GRUPO 4: Sistema & IA */}
          <div className="header-dropdown">
            <button 
              type="button"
              className={`dropdown-trigger ${['assistente-ia', 'admin-users', 'cadastro-oticas', 'system-parameters'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'sistema' ? null : 'sistema')}
            >
              <Sparkles size={16} /> Sistema & IA <ChevronDown size={14} />
            </button>
            {openDropdown === 'sistema' && (
              <div className="dropdown-menu">
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'assistente-ia' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('assistente-ia'); setOpenDropdown(null); }}
                >
                  <Sparkles size={14} /> Assistente IA
                </button>
                <button 
                  type="button"
                  className={`dropdown-item ${activeTab === 'cadastro-oticas' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('cadastro-oticas'); setOpenDropdown(null); }}
                >
                  <Store size={14} /> Cadastro Óticas
                </button>
                {currentUser.role === 'Administrador' && (
                  <>
                    <button 
                      type="button"
                      className={`dropdown-item ${activeTab === 'admin-users' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('admin-users'); setOpenDropdown(null); }}
                    >
                      <Users size={14} /> Gerenciar Usuários
                    </button>
                    <button 
                      type="button"
                      className={`dropdown-item ${activeTab === 'system-parameters' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('system-parameters'); setOpenDropdown(null); }}
                    >
                      <Settings size={14} /> Parâmetros do Sistema
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* GRUPO 5: Central de Relatórios & BI */}
          <div className="header-dropdown">
            <button 
              type="button"
              className={`dropdown-trigger ${activeTab === 'relatorios-bi' ? 'active' : ''}`}
              style={{
                background: activeTab === 'relatorios-bi' ? 'rgba(14, 165, 233, 0.25)' : 'transparent',
                borderColor: activeTab === 'relatorios-bi' ? '#38bdf8' : undefined,
                color: activeTab === 'relatorios-bi' ? '#38bdf8' : undefined,
                fontWeight: 700
              }}
              onClick={() => { setActiveTab('relatorios-bi'); setOpenDropdown(null); }}
            >
              <BarChart3 size={16} style={{ color: '#38bdf8' }} /> Relatórios & BI
            </button>
          </div>

        </nav>

        {/* Informações do usuário logado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingRight: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'block' }}>{currentUser.name}</span>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--secondary))', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>{currentUser.role}</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-outline" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.85rem', 
              color: 'hsl(var(--danger))', 
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'transparent',
              fontWeight: 700
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Barra de Menu Inteligente: Favoritos + Recentes */}
      <SmartMenuBar
        userId={currentUser?.name}
        onNavigate={(tab) => setActiveTab(tab)}
        activeTab={activeTab}
      />

      {/* Conteúdo Dinâmico */}
      <main className="app-container">
        {activeTab === 'scanner' && (
          <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
            <UsbScanner 
              onInedito={(barcode) => handleIneditoBarcode(barcode, 1)} 
              onScanSuccess={(item) => console.log("Bipagem bem-sucedida:", item)}
            />
          </div>
        )}

        {activeTab === 'grid' && (
          <GradeOptica 
            onOpenManualInsert={(initialData) => handleOpenUnifiedRegister(initialData)}
          />
        )}

        {activeTab === 'grid-167' && (
          <GradeLentes167 
            onOpenManualInsert={(initialData) => handleOpenUnifiedRegister({ ...(initialData || {}), matrixType: 'GRADE_167' })}
          />
        )}

        {activeTab === 'grid-blocos' && (
          <GradeBlocos onOpenManualInsert={(initialData) => handleOpenUnifiedRegister({ ...(initialData || {}), matrixType: 'MF_BLOCO' })} />
        )}

        {activeTab === 'grid-multifocal-acabado' && (
          <GradeMultifocalAcabado onOpenManualInsert={(initialData) => handleOpenUnifiedRegister({ ...(initialData || {}), matrixType: 'MF_ACB' })} />
        )}

        {activeTab === 'matriz-visao-simples' && (
          <MatrizVisaoSimples onOpenManualInsert={(initialData) => handleOpenUnifiedRegister({ ...(initialData || {}), matrixType: 'BLOCO_VS' })} />
        )}

        {activeTab === 'unified-lens-register' && (
          <UnifiedLensRegister 
            initialData={fallbackData}
            onComplete={() => setFallbackData(null)}
          />
        )}

        {activeTab === 'nfe' && (
          <XMLUpload />
        )}

        {activeTab === 'alerts' && (
          <DashboardAlerts />
        )}

        {activeTab === 'admin-lentes' && (
          <AdminLentes />
        )}

        {activeTab === 'os-factory-register' && (
          <OSRegistrationForm onOSCreated={() => setActiveTab('os-workflow')} />
        )}

        {activeTab === 'os-upload' && (
          <OSUpload onOSCreated={() => setActiveTab('os-workflow')} />
        )}

        {activeTab === 'os-workflow' && (
          <OSWorkflow />
        )}

        {activeTab === 'os-dashboard' && (
          <OSDashboard />
        )}

        {activeTab === 'cadastro-oticas' && (
          <CadastroOticas />
        )}

        {activeTab === 'catalog' && (
          <CatalogoFinanceiro 
            onOpenManualLensInsert={(initialData) => setFallbackData(initialData || { barcode: '', quantity: 1 })} 
          />
        )}

        {activeTab === 'price-tables' && (
          <TabelaPrecos />
        )}

        {activeTab === 'billing' && (
          <FechamentoFinanceiro laboratory={laboratory} />
        )}
        
        {activeTab === 'dashboard-gerencial' && (
          <DashboardGerencial onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'dre-consolidado' && (
          <DashboardDRE />
        )}

        {['executive-dashboard', 'finance-corp'].includes(activeTab) && currentUser?.role === 'Administrador' && (
          <DashboardExecutivo onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'system-parameters' && currentUser?.role === 'Administrador' && (
          <ParametrosSistema />
        )}

        {activeTab === 'supplier-orders' && (
          <GestaoPedidosFornecedor />
        )}


        {activeTab === 'financial-blocked-orders' && currentUser?.role === 'Administrador' && (
          <FilaOrdensBloqueadas />
        )}


        <CentralAlertasFinanceiros
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          onNavigateToFinance={() => setActiveTab('finance-corp')}
        />

        
        {activeTab === 'assistente-ia' && (
          <AssistenteIA />
        )}

        {activeTab === 'admin-users' && currentUser.role === 'Administrador' && (
          <GerenciamentoUsuarios />
        )}

        {activeTab === 'relatorios-bi' && (
          <RelatoriosHub currentUser={currentUser} />
        )}
      </main>


      {/* Rodapé Fixo */}
      <footer style={{ marginTop: 'auto', padding: '20px', textAlign: 'center', borderTop: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
        &copy; {new Date().getFullYear()} {laboratory.name}. Painel de Controle de Inventário local.
      </footer>

      {/* Modal de Reconciliação / Fallback */}
      {fallbackData && (
        <FallbackModal 
          barcode={fallbackData.barcode}
          initialQty={fallbackData.quantity}
          initialSpherical={fallbackData.spherical}
          initialCylindrical={fallbackData.cylindrical}
          initialLensModelId={fallbackData.lensModelId}
          initialRefractiveIndex={fallbackData.refractiveIndex}
          is167Mode={fallbackData.is167Mode || fallbackData.refractiveIndex === 1.67 || fallbackData.refractiveIndex === '1.67'}
          onClose={() => setFallbackData(null)}
          onSuccess={handleFallbackSuccess}
        />
      )}

      {/* Toast flutuante premium */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(12px)',
          border: toast.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
          color: 'white',
          padding: '14px 28px',
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          fontSize: '0.9rem',
          fontWeight: 600,
          transition: 'all 0.3s ease-in-out'
        }}>
          {toast.message}
        </div>
      )}

      {/* Modal de Configuração do Laboratório */}
      {isLabModalOpen && (
        <div className="modal-overlay" onClick={() => setIsLabModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <button 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              onClick={() => setIsLabModalOpen(false)}
            >
              x
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
              <Store size={22} style={{ color: 'hsl(var(--primary))' }} />
              Cadastro do Laboratório
            </h3>

            <form onSubmit={handleSaveLab} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Laboratório *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={labForm.name}
                  onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">CNPJ *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={labForm.cnpj}
                    onChange={(e) => setLabForm({ ...labForm, cnpj: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={labForm.telephone}
                    onChange={(e) => setLabForm({ ...labForm, telephone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">CEP *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={labForm.cep}
                    onChange={(e) => setLabForm({ ...labForm, cep: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço Completo *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={labForm.address}
                    onChange={(e) => setLabForm({ ...labForm, address: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'end', marginTop: '15px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsLabModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Global de Detalhes da OS (Acionado via Busca Global ou seleção direta) */}
      {selectedOSIdForModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedOSIdForModal(null)}
        >
          <div 
            style={{
              background: 'hsl(var(--card, 222 47% 11%))',
              border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <OSDetail
              osId={selectedOSIdForModal}
              onClose={() => setSelectedOSIdForModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;




