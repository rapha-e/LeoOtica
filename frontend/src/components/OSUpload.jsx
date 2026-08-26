import React, { useState, useEffect } from 'react';
import { FileImage, Scan, CheckCircle2, AlertCircle, RefreshCw, Layers, Sparkles, User, FileText, UserCheck, Check, Info } from 'lucide-react';
import { OSService, OpticalStoreService, LensService } from '../services/api';
import GerenciadorItensOS from './GerenciadorItensOS';
import OCRValidationView from './OCRValidationView';


const OSUpload = ({ onOSCreated }) => {
  const [formMode, setFormMode] = useState('ia'); // 'ia' ou 'manual'
  const [opticalStores, setOpticalStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  
  // Estado para upload de arquivo (IA)
  const [file, setFile] = useState(null);
  const [showOcrValidation, setShowOcrValidation] = useState(false);
  
  // Modelos de lentes e estado do formulário manual
  const [models, setModels] = useState([]);
  const [manualForm, setManualForm] = useState({
    client_name: '',
    doctor_name: '',
    od_spherical: '',
    od_cylindrical: '',
    od_axis: '',
    od_addition: '',
    od_dnp: '',
    od_prism: '',
    od_height: '',
    oe_spherical: '',
    oe_cylindrical: '',
    oe_axis: '',
    oe_addition: '',
    oe_dnp: '',
    oe_prism: '',
    oe_height: '',
    frame_a: '52',
    frame_bridge: '18',
    frame_ed: '54',
    lens_model_id: '',
    clinical_notes: ''
  });


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdOS, setCreatedOS] = useState(null);
  const [currentTotal, setCurrentTotal] = useState(0);

  const [delinquencyAlert, setDelinquencyAlert] = useState(null);

  // Carrega as óticas comerciais e modelos de lentes
  useEffect(() => {
    const fetchStores = async () => {
      setLoadingStores(true);
      try {
        const response = await OpticalStoreService.list('', true); // Apenas óticas ativas
        setOpticalStores(response.data);
        if (response.data.length > 0) {
          setSelectedStoreId(response.data[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar óticas comerciais:", err);
      } finally {
        setLoadingStores(false);
      }
    };

    const fetchModels = async () => {
      try {
        const response = await LensService.getModels();
        setModels(response.data);
        if (response.data.length > 0) {
          setManualForm(prev => ({ ...prev, lens_model_id: response.data[0].id }));
        }
      } catch (err) {
        console.error("Erro ao carregar modelos de lentes:", err);
      }
    };

    fetchStores();
    fetchModels();
  }, []);

  // Efeito para checar inadimplência ao mudar de ótica
  useEffect(() => {
    if (selectedStoreId) {
      const token = localStorage.getItem('token');
      fetch(`/api/v1/finance-corp/delinquency-check/${selectedStoreId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.is_delinquent) {
            setDelinquencyAlert(data);
          } else {
            setDelinquencyAlert(null);
          }
        })
        .catch(() => setDelinquencyAlert(null));
    }
  }, [selectedStoreId]);



  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleManualFormChange = (field, val) => {
    setManualForm(prev => ({ ...prev, [field]: val }));
  };

  // Redireciona para a tela de Validação Lado a Lado
  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;
    if (!selectedStoreId) {
      setError("Selecione uma Ótica Comercial de faturamento.");
      return;
    }
    setError(null);
    setShowOcrValidation(true);
  };


  // Criação Manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStoreId) {
      setError("Selecione uma Ótica Comercial de faturamento.");
      return;
    }

    // Validações visuais de eixo
    const odAxis = manualForm.od_axis ? parseInt(manualForm.od_axis) : null;
    const oeAxis = manualForm.oe_axis ? parseInt(manualForm.oe_axis) : null;
    if ((odAxis !== null && (odAxis < 0 || odAxis > 180)) || (oeAxis !== null && (oeAxis < 0 || oeAxis > 180))) {
      setError("O eixo de astigmatismo deve estar entre 0° e 180°.");
      return;
    }

    setLoading(true);
    setError(null);

    const parseLocaleFloat = (val) => {
      if (val === undefined || val === null || val === '') return null;
      const str = String(val).replace(',', '.');
      const parsed = parseFloat(str);
      return isNaN(parsed) ? null : parsed;
    };

    const payload = {
      optical_store_id: selectedStoreId,
      os_type: formMode === 'reparo' ? 'REPARO_SERVICO' : 'PADRAO',
      os_number: manualForm.client_name || null,
      client_name: manualForm.client_name || null,

      od_spherical: parseLocaleFloat(manualForm.od_spherical),
      od_cylindrical: parseLocaleFloat(manualForm.od_cylindrical),
      od_axis: odAxis,
      od_addition: parseLocaleFloat(manualForm.od_addition),
      od_dnp: parseLocaleFloat(manualForm.od_dnp),
      od_prism: manualForm.od_prism || null,
      od_height: parseLocaleFloat(manualForm.od_height),
      oe_spherical: parseLocaleFloat(manualForm.oe_spherical),
      oe_cylindrical: parseLocaleFloat(manualForm.oe_cylindrical),
      oe_axis: oeAxis,
      oe_addition: parseLocaleFloat(manualForm.oe_addition),
      oe_dnp: parseLocaleFloat(manualForm.oe_dnp),
      oe_prism: manualForm.oe_prism || null,
      oe_height: parseLocaleFloat(manualForm.oe_height),
      frame_a: parseLocaleFloat(manualForm.frame_a),
      frame_bridge: parseLocaleFloat(manualForm.frame_bridge),
      frame_ed: parseLocaleFloat(manualForm.frame_ed),
      lens_model_id: manualForm.lens_model_id || null,
      clinical_notes: manualForm.clinical_notes || null
    };


    try {
      const response = await OSService.create(payload);
      setCreatedOS(response.data);
      setCurrentTotal(response.data.total_amount || 0);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Erro ao criar Ordem de Serviço manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onOSCreated) {
      onOSCreated(createdOS);
    }
    setCreatedOS(null);
    setManualForm({
      client_name: '',
      od_spherical: '',
      od_cylindrical: '',
      od_axis: '',
      od_addition: '',
      od_dnp: '',
      od_prism: '',
      od_height: '',
      oe_spherical: '',
      oe_cylindrical: '',
      oe_axis: '',
      oe_addition: '',
      oe_dnp: '',
      oe_prism: '',
      oe_height: '',
      frame_a: '52',
      frame_bridge: '18',
      frame_ed: '54',
      lens_model_id: models.length > 0 ? models[0].id : '',
      clinical_notes: ''
    });
  };

  if (showOcrValidation && file) {
    return (
      <OCRValidationView 
        file={file} 
        opticalStoreId={selectedStoreId} 
        onCancel={() => { setShowOcrValidation(false); setFile(null); }} 
        onConfirm={(os) => { setCreatedOS(os); setShowOcrValidation(false); setFile(null); setCurrentTotal(os.total_amount || 0); }} 
      />
    );
  }

  return (

    <div style={{ width: '100%', maxWidth: createdOS ? '900px' : '700px', margin: '0 auto' }}>
      
      {/* Fase 1: Cadastro de Cabeçalho da OS */}
      {!createdOS ? (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ color: 'hsl(var(--primary))' }} /> Recepção de Ordem de Serviço
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
              Registre a receita médica para iniciar a validação geométrica de corte e o faturamento automático.
            </p>
          </div>

          {/* Seleção de Ótica Comercial (Obrigatória em ambos) */}
          <div className="form-group" style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.01)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={16} style={{ color: 'hsl(var(--secondary))' }} />
              Ótica Comercial de Faturamento *
            </label>
            {loadingStores ? (
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Buscando óticas comerciais...</span>
            ) : (
              <select 
                className="form-control" 
                value={selectedStoreId} 
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={{ marginTop: '8px' }}
                required
              >
                <option value="">Selecione a ótica para faturamento...</option>
                {opticalStores.map(store => (
                  <option key={store.id} value={store.id}>{store.fantasy_name} ({store.corporate_name}) - CNPJ: {store.cnpj}</option>
                ))}
              </select>
            )}
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>
              Necessário para aplicar a tabela de preços vigente e os descontos contratuais no faturamento.
            </span>
          </div>

          {delinquencyAlert && (
            <div style={{
              background: delinquencyAlert.policy === 'POLICY_BLOCK' ? 'rgba(239,68,68,0.1)' : delinquencyAlert.policy === 'POLICY_AUTHORIZE' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
              border: `1px solid ${delinquencyAlert.policy === 'POLICY_BLOCK' ? '#ef4444' : delinquencyAlert.policy === 'POLICY_AUTHORIZE' ? '#f59e0b' : '#3b82f6'}`,
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
              fontSize: '0.85rem'
            }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: delinquencyAlert.policy === 'POLICY_BLOCK' ? '#ef4444' : delinquencyAlert.policy === 'POLICY_AUTHORIZE' ? '#d97706' : '#2563eb' }}>
                <AlertCircle size={18} />
                {delinquencyAlert.policy === 'POLICY_BLOCK' ? 'ÓTICA BLOQUEADA POR INADIMPLÊNCIA (POLÍTICA 3)' : delinquencyAlert.policy === 'POLICY_AUTHORIZE' ? 'ATENÇÃO: ÓTICA REQUER AUTORIZAÇÃO ADMIN (POLÍTICA 2)' : 'ALERTA FINANCEIRO: FATICAS VENCIDAS (POLÍTICA 1)'}
              </div>
              <div style={{ marginTop: '6px', color: 'hsl(var(--text-primary))' }}>
                Esta ótica possui <strong>{delinquencyAlert.overdue_count} fatura(s) vencida(s)</strong> no total de <strong>R$ {delinquencyAlert.total_overdue_amount?.toFixed(2)}</strong> (Maior atraso: {delinquencyAlert.max_overdue_days} dias).
              </div>
            </div>
          )}


          {/* Abas de Entrada */}
          <div className="nav-tabs" style={{ marginBottom: '20px' }}>
            <button 
              className={`tab-btn ${formMode === 'ia' ? 'active' : ''}`} 
              onClick={() => { setFormMode('ia'); setError(null); }}
              type="button"
            >
              <Sparkles size={14} /> Leitura com IA (OCR)
            </button>
            <button 
              className={`tab-btn ${formMode === 'manual' ? 'active' : ''}`} 
              onClick={() => { setFormMode('manual'); setError(null); }}
              type="button"
            >
              <FileText size={14} /> OS Padrão (Com Lentes)
            </button>
            <button 
              className={`tab-btn ${formMode === 'reparo' ? 'active' : ''}`} 
              onClick={() => { setFormMode('reparo'); setError(null); }}
              type="button"
            >
              <FileText size={14} /> OS de Reparo / Serviços (Sem Lentes)
            </button>
          </div>


          {error && (
            <div style={{ 
              color: 'hsl(var(--danger))', 
              fontSize: '0.85rem', 
              display: 'flex', 
              gap: '6px', 
              alignItems: 'center',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}

          {/* MODO IA (OCR) */}
          {formMode === 'ia' && (
            <div>
              <div style={{ 
                padding: '12px 15px', 
                borderRadius: '10px', 
                background: 'rgba(234, 179, 8, 0.05)', 
                border: '1px solid rgba(234, 179, 8, 0.15)', 
                marginBottom: '20px', 
                fontSize: '0.8rem' 
              }}>
                <strong style={{ color: 'hsl(var(--warning))', display: 'block', marginBottom: '5px' }}>💡 Dica de Testes rápidos:</strong>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: 0 }}>
                  Você pode arrastar imagens de receitas como <strong style={{ color: 'white' }}>receita_sucesso.jpg</strong> ou <strong style={{ color: 'white' }}>receita_transposicao.jpg</strong> para testar a inteligência do fluxo.
                </p>
              </div>

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: '12px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'rgba(8, 10, 18, 0.4)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                  <FileImage size={44} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
                  {file ? (
                    <div>
                      <p style={{ color: 'white', fontWeight: 600 }}>{file.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: 'white', fontWeight: 600 }}>Arraste ou selecione a imagem da receita</p>
                      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>PNG, JPG ou JPEG</p>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading || !file}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', fontWeight: 700 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} /> Extraindo Receita com IA...
                    </>
                  ) : (
                    <>
                      <Scan size={18} /> Escanear e Iniciar OS
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* MODO MANUAL */}
          {formMode === 'manual' && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label className="form-label">NÚMERO DA ORDEM DE SERVIÇO *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: OS-2026-0001" 
                    className="form-control"
                    value={manualForm.client_name}
                    onChange={(e) => handleManualFormChange('client_name', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Bloco de Receita (Olho Direito e Olho Esquerdo) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                
                {/* Olho Direito */}
                <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'hsl(var(--secondary))', marginBottom: '15px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                    Olho Direito (OD)
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Esférico</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.od_spherical} onChange={(e) => handleManualFormChange('od_spherical', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Cilíndrico</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.od_cylindrical} onChange={(e) => handleManualFormChange('od_cylindrical', e.target.value)} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          Eixo (°)
                          {manualForm.od_axis && (parseInt(manualForm.od_axis) < 0 || parseInt(manualForm.od_axis) > 180) && (
                            <span style={{ color: 'hsl(var(--danger))', fontSize: '0.7rem', fontWeight: 'bold' }}>Inválido (&gt;180)</span>
                          )}
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max="180" 
                          placeholder="180" 
                          className="form-control" 
                          value={manualForm.od_axis} 
                          onChange={(e) => handleManualFormChange('od_axis', e.target.value)} 
                          style={manualForm.od_axis && (parseInt(manualForm.od_axis) < 0 || parseInt(manualForm.od_axis) > 180) ? { borderColor: 'hsl(var(--danger))', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Adição</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.od_addition} onChange={(e) => handleManualFormChange('od_addition', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">DNP (mm)</label>
                        <input type="number" step="0.5" placeholder="32.0" className="form-control" value={manualForm.od_dnp} onChange={(e) => handleManualFormChange('od_dnp', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Altura (mm)</label>
                        <input type="number" step="0.5" placeholder="18.0" className="form-control" value={manualForm.od_height} onChange={(e) => handleManualFormChange('od_height', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Prisma</label>
                      <input type="text" placeholder="Ex: 1.5 D base interna" className="form-control" value={manualForm.od_prism} onChange={(e) => handleManualFormChange('od_prism', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Olho Esquerdo */}
                <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'hsl(var(--secondary))', marginBottom: '15px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                    Olho Esquerdo (OE)
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Esférico</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.oe_spherical} onChange={(e) => handleManualFormChange('oe_spherical', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Cilíndrico</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.oe_cylindrical} onChange={(e) => handleManualFormChange('oe_cylindrical', e.target.value)} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          Eixo (°)
                          {manualForm.oe_axis && (parseInt(manualForm.oe_axis) < 0 || parseInt(manualForm.oe_axis) > 180) && (
                            <span style={{ color: 'hsl(var(--danger))', fontSize: '0.7rem', fontWeight: 'bold' }}>Inválido (&gt;180)</span>
                          )}
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max="180" 
                          placeholder="180" 
                          className="form-control" 
                          value={manualForm.oe_axis} 
                          onChange={(e) => handleManualFormChange('oe_axis', e.target.value)} 
                          style={manualForm.oe_axis && (parseInt(manualForm.oe_axis) < 0 || parseInt(manualForm.oe_axis) > 180) ? { borderColor: 'hsl(var(--danger))', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Adição</label>
                        <input type="number" step="0.25" placeholder="0.00" className="form-control" value={manualForm.oe_addition} onChange={(e) => handleManualFormChange('oe_addition', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">DNP (mm)</label>
                        <input type="number" step="0.5" placeholder="32.0" className="form-control" value={manualForm.oe_dnp} onChange={(e) => handleManualFormChange('oe_dnp', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Altura (mm)</label>
                        <input type="number" step="0.5" placeholder="18.0" className="form-control" value={manualForm.oe_height} onChange={(e) => handleManualFormChange('oe_height', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Prisma</label>
                      <input type="text" placeholder="Ex: 2.0 D base inferior" className="form-control" value={manualForm.oe_prism} onChange={(e) => handleManualFormChange('oe_prism', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Medidas da Armação & Alocação na Criação Manual */}
              <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <Layers size={15} style={{ color: 'hsl(var(--primary))' }} />
                  Dados da Armação & Lente (Gatilho de Alocação Imediata)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '15px' }}>
                  <div className="form-group">
                    <label className="form-label">Modelo de Lente base no Estoque</label>
                    <select 
                      className="form-control"
                      value={manualForm.lens_model_id}
                      onChange={(e) => handleManualFormChange('lens_model_id', e.target.value)}
                    >
                      <option value="">Selecione a lente para alocação...</option>
                      {models.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.brand || m.name} — Tratamento: {m.treatment || 'Incolor'} | {m.material || 'Resina'} (n={m.refractive_index}) (Custo: R$ {parseFloat(m.cost_price || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tamanho da Armação (Aro horizontal / Ponte / Diagonal ED) em mm</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" placeholder="A (Aro)" className="form-control" value={manualForm.frame_a} onChange={(e) => handleManualFormChange('frame_a', e.target.value)} />
                      <input type="number" placeholder="Ponte" className="form-control" value={manualForm.frame_bridge} onChange={(e) => handleManualFormChange('frame_bridge', e.target.value)} />
                      <input type="number" placeholder="ED (Diag.)" className="form-control" value={manualForm.frame_ed} onChange={(e) => handleManualFormChange('frame_ed', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações Clínicas */}
              <div className="form-group">
                <label className="form-label">Observações Clínicas (Indexação Semântica IA)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Paciente reclama de reflexos fortes no computador. Exige filtro azul." 
                  className="form-control"
                  value={manualForm.clinical_notes}
                  onChange={(e) => handleManualFormChange('clinical_notes', e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', fontWeight: 700, marginTop: '10px' }}
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Abrir OS Manualmente'}
              </button>
            </form>
          )}

          {/* MODO REPARO / SERVIÇOS */}
          {formMode === 'reparo' && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label className="form-label">NÚMERO DA ORDEM DE SERVIÇO *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: OS-2026-0001" 
                    className="form-control"
                    value={manualForm.client_name}
                    onChange={(e) => handleManualFormChange('client_name', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição Detalhada do Serviço / Reparo *</label>
                <textarea 
                  placeholder="Descreva o serviço a ser realizado. Ex: Solda de plaqueta e ajuste das hastes da armação." 
                  className="form-control"
                  rows={4}
                  value={manualForm.clinical_notes}
                  onChange={(e) => handleManualFormChange('clinical_notes', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(8, 10, 18, 0.4)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', fontWeight: 700, marginTop: '10px' }}
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Abrir OS de Reparo / Serviço'}
              </button>
            </form>
          )}
        </div>
      ) : (
        
        /* Fase 2: Exibir OS criada + Adição de itens de faturamento */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Alerta de Sucesso */}
          <div className="glass-panel" style={{ padding: '20px', borderLeft: '5px solid hsl(var(--success))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'hsl(var(--success))', marginBottom: '12px' }}>
              <CheckCircle2 size={28} />
              <h3 style={{ color: 'white', fontSize: '1.25rem', margin: 0 }}>OS {createdOS.os_number} criada com sucesso!</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div>Ordem de Serviço: <strong style={{ color: 'white' }}>{createdOS.client_name || createdOS.os_number || 'N/A'}</strong></div>
              <div>Status: <span style={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}>{createdOS.status}</span></div>
            </div>

            {/* Resumo da Receita */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.85rem' }}>
              <div style={{ borderRight: '1px solid var(--border-glass)', paddingRight: '15px' }}>
                <span style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>OLHO DIREITO (OD)</span>
                <p style={{ margin: '3px 0' }}>Esf: <strong>{createdOS.od_spherical ? parseFloat(createdOS.od_spherical).toFixed(2) : '0.00'}</strong> | Cil: <strong>{createdOS.od_cylindrical ? parseFloat(createdOS.od_cylindrical).toFixed(2) : '0.00'}</strong></p>
                <p style={{ margin: '3px 0' }}>Eixo: <strong>{createdOS.od_axis ? `${createdOS.od_axis}°` : 'N/A'}</strong> | Adição: <strong>{createdOS.od_addition ? `+${parseFloat(createdOS.od_addition).toFixed(2)}` : 'N/A'}</strong></p>
                <p style={{ margin: '3px 0' }}>DNP: <strong>{createdOS.od_dnp ? `${parseFloat(createdOS.od_dnp).toFixed(2)}mm` : 'N/A'}</strong> | Altura: <strong>{createdOS.od_height ? `${parseFloat(createdOS.od_height).toFixed(2)}mm` : 'N/A'}</strong></p>
                {createdOS.od_prism && <p style={{ margin: '3px 0' }}>Prisma: <strong>{createdOS.od_prism}</strong></p>}
              </div>
              <div style={{ paddingLeft: '15px' }}>
                <span style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>OLHO ESQUERDO (OE)</span>
                <p style={{ margin: '3px 0' }}>Esf: <strong>{createdOS.oe_spherical ? parseFloat(createdOS.oe_spherical).toFixed(2) : '0.00'}</strong> | Cil: <strong>{createdOS.oe_cylindrical ? parseFloat(createdOS.oe_cylindrical).toFixed(2) : '0.00'}</strong></p>
                <p style={{ margin: '3px 0' }}>Eixo: <strong>{createdOS.oe_axis ? `${createdOS.oe_axis}°` : 'N/A'}</strong> | Adição: <strong>{createdOS.oe_addition ? `+${parseFloat(createdOS.oe_addition).toFixed(2)}` : 'N/A'}</strong></p>
                <p style={{ margin: '3px 0' }}>DNP: <strong>{createdOS.oe_dnp ? `${parseFloat(createdOS.oe_dnp).toFixed(2)}mm` : 'N/A'}</strong> | Altura: <strong>{createdOS.oe_height ? `${parseFloat(createdOS.oe_height).toFixed(2)}mm` : 'N/A'}</strong></p>
                {createdOS.oe_prism && <p style={{ margin: '3px 0' }}>Prisma: <strong>{createdOS.oe_prism}</strong></p>}
              </div>
            </div>
          </div>

          {/* Gerenciador de Itens de Faturamento da OS */}
          <GerenciadorItensOS 
            osId={createdOS.id} 
            opticalStoreId={createdOS.optical_store_id} 
            onItemsUpdated={(newTotal) => setCurrentTotal(newTotal)}
          />

          {/* Botões de Ação Final */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
              A OS foi inserida na bancada <strong>Recebida</strong>.
            </span>
            <button 
              className="btn btn-primary" 
              onClick={handleFinish} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: 700, boxShadow: '0 4px 14px rgba(hsl(var(--primary)), 0.3)' }}
            >
              <Check size={16} /> Finalizar e ir para Bancadas
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default OSUpload;
