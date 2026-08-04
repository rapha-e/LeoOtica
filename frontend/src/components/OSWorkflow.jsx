import React, { useEffect, useState, useRef } from 'react';
import api, { LensService, OSService } from '../services/api';

import { Play, Check, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Info, DollarSign, History, User, Clock, MapPin, ClipboardList, Trash2, Barcode, Camera, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import OSDetail from './OSDetail';

const OSWorkflow = () => {
  const [orders, setOrders] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Abas do Kanban da Sprint 6: Recebida, Separação, Produção, Montagem, CQ, Expedição, Cancelada
  const [activeSubTab, setActiveSubTab] = useState('Recebida'); 
  
  // Controle de acordes / formulário de alocação por OS
  const [expandedOsId, setExpandedOsId] = useState(null);
  
  // Controle de exibição do histórico de rastreabilidade por OS ID
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  
  // Estados dos formulários de alocação (indexados por OS ID)
  const [allocationForms, setAllocationForms] = useState({});
  const [allocatingId, setAllocatingId] = useState(null);
  const [allocError, setAllocError] = useState({});

  // Estados dos formulários de transição com notas/setor customizados
  const [transitionNotes, setTransitionNotes] = useState({}); // { os_id: "notas" }
  const [transitionSector, setTransitionSector] = useState({}); // { os_id: "setor" }

  // Estados dos formulários de quebra
  const [quebraForms, setQuebraForms] = useState({}); // { os_id: "motivo" }
  const [showingQuebraInput, setShowingQuebraInput] = useState({}); // { os_id: true/false }

  // Estados do Controle de Qualidade (CQ)
  const [showingCQForm, setShowingCQForm] = useState({}); // { os_id: true/false }
  const [cqChecklist, setCqChecklist] = useState({}); // { os_id: { grau: false, eixo: false, prisma: false, acabamento: false } }
  const [cqResult, setCqResult] = useState({}); // { os_id: 'APROVADO' }
  const [cqReworkDest, setCqReworkDest] = useState({}); // { os_id: 'Montagem' }
  const [cqNotes, setCqNotes] = useState({}); // { os_id: '' }

  // Controle de exibição dos detalhes técnicos por OS ID
  const [expandedDetailsId, setExpandedDetailsId] = useState(null);

  // Estados do cancelamento lógico da OS
  const [showingCancelModal, setShowingCancelModal] = useState(false);
  const [cancelOsId, setCancelOsId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const getBaseUrl = () => {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000/api/v1`;
  };

  const handleOpenCancelModal = (osId) => {
    setCancelOsId(osId);
    setCancelReason('');
    setShowingCancelModal(true);
  };

  const handleCancelOS = async () => {
    if (!cancelReason || cancelReason.trim() === '') {
      alert("A justificativa de cancelamento é obrigatória.");
      return;
    }
    try {
      await OSService.cancel(cancelOsId, cancelReason);
      setShowingCancelModal(false);
      setCancelOsId(null);
      setCancelReason('');
      loadOrders();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Falha ao cancelar a Ordem de Serviço.");
    }
  };

  // Estados da Bipadora de OS
  const [showingBipadoraModal, setShowingBipadoraModal] = useState(false);
  const [bipadoraMode, setBipadoraMode] = useState('usb'); // 'usb' ou 'camera'
  const [bipadoraInputValue, setBipadoraInputValue] = useState('');
  const [bipadoraResult, setBipadoraResult] = useState(null); // { type: 'success'|'error', message: '', detail: '' }
  const [bipadoraLoading, setBipadoraLoading] = useState(false);
  const bipadoraInputRef = useRef(null);
  const bipadoraQrCodeRef = useRef(null);

  const focusBipadoraInput = () => {
    if (bipadoraInputRef.current) {
      bipadoraInputRef.current.focus();
    }
  };

  useEffect(() => {
    if (showingBipadoraModal && bipadoraMode === 'usb') {
      setTimeout(focusBipadoraInput, 100);
    }
  }, [showingBipadoraModal, bipadoraMode]);

  // Efeito da câmera para o modal de escaneamento de OS
  useEffect(() => {
    let html5Qrcode = null;
    
    const startBipadoraCamera = async () => {
      if (!showingBipadoraModal || bipadoraMode !== 'camera') return;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        html5Qrcode = new Html5Qrcode("workflow-reader");
        bipadoraQrCodeRef.current = html5Qrcode;
        
        await html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => ({ width: Math.min(width * 0.8, 280), height: 120 })
          },
          async (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(100);
            if (html5Qrcode && html5Qrcode.isScanning) {
              await html5Qrcode.stop();
            }
            handleBipadoraSubmit(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Erro ao iniciar câmera de bancada:", err);
      }
    };

    startBipadoraCamera();
    
    return () => {
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.error(err));
      }
    };
  }, [showingBipadoraModal, bipadoraMode]);

  const handleBipadoraSubmit = async (barcodeVal) => {
    const code = typeof barcodeVal === 'string' ? barcodeVal.trim() : bipadoraInputValue.trim();
    if (!code) return;

    setBipadoraInputValue('');
    setBipadoraLoading(true);
    setBipadoraResult(null);

    if (!code.startsWith('OS-')) {
      setBipadoraResult({
        type: 'error',
        message: `Código inválido: "${code}".`,
        detail: `As bancadas aceitam apenas códigos de Ordens de Serviço (iniciando com "OS-").`
      });
      setBipadoraLoading(false);
      if (bipadoraMode === 'usb') setTimeout(focusBipadoraInput, 100);
      return;
    }

    try {
      const response = await api.post('/factory/os/bip-bancada', {
        os_number: code
      });
      
      setBipadoraResult({
        type: 'success',
        message: `OS ${code} bipada com sucesso!`,
        detail: `Transicionada para a bancada: ${response.data.status}`
      });
      
      loadOrders();
    } catch (err) {
      console.error(err);
      setBipadoraResult({
        type: 'error',
        message: `Falha ao transicionar OS ${code}.`,
        detail: err.response?.data?.detail || "Erro de validação na máquina de estados do workflow."
      });
    } finally {
      setBipadoraLoading(false);
      if (bipadoraMode === 'usb') setTimeout(focusBipadoraInput, 100);
    }
  };

  useEffect(() => {
    loadOrders();
    loadModels();
  }, [activeSubTab]);

  // WebSocket real-time updates listener
  useEffect(() => {
    const hostname = window.location.hostname;
    const ws = new WebSocket(`ws://${hostname}:8000/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'os_status_updated') {
          console.log("WebSocket: status da OS atualizado no backend, recarregando...", data);
          loadOrders();
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket desconectado. As bancadas atualizarão sob requisição manual.");
    };

    return () => {
      ws.close();
    };
  }, [activeSubTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/os/?status=${encodeURIComponent(activeSubTab)}`);
      setOrders(response.data);
    } catch (err) {
      console.error("Erro ao carregar OSs:", err);
    } finally {
      setLoading(false);
    }
  };


  const loadModels = async () => {
    try {
      const response = await LensService.getModels();
      setModels(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const initAllocationForm = (os) => {
    if (allocationForms[os.id]) return;
    
    // Inicia os valores padrão de armação: A:52, Ponte:18, ED:54
    setAllocationForms(prev => ({
      ...prev,
      [os.id]: {
        frame_a: '52',
        frame_bridge: '18',
        frame_ed: '54',
        od_dnp: os.od_dnp ? os.od_dnp.toString() : '32.00',
        oe_dnp: os.oe_dnp ? os.oe_dnp.toString() : '32.00',
        lens_model_id: models.length > 0 ? models[0].id.toString() : ''
      }
    }));
  };

  const handleFormChange = (osId, field, val) => {
    setAllocationForms(prev => ({
      ...prev,
      [osId]: {
        ...prev[osId],
        [field]: val
      }
    }));
  };

  const toggleExpand = (os) => {
    if (expandedOsId === os.id) {
      setExpandedOsId(null);
    } else {
      setExpandedOsId(os.id);
      setExpandedHistoryId(null);
      initAllocationForm(os);
    }
  };

  const toggleHistoryExpand = (osId) => {
    if (expandedHistoryId === osId) {
      setExpandedHistoryId(null);
    } else {
      setExpandedHistoryId(osId);
      setExpandedOsId(null);
    }
  };

  // 1. AÇÃO: Validar Geometria e Reservar Lentes no Estoque (Bancada Recebida)
  const handleAllocate = async (osId) => {
    const form = allocationForms[osId];
    if (!form || !form.lens_model_id) {
      setAllocError(prev => ({ ...prev, [osId]: "Selecione um modelo de lente." }));
      return;
    }

    setAllocatingId(osId);
    setAllocError(prev => ({ ...prev, [osId]: null }));

    const payload = {
      frame_a: parseFloat(form.frame_a),
      frame_bridge: parseFloat(form.frame_bridge),
      frame_ed: parseFloat(form.frame_ed),
      lens_model_id: form.lens_model_id,
      od_dnp: parseFloat(form.od_dnp),
      oe_dnp: parseFloat(form.oe_dnp)
    };

    try {
      await api.post(`/os/${osId}/allocate`, payload);
      setExpandedOsId(null);
      loadOrders();
    } catch (err) {
      console.error(err);
      setAllocError(prev => ({ 
        ...prev, 
        [osId]: err.response?.data?.detail || "Estoque insuficiente ou erro na alocação." 
      }));
    } finally {
      setAllocatingId(null);
    }
  };

  // 2. AÇÃO: Mudar Status de Workflow com Notas e Setor Opcionais
  const handleStatusTransition = async (osId, targetStatus, defaultNotes = "", defaultSector = "") => {
    const notes = transitionNotes[osId] || defaultNotes;
    const sector = transitionSector[osId] || defaultSector;
    
    try {
      await api.post(`/os/${osId}/status`, {
        status: targetStatus,
        operator_notes: notes,
        sector: sector || null
      });
      // Limpa formulários locais de transição
      setTransitionNotes(prev => ({ ...prev, [osId]: '' }));
      setTransitionSector(prev => ({ ...prev, [osId]: '' }));
      loadOrders();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map(e => e.msg || JSON.stringify(e)).join('\n')
        : typeof detail === 'object' && detail !== null
          ? JSON.stringify(detail)
          : detail || "Falha ao transicionar status.";
      alert(errorMsg);
    }
  };


  // 3. AÇÃO: Reprocessar por Quebra Física de Lente (Inutiliza lentes e volta a Recebida)
  const handleQuebraReprocess = async (osId) => {
    const reason = quebraForms[osId];
    if (!reason || reason.trim() === "") {
      alert("Informe a justificativa da quebra física.");
      return;
    }

    try {
      await api.post(`/factory/os/${osId}/breakage`, {
        operator_notes: reason
      });

      // Limpa formulário
      setQuebraForms(prev => ({ ...prev, [osId]: '' }));
      setShowingQuebraInput(prev => ({ ...prev, [osId]: false }));
      loadOrders();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao registrar a quebra.");
    }
  };

  // 4. AÇÃO: Controle de Qualidade (Checklist e Resultado de CQ)
  const initCQForm = (osId) => {
    setCqChecklist(prev => ({
      ...prev,
      [osId]: { grau: false, eixo: false, prisma: false, acabamento: false }
    }));
    setCqResult(prev => ({ ...prev, [osId]: 'APROVADO' }));
    setCqReworkDest(prev => ({ ...prev, [osId]: 'Montagem' }));
    setCqNotes(prev => ({ ...prev, [osId]: '' }));
  };

  const handleCQInspection = async (osId) => {
    const result = cqResult[osId] || 'APROVADO';
    const notes = cqNotes[osId] || '';
    const checklist = cqChecklist[osId] || { grau: false, eixo: false, prisma: false, acabamento: false };
    const reworkDestination = cqReworkDest[osId] || 'Montagem';

    if (['RETRABALHO', 'REPROVADO'].includes(result) && (!notes || notes.trim() === '')) {
      alert(`Informe a justificativa/observações para o resultado: ${result}`);
      return;
    }

    const payload = {
      check_grau: checklist.grau,
      check_eixo: checklist.eixo,
      check_prisma: checklist.prisma,
      check_acabamento: checklist.acabamento,
      result: result,
      rework_destination: result === 'RETRABALHO' ? reworkDestination : null,
      notes: notes
    };

    try {
      await api.post(`/os/${osId}/cq`, payload);
      // Limpa formulários locais de CQ
      setShowingCQForm(prev => ({ ...prev, [osId]: false }));
      loadOrders();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao registrar inspeção de Controle de Qualidade.");
    }
  };


  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Recebida': return 'hsl(var(--primary) / 0.2)';
      case 'Separação': return 'rgba(59, 130, 246, 0.2)';
      case 'Produção':
      case 'Surfaçagem': return 'rgba(6, 182, 212, 0.2)';
      case 'Montagem': return 'rgba(234, 179, 8, 0.2)';
      case 'CQ':
      case 'CQ Final': return 'rgba(147, 51, 234, 0.2)';
      case 'Expedição': return 'hsl(var(--success) / 0.2)';
      case 'Cancelada': return 'hsl(var(--danger) / 0.2)';
      default: return 'var(--border-glass)';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'Recebida': return 'hsl(var(--primary))';
      case 'Separação': return '#3b82f6';
      case 'Produção':
      case 'Surfaçagem': return 'rgb(6, 182, 212)';
      case 'Montagem': return 'rgb(234, 179, 8)';
      case 'CQ':
      case 'CQ Final': return 'rgb(147, 51, 234)';
      case 'Expedição': return 'hsl(var(--success))';
      case 'Cancelada': return 'hsl(var(--danger))';
      default: return 'white';
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'between', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px' }}>Bancada OS</h2>

          <p style={{ fontSize: '0.85rem' }}>Workflow operacional do laboratório oftálmico. Acompanhe a rastreabilidade e transições de chão de fábrica.</p>
        </div>

        {/* Abas das Bancadas do Kanban (Sprint 6) */}
        <div className="nav-tabs" style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {['Recebida', 'Separação', 'Produção', 'Montagem', 'CQ', 'Expedição', 'Concluída', 'Cancelada'].map(tab => (
            <button 
              key={tab}
              className={`tab-btn ${activeSubTab === tab ? 'active' : ''}`} 
              onClick={() => { setActiveSubTab(tab); setExpandedOsId(null); setExpandedHistoryId(null); }}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              {tab === 'Recebida' ? 'Recebidas (Triagem)' : tab === 'CQ' ? 'CQ (Qualidade)' : tab === 'Expedição' ? 'Expedição (Logística)' : tab === 'Concluída' ? 'Concluídas / Entregues' : tab}
            </button>
          ))}
        </div>

        {/* Botão de escaneamento de OS de bancada */}
        <div style={{ marginLeft: '10px' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            onClick={() => {
              setShowingBipadoraModal(true);
              setBipadoraMode('usb');
              setBipadoraResult(null);
              setBipadoraInputValue('');
            }}
          >
            <Barcode size={16} /> Bipar OS (Bancada)
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>
          <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 10px auto' }} />
          <span>Atualizando Ordens de Serviço...</span>
        </div>
      ) : orders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orders.map((os) => {
            const form = allocationForms[os.id] || {};
            const isExpanded = expandedOsId === os.id;
            const isHistoryExpanded = expandedHistoryId === os.id;
            const errorMsg = allocError[os.id];
            
            return (
              <div key={os.id} className="glass-panel" style={{ padding: '20px', background: 'rgba(8,10,18,0.3)', border: isExpanded ? '1px solid hsl(var(--primary) / 0.4)' : isHistoryExpanded ? '1px solid hsl(var(--secondary) / 0.4)' : '1px solid var(--border-glass)' }}>
                
                {/* Cabeçalho do Card */}
                <div style={{ display: 'flex', justifyContent: 'between', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>NÚMERO DA OS</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: 'white', fontSize: '1.25rem' }}>{os.os_number}</strong>
                      {os.is_rework && (
                        <span className="rework-badge-piscante" style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'hsl(var(--danger))',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          animation: 'pulse 1.5s infinite',
                          display: 'inline-block'
                        }}>
                          ⚠️ Retrabalho Urgente
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>PACIENTE</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{os.client_name || 'Não identificado'}</span>
                  </div>
                  {os.optical_store && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>ÓTICA COMERCIAL</span>
                      <span style={{ color: 'white', fontWeight: 600 }}>{os.optical_store.fantasy_name}</span>
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>VALOR TOTAL</span>
                    <span style={{ color: 'hsl(var(--success))', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <DollarSign size={13} />
                      {formatCurrency(os.total_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>BANCADA ATUAL</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: getStatusBadgeColor(os.status), color: getStatusTextColor(os.status)
                    }}>
                      {os.status}
                    </span>
                  </div>
                  
                  {/* Controles do workflow dependendo do Status */}
                  <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    
                    {/* Botão de Histórico de Rastreabilidade */}
                    <button 
                      className={`btn ${isHistoryExpanded ? 'btn-primary' : 'btn-outline'}`} 
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      onClick={() => {
                        if (isHistoryExpanded) {
                          setExpandedHistoryId(null);
                        } else {
                          setExpandedHistoryId(os.id);
                          setExpandedOsId(null);
                          setExpandedDetailsId(null);
                        }
                      }}
                    >
                      <History size={14} />
                      {isHistoryExpanded ? "Fechar Rastreabilidade" : "Rastreabilidade"}
                    </button>

                    {/* Botão para Ver Detalhes Técnicos (Split Screen) */}
                    <button 
                      className={`btn ${expandedDetailsId === os.id ? 'btn-primary' : 'btn-outline'}`} 
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      onClick={() => {
                        if (expandedDetailsId === os.id) {
                          setExpandedDetailsId(null);
                        } else {
                          setExpandedDetailsId(os.id);
                          setExpandedOsId(null);
                          setExpandedHistoryId(null);
                        }
                      }}
                    >
                      <Info size={14} />
                      {expandedDetailsId === os.id ? "Fechar Detalhes" : "Ver Detalhes"}
                    </button>

                    {os.status !== 'Cancelada' && os.status !== 'Expedição' && (
                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ borderColor: 'hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleOpenCancelModal(os.id)}
                      >
                        <Trash2 size={14} />
                        Cancelar OS
                      </button>
                    )}

                    {os.status === 'Recebida' && (
                      os.os_type === 'REPARO_SERVICO' ? (
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => handleStatusTransition(os.id, 'Montagem', 'OS de Reparo/Serviço encaminhada para a bancada técnica.', 'Serviço Técnico / Reparos')} 
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2563eb', borderColor: '#1d4ed8' }}
                        >
                          <Play size={14} /> Encaminhar p/ Bancada Técnica
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          toggleExpand(os);
                          setExpandedDetailsId(null);
                        }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {isExpanded ? "Fechar Alocação" : "Validar & Alocar"}
                        </button>
                      )
                    )}

                    {os.status === 'Separação' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusTransition(os.id, 'Produção', 'Separação física concluída no estoque.', 'Almoxarifado / Separação')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Play size={14} /> Confirmar Separação
                      </button>
                    )}

                    {['Produção', 'Surfaçagem'].includes(os.status) && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusTransition(os.id, 'Montagem', 'Processo de surfaçagem finalizado.', 'Surfaçagem / Produção')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Play size={14} /> Iniciar Montagem
                      </button>
                    )}

                    {os.status === 'Montagem' && (
                      <button className="btn btn-accent btn-sm" onClick={() => handleStatusTransition(os.id, 'CQ', 'Lentes facetadas e montadas no aro.', 'Corte & Montagem')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} /> Enviar para CQ
                      </button>
                    )}

                    {['CQ', 'CQ Final'].includes(os.status) && (
                      <button 
                        className={`btn btn-sm ${showingCQForm[os.id] ? 'btn-primary' : 'btn-accent'}`} 
                        onClick={() => {
                          const willShow = !showingCQForm[os.id];
                          setShowingCQForm(prev => ({ ...prev, [os.id]: willShow }));
                          if (willShow) initCQForm(os.id);
                        }} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <ClipboardList size={14} /> {showingCQForm[os.id] ? "Fechar Inspeção" : "Inspeção de CQ"}
                      </button>
                    )}

                    {['Expedição', 'EXPEDICAO'].includes(os.status) && (
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => {
                          handleStatusTransition(os.id, 'Concluída', 'Pacote finalizado e expedido com sucesso.', 'Expedição & Logística');
                          alert(`OS ${os.os_number} expedida e concluída com sucesso! Ela foi movida para a aba de Concluídas/Entregues e disponibilizada no Fechamento Financeiro.`);
                        }} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                      >
                        <Check size={14} /> Concluir & Despachar OS
                      </button>
                    )}


                    {/* Botão de Quebra Física em Chão de Fábrica */}
                    {['Separação', 'Produção', 'Surfaçagem', 'Montagem', 'CQ', 'CQ Final'].includes(os.status) && (
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ borderColor: 'hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))' }}
                        onClick={() => setShowingQuebraInput(prev => ({ ...prev, [os.id]: !prev[os.id] }))}
                      >
                        <AlertTriangle size={14} /> Interromper (Scrap)
                      </button>
                    )}

                  </div>
                </div>

                {/* Form Inputs adicionais para Transição de Status (Notas/Setor Customizados) */}
                {!['Recebida', 'Cancelada', 'CQ', 'CQ Final'].includes(os.status) && !showingQuebraInput[os.id] && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px', background: 'rgba(255,255,255,0.01)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '3px' }}>Notas de Transição Opcionais</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Lente facetada com cuidado especial" 
                        className="form-control"
                        style={{ fontSize: '0.8rem', height: '32px' }}
                        value={transitionNotes[os.id] || ''}
                        onChange={(e) => setTransitionNotes(prev => ({ ...prev, [os.id]: e.target.value }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '3px' }}>Setor / Bancada Customizado</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Bancada A-2" 
                        className="form-control"
                        style={{ fontSize: '0.8rem', height: '32px' }}
                        value={transitionSector[os.id] || ''}
                        onChange={(e) => setTransitionSector(prev => ({ ...prev, [os.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Formulário Estruturado de Controle de Qualidade (CQ) */}
                {['CQ', 'CQ Final'].includes(os.status) && showingCQForm[os.id] && (

                  <div style={{
                    marginTop: '20px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-glass)',
                    padding: '20px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ClipboardList size={16} style={{ color: 'hsl(var(--primary))' }} />
                      Inspeção de Controle de Qualidade (Checklist)
                    </h4>

                    {/* Checklist Oftálmico */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      {[
                        { key: 'grau', label: 'Grau / Dioptria', desc: 'Esférico e cilíndrico batem com a receita' },
                        { key: 'eixo', label: 'Eixo de Montagem', desc: 'Alinhamento do eixo correto' },
                        { key: 'prisma', label: 'Centralização Prismática', desc: 'Centralização do prisma sem desvios' },
                        { key: 'acabamento', label: 'Acabamento Físico', desc: 'Polimento, sem riscos, bisel perfeito' }
                      ].map(item => (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'start', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                          <input 
                            type="checkbox" 
                            id={`chk-${os.id}-${item.key}`}
                            checked={cqChecklist[os.id]?.[item.key] || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCqChecklist(prev => ({
                                ...prev,
                                [os.id]: {
                                  ...prev[os.id],
                                  [item.key]: checked
                                }
                              }));
                            }}
                            style={{ width: '16px', height: '16px', marginTop: '3px', cursor: 'pointer', accentColor: 'hsl(var(--primary))' }}
                          />
                          <div>
                            <label htmlFor={`chk-${os.id}-${item.key}`} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>{item.label}</label>
                            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', display: 'block' }}>{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Seleção do Resultado */}
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '6px' }}>Resultado da Inspeção</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {[
                          { key: 'APROVADO', label: 'Aprovado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
                          { key: 'RETRABALHO', label: 'Retrabalho', color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
                          { key: 'REPROVADO', label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
                        ].map(res => (
                          <button
                            key={res.key}
                            type="button"
                            onClick={() => setCqResult(prev => ({ ...prev, [os.id]: res.key }))}
                            style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: '8px',
                              border: cqResult[os.id] === res.key ? `2px solid ${res.color}` : `1px solid ${res.border}`,
                              background: cqResult[os.id] === res.key ? res.bg : 'transparent',
                              color: res.color,
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              backgroundColor: res.color, display: 'inline-block'
                            }} />
                            {res.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Destino de Retrabalho (Condicional) */}
                    {cqResult[os.id] === 'RETRABALHO' && (
                      <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        <label style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>Destino do Retrabalho *</label>
                        <select
                          className="form-control"
                          value={cqReworkDest[os.id] || 'Montagem'}
                          onChange={(e) => setCqReworkDest(prev => ({ ...prev, [os.id]: e.target.value }))}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <option value="Montagem">Montagem (Corte & Facetamento)</option>
                          <option value="Produção">Produção (Surfaçagem)</option>
                        </select>
                      </div>
                    )}

                    {/* Notas / Justificativa */}
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>
                        {['RETRABALHO', 'REPROVADO'].includes(cqResult[os.id]) ? 'Justificativa da Falha * (Obrigatória)' : 'Observações (Opcional)'}
                      </label>
                      <input 
                        type="text"
                        placeholder={['RETRABALHO', 'REPROVADO'].includes(cqResult[os.id]) ? 'Descreva detalhadamente o motivo da falha...' : 'Ex: Lentes limpas, prontas para faturamento e envio.'}
                        className="form-control"
                        value={cqNotes[os.id] || ''}
                        onChange={(e) => setCqNotes(prev => ({ ...prev, [os.id]: e.target.value }))}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>

                    {/* Botão de Confirmação */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleCQInspection(os.id)}
                        style={{
                          background: cqResult[os.id] === 'REPROVADO' ? 'hsl(var(--danger))' : cqResult[os.id] === 'RETRABALHO' ? '#eab308' : 'hsl(var(--success))',
                          borderColor: cqResult[os.id] === 'REPROVADO' ? 'hsl(var(--danger))' : cqResult[os.id] === 'RETRABALHO' ? '#eab308' : 'hsl(var(--success))',
                          color: 'white',
                          fontWeight: 700,
                          padding: '10px 20px'
                        }}
                      >
                        Confirmar Resultado de CQ
                      </button>
                    </div>
                  </div>
                )}

                {/* Bloco de Input de Justificativa de Quebra */}
                {showingQuebraInput[os.id] && (
                  <div style={{ marginTop: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '15px', borderRadius: '10px' }}>
                    <label className="form-label" style={{ color: 'hsl(var(--danger))' }}>Justificativa da Quebra da Lente (Scrap)</label>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                      <input 
                        type="text" 
                        placeholder="Ex: Trincou na facetadora ao furar" 
                        className="form-control"
                        value={quebraForms[os.id] || ''}
                        onChange={(e) => setQuebraForms(prev => ({ ...prev, [os.id]: e.target.value }))}
                      />
                      <button className="btn btn-primary" style={{ background: 'hsl(var(--danger))', color: 'white' }} onClick={() => handleQuebraReprocess(os.id)}>
                        Interromper e Retornar à Separação
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel do Histórico de Rastreabilidade Detalhado (Timeline) */}
                {isHistoryExpanded && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                    <h4 style={{ fontSize: '0.95rem', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClipboardList size={16} style={{ color: 'hsl(var(--secondary))' }} />
                      Rastreabilidade de Produção (Workflow History)
                    </h4>
                    
                    {os.workflow_history && os.workflow_history.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '20px', marginLeft: '10px', borderLeft: '2px solid var(--border-glass)' }}>
                        {os.workflow_history.map((h, i) => (
                          <div key={h.id} style={{ position: 'relative', marginBottom: '20px' }}>
                            {/* Ponto na linha vertical */}
                            <div style={{
                              position: 'absolute',
                              left: '-27px',
                              top: '4px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: getStatusTextColor(h.new_status),
                              border: '2px solid rgba(8,10,18,0.9)',
                              boxShadow: `0 0 10px ${getStatusTextColor(h.new_status)}`
                            }} />

                            <div className="glass-panel" style={{ padding: '12px 15px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                                  background: getStatusBadgeColor(h.new_status), color: getStatusTextColor(h.new_status)
                                }}>
                                  {h.new_status}
                                </span>
                                
                                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} />
                                  {formatDateTime(h.changed_at)}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <User size={12} style={{ color: 'hsl(var(--secondary))' }} />
                                  Operador: <strong style={{ color: 'white', marginLeft: '3px' }}>{h.operator ? h.operator.name : 'Sistema'}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <MapPin size={12} style={{ color: 'hsl(var(--primary))' }} />
                                  Setor: <strong style={{ color: 'white', marginLeft: '3px' }}>{h.sector || 'N/A'}</strong>
                                </div>
                              </div>

                              {h.operator_notes && (
                                <p style={{ fontSize: '0.8rem', color: 'white', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                                  "{h.operator_notes}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Nenhum log registrado de rastreabilidade.</div>
                    )}
                  </div>
                )}

                {/* Bloco de Detalhes Técnicos Integrados (Split Screen com Desenho SVG e Timeline) */}
                {expandedDetailsId === os.id && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                    <OSDetail osId={os.id} onClose={() => setExpandedDetailsId(null)} />
                  </div>
                )}

                {/* Bloco Formulário de Alocação / Validação Geométrica */}
                {isExpanded && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                    {os.os_type === 'REPARO_SERVICO' ? (
                      <div className="glass-panel" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <h4 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          🛠️ Ordem de Serviço de Reparo / Serviço Técnico (Sem Lentes)
                        </h4>
                        <p style={{ fontSize: '0.88rem', color: 'white', margin: 0, lineHeight: '1.5' }}>
                          Esta OS é exclusiva para serviços técnicos e reparos em armações e não necessita de reserva de lentes no estoque nem validação de diâmetro geométrico.
                        </p>
                        {os.clinical_notes && (
                          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px', borderLeft: '3px solid #60a5fa' }}>
                            <strong style={{ color: 'white' }}>Descrição / Instruções do Serviço:</strong> {os.clinical_notes}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'end' }}>
                          <button className="btn btn-secondary" onClick={() => setExpandedOsId(null)}>
                            Fechar
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ background: '#2563eb', borderColor: '#1d4ed8' }}
                            onClick={() => {
                              setExpandedOsId(null);
                              handleStatusTransition(os.id, 'Montagem', 'OS de Reparo/Serviço encaminhada para a bancada técnica.', 'Serviço Técnico / Reparos');
                            }}
                          >
                            Confirmar e Encaminhar p/ Bancada Técnica (Montagem)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 style={{ fontSize: '0.95rem', color: 'white', marginBottom: '15px' }}>Validação Geométrica e Reserva de Estoque</h4>
                        
                        <div className="form-grid">
                          {/* Graus (Apenas Leitura) */}
                          <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary))', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>OLHO DIREITO (OD)</span>
                            <p style={{ fontSize: '0.85rem' }}>Esférico: <strong>{os.od_spherical ? parseFloat(os.od_spherical).toFixed(2) : '0.00'}</strong> | Cilíndrico: <strong>{os.od_cylindrical ? parseFloat(os.od_cylindrical).toFixed(2) : '0.00'}</strong></p>
                            <p style={{ fontSize: '0.85rem' }}>Eixo: <strong>{os.od_axis ? `${os.od_axis}°` : 'N/A'}</strong></p>
                            {os.od_addition > 0 && <p style={{ fontSize: '0.85rem' }}>Adição: <strong>+{parseFloat(os.od_addition).toFixed(2)}</strong></p>}
                            {os.od_prism && <p style={{ fontSize: '0.85rem' }}>Prisma: <strong>{os.od_prism}</strong></p>}
                            {os.od_height > 0 && <p style={{ fontSize: '0.85rem' }}>Altura: <strong>{parseFloat(os.od_height).toFixed(2)}mm</strong></p>}
                          </div>
                          <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary))', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>OLHO ESQUERDO (OE)</span>
                            <p style={{ fontSize: '0.85rem' }}>Esférico: <strong>{os.oe_spherical ? parseFloat(os.oe_spherical).toFixed(2) : '0.00'}</strong> | Cilíndrico: <strong>{os.oe_cylindrical ? parseFloat(os.oe_cylindrical).toFixed(2) : '0.00'}</strong></p>
                            <p style={{ fontSize: '0.85rem' }}>Eixo: <strong>{os.oe_axis ? `${os.oe_axis}°` : 'N/A'}</strong></p>
                            {os.oe_addition > 0 && <p style={{ fontSize: '0.85rem' }}>Adição: <strong>+{parseFloat(os.oe_addition).toFixed(2)}</strong></p>}
                            {os.oe_prism && <p style={{ fontSize: '0.85rem' }}>Prisma: <strong>{os.oe_prism}</strong></p>}
                            {os.oe_height > 0 && <p style={{ fontSize: '0.85rem' }}>Altura: <strong>{parseFloat(os.oe_height).toFixed(2)}mm</strong></p>}
                          </div>
                        </div>

                        <div className="form-grid" style={{ marginTop: '20px' }}>
                          <div className="form-group">
                            <label className="form-label">Modelo de Lente (Estoque)</label>
                            <select 
                              className="form-control"
                              value={form.lens_model_id || ''}
                              onChange={(e) => handleFormChange(os.id, 'lens_model_id', e.target.value)}
                            >
                              <option value="">Selecione...</option>
                              {models.map(m => (
                                <option key={m.id} value={m.id}>{m.brand} | {m.material} | Ø{m.diameter}mm (Custo: R$ {parseFloat(m.cost_price).toFixed(2)})</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Medidas Armação (A / Ponte / ED) em mm</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="A (Aro)" className="form-control" value={form.frame_a || ''} onChange={(e) => handleFormChange(os.id, 'frame_a', e.target.value)} />
                              <input type="number" placeholder="Ponte" className="form-control" value={form.frame_bridge || ''} onChange={(e) => handleFormChange(os.id, 'frame_bridge', e.target.value)} />
                              <input type="number" placeholder="ED (Diagonal)" className="form-control" value={form.frame_ed || ''} onChange={(e) => handleFormChange(os.id, 'frame_ed', e.target.value)} />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Distância Nasopupilar DNP (OD / OE) em mm</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" step="0.5" placeholder="OD" className="form-control" value={form.od_dnp || ''} onChange={(e) => handleFormChange(os.id, 'od_dnp', e.target.value)} />
                              <input type="number" step="0.5" placeholder="OE" className="form-control" value={form.oe_dnp || ''} onChange={(e) => handleFormChange(os.id, 'oe_dnp', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {errorMsg && (
                          <div style={{ 
                            color: 'hsl(var(--danger))', 
                            fontSize: '0.85rem', 
                            marginTop: '15px', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center'
                          }}>
                            <Info size={16} /> <span>{errorMsg}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'end' }}>
                          <button className="btn btn-secondary" onClick={() => setExpandedOsId(null)}>
                            Cancelar
                          </button>
                          <button 
                            className="btn btn-primary" 
                            disabled={allocatingId === os.id}
                            onClick={() => handleAllocate(os.id)}
                          >
                            {allocatingId === os.id ? "Alocando..." : "Validar Geometria & Reservar"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
          <p>Nenhuma Ordem de Serviço encontrada nesta bancada.</p>
        </div>
      )}
      {/* Modal de Cancelamento de OS */}
      {showingCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'rgba(255, 255, 255, 0.98)', color: 'hsl(var(--text-primary))' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--danger))', marginBottom: '15px' }}>
              <AlertTriangle style={{ color: 'hsl(var(--danger))' }} />
              Cancelar Ordem de Serviço
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'hsl(var(--text-secondary))' }}>
              Tem certeza que deseja cancelar esta Ordem de Serviço? As lentes alocadas serão devolvidas ao estoque. Esta ação não pode ser desfeita.
            </p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ color: 'hsl(var(--danger))' }}>Justificativa do Cancelamento (Obrigatória)</label>
              <textarea
                className="form-control"
                placeholder="Informe o motivo detalhado do cancelamento..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                style={{ resize: 'none', fontSize: '0.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowingCancelModal(false);
                  setCancelOsId(null);
                  setCancelReason('');
                }}
              >
                Voltar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger))', color: 'white' }}
                onClick={handleCancelOS}
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Bipadora de OS para Workflow */}
      {showingBipadoraModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'rgba(255, 255, 255, 0.98)', color: 'hsl(var(--text-primary))', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={18} style={{ color: 'hsl(var(--primary))' }} /> Bipar OS (Entrada em Bancada)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginBottom: '15px' }}>
              Escolha o leitor e bipa o código de barras da OS para avançá-la de bancada.
            </p>

            {/* Seletor de modo */}
            <div className="scanner-mode-selector" style={{ marginBottom: '20px' }}>
              <button 
                type="button"
                className={`scanner-mode-btn ${bipadoraMode === 'usb' ? 'active' : ''}`}
                onClick={() => {
                  setBipadoraMode('usb');
                  setBipadoraResult(null);
                }}
              >
                <Keyboard size={14} /> Leitor USB
              </button>
              <button 
                type="button"
                className={`scanner-mode-btn ${bipadoraMode === 'camera' ? 'active' : ''}`}
                onClick={() => {
                  setBipadoraMode('camera');
                  setBipadoraResult(null);
                }}
              >
                <Camera size={14} /> Câmera Celular
              </button>
            </div>

            {/* Conteúdo dinâmico do Scanner */}
            {bipadoraMode === 'usb' && !bipadoraResult && (
              <div 
                className="usb-scanner-panel active"
                onClick={focusBipadoraInput}
                style={{ cursor: 'pointer', minHeight: '180px', padding: '20px' }}
              >
                <div className="usb-scanner-laser" />
                <form onSubmit={(e) => { e.preventDefault(); handleBipadoraSubmit(); }} style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
                  <input
                    ref={bipadoraInputRef}
                    type="text"
                    className="usb-hidden-input"
                    value={bipadoraInputValue}
                    onChange={(e) => setBipadoraInputValue(e.target.value)}
                    onBlur={() => setTimeout(focusBipadoraInput, 100)}
                    autoComplete="off"
                  />
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <Barcode size={36} style={{ color: 'hsl(var(--primary))', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Leitor USB Pronto</span>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Bipe o código de barras da OS...</span>
                </div>
              </div>
            )}

            {bipadoraMode === 'camera' && !bipadoraResult && (
              <div className="scanner-viewport" style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden' }}>
                <div className="scanner-laser" />
                <div id="workflow-reader" style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            )}

            {/* Resultado ou carregamento */}
            {bipadoraLoading && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <RefreshCw className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))', margin: '0 auto 8px auto' }} />
                <span>Processando movimentação de bancada...</span>
              </div>
            )}

            {bipadoraResult && (
              <div className="glass-panel" style={{ padding: '15px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: bipadoraResult.type === 'success' ? '1px solid hsl(var(--success))' : '1px solid hsl(var(--danger))' }}>
                {bipadoraResult.type === 'success' ? (
                  <CheckCircle size={32} style={{ color: 'hsl(var(--success))', marginBottom: '8px', margin: '0 auto' }} />
                ) : (
                  <AlertTriangle size={32} style={{ color: 'hsl(var(--danger))', marginBottom: '8px', margin: '0 auto' }} />
                )}
                <h4 style={{ margin: '8px 0 4px 0', fontSize: '0.95rem' }}>{bipadoraResult.message}</h4>
                {bipadoraResult.detail && <p style={{ fontSize: '0.8rem', margin: 0 }}>{bipadoraResult.detail}</p>}
                
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  style={{ marginTop: '15px' }}
                  onClick={() => {
                    setBipadoraResult(null);
                    if (bipadoraMode === 'usb') setTimeout(focusBipadoraInput, 100);
                  }}
                >
                  Continuar Lendo
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-glass)', paddingTop: '15px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowingBipadoraModal(false);
                  setBipadoraResult(null);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OSWorkflow;
