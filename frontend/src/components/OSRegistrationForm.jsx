import React, { useState, useEffect } from 'react';
import {
  FileText,
  Store,
  Layers,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Save,
  Plus,
  RefreshCw,
  Eye,
  DollarSign,
  PackageCheck,
  Info,
  Clock,
  ArrowRight,
  Check,
  AlertTriangle,
  Wrench,
  FileImage
} from 'lucide-react';
import api, { LensService, OSService } from '../services/api';
import { osService, formatApiError } from '../services/osService';

export default function OSRegistrationForm({ onOSCreated, onCancel }) {
  const [activeStep, setActiveStep] = useState('ADMIN'); // 'ADMIN', 'PRESCRIPTION', 'PRODUCT', 'FRAME', 'OBSERVATIONS'

  // Listas de apoio carregadas da API
  const [opticalStores, setOpticalStores] = useState([]);
  const [lensModels, setLensModels] = useState([]);
  const [technicalServices, setTechnicalServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Seleções do formulário
  const [osType, setOsType] = useState('PADRAO'); // 'PADRAO' ou 'REPARO_SERVICO'
  const [selectedMatrixFilter, setSelectedMatrixFilter] = useState('TODAS'); // 'TODAS', 'LP_GRADE', 'GRADE_167', 'MF_ACB', 'BLOCO_VS', 'MF_BLOCO'
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);
  const [clientOrderNumber, setClientOrderNumber] = useState('');
  const [trayNumber, setTrayNumber] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [serviceType, setServiceType] = useState('SURFACAGEM_MONTAGEM');

  // Prescrição OD e OE
  const [od, setOd] = useState({
    spherical: '0.00',
    cylindrical: '0.00',
    axis: '0',
    addition: '0.00',
    baseCurve: '4.00',
    prismValue: '0.00',
    prismBase: '',
    dnp: '31.0',
    height: '20.0'
  });

  const [oe, setOe] = useState({
    spherical: '0.00',
    cylindrical: '0.00',
    axis: '0',
    addition: '0.00',
    baseCurve: '4.00',
    prismValue: '0.00',
    prismBase: '',
    dnp: '31.0',
    height: '20.0'
  });

  // Produto e Quantidade selecionada
  const [selectedLensModelId, setSelectedLensModelId] = useState('');
  const [selectedLensModel, setSelectedLensModel] = useState(null);
  const [lensQuantity, setLensQuantity] = useState('2'); // Quantidade de Lentes
  const [selectedEyeTarget, setSelectedEyeTarget] = useState('OD_OE'); // 'OD', 'OE', 'OD_OE'
  const [manualPrice, setManualPrice] = useState('');
  const [priceOverrideReason, setPriceOverrideReason] = useState('');

  // Geometria da Armação
  const [frame, setFrame] = useState({
    a: '52.0',
    b: '36.0',
    bridge: '18.0',
    ed: '56.0',
    type: 'ACETATO',
    bevelType: 'AUTOMATICO'
  });

  // Observações Fabris
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Estado de Leitura de Receita via IA OCR e Bipador USB
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState(null);
  const [ocrErrorMsg, setOcrErrorMsg] = useState(null);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);

  // Modal de Confirmação Pós-Bipagem (Multifocal: OE/OD/Ambos | Visão Simples / Blocos: Unidade/Par)
  const [bipConfirmModal, setBipConfirmModal] = useState({
    open: false,
    type: null, // 'MULTIFOCAL' ou 'VS_QUANTITY'
    code: '',
    modelName: '',
    matrixTypeName: '',
    item: null,
    model: null
  });

  const handleScanBarcode = async (e) => {
    if (e) e.preventDefault();
    const code = barcodeScanInput.trim();
    if (!code) return;
    
    setScanLoading(true);
    setOcrSuccessMsg(null);
    setOcrErrorMsg(null);

    try {
      const res = await api.get(`/inventory/by-barcode/${encodeURIComponent(code)}`);
      const item = res.data;
      if (item) {
        let foundModel = null;
        if (item.lens_model_id) {
          setSelectedLensModelId(item.lens_model_id);
          foundModel = lensModels.find(m => m.id === item.lens_model_id) || item.lens_model;
          if (foundModel) {
            setSelectedLensModel(foundModel);
            if (foundModel.matrix_type) {
              setSelectedMatrixFilter(foundModel.matrix_type);
            }
          }
        }

        const formatDiopter = (val) => {
          if (val === null || val === undefined) return '0.00';
          const num = parseFloat(val);
          return isNaN(num) ? String(val) : num.toFixed(2);
        };

        if (item.spherical !== null && item.spherical !== undefined) {
          const sphStr = formatDiopter(item.spherical);
          setOd(prev => ({ ...prev, spherical: sphStr }));
          setOe(prev => ({ ...prev, spherical: sphStr }));
        }
        if (item.cylindrical !== null && item.cylindrical !== undefined) {
          const cylStr = formatDiopter(item.cylindrical);
          setOd(prev => ({ ...prev, cylindrical: cylStr }));
          setOe(prev => ({ ...prev, cylindrical: cylStr }));
        }
        if (item.addition !== null && item.addition !== undefined) {
          const addStr = formatDiopter(item.addition);
          setOd(prev => ({ ...prev, addition: addStr }));
          setOe(prev => ({ ...prev, addition: addStr }));
        }
        if (item.base_curve !== null && item.base_curve !== undefined) {
          const baseStr = formatDiopter(item.base_curve);
          setOd(prev => ({ ...prev, baseCurve: baseStr }));
          setOe(prev => ({ ...prev, baseCurve: baseStr }));
        }
        if (item.eye) {
          if (item.eye === 'OD') setSelectedEyeTarget('OD');
          else if (item.eye === 'OE') setSelectedEyeTarget('OE');
          else setSelectedEyeTarget('OD_OE');
        }

        setBarcodeScanInput('');

        // Identificação precisa da Grade da Lente para a confirmação exigida
        const mType = String(foundModel?.matrix_type || item?.lens_model?.matrix_type || item?.matrix_type || selectedMatrixFilter || '').toUpperCase();
        const modelNameStr = String(foundModel?.name || item?.lens_model?.name || item?.model_name || '').toUpperCase();
        const brandStr = String(foundModel?.brand || item?.lens_model?.brand || '').toUpperCase();

        // 1. Multifocal Acabado ou Multifocal
        const isMultifocalGrade = (
          mType === 'MF_ACB' ||
          mType === 'MF_BLOCO' ||
          mType.includes('MF') ||
          mType.includes('MULTIFOCAL') ||
          modelNameStr.includes('MULTIFOCAL') ||
          modelNameStr.includes('MF') ||
          brandStr.includes('MULTIFOCAL')
        );

        // 2. Visão Simples LP, 1.67 Lentes Prontas ou Bloco Visão Simples
        const isVSOrBlockGrade = !isMultifocalGrade && (
          mType === 'LP_GRADE' ||
          mType === 'GRADE_167' ||
          mType === 'BLOCO_VS' ||
          mType.includes('LP') ||
          mType.includes('167') ||
          mType.includes('BLOCO_VS') ||
          modelNameStr.includes('VISÃO SIMPLES') ||
          modelNameStr.includes('LP') ||
          modelNameStr.includes('1.67') ||
          modelNameStr.includes('BLOCO')
        );

        let matrixLabel = 'Grade da Lente';
        if (mType === 'MF_ACB') matrixLabel = 'Multifocal Acabado';
        else if (mType === 'MF_BLOCO') matrixLabel = 'Multifocal';
        else if (mType === 'LP_GRADE') matrixLabel = 'Visão Simples LP';
        else if (mType === 'GRADE_167') matrixLabel = '1.67 Lentes Prontas';
        else if (mType === 'BLOCO_VS') matrixLabel = 'Bloco Visão Simples';
        else if (isMultifocalGrade) matrixLabel = 'Multifocal';
        else if (isVSOrBlockGrade) matrixLabel = 'Visão Simples / Bloco';

        if (isMultifocalGrade) {
          setBipConfirmModal({
            open: true,
            type: 'MULTIFOCAL',
            code: code,
            modelName: foundModel?.name || item?.lens_model?.name || 'Lente Multifocal',
            matrixTypeName: matrixLabel,
            item: item,
            model: foundModel
          });
        } else if (isVSOrBlockGrade) {
          setBipConfirmModal({
            open: true,
            type: 'VS_QUANTITY',
            code: code,
            modelName: foundModel?.name || item?.lens_model?.name || 'Lente Pronta / Bloco',
            matrixTypeName: matrixLabel,
            item: item,
            model: foundModel
          });
        } else {
          setOcrSuccessMsg(`✨ Lente [${code}] bipada com sucesso! Modelo e prescrição preenchidos automaticamente. Avançando para Armação...`);
          setTimeout(() => {
            if (osType === 'PADRAO') {
              setActiveStep('FRAME');
            }
          }, 700);
        }
      }
    } catch (err) {
      setOcrErrorMsg(err.response?.data?.detail || `Código de barras [${code}] não encontrado no estoque.`);
    } finally {
      setScanLoading(false);
    }
  };

  const handleConfirmBipSelection = (option) => {
    const { type, code, matrixTypeName } = bipConfirmModal;

    if (type === 'MULTIFOCAL') {
      if (option === 'OE') {
        setSelectedEyeTarget('OE');
        setLensQuantity('1');
        setOcrSuccessMsg(`✨ Lente [${code}] (${matrixTypeName}) confirmada: Somente Olho Esquerdo (OE) | 1 Unidade.`);
      } else if (option === 'OD') {
        setSelectedEyeTarget('OD');
        setLensQuantity('1');
        setOcrSuccessMsg(`✨ Lente [${code}] (${matrixTypeName}) confirmada: Somente Olho Direito (OD) | 1 Unidade.`);
      } else {
        setSelectedEyeTarget('OD_OE');
        setLensQuantity('2');
        setOcrSuccessMsg(`✨ Lente [${code}] (${matrixTypeName}) confirmada: Ambos os Olhos (OD + OE) | Par (2 Lentes).`);
      }
    } else if (type === 'VS_QUANTITY') {
      if (option === '1') {
        setLensQuantity('1');
        setOcrSuccessMsg(`✨ Lente [${code}] (${matrixTypeName}) confirmada: Quantidade Unidade (1 Lente).`);
      } else {
        setLensQuantity('2');
        setSelectedEyeTarget('OD_OE');
        setOcrSuccessMsg(`✨ Lente [${code}] (${matrixTypeName}) confirmada: Quantidade Par (2 Lentes).`);
      }
    }

    setBipConfirmModal({ open: false, type: null, code: '', modelName: '', matrixTypeName: '', item: null, model: null });

    setTimeout(() => {
      if (osType === 'PADRAO') {
        setActiveStep('FRAME');
      }
    }, 500);
  };

  const handleOcrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrSuccessMsg(null);
    setOcrErrorMsg(null);

    try {
      const response = await OSService.uploadReceita(file, selectedStoreId || null);
      const data = response.data;

      if (data) {
        setOd(prev => ({
          ...prev,
          spherical: data.od_spherical !== undefined && data.od_spherical !== null ? String(data.od_spherical) : prev.spherical,
          cylindrical: data.od_cylindrical !== undefined && data.od_cylindrical !== null ? String(data.od_cylindrical) : prev.cylindrical,
          axis: data.od_axis !== undefined && data.od_axis !== null ? String(data.od_axis) : prev.axis,
          addition: data.od_addition !== undefined && data.od_addition !== null ? String(data.od_addition) : prev.addition,
          dnp: data.od_dnp !== undefined && data.od_dnp !== null ? String(data.od_dnp) : prev.dnp,
          height: data.od_height !== undefined && data.od_height !== null ? String(data.od_height) : prev.height,
        }));

        setOe(prev => ({
          ...prev,
          spherical: data.oe_spherical !== undefined && data.oe_spherical !== null ? String(data.oe_spherical) : prev.spherical,
          cylindrical: data.oe_cylindrical !== undefined && data.oe_cylindrical !== null ? String(data.oe_cylindrical) : prev.cylindrical,
          axis: data.oe_axis !== undefined && data.oe_axis !== null ? String(data.oe_axis) : prev.axis,
          addition: data.oe_addition !== undefined && data.oe_addition !== null ? String(data.oe_addition) : prev.addition,
          dnp: data.oe_dnp !== undefined && data.oe_dnp !== null ? String(data.oe_dnp) : prev.dnp,
          height: data.oe_height !== undefined && data.oe_height !== null ? String(data.oe_height) : prev.height,
        }));

        if (data.client_name) {
          setSpecialInstructions(prev => prev ? `${prev} | Paciente: ${data.client_name}` : `Paciente: ${data.client_name}`);
        }

        setOcrSuccessMsg("✨ Prescrição médica lida com sucesso via IA OCR! Os valores foram preenchidos nos campos abaixo.");
      }
    } catch (err) {
      console.error("Erro na leitura OCR da receita:", err);
      setOcrErrorMsg("Não foi possível realizar a leitura automática da receita. Preencha os valores manualmente abaixo.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Estado de envio
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [createdOSData, setCreatedOSData] = useState(null);

  // Navegação e Validação Rigorosa de Campos Obrigatórios entre Etapas
  const goToStep = (targetStep) => {
    setErrorMsg(null);

    const stepOrder = osType === 'PADRAO' 
      ? ['ADMIN', 'PRODUCT', 'PRESCRIPTION', 'FRAME', 'OBSERVATIONS']
      : ['ADMIN', 'OBSERVATIONS'];
    
    const currentIndex = stepOrder.indexOf(activeStep);
    const targetIndex = stepOrder.indexOf(targetStep);

    // Se o operador estiver tentando avançar para uma etapa posterior
    if (targetIndex > currentIndex) {
      // 1. Validação da Etapa ADMINISTRATIVA (ADMIN)
      if (activeStep === 'ADMIN') {
        if (!selectedStoreId) {
          setErrorMsg("⚠️ Campo Obrigatório: Selecione a Ótica Cliente Parceira para avançar.");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (!clientOrderNumber || !clientOrderNumber.trim()) {
          setErrorMsg("⚠️ Campo Obrigatório: Preencha o Número do Pedido da Loja para avançar.");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (osType === 'REPARO_SERVICO' && selectedServices.length === 0) {
          setErrorMsg("⚠️ Campo Obrigatório: Selecione ao menos um Serviço Técnico do catálogo para OS de Reparo.");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      // 2. Validação da Etapa de MODELO DE LENTE (PRODUCT)
      if (activeStep === 'PRODUCT' && osType === 'PADRAO') {
        if (!selectedLensModelId) {
          setErrorMsg("⚠️ Campo Obrigatório: Selecione o Modelo da Lente para prosseguir.");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    setErrorMsg(null);
    setActiveStep(targetStep);
  };

  // Carrega Óticas, Modelos e Serviços Técnicos ao iniciar
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingInitial(true);
    try {
      const [storesRes, modelsRes, techServicesRes] = await Promise.all([
        api.get('/optical-stores/').catch(() => ({ data: [] })),
        LensService.getModels().catch(() => ({ data: [] })),
        api.get('/catalog/technical-services/').catch(() => ({ data: [] }))
      ]);

      const storesList = Array.isArray(storesRes.data) ? storesRes.data : [];
      const modelsList = Array.isArray(modelsRes.data) ? modelsRes.data : [];
      const servicesList = Array.isArray(techServicesRes.data) ? techServicesRes.data : [];

      setOpticalStores(storesList);
      setLensModels(modelsList);
      setTechnicalServices(servicesList);

      if (storesList.length > 0) {
        setSelectedStoreId(storesList[0].id);
        setSelectedStore(storesList[0]);
      }

      if (modelsList.length > 0) {
        setSelectedLensModelId(modelsList[0].id);
        setSelectedLensModel(modelsList[0]);
      }

      if (servicesList.length > 0) {
        setServiceType(servicesList[0].name);
      }
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Atualiza ótica selecionada e checa aviso de crédito
  const handleStoreChange = (storeId) => {
    setSelectedStoreId(storeId);
    const store = opticalStores.find(s => s.id === storeId);
    setSelectedStore(store || null);
  };

  // Pré-carregamento automático de lente cadastrada no Cadastrador Unificado
  const handleLensModelChange = (modelId) => {
    setSelectedLensModelId(modelId);
    const model = lensModels.find(m => m.id === modelId);
    setSelectedLensModel(model || null);
    
    // Se não for multifocal ou multifocal semi acabado, fixa em ambos (OD_OE) e 2 unidades
    const isMF = Boolean(
      model && (
        model.matrix_type === 'MF_ACB' || 
        model.matrix_type === 'MF_BLOCO' ||
        String(model.matrix_type || '').toUpperCase().includes('MF') ||
        String(model.name || '').toUpperCase().includes('MULTIFOCAL') ||
        String(model.name || '').toUpperCase().includes('MF') ||
        String(model.brand || '').toUpperCase().includes('MULTIFOCAL')
      )
    );
    if (!isMF) {
      setSelectedEyeTarget('OD_OE');
      setLensQuantity('2');
    }
  };

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.some(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  // Manipuladores de alteração da receita
  const handleOdChange = (field, val) => setOd(prev => ({ ...prev, [field]: val }));
  const handleOeChange = (field, val) => setOe(prev => ({ ...prev, [field]: val }));
  const handleUnifiedPrescriptionChange = (field, val) => {
    setOd(prev => ({ ...prev, [field]: val }));
    setOe(prev => ({ ...prev, [field]: val }));
  };
  const handleFrameChange = (field, val) => setFrame(prev => ({ ...prev, [field]: val }));

  // Detecção automática de Lente Multifocal e Multifocal Semi Acabado
  const isMultifocalMatrix = Boolean(
    selectedMatrixFilter === 'MF_ACB' ||
    selectedMatrixFilter === 'MF_BLOCO' ||
    (selectedLensModel && (
      selectedLensModel.matrix_type === 'MF_ACB' || 
      selectedLensModel.matrix_type === 'MF_BLOCO' ||
      String(selectedLensModel.matrix_type || '').toUpperCase().includes('MF') ||
      String(selectedLensModel.name || '').toUpperCase().includes('MULTIFOCAL') ||
      String(selectedLensModel.name || '').toUpperCase().includes('MF') ||
      String(selectedLensModel.brand || '').toUpperCase().includes('MULTIFOCAL')
    ))
  );

  // Detecção automática de Bloco de Visão Simples (Surfaçagem CNC)
  const isBlocoVS = Boolean(
    selectedMatrixFilter === 'BLOCO_VS' ||
    (selectedLensModel && (
      selectedLensModel.matrix_type === 'BLOCO_VS' ||
      String(selectedLensModel.matrix_type || '').toUpperCase().includes('BLOCO_VS') ||
      String(selectedLensModel.name || '').toUpperCase().includes('BLOCO VS') ||
      String(selectedLensModel.brand || '').toUpperCase().includes('BLOCO VS')
    ))
  );

  // Filtra lista de modelos de lentes por Matriz de Estoque selecionada
  const filteredLensModels = lensModels.filter(m => {
    if (selectedMatrixFilter === 'TODAS') return true;
    return m.matrix_type === selectedMatrixFilter;
  });

  const getServicesSum = () => {
    return selectedServices.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);
  };

  // Cálculo prévio do valor estimado (Lentes * Qtd / Serviço de Reparo + Serviços Adicionais)
  const getEstimatedPrice = () => {
    let basePrice = 0.0;
    if (manualPrice && parseFloat(manualPrice) > 0) {
      basePrice = parseFloat(manualPrice);
    } else if (osType === 'PADRAO' && selectedLensModel) {
      const qty = parseInt(lensQuantity) || (selectedEyeTarget === 'OD_OE' ? 2 : 1);
      basePrice = parseFloat(selectedLensModel.sale_price || 0) * qty;
    } else if (osType === 'REPARO_SERVICO') {
      basePrice = 0.0; // O valor é composto 100% pelos serviços selecionados
    }
    return basePrice + getServicesSum();
  };

  // Submissão da OS Fabril
  const handleSubmitOS = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!selectedStoreId) {
      setErrorMsg("Selecione a Ótica Cliente responsável pelo pedido.");
      setActiveStep('ADMIN');
      return;
    }

    if (osType === 'PADRAO' && !selectedLensModelId) {
      setErrorMsg("Para OS Padrão com alocação de lentes, selecione um Modelo de Lente cadastrado.");
      setActiveStep('PRODUCT');
      return;
    }

    if (osType === 'REPARO_SERVICO' && selectedServices.length === 0) {
      setErrorMsg("Selecione ao menos um Serviço Técnico cadastrado para a OS de Reparo.");
      setActiveStep('ADMIN');
      return;
    }

    if (manualPrice && parseFloat(manualPrice) > 0 && !priceOverrideReason.trim()) {
      setErrorMsg("Informe a justificativa ao aplicar um preço manual acordado.");
      setActiveStep('PRODUCT');
      return;
    }

    setSubmitting(true);

    // Constrói notas de instrução de quantidade e olho target
    let instructions = specialInstructions.trim();
    if (osType === 'PADRAO') {
      const qtyTag = `[Qtd Lentes: ${lensQuantity} un | Olho(s): ${selectedEyeTarget === 'OD_OE' ? 'Par Completo OD+OE' : selectedEyeTarget}]`;
      if (!instructions.includes(qtyTag)) {
        instructions = instructions ? `${instructions} ${qtyTag}` : qtyTag;
      }
    }

    const payload = {
      opticalStoreId: selectedStoreId,
      clientOrderNumber: clientOrderNumber.trim() || `LOJA-${Math.floor(Math.random()*10000)}`,
      trayNumber: trayNumber.trim() || `BD-${Math.floor(Math.random()*100)}`,
      priority,
      osType,
      serviceType: osType === 'REPARO_SERVICO' ? (selectedServices.map(s => s.name).join(', ') || 'Serviço Técnico') : 'Surfaçagem + Montagem CNC',
      od: (osType === 'PADRAO' && (selectedEyeTarget === 'OD' || selectedEyeTarget === 'OD_OE')) ? {
        spherical: parseFloat(od.spherical) || 0.0,
        cylindrical: parseFloat(od.cylindrical) || 0.0,
        axis: parseInt(od.axis) || 0,
        addition: parseFloat(od.addition) || 0.0,
        base_curve: parseFloat(od.baseCurve) || 0.0,
        dnp: parseFloat(od.dnp) || 0.0,
        height: parseFloat(od.height) || 0.0
      } : null,
      oe: (osType === 'PADRAO' && (selectedEyeTarget === 'OE' || selectedEyeTarget === 'OD_OE')) ? {
        spherical: parseFloat(oe.spherical) || 0.0,
        cylindrical: parseFloat(oe.cylindrical) || 0.0,
        axis: parseInt(oe.axis) || 0,
        addition: parseFloat(oe.addition) || 0.0,
        base_curve: parseFloat(oe.baseCurve) || 0.0,
        dnp: parseFloat(oe.dnp) || 0.0,
        height: parseFloat(oe.height) || 0.0
      } : null,
      frame: osType === 'PADRAO' ? frame : null,
      lensModelId: osType === 'PADRAO' ? selectedLensModelId : null,
      additionalServices: selectedServices.map(s => ({
        id: s.id,
        name: s.name,
        price: parseFloat(s.price || 0)
      })),
      manualPrice: manualPrice ? parseFloat(manualPrice) : null,
      priceOverrideReason: priceOverrideReason.trim() || null,
      specialInstructions: instructions
    };

    try {
      const response = await osService.registerFactoryOS(payload);
      setCreatedOSData(response.data || response);
      if (onOSCreated) onOSCreated(response.data);
    } catch (err) {
      console.error("Erro ao registrar OS:", err);
      setErrorMsg(formatApiError(err, 'Falha ao registrar Ordem de Serviço.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
        <p style={{ color: 'white', fontWeight: 600 }}>Carregando dados fabris e modelos cadastrados...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabeçalho */}
      <div className="page-header" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <FileText size={28} style={{ color: 'hsl(var(--primary))' }} />
            Registro Fabril de Ordem de Serviço (OS)
          </h1>
          <p className="page-subtitle" style={{ marginTop: '4px', margin: 0 }}>
            {osType === 'PADRAO' 
              ? 'Cadastre a prescrição, armação e selecione a lente com pré-carregamento automático por matriz de estoque.'
              : 'Cadastre OS de Reparo / Serviço Técnico com inclusão de serviços do catálogo e valor automatizado.'
            }
          </p>
        </div>
      </div>

      {/* Navegação de Abas/Passos da OS */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeStep === 'ADMIN' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => goToStep('ADMIN')}
          style={{ fontWeight: 700, borderRadius: '8px' }}
        >
          1. Identificação {osType === 'REPARO_SERVICO' ? '& Serviços' : '& Pedido'}
        </button>

        {osType === 'PADRAO' && (
          <>
            <button
              type="button"
              className={`btn btn-sm ${activeStep === 'PRODUCT' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => goToStep('PRODUCT')}
              style={{ fontWeight: 700, borderRadius: '8px' }}
            >
              2. Lente & Tratamentos
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeStep === 'PRESCRIPTION' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => goToStep('PRESCRIPTION')}
              style={{ fontWeight: 700, borderRadius: '8px' }}
            >
              3. Prescrição
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeStep === 'FRAME' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => goToStep('FRAME')}
              style={{ fontWeight: 700, borderRadius: '8px' }}
            >
              4. Armação
            </button>
          </>
        )}

        <button
          type="button"
          className={`btn btn-sm ${activeStep === 'OBSERVATIONS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => goToStep('OBSERVATIONS')}
          style={{ fontWeight: 700, borderRadius: '8px' }}
        >
          {osType === 'PADRAO' ? '5. Observações & Finalização' : '2. Observações & Finalização'}
        </button>
      </div>

      {/* MENSAGEM DE ERRO */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '12px 16px', borderRadius: '10px', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MENSAGENS DE BIPAGEM / OCR */}
      {ocrSuccessMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '12px 16px', borderRadius: '10px', color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} />
          <span>{ocrSuccessMsg}</span>
        </div>
      )}

      {ocrErrorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '12px 16px', borderRadius: '10px', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} />
          <span>{ocrErrorMsg}</span>
        </div>
      )}

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <form onSubmit={handleSubmitOS} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ABA 1: ADMINISTRATIVO */}
        {activeStep === 'ADMIN' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} className="text-secondary" /> Identificação Comercial e Tipo de Pedido
            </h3>

            {/* SELETOR DE TIPO DE OS: PADRÃO OU REPARO */}
            <div style={{ display: 'flex', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-glass)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${osType === 'PADRAO' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setOsType('PADRAO'); setServiceType('SURFACAGEM_MONTAGEM'); }}
                style={{ flex: 1, minWidth: '220px', padding: '10px', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <PackageCheck size={18} /> OS Padrão de Lentes (Facetamento / CNC)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${osType === 'REPARO_SERVICO' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setOsType('REPARO_SERVICO'); setServiceType('REPARO_ARMACAO'); }}
                style={{ flex: 1, minWidth: '220px', padding: '10px', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Wrench size={18} /> OS de Apenas Reparo / Serviço Técnico
              </button>
            </div>

            {osType === 'REPARO_SERVICO' && (
              <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                💡 <strong>OS de Apenas Reparo/Serviço:</strong> Contém somente dados de identificação e a inclusão dos serviços técnicos com seus valores já cadastrados. A etapa de Armação & Bisel é dispensada.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>Ótica Cliente Parceira *</label>
                <select
                  className="form-control"
                  value={selectedStoreId}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  style={{ color: 'black', fontWeight: 700 }}
                  required
                >
                  <option value="">Selecione a Ótica...</option>
                  {opticalStores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.trade_name || s.corporate_name} (CNPJ: {s.cnpj})
                    </option>
                  ))}
                </select>
                {selectedStore && selectedStore.delinquency_policy === 'POLICY_BLOCK' && (
                  <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> Atenção: Esta Ótica possui bloqueio comercial por inadimplência.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Número do Pedido da Loja *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: PED-8842"
                  value={clientOrderNumber}
                  onChange={(e) => setClientOrderNumber(e.target.value)}
                  style={{ color: 'black' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Número da Bandeja (Opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: BD-14"
                  value={trayNumber}
                  onChange={(e) => setTrayNumber(e.target.value)}
                  style={{ color: 'black' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prioridade na Esteira</label>
                <select
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ color: 'black', fontWeight: 700 }}
                >
                  <option value="NORMAL">NORMAL (Padrão)</option>
                  <option value="URGENTE">URGENTE (Prioridade Máxima)</option>
                  <option value="REFAZIMENTO">REFAZIMENTO / GARANTIA</option>
                </select>
              </div>
            </div>

            {/* SEÇÃO DE INCLUSÃO DE VÁRIOS SERVIÇOS DO CATÁLOGO (PARA OS DE REPARO/SERVIÇO) */}
            {osType === 'REPARO_SERVICO' && (
              <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', marginTop: '8px' }}>
                <h4 style={{ color: '#38bdf8', marginTop: 0, marginBottom: '10px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wrench size={18} /> Serviços Técnicos a Inserir na OS (Selecione um ou vários) *
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginTop: 0, marginBottom: '12px' }}>
                  Marque os serviços que serão prestados. O valor total da OS será calculado automaticamente com base nos preços do catálogo:
                </p>

                {technicalServices.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
                    ⚠️ Nenhum serviço técnico cadastrado no catálogo. Cadastre serviços em <em>Financeiro &gt; Catálogo Financeiro</em>.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {technicalServices.map(service => {
                      const isSelected = selectedServices.some(s => s.id === service.id);
                      return (
                        <div
                          key={service.id}
                          onClick={() => toggleService(service)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid #38bdf8' : '1px solid var(--border-glass)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 800 : 600, color: 'white' }}>
                              {service.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: isSelected ? '#38bdf8' : '#22c55e' }}>
                            R$ {parseFloat(service.price || 0).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToStep(osType === 'PADRAO' ? 'PRODUCT' : 'OBSERVATIONS')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              >
                {osType === 'PADRAO' ? 'Próximo: Selecionar Lente' : 'Próximo: Observações & Finalização'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ABA 3: PRESCRIÇÃO */}
        {activeStep === 'PRESCRIPTION' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} className="text-secondary" /> Prescrição Médica (Receita Oftálmica)
            </h3>

            {/* PAINEL DE UPLOAD E LEITURA DE RECEITA VIA IA OCR */}
            <div style={{ background: 'rgba(147, 51, 234, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} style={{ color: '#c084fc' }} />
                  <div>
                    <strong style={{ color: 'white', fontSize: '0.95rem' }}>Leitura Inteligente de Receita (IA / OCR)</strong>
                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                      Faça o upload de uma foto ou PDF da receita médica para preenchimento automático das dioptrias.
                    </span>
                  </div>
                </div>

                <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer', background: '#9333ea', borderColor: '#7e22ce', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  {ocrLoading ? <RefreshCw size={16} className="animate-spin" /> : <FileImage size={16} />}
                  {ocrLoading ? 'Processando OCR...' : 'Carregar Foto / PDF da Receita'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleOcrFileUpload}
                    disabled={ocrLoading}
                  />
                </label>
              </div>

              {ocrSuccessMsg && (
                <div style={{ fontSize: '0.82rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.12)', padding: '8px 12px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {ocrSuccessMsg}
                </div>
              )}

              {ocrErrorMsg && (
                <div style={{ fontSize: '0.82rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', padding: '8px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> {ocrErrorMsg}
                </div>
              )}
            </div>

            {/* PAINEL DE SELEÇÃO RÁPIDA VIA BIPADOR DE CÓDIGO DE BARRAS */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                <PackageCheck size={20} style={{ color: '#38bdf8' }} />
                <div>
                  <strong style={{ color: 'white', fontSize: '0.95rem' }}>Seleção via Bipador USB / Código de Barras</strong>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                    Bipe a caixa de lentes para selecionar o modelo e preencher a dioptria automaticamente.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Bipe ou digite o Código EAN..."
                  value={barcodeScanInput}
                  onChange={(e) => setBarcodeScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanBarcode(e); } }}
                  style={{ color: 'black', fontWeight: 700 }}
                />
                <button type="button" onClick={handleScanBarcode} className="btn btn-primary" disabled={scanLoading} style={{ fontWeight: 700 }}>
                  {scanLoading ? 'Bipando...' : 'Buscar'}
                </button>
              </div>
            </div>

            {/* SELEÇÃO DO OLHO SOLICITADO (APENAS PARA MATRIZES MULTIFOCAIS / SEMI ACABADOS) */}
            {isMultifocalMatrix ? (
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', fontWeight: 800, fontSize: '0.92rem' }}>
                    <Sparkles size={18} />
                    <span>Lente Multifocal ({selectedLensModel?.matrix_type}): Selecione o Olho Solicitado *</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${selectedEyeTarget === 'OD_OE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setSelectedEyeTarget('OD_OE'); setLensQuantity('2'); }}
                      style={{ fontWeight: 700, borderRadius: '8px' }}
                    >
                      👁️ Par Completo (OD + OE) — 2 Lentes
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${selectedEyeTarget === 'OD' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setSelectedEyeTarget('OD'); setLensQuantity('1'); }}
                      style={{ fontWeight: 700, borderRadius: '8px' }}
                    >
                      👁️ Somente Olho Direito (OD) — 1 Lente
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${selectedEyeTarget === 'OE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setSelectedEyeTarget('OE'); setLensQuantity('1'); }}
                      style={{ fontWeight: 700, borderRadius: '8px' }}
                    >
                      👁️ Somente Olho Esquerdo (OE) — 1 Lente
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* GRID DOS OLHOS CONFORME SELEÇÃO E MATRIZ DA LENTE */}
            {isBlocoVS ? (
              /* LAYOUT EXCLUSIVO PARA BLOCO DE VISÃO SIMPLES: EXIBE APENAS CURVA BASE + DNP / ALTURA */
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '24px', borderRadius: '16px', border: '2px solid rgba(56, 189, 248, 0.4)', boxShadow: '0 8px 24px rgba(56, 189, 248, 0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#0284c7', fontWeight: 800 }}>
                  <Layers size={22} />
                  <span style={{ fontSize: '1.05rem' }}>Especificação do Bloco de Visão Simples (Surfaçagem CNC)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'end' }}>
                  {/* CAMPO DESTAQUE DA CURVA BASE (CONFORME SOLICITADO NO ANEXO) */}
                  <div className="form-group" style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '16px', borderRadius: '12px', border: '2px solid #0284c7', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)' }}>
                    <label className="form-label" style={{ fontWeight: 900, color: '#0284c7', fontSize: '0.95rem', letterSpacing: '0.03em', display: 'block', marginBottom: '8px' }}>
                      🎯 CURVA BASE (BASE) *
                    </label>
                    <input
                      type="number" step="0.25" className="form-control"
                      placeholder="Ex: 4.00"
                      value={od.baseCurve || ''} onChange={(e) => handleUnifiedPrescriptionChange('baseCurve', e.target.value)}
                      style={{ color: 'black', fontWeight: 900, fontSize: '1.25rem', padding: '12px 16px', borderRadius: '8px', border: '2px solid #0284c7', background: '#f0f9ff' }}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '6px', display: 'block' }}>
                      Curva base física selecionada para reserva de estoque e gerador CNC.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>DNP (MM)</label>
                    <input
                      type="number" step="0.5" className="form-control"
                      value={od.dnp} onChange={(e) => handleUnifiedPrescriptionChange('dnp', e.target.value)}
                      style={{ color: 'black', fontWeight: 800, padding: '12px 16px', borderRadius: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>ALTURA MONTAGEM (MM)</label>
                    <input
                      type="number" step="0.5" className="form-control"
                      value={od.height} onChange={(e) => handleUnifiedPrescriptionChange('height', e.target.value)}
                      style={{ color: 'black', fontWeight: 800, padding: '12px 16px', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              </div>
            ) : !isMultifocalMatrix ? (
              /* LAYOUT UNIFICADO PARA VISÃO SIMPLES E BLOCOS COMUNS (CONFORME ANEXO DO USUÁRIO) */
              <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>ESFÉRICO (ESF)</label>
                    <input
                      type="number" step="0.25" className="form-control"
                      value={od.spherical} onChange={(e) => handleUnifiedPrescriptionChange('spherical', e.target.value)}
                      style={{ color: 'black', fontWeight: 800, padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>CILÍNDRICO (CIL)</label>
                    <input
                      type="number" step="0.25" className="form-control"
                      value={od.cylindrical} onChange={(e) => handleUnifiedPrescriptionChange('cylindrical', e.target.value)}
                      style={{ color: 'black', fontWeight: 800, padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>EIXO (°)</label>
                    <input
                      type="number" min="0" max="180" className="form-control"
                      value={od.axis} onChange={(e) => handleUnifiedPrescriptionChange('axis', e.target.value)}
                      style={{ color: 'black', padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>ADIÇÃO (ADD)</label>
                    <input
                      type="number" step="0.25" className="form-control"
                      value={od.addition} onChange={(e) => handleUnifiedPrescriptionChange('addition', e.target.value)}
                      style={{ color: 'black', padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>CURVA BASE (BASE)</label>
                    <input
                      type="number" step="0.25" className="form-control"
                      placeholder="Ex: 4.00"
                      value={od.baseCurve || ''} onChange={(e) => handleUnifiedPrescriptionChange('baseCurve', e.target.value)}
                      style={{ color: 'black', fontWeight: 700, padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>DNP (MM)</label>
                    <input
                      type="number" step="0.5" className="form-control"
                      value={od.dnp} onChange={(e) => handleUnifiedPrescriptionChange('dnp', e.target.value)}
                      style={{ color: 'black', padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>ALTURA MONTAGEM (MM)</label>
                    <input
                      type="number" step="0.5" className="form-control"
                      value={od.height} onChange={(e) => handleUnifiedPrescriptionChange('height', e.target.value)}
                      style={{ color: 'black', padding: '10px 14px', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* LAYOUT MULTIFOCAL COM CARTÕES SEPARADOS POR OLHO */
              <div style={{ display: 'grid', gridTemplateColumns: selectedEyeTarget === 'OD_OE' ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '20px' }}>
                
                {/* OLHO DIREITO (OD) */}
                {(selectedEyeTarget === 'OD_OE' || selectedEyeTarget === 'OD') && (
                  <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <h4 style={{ color: '#38bdf8', marginTop: 0, marginBottom: '12px', fontSize: '0.95rem', fontWeight: 800 }}>
                      OLHO DIREITO (OD)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {!isBlocoVS && !isMultifocalMatrix && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Esférico (ESF)</label>
                            <input
                              type="number" step="0.25" className="form-control"
                              value={od.spherical} onChange={(e) => handleOdChange('spherical', e.target.value)}
                              style={{ color: 'black', fontWeight: 800 }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Cilíndrico (CIL)</label>
                            <input
                              type="number" step="0.25" className="form-control"
                              value={od.cylindrical} onChange={(e) => handleOdChange('cylindrical', e.target.value)}
                              style={{ color: 'black', fontWeight: 800 }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Eixo (°)</label>
                            <input
                              type="number" min="0" max="180" className="form-control"
                              value={od.axis} onChange={(e) => handleOdChange('axis', e.target.value)}
                              style={{ color: 'black' }}
                            />
                          </div>
                        </>
                      )}
                      
                      <div className="form-group" style={isBlocoVS || isMultifocalMatrix ? { gridColumn: isBlocoVS ? 'span 2' : 'span 1', background: 'rgba(56, 189, 248, 0.1)', padding: '10px', borderRadius: '8px', border: '2px solid #0284c7' } : {}}>
                        <label className="form-label" style={{ color: '#0284c7', fontWeight: 800 }}>🎯 Curva Base (Base) *</label>
                        <input
                          type="number" step="0.25" className="form-control"
                          placeholder="Ex: 4.00"
                          value={od.baseCurve || ''} onChange={(e) => handleOdChange('baseCurve', e.target.value)}
                          style={{ color: 'black', fontWeight: 900, fontSize: isBlocoVS || isMultifocalMatrix ? '1.1rem' : '1rem' }}
                        />
                      </div>

                      {!isBlocoVS && (
                        <div className="form-group" style={isMultifocalMatrix ? { background: 'rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px', border: '2px solid #a855f7' } : {}}>
                          <label className="form-label" style={{ color: isMultifocalMatrix ? '#a855f7' : 'inherit', fontWeight: 800 }}>✨ Adição (ADD) *</label>
                          <input
                            type="number" step="0.25" className="form-control"
                            placeholder="Ex: +2.00"
                            value={od.addition} onChange={(e) => handleOdChange('addition', e.target.value)}
                            style={{ color: 'black', fontWeight: 900, fontSize: isMultifocalMatrix ? '1.1rem' : '1rem' }}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">DNP (mm)</label>
                        <input
                          type="number" step="0.5" className="form-control"
                          value={od.dnp} onChange={(e) => handleOdChange('dnp', e.target.value)}
                          style={{ color: 'black' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Altura Montagem (mm)</label>
                        <input
                          type="number" step="0.5" className="form-control"
                          value={od.height} onChange={(e) => handleOdChange('height', e.target.value)}
                          style={{ color: 'black' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* OLHO ESQUERDO (OE) */}
                {(selectedEyeTarget === 'OD_OE' || selectedEyeTarget === 'OE') && (
                  <div style={{ background: 'rgba(168, 85, 247, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    <h4 style={{ color: '#a855f7', marginTop: 0, marginBottom: '12px', fontSize: '0.95rem', fontWeight: 800 }}>
                      OLHO ESQUERDO (OE)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {!isBlocoVS && !isMultifocalMatrix && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Esférico (ESF)</label>
                            <input
                              type="number" step="0.25" className="form-control"
                              value={oe.spherical} onChange={(e) => handleOeChange('spherical', e.target.value)}
                              style={{ color: 'black', fontWeight: 800 }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Cilíndrico (CIL)</label>
                            <input
                              type="number" step="0.25" className="form-control"
                              value={oe.cylindrical} onChange={(e) => handleOeChange('cylindrical', e.target.value)}
                              style={{ color: 'black', fontWeight: 800 }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Eixo (°)</label>
                            <input
                              type="number" min="0" max="180" className="form-control"
                              value={oe.axis} onChange={(e) => handleOeChange('axis', e.target.value)}
                              style={{ color: 'black' }}
                            />
                          </div>
                        </>
                      )}

                      <div className="form-group" style={isBlocoVS || isMultifocalMatrix ? { gridColumn: isBlocoVS ? 'span 2' : 'span 1', background: 'rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px', border: '2px solid #a855f7' } : {}}>
                        <label className="form-label" style={{ color: '#a855f7', fontWeight: 800 }}>🎯 Curva Base (Base) *</label>
                        <input
                          type="number" step="0.25" className="form-control"
                          placeholder="Ex: 4.00"
                          value={oe.baseCurve || ''} onChange={(e) => handleOeChange('baseCurve', e.target.value)}
                          style={{ color: 'black', fontWeight: 900, fontSize: isBlocoVS || isMultifocalMatrix ? '1.1rem' : '1rem' }}
                        />
                      </div>

                      {!isBlocoVS && (
                        <div className="form-group" style={isMultifocalMatrix ? { background: 'rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px', border: '2px solid #a855f7' } : {}}>
                          <label className="form-label" style={{ color: isMultifocalMatrix ? '#a855f7' : 'inherit', fontWeight: 800 }}>✨ Adição (ADD) *</label>
                          <input
                            type="number" step="0.25" className="form-control"
                            placeholder="Ex: +2.00"
                            value={oe.addition} onChange={(e) => handleOeChange('addition', e.target.value)}
                            style={{ color: 'black', fontWeight: 900, fontSize: isMultifocalMatrix ? '1.1rem' : '1rem' }}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">DNP (mm)</label>
                        <input
                          type="number" step="0.5" className="form-control"
                          value={oe.dnp} onChange={(e) => handleOeChange('dnp', e.target.value)}
                          style={{ color: 'black' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Altura Montagem (mm)</label>
                        <input
                          type="number" step="0.5" className="form-control"
                          value={oe.height} onChange={(e) => handleOeChange('height', e.target.value)}
                          style={{ color: 'black' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep('PRODUCT')}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToStep('FRAME')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              >
                Próximo: Armação & Bisel <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ABA 3: SELEÇÃO DA LENTE E TRATAMENTOS (PRÉ-CARREGADOS) */}
        {activeStep === 'PRODUCT' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-secondary" /> Seleção do Modelo de Lente (Por Matriz de Estoque)
            </h3>

            {/* PAINEL DE SELEÇÃO RÁPIDA VIA BIPADOR DE CÓDIGO DE BARRAS */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                <PackageCheck size={20} style={{ color: '#38bdf8' }} />
                <div>
                  <strong style={{ color: 'white', fontSize: '0.95rem' }}>Seleção Rápida via Bipador USB / Código de Barras</strong>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                    Bipe o código EAN da lente para preencher automaticamente o modelo e a prescrição e avançar para a Armação.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Bipe ou digite o Código EAN..."
                  value={barcodeScanInput}
                  onChange={(e) => setBarcodeScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanBarcode(e); } }}
                  style={{ color: 'black', fontWeight: 700 }}
                  autoFocus
                />
                <button type="button" onClick={handleScanBarcode} className="btn btn-primary" disabled={scanLoading} style={{ fontWeight: 700 }}>
                  {scanLoading ? 'Bipando...' : 'Bipar / Buscar'}
                </button>
              </div>
            </div>

            {/* SELETOR / FILTRO POR MATRIZ DE ESTOQUE (DROPDOWN) */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 'bold', color: '#38bdf8' }}>
                Filtrar por Matriz de Estoque *
              </label>
              <select
                className="form-control"
                value={selectedMatrixFilter}
                onChange={(e) => setSelectedMatrixFilter(e.target.value)}
                style={{ color: 'black', fontWeight: 700, fontSize: '0.95rem' }}
              >
                <option value="TODAS">Todas as Matrizes de Estoque</option>
                <option value="LP_GRADE">LP_GRADE — Visão Simples Lente Pronta (1.56 AR)</option>
                <option value="GRADE_167">GRADE_167 — Alto Índice (1.67 AR / FA)</option>
                <option value="MF_ACB">MF_ACB — Multifocal Acabado</option>
                <option value="BLOCO_VS">BLOCO_VS — Bloco Visão Simples (Surfaçagem CNC)</option>
                <option value="MF_BLOCO">MF_BLOCO — Bloco Multifocal (Semi-Acabado)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 'bold' }}>Modelo de Lente Disponível na Matriz Selecionada *</label>
              <select
                className="form-control"
                value={selectedLensModelId}
                onChange={(e) => handleLensModelChange(e.target.value)}
                style={{ color: 'black', fontWeight: 700, fontSize: '0.95rem' }}
                required
              >
                <option value="">Selecione o Modelo da Lente...</option>
                {filteredLensModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.brand || m.name} — Tratamento: {m.treatment || 'Incolor'} | {m.material || 'Resina'} (n={m.refractive_index}) [Matriz: {m.matrix_type}] — R$ {parseFloat(m.sale_price || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* SELEÇÃO DE QUANTIDADE E OLHOS SOLICITADOS (Exclusivo para Multifocal e Multifocal Semi Acabado) */}
            {isMultifocalMatrix ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: 'rgba(168, 85, 247, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#c084fc' }}>
                    👁️ Olho(s) Solicitado(s) * (Multifocal / Semi Acabado)
                  </label>
                  <select
                    className="form-control"
                    value={selectedEyeTarget}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedEyeTarget(val);
                      setLensQuantity(val === 'OD_OE' ? '2' : '1');
                    }}
                    style={{ color: 'black', fontWeight: 700 }}
                  >
                    <option value="OD_OE">Ambos / Par Completo (Olho Direito + Olho Esquerdo) — 2 Lentes</option>
                    <option value="OD">Somente Olho Direito (OD) — 1 Lente</option>
                    <option value="OE">Somente Olho Esquerdo (OE) — 1 Lente</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#c084fc' }}>
                    📦 Quantidade de Lentes (Unidades) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="form-control"
                    value={lensQuantity}
                    onChange={(e) => setLensQuantity(e.target.value)}
                    style={{ color: 'black', fontWeight: 800, background: 'rgba(168, 85, 247, 0.08)' }}
                    required
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#38bdf8' }}>
                    📦 Quantidade de Lentes (Unidades) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="form-control"
                    value={lensQuantity}
                    onChange={(e) => setLensQuantity(e.target.value)}
                    style={{ color: 'black', fontWeight: 800, background: 'rgba(56, 189, 248, 0.08)' }}
                    required
                  />
                </div>
              </div>
            )}

            {/* DESTAQUE SE FOR MATRIZ SEMIFOCAL / MULTIFOCAL */}
            {isMultifocalMatrix && (
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '12px 16px', borderRadius: '10px', color: '#a855f7', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={20} />
                <span>
                  Matriz Multifocal / Semi Acabado ({selectedLensModel?.matrix_type}): Pedido configurado com seleção por Olho ({selectedEyeTarget === 'OD_OE' ? 'Ambos OD e OE' : selectedEyeTarget === 'OD' ? 'Somente Olho Direito' : 'Somente Olho Esquerdo'}).
                </span>
              </div>
            )}

            {/* CARTÃO DE PRÉ-CARREGAMENTO DE ESPECIFICAÇÕES E TRATAMENTOS DA LENTE */}
            {selectedLensModel && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  ESPECIFICAÇÕES E TRATAMENTOS PRÉ-CARREGADOS AUTOMATICAMENTE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Modelo Comercial:</span>
                    <strong style={{ color: 'white', fontSize: '0.95rem' }}>{selectedLensModel.name || selectedLensModel.brand}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Material / Índice:</span>
                    <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>{selectedLensModel.material || 'Resina'} (Ind. {selectedLensModel.refractive_index})</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Matriz de Estoque:</span>
                    <span className="badge badge-primary" style={{ fontWeight: 800 }}>{selectedLensModel.matrix_type}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Tratamentos Inclusos:</span>
                    <strong style={{ color: '#22c55e', fontSize: '0.95rem' }}>{selectedLensModel.treatment || 'Anti-Reflexo (AR)'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Rota de Produção:</span>
                    <strong style={{ color: '#a855f7', fontSize: '0.9rem' }}>{selectedLensModel.production_route}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Preço Base Tabela:</span>
                    <strong style={{ color: 'white', fontSize: '1rem' }}>R$ {parseFloat(selectedLensModel.sale_price || 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* SEÇÃO DE SERVIÇOS TÉCNICOS ADICIONAIS */}
            <div style={{ background: 'rgba(56, 189, 248, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', marginTop: '6px' }}>
              <h4 style={{ color: '#38bdf8', marginTop: 0, marginBottom: '10px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={16} /> Serviços Técnicos e Laboratoriais Adicionais (Do Catálogo)
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: 0, marginBottom: '12px' }}>
                Marque os serviços ou tratamentos especiais a serem incluídos na Ordem de Serviço junto com as lentes:
              </p>

              {technicalServices.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                  Nenhum serviço técnico adicional cadastrado no catálogo. (Cadastre em <em>Financeiro &gt; Catálogo Financeiro</em>).
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  {technicalServices.map(service => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleService(service)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.88rem', fontWeight: isSelected ? 800 : 500, color: 'white' }}>
                            {service.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? '#38bdf8' : '#22c55e' }}>
                          + R$ {parseFloat(service.price || 0).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SOBRESCRITA MANUAL DE PREÇO COM JUSTIFICATIVA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '10px' }}>
              <div className="form-group">
                <label className="form-label">Preço Manual Acordado (Opcional - R$)</label>
                <input
                  type="number" step="0.01" className="form-control"
                  placeholder="Deixe em branco para usar preço de tabela"
                  value={manualPrice} onChange={(e) => setManualPrice(e.target.value)}
                  style={{ color: 'black', fontWeight: 800 }}
                />
              </div>

              {manualPrice && parseFloat(manualPrice) > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ color: '#eab308', fontWeight: 'bold' }}>Justificativa do Preço Manual *</label>
                  <input
                    type="text" className="form-control"
                    placeholder="Ex: Desconto autorizado pelo gerente comercial"
                    value={priceOverrideReason} onChange={(e) => setPriceOverrideReason(e.target.value)}
                    style={{ color: 'black' }}
                    required
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep('ADMIN')}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToStep('PRESCRIPTION')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              >
                Próximo: Prescrição Óptica <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ABA 4: ARMAÇÃO */}
        {activeStep === 'FRAME' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackageCheck size={18} className="text-secondary" /> Geometria da Armação
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Largura Horizontal A (mm)</label>
                <input
                  type="number" step="0.5" className="form-control"
                  value={frame.a} onChange={(e) => handleFrameChange('a', e.target.value)}
                  style={{ color: 'black' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Altura Vertical B (mm)</label>
                <input
                  type="number" step="0.5" className="form-control"
                  value={frame.b} onChange={(e) => handleFrameChange('b', e.target.value)}
                  style={{ color: 'black' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ponte DBL (mm)</label>
                <input
                  type="number" step="0.5" className="form-control"
                  value={frame.bridge} onChange={(e) => handleFrameChange('bridge', e.target.value)}
                  style={{ color: 'black' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Maior Diâmetro ED (mm)</label>
                <input
                  type="number" step="0.5" className="form-control"
                  value={frame.ed} onChange={(e) => handleFrameChange('ed', e.target.value)}
                  style={{ color: 'black' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Armação</label>
                <select
                  className="form-control"
                  value={frame.type} onChange={(e) => handleFrameChange('type', e.target.value)}
                  style={{ color: 'black', fontWeight: 700 }}
                >
                  <option value="ACETATO">ACETATO (Aro Fechado)</option>
                  <option value="METAL">METAL (Aro Fechado)</option>
                  <option value="NYLON">FIO DE NYLON (Semi-flutuante)</option>
                  <option value="BALGRIFF">BALGRIFF / TRÊS PEÇAS (Parafuso/Bucha)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep(osType === 'PADRAO' ? 'PRESCRIPTION' : 'ADMIN')}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToStep('OBSERVATIONS')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              >
                Próximo: Observações <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ABA 5: OBSERVAÇÕES E FINALIZAÇÃO */}
        {activeStep === 'OBSERVATIONS' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} className="text-secondary" /> Observações da Montagem e Resumo
            </h3>

            <div className="form-group">
              <label className="form-label">Instruções Especiais de Montagem / Laboratório</label>
              <textarea
                rows="3" className="form-control"
                placeholder="Ex: Armação delicada do cliente. Bisel fino com polimento de bordas."
                value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>

            {/* DETALHAMENTO DE ITENS SELECIONADOS */}
            {selectedServices.length > 0 && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <h4 style={{ color: '#38bdf8', marginTop: 0, marginBottom: '10px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={16} /> Serviços Técnicos Incluídos ({selectedServices.length}):
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedServices.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{ color: 'white', fontWeight: 600 }}>• {s.name}</span>
                      <strong style={{ color: '#22c55e' }}>R$ {parseFloat(s.price || 0).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RESUMO DE VALORES E BOTÃO DE SALVAR */}
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase' }}>
                  VALOR TOTAL ESTIMADO DA OS ({osType === 'REPARO_SERVICO' ? 'REPARO / SERVIÇO TÉCNICO' : 'PADRÃO DE LENTES'})
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4ade80' }}>
                  R$ {getEstimatedPrice().toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button" className="btn btn-secondary"
                  onClick={() => setActiveStep(osType === 'PADRAO' ? 'FRAME' : 'ADMIN')}
                >
                  Voltar
                </button>
                <button
                  type="submit" className="btn btn-primary"
                  disabled={submitting}
                  style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  {submitting ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                  Registrar Ordem de Serviço na Fábrica
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* MODAL DE SUCESSO APÓS CRIAÇÃO */}
      {createdOSData && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '28px', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800 }}>
              Ordem de Serviço Registrada!
            </h2>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginBottom: '20px' }}>
              A OS foi criada e processada com sucesso na esteira fabril.
            </p>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong style={{ color: 'hsl(var(--text-muted))' }}>Número da OS:</strong> <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{createdOSData.os_number}</span></div>
              <div><strong style={{ color: 'hsl(var(--text-muted))' }}>Status Inicial:</strong> <span className="badge badge-primary">{createdOSData.status}</span></div>
              <div><strong style={{ color: 'hsl(var(--text-muted))' }}>Bandeja (Tray ID):</strong> <span style={{ color: 'white', fontWeight: 700 }}>{createdOSData.tray_number}</span></div>
              <div><strong style={{ color: 'hsl(var(--text-muted))' }}>Valor Total:</strong> <span style={{ color: '#4ade80', fontWeight: 900 }}>R$ {parseFloat(createdOSData.total_price || 0).toFixed(2)}</span></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCreatedOSData(null);
                  setClientOrderNumber('');
                  setTrayNumber('');
                  setActiveStep('ADMIN');
                }}
              >
                + Nova OS
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreatedOSData(null);
                  if (onOSCreated) onOSCreated(createdOSData);
                }}
                style={{ fontWeight: 800 }}
              >
                Ir para Bancada OS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PÓS-BIPAGEM (SOLICITADO PELO USUÁRIO) */}
      {bipConfirmModal.open && (
        <div style={{
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
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(24, 24, 37, 0.98), rgba(15, 23, 42, 0.99))',
            border: `2px solid ${bipConfirmModal.type === 'MULTIFOCAL' ? 'rgba(168, 85, 247, 0.6)' : 'rgba(56, 189, 248, 0.6)'}`,
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2)',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: bipConfirmModal.type === 'MULTIFOCAL' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                border: `2px solid ${bipConfirmModal.type === 'MULTIFOCAL' ? '#c084fc' : '#38bdf8'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '6px'
              }}>
                {bipConfirmModal.type === 'MULTIFOCAL' ? (
                  <Eye size={30} style={{ color: '#c084fc' }} />
                ) : (
                  <PackageCheck size={30} style={{ color: '#38bdf8' }} />
                )}
              </div>

              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                {bipConfirmModal.type === 'MULTIFOCAL' ? 'Confirmação do Olho Solicitado' : 'Confirmação de Quantidade de Lentes'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                Lente Bipada: <strong style={{ color: '#e2e8f0' }}>{bipConfirmModal.modelName}</strong> ({bipConfirmModal.matrixTypeName})
              </p>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '12px', color: '#cbd5e1', fontWeight: 700 }}>
                EAN: {bipConfirmModal.code}
              </span>
            </div>

            {bipConfirmModal.type === 'MULTIFOCAL' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <p style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 600, margin: 0 }}>
                  A grade da lente é <strong>{bipConfirmModal.matrixTypeName}</strong>. Por favor, confirme qual olho será produzido:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleConfirmBipSelection('OE')}
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '2px solid rgba(168, 85, 247, 0.5)',
                      color: '#e9d5ff',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    👁️ Somente Olho Esquerdo (OE) — 1 Lente
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleConfirmBipSelection('OD')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '2px solid rgba(56, 189, 248, 0.5)',
                      color: '#bae6fd',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    👁️ Somente Olho Direito (OD) — 1 Lente
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleConfirmBipSelection('AMBOS')}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #7e22ce)',
                      border: 'none',
                      color: 'white',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(126, 34, 206, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    👓 Ambos os Olhos (OD + OE) — Par Completo (2 Lentes)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <p style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 600, margin: 0 }}>
                  A grade da lente é <strong>{bipConfirmModal.matrixTypeName}</strong>. Por favor, confirme a quantidade solicitada:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleConfirmBipSelection('1')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '2px solid rgba(56, 189, 248, 0.5)',
                      color: '#bae6fd',
                      padding: '16px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <PackageCheck size={24} />
                    <span>Unidade (1 Lente)</span>
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleConfirmBipSelection('2')}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                      border: 'none',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Eye size={24} />
                    <span>Par (2 Lentes)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
