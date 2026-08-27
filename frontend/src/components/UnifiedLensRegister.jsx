import React, { useState, useEffect, useRef } from 'react';
import api, { LensService, InventoryService, DegreePolicyService } from '../services/api';
import { Sparkles, Check, Barcode, RefreshCw, AlertTriangle, CheckCircle, FileText, Zap, PlusCircle, X } from 'lucide-react';

const PRESET_OPTIONS = {
  LP_GRADE: [
    { paramKey: 'lp_incolor_150', name: "LP Incolor 1.50", index: 1.50, material: "CR-39", treatment: "Incolor", route: "EXPRESSA_FACETAMENTO", defaultBase: "60.00", defaultOver: "80.00" },
    { paramKey: 'lp_ar_156', name: "LP AR 1.56", index: 1.56, material: "Resina", treatment: "AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "75.00", defaultOver: "95.00" },
    { paramKey: 'lp_filtro_azul_ar_156', name: "LP Filtro Azul AR 1.56", index: 1.56, material: "Resina", treatment: "Filtro Azul AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "95.00", defaultOver: "125.00" },
    { paramKey: 'lp_poly_ar_159', name: "LP POLY AR 1.59", index: 1.59, material: "Policarbonato", treatment: "AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "110.00", defaultOver: "140.00" },
    { paramKey: 'lp_poly_filtro_azul_ar_159', name: "LP POLY FILTRO AZUL AR 1.59", index: 1.59, material: "Policarbonato", treatment: "Filtro Azul AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "130.00", defaultOver: "165.00" },
    { paramKey: 'lp_photo_ar_156', name: "LP PHOTO AR 1.56", index: 1.56, material: "Resina", treatment: "Photo AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "145.00", defaultOver: "185.00" },
    { paramKey: 'lp_photo_filtro_azul_ar_156', name: "LP PHOTO FILTRO AZUL AR 1.56", index: 1.56, material: "Resina", treatment: "Photo Filtro Azul AR", route: "EXPRESSA_FACETAMENTO", defaultBase: "170.00", defaultOver: "215.00" }
  ],
  MF_ACB: [
    { name: "MF ACB Incolor 1.50", index: 1.50, material: "CR-39", treatment: "Incolor", route: "EXPRESSA_FACETAMENTO" },
    { name: "MF ACB AR 1.56", index: 1.56, material: "Resina", treatment: "AR", route: "EXPRESSA_FACETAMENTO" },
    { name: "MF ACB Filtro Azul AR 1.56", index: 1.56, material: "Resina", treatment: "Filtro Azul AR", route: "EXPRESSA_FACETAMENTO" },
    { name: "MF ACB PHOTO AR 1.56", index: 1.56, material: "Resina", treatment: "Photo AR", route: "EXPRESSA_FACETAMENTO" },
    { name: "MF ACB PHOTO FILTRO AZUL AR 1.56", index: 1.56, material: "Resina", treatment: "Photo Filtro Azul AR", route: "EXPRESSA_FACETAMENTO" }
  ],
  GRADE_167: [
    { name: "1.67 AR", index: 1.67, material: "Alto Índice 1.67", treatment: "AR", route: "EXPRESSA_FACETAMENTO", defaultCost: "45.00", defaultSale: "150.00" },
    { name: "1.67 FA", index: 1.67, material: "Alto Índice 1.67", treatment: "Filtro Azul AR", route: "EXPRESSA_FACETAMENTO", defaultCost: "55.00", defaultSale: "180.00" }
  ],
  BLOCO_VS: [
    { name: "Bloco VS INCOLOR", index: 1.50, material: "CR-39", treatment: "Incolor", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS AR", index: 1.56, material: "Resina", treatment: "AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS FILTRO AZUL AR", index: 1.56, material: "Resina", treatment: "Filtro Azul AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS PHOTO AR", index: 1.56, material: "Resina", treatment: "Photo AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS PHOTO FILTRO AZUL AR", index: 1.56, material: "Resina", treatment: "Photo Filtro Azul AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS 1.67 AR", index: 1.67, material: "Alto Índice 1.67", treatment: "AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco VS 1.67 FA", index: 1.67, material: "Alto Índice 1.67", treatment: "Filtro Azul AR", route: "SURFACAGEM_CNC" }
  ],
  MF_BLOCO: [
    { name: "Bloco MF INCOLOR 1.50", index: 1.50, material: "CR-39", treatment: "Incolor", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF AR 1.56", index: 1.56, material: "Resina", treatment: "AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF FILTRO AZUL AR 1.56", index: 1.56, material: "Resina", treatment: "Filtro Azul AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF PHOTO AR 1.56", index: 1.56, material: "Resina", treatment: "Photo AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF PHOTO FILTRO AZUL AR 1.56", index: 1.56, material: "Resina", treatment: "Photo Filtro Azul AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF 1.67 AR", index: 1.67, material: "Alto Índice 1.67", treatment: "AR", route: "SURFACAGEM_CNC" },
    { name: "Bloco MF 1.67 FA", index: 1.67, material: "Alto Índice 1.67", treatment: "Filtro Azul AR", route: "SURFACAGEM_CNC" }
  ]
};

export default function UnifiedLensRegister({ initialData = null, onComplete = null }) {
  // Lista de modelos existentes para seleção rápida
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  // Estado Unificado do Formulário (Especificações sem preenchimento automático)
  const [matrixType, setMatrixType] = useState(initialData?.matrixType || 'LP_GRADE');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState('');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [refractiveIndex, setRefractiveIndex] = useState('');
  const [treatment, setTreatment] = useState('');
  
  // BIP & Dados Físicos do Estoque
  const [barcode, setBarcode] = useState(initialData?.barcode || '');
  const [spherical, setSpherical] = useState(initialData?.spherical || '');
  const [cylindrical, setCylindrical] = useState(initialData?.cylindrical || '');
  const [baseCurve, setBaseCurve] = useState(initialData?.baseCurve || '');
  const [addition, setAddition] = useState(initialData?.addition || '');
  const [eye, setEye] = useState(initialData?.eye || 'OD');
  const [locationTag, setLocationTag] = useState(initialData?.locationTag || 'GAVETA-01');
  const [quantity, setQuantity] = useState(initialData?.quantity || 1);

  // Modal / Prompt de Incremento de Estoque para Código Existente
  const [existingBarcodeItem, setExistingBarcodeItem] = useState(null);
  const [incrementQty, setIncrementQty] = useState(1);
  const [incrementing, setIncrementing] = useState(false);

  // Precificação & Políticas
  const [costPrice, setCostPrice] = useState('25.00');
  const [salePrice, setSalePrice] = useState('75.00');
  const [salePriceOverThreshold, setSalePriceOverThreshold] = useState('95.00');
  const [degreeThreshold, setDegreeThreshold] = useState('2.00');
  const [systemParams, setSystemParams] = useState(null);
  const [degreePolicy, setDegreePolicy] = useState(null);

  const [saving, setSaving] = useState(false);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const barcodeInputRef = useRef(null);

  // Carregar modelos cadastrados
  const loadModels = async () => {
    try {
      const res = await LensService.getModels();
      setModels(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
    }
  };

  // Carregar parâmetros globais do sistema e política por grau
  const loadSystemParameters = async () => {
    try {
      const polRes = await DegreePolicyService.getPolicy();
      if (polRes.data) {
        setDegreePolicy(polRes.data);
        if (polRes.data.default_sale_price_le) setSalePrice(parseFloat(polRes.data.default_sale_price_le).toFixed(2));
        if (polRes.data.default_sale_price_gt) setSalePriceOverThreshold(parseFloat(polRes.data.default_sale_price_gt).toFixed(2));
        if (polRes.data.degree_threshold) setDegreeThreshold(parseFloat(polRes.data.degree_threshold).toFixed(2));
      }
      const sysRes = await api.get('/system-parameters/');
      if (sysRes.data) {
        setSystemParams(sysRes.data);
      }
    } catch (e) {
      console.warn("Erro ao carregar parâmetros do sistema:", e);
    }
  };

  useEffect(() => {
    loadModels();
    loadSystemParameters();
  }, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.barcode) setBarcode(initialData.barcode);
      if (initialData.spherical) setSpherical(initialData.spherical);
      if (initialData.cylindrical) setCylindrical(initialData.cylindrical);
      if (initialData.matrixType) setMatrixType(initialData.matrixType);
    }
  }, [initialData]);

  const selectedPresetObj = selectedPresetIndex !== '' ? PRESET_OPTIONS[matrixType]?.[parseInt(selectedPresetIndex, 10)] : null;

  // Seleção de Preset Sugerido da Fábrica (Apenas seleciona modelo de precificação sem auto-preencher os campos de especificação)
  const handlePresetSelect = (idxStr) => {
    setSelectedPresetIndex(idxStr);
  };

  // Seleção de Modelo Existente no Dropdown
  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
    if (modelId === 'NEW_MODEL') {
      setBrand('');
      setMaterial('');
      setRefractiveIndex('');
      setTreatment('');
    } else if (modelId) {
      const found = models.find(m => String(m.id) === String(modelId));
      if (found) {
        setBrand(found.brand || '');
        setMatrixType(found.matrix_type || 'LP_GRADE');
        setMaterial(found.material || '');
        setTreatment(found.treatment || '');
        setRefractiveIndex(found.refractive_index ? String(found.refractive_index) : '');
        if (found.cost_price) setCostPrice(parseFloat(found.cost_price).toFixed(2));
        if (found.sale_price) setSalePrice(parseFloat(found.sale_price).toFixed(2));
      }
    }
  };

  // Resolução da chave do preset para preço por grau
  const resolvePresetKey = () => {
    if (matrixType === 'GRADE_167' || parseFloat(refractiveIndex) === 1.67) return null;
    if (selectedPresetObj?.paramKey) return selectedPresetObj.paramKey;
    const b = (brand || '').toUpperCase();
    const t = (treatment || '').toUpperCase();
    const m = (material || '').toUpperCase();
    const idx = parseFloat(refractiveIndex);

    if (t.includes('FILTRO AZUL') || t.includes('BLUE')) {
      if (t.includes('PHOTO') || t.includes('FOTO')) return 'lp_photo_filtro_azul_ar_156';
      if (idx === 1.59 || m.includes('POLY')) return 'lp_poly_filtro_azul_ar_159';
      return 'lp_filtro_azul_ar_156';
    }
    if (t.includes('PHOTO') || t.includes('FOTO')) return 'lp_photo_ar_156';
    if (idx === 1.59 || m.includes('POLY')) return 'lp_poly_ar_159';
    if (idx === 1.50 || t.includes('INCOLOR')) return 'lp_incolor_150';
    if (idx === 1.56 || t.includes('AR')) return 'lp_ar_156';
    return null;
  };

  // Cálculo ao vivo do preço por grau
  const getPresetLiveCalculatedPrice = () => {
    let sphVal = parseFloat(spherical) || 0.0;
    let cylVal = parseFloat(cylindrical) || 0.0;

    if (cylVal > 0) {
      sphVal = sphVal + cylVal;
      cylVal = -cylVal;
    }

    const absSph = Math.abs(sphVal);
    const absCyl = Math.abs(cylVal);

    const pk = resolvePresetKey();
    let base = selectedPresetObj?.defaultBase || degreePolicy?.default_sale_price_le || '75.00';
    let over = selectedPresetObj?.defaultOver || degreePolicy?.default_sale_price_gt || '95.00';
    let thresh = degreePolicy?.degree_threshold || '2.00';

    if (pk && systemParams) {
      if (systemParams[`${pk}_price_base`]) base = systemParams[`${pk}_price_base`];
      if (systemParams[`${pk}_price_over`]) over = systemParams[`${pk}_price_over`];
      if (systemParams[`${pk}_cyl_threshold`]) thresh = systemParams[`${pk}_cyl_threshold`];
    }

    const basePriceNum = parseFloat(base) || 75.00;
    const overPriceNum = parseFloat(over) || 95.00;
    const threshNum = parseFloat(thresh) || 2.00;

    const hasDegreeInput = (spherical !== '' && spherical !== null && spherical !== undefined) ||
                           (cylindrical !== '' && cylindrical !== null && cylindrical !== undefined);
    const isHigh = absSph > 4.00 || absCyl > threshNum;
    const price = isHigh ? overPriceNum : basePriceNum;

    return { sphVal, cylVal, absSph, absCyl, thresh: threshNum, isHigh, price, basePrice: basePriceNum, overPrice: overPriceNum, hasDegreeInput };
  };

  // Atualizar preços quando o grau, preset ou matriz alteram
  useEffect(() => {
    if (selectedPresetObj) {
      setMaterial(selectedPresetObj.material || '');
      setRefractiveIndex(String(selectedPresetObj.index || '1.56'));
      setTreatment(selectedPresetObj.treatment || '');
      if (selectedPresetObj.defaultCost) setCostPrice(selectedPresetObj.defaultCost);
      if (selectedPresetObj.defaultSale) setSalePrice(selectedPresetObj.defaultSale);
    }

    if (matrixType === 'LP_GRADE') {
      const calc = getPresetLiveCalculatedPrice();
      setSalePrice(calc.price.toFixed(2));
      setSalePriceOverThreshold(calc.overPrice.toFixed(2));
      setDegreeThreshold(calc.thresh.toFixed(2));
    }
  }, [selectedPresetIndex, matrixType, spherical, cylindrical, material, refractiveIndex, treatment, systemParams, degreePolicy]);

  // Verificar ou bipar o código de barras SEM incremento automático (Solicita quantidade se já existir)
  const handleScanOrVerifyBarcode = async (codeToTest) => {
    const code = (codeToTest || barcode).trim();
    if (!code) return;

    setCheckingBarcode(true);
    setFeedback(null);
    setExistingBarcodeItem(null);

    try {
      // Consulta se o código já existe no estoque
      const response = await api.get(`/inventory/by-barcode/${encodeURIComponent(code)}`);
      const item = response.data;
      if (item) {
        setExistingBarcodeItem(item);
        const activeQty = parseInt(quantity, 10) || 1;
        setIncrementQty(activeQty);
        setBarcode(code);

        // Preenche campos para conferência no formulário
        if (item.lens_model) {
          setBrand(item.lens_model.brand || '');
          setMaterial(item.lens_model.material || '');
          setTreatment(item.lens_model.treatment || '');
          setRefractiveIndex(String(item.lens_model.refractive_index || '1.56'));
          setMatrixType(item.lens_model.matrix_type || 'LP_GRADE');
        }
        if (item.spherical !== undefined) setSpherical(String(item.spherical));
        if (item.cylindrical !== undefined) setCylindrical(String(item.cylindrical));
        if (item.location_tag) setLocationTag(item.location_tag);

        setFeedback({
          type: 'warning',
          message: `Lente com código '${code}' já cadastrada! Defina abaixo a quantidade que deseja adicionar ao estoque.`,
          detail: `${item.lens_model?.brand || 'Lente'} | ESF: ${item.spherical || '0.00'} | CIL: ${item.cylindrical || '0.00'} | Saldo Atual: ${item.quantity_available} un | Gaveta: ${item.location_tag || 'N/I'}`
        });
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setBarcode(code);
        setExistingBarcodeItem(null);
        setFeedback({
          type: 'success',
          message: `Código BIP '${code}' válido e inédito! Preencha as especificações da lente e clique em 'Registrar Entrada no Estoque'.`,
        });
      } else {
        console.error(err);
        setBarcode(code);
        setFeedback({ type: 'warning', message: `Código '${code}' pronto para cadastro.` });
      }
    } finally {
      setCheckingBarcode(false);
    }
  };

  // Confirmar incremento de estoque da lente já cadastrada
  const handleConfirmIncrement = async () => {
    if (!existingBarcodeItem) return;
    const qty = parseInt(incrementQty, 10) || parseInt(quantity, 10) || 1;
    if (isNaN(qty) || qty <= 0) {
      alert("Informe uma quantidade válida maior que zero.");
      return;
    }

    setIncrementing(true);
    try {
      const response = await InventoryService.scan({
        barcode: existingBarcodeItem.barcode,
        quantity: qty
      });

      const updatedItem = response.data.item;
      const newTotal = updatedItem ? updatedItem.quantity_available : (existingBarcodeItem.quantity_available + qty);

      setFeedback({
        type: 'success',
        message: `⚡ BIP Sucesso! Saldo incrementado (+${qty}) no estoque para a lente existente (${existingBarcodeItem.barcode}).`,
        detail: `${existingBarcodeItem.lens_model?.brand || 'Lente'} | ESF: ${existingBarcodeItem.spherical || '0.00'} | CIL: ${existingBarcodeItem.cylindrical || '0.00'} | NOVO SALDO: ${newTotal} un | Gaveta: ${existingBarcodeItem.location_tag || 'N/I'}`
      });

      setExistingBarcodeItem(null);
      setBarcode('');
      setSpherical('');
      setCylindrical('');
      setQuantity(1);
      setIncrementQty(1);
      if (onComplete) onComplete();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: formatErrorMessage(err, "Erro ao incrementar estoque.") });
    } finally {
      setIncrementing(false);
    }
  };

  const formatErrorMessage = (err, defaultMsg) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map(d => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(' | ');
    }
    if (detail && typeof detail === 'object') {
      return detail.msg || JSON.stringify(detail);
    }
    return err.message || defaultMsg;
  };

  // Salvar Modelo & Item de Estoque Unificado
  const handleSaveLens = async (e) => {
    e.preventDefault();

    // Se o item já existia e o usuário submeter o formulário sem ter clicado em Confirmar Incremento, aciona o incremento diretamente
    if (existingBarcodeItem) {
      await handleConfirmIncrement();
      return;
    }

    const finalBrand = brand.trim();
    if (!finalBrand) {
      alert("Informe a Marca Comercial da Lente.");
      return;
    }

    const isMultifocal = (matrixType === 'MF_ACB' || matrixType === 'MF_BLOCO');
    if (isMultifocal) {
      if (baseCurve === '' || baseCurve === null || baseCurve === undefined) {
        setFeedback({ type: 'error', message: 'Para matrizes Multifocal (MF_ACB / MF_BLOCO), o campo Curva Base é obrigatório.' });
        return;
      }
      if (addition === '' || addition === null || addition === undefined) {
        setFeedback({ type: 'error', message: 'Para matrizes Multifocal (MF_ACB / MF_BLOCO), o campo Adição (ADD) é obrigatório.' });
        return;
      }
    }

    const parseNum = (val, fallback = 0.0) => {
      if (val === '' || val === null || val === undefined) return fallback;
      const parsed = parseFloat(String(val).replace(',', '.'));
      return isNaN(parsed) ? fallback : parsed;
    };

    // Validação de Limites de Dioptria para Visão Simples LP (Esférico -6 a +6 / Cilíndrico 0 a -4)
    if (matrixType === 'LP_GRADE') {
      let rawSph = spherical !== '' && spherical !== null && spherical !== undefined ? parseNum(spherical, 0.0) : 0.0;
      let rawCyl = cylindrical !== '' && cylindrical !== null && cylindrical !== undefined ? parseNum(cylindrical, 0.0) : 0.0;

      if (rawCyl > 0) {
        rawSph = rawSph + rawCyl;
        rawCyl = -rawCyl;
      }

      if (rawSph < -6.00 || rawSph > 6.00) {
        setFeedback({
          type: 'error',
          message: `O Grau Esférico (${rawSph > 0 ? '+' : ''}${rawSph.toFixed(2)}) está fora do limite permitido para a grade Visão Simples LP (-6.00D a +6.00D).`
        });
        return;
      }

      if (rawCyl < -4.00 || rawCyl > 0.00) {
        setFeedback({
          type: 'error',
          message: `O Grau Cilíndrico (${rawCyl.toFixed(2)}) está fora do limite permitido para a grade Visão Simples LP (0.00D a -4.00D).`
        });
        return;
      }
    }

    setSaving(true);
    setFeedback(null);

    try {
      // 1. Gera código de barras final ou código interno automático
      const finalBarcode = (barcode && barcode.trim()) ? barcode.trim() : 'INT-' + Math.floor(1000000000 + Math.random() * 9000000000);
      const baseQty = parseInt(quantity) || 1;

      // 2. Criar ou obter modelo de lente comercial (passa o código de barras para ser salvo no SKU do produto)
      const modelPayload = {
        code: finalBarcode,
        brand: finalBrand,
        name: finalBrand,
        material: material || selectedPresetObj?.material || 'Resina',
        refractive_index: parseNum(refractiveIndex || selectedPresetObj?.index, 1.56),
        treatment: treatment || selectedPresetObj?.treatment || 'Incolor',
        diameter: 70,
        matrix_type: matrixType,
        production_route: selectedPresetObj?.route || 'EXPRESSA_FACETAMENTO',
        cost_price: parseNum(costPrice, 25.00),
        sale_price: parseNum(salePrice, 75.00),
        degree_threshold: parseNum(degreeThreshold, 2.00),
        sale_price_over_threshold: parseNum(salePriceOverThreshold, 95.00)
      };
      const modelRes = await LensService.createModel(modelPayload);
      const createdModel = modelRes.data;

      if (isMultifocal && eye === 'OD_OE') {
        await InventoryService.registerFallback({
          barcode: `${finalBarcode}-OD`,
          lens_model_id: createdModel.id,
          spherical: 0.0,
          cylindrical: 0.0,
          base_curve: baseCurve !== '' ? parseNum(baseCurve, 0.0) : 0.0,
          addition: addition !== '' ? parseNum(addition, 0.0) : 0.0,
          eye: 'OD',
          quantity_available: baseQty,
          quantity: baseQty,
          location_tag: locationTag || 'GAVETA-01'
        });
        await InventoryService.registerFallback({
          barcode: `${finalBarcode}-OE`,
          lens_model_id: createdModel.id,
          spherical: 0.0,
          cylindrical: 0.0,
          base_curve: baseCurve !== '' ? parseNum(baseCurve, 0.0) : 0.0,
          addition: addition !== '' ? parseNum(addition, 0.0) : 0.0,
          eye: 'OE',
          quantity_available: baseQty,
          quantity: baseQty,
          location_tag: locationTag || 'GAVETA-01'
        });
      } else {
        const finalEye = isMultifocal ? (eye || 'OD') : null;
        await InventoryService.registerFallback({
          barcode: finalBarcode,
          lens_model_id: createdModel.id,
          spherical: spherical !== '' ? parseNum(spherical, 0.0) : 0.0,
          cylindrical: cylindrical !== '' ? parseNum(cylindrical, 0.0) : 0.0,
          base_curve: baseCurve !== '' ? parseNum(baseCurve, 0.0) : (isMultifocal ? 0.0 : null),
          addition: addition !== '' ? parseNum(addition, 0.0) : (isMultifocal ? 0.0 : null),
          eye: finalEye,
          quantity_available: baseQty,
          quantity: baseQty,
          location_tag: locationTag || 'GAVETA-01'
        });
      }

      setFeedback({ 
        type: 'success', 
        message: `Lente '${finalBrand}' (${matrixType}) registrada com sucesso no estoque! Código de Barras: ${finalBarcode}` 
      });

      // Limpa dados para nova entrada
      setBarcode('');
      setSpherical('');
      setCylindrical('');
      setBaseCurve('');
      setAddition('');
      setSelectedPresetIndex('');
      setQuantity(1);
      setIncrementQty(1);
      if (onComplete) onComplete();
      await loadModels();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: formatErrorMessage(err, "Erro ao salvar item no estoque.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={28} style={{ color: 'hsl(var(--primary))' }} />
            Cadastrador Unificado de Lentes
          </h1>
          <p className="page-subtitle">
            Cadastro de modelos comerciais, dioptrias e inserção direta no estoque via código de barras (digitado ou bipado).
          </p>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: feedback.type === 'success' ? 'rgba(34,197,94,0.15)' : feedback.type === 'warning' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
          border: feedback.type === 'success' ? '1px solid rgba(34,197,94,0.4)' : feedback.type === 'warning' ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(239,68,68,0.4)',
          color: feedback.type === 'success' ? '#166534' : feedback.type === 'warning' ? '#854d0e' : '#991b1b',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          {feedback.message}
          {feedback.detail && <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>{feedback.detail}</div>}
        </div>
      )}

      {/* Caixa Interativa de Solicitação de Quantidade quando o Código de Barras já existe */}
      {existingBarcodeItem && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)',
          border: '2px solid rgba(234, 179, 8, 0.6)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(234, 179, 8, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
              <Zap size={22} style={{ color: '#d97706' }} /> LENTE JÁ CADASTRADA NO ESTOQUE
            </h3>
            <button 
              type="button" 
              onClick={() => setExistingBarcodeItem(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#854d0e' }}
            >
              <X size={20} />
            </button>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#78350f', fontWeight: 600 }}>
            O código de barras <strong style={{ fontFamily: 'monospace' }}>{existingBarcodeItem.barcode}</strong> já possui cadastro ({existingBarcodeItem.lens_model?.brand || 'Lente'} | ESF: {existingBarcodeItem.spherical || '0.00'} | CIL: {existingBarcodeItem.cylindrical || '0.00'}). Informe a quantidade que deseja adicionar ao estoque:
          </p>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#78350f' }}>Quantidade a Adicionar:</label>
              <input 
                type="number" 
                min="1" 
                value={incrementQty} 
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setIncrementQty(val);
                  setQuantity(val);
                }}
                style={{
                  width: '90px',
                  padding: '8px 12px',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'black',
                  borderRadius: '8px',
                  border: '2px solid #d97706',
                  textAlign: 'center'
                }}
                autoFocus
              />
            </div>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleConfirmIncrement}
              disabled={incrementing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontWeight: 700,
                backgroundColor: '#d97706',
                borderColor: '#b45309'
              }}
            >
              {incrementing ? <RefreshCw className="animate-spin" size={18} /> : <PlusCircle size={18} />}
              {incrementing ? 'Adicionando...' : `Confirmar Adição (+${incrementQty})`}
            </button>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setExistingBarcodeItem(null)}
              style={{ fontWeight: 600 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* FORMULÁRIO UNIFICADO DE CADASTRO */}
      <form onSubmit={handleSaveLens} className="glass-panel" style={{ padding: '24px' }}>
        
        {/* Passos 1 & 2: Seleção de Matriz & Presets Sugeridos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold' }}>1. SELECIONE A MATRIZ DE ESTOQUE *</label>
            <select 
              className="form-control"
              value={matrixType}
              onChange={(e) => {
                setMatrixType(e.target.value);
                setSelectedPresetIndex('');
              }}
              style={{ color: 'black', fontWeight: 700, fontSize: '0.95rem' }}
            >
              <option value="LP_GRADE">Visão Simples Lente Pronta (LP_GRADE)</option>
              <option value="GRADE_167">Grade 1.67 Alto Índice (GRADE_167)</option>
              <option value="MF_ACB">Multifocal Acabado (MF_ACB)</option>
              <option value="BLOCO_VS">Bloco Visão Simples (BLOCO_VS)</option>
              <option value="MF_BLOCO">Bloco Multifocal (MF_BLOCO)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold' }}>2. PRESET SUGERIDO DA FÁBRICA</label>
            <select 
              className="form-control"
              value={selectedPresetIndex}
              onChange={(e) => handlePresetSelect(e.target.value)}
              style={{ color: 'black', fontWeight: 600 }}
            >
              <option value="">-- Selecione para Preenchimento Automático --</option>
              {(PRESET_OPTIONS[matrixType] || []).map((preset, idx) => (
                <option key={idx} value={idx}>
                  {preset.name} ({preset.material} - {preset.treatment})
                </option>
              ))}
            </select>
          </div>

          {/* Seleção opcional de modelo existente */}
          {models.length > 0 && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                Ou selecione um modelo comercial pré-cadastrado no sistema:
              </label>
              <select 
                className="form-control"
                value={selectedModelId}
                onChange={(e) => handleModelSelect(e.target.value)}
                style={{ color: 'black', fontSize: '0.85rem' }}
              >
                <option value="">-- Seleção Opcional de Modelo Existente --</option>
                <option value="NEW_MODEL">➕ Novo Modelo Comercial Personalizado</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.brand} — [{m.matrix_type}] ({m.material} - {m.treatment})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Especificações do Modelo Comercial de Lente */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>
            Especificações do Modelo Comercial de Lente
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 'bold' }}>MARCA COMERCIAL *</label>
              <input 
                type="text" 
                placeholder="Ex: Hoya, Essilor, Zeiss ou Marca Própria"
                className="form-control"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                style={{ color: 'black', fontWeight: 700 }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">MATERIAL DA LENTE</label>
              <input 
                type="text" 
                placeholder="Resina, Policarbonato, CR-39"
                className="form-control"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ÍNDICE DE REFRAÇÃO</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="1.56"
                className="form-control"
                value={refractiveIndex}
                onChange={(e) => setRefractiveIndex(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">TRATAMENTO INCLUSO</label>
              <input 
                type="text" 
                placeholder="Incolor, AR, Filtro Azul AR"
                className="form-control"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>

            {/* CAMPO DE CÓDIGO DE BARRAS DIGITADO OU BIPADO */}
            <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(59,130,246,0.06)', padding: '14px', borderRadius: '10px', border: '1px dashed rgba(59,130,246,0.4)', marginTop: '4px' }}>
              <label className="form-label" style={{ fontWeight: 'bold', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode size={18} style={{ color: '#2563eb' }} /> CÓDIGO DE BARRAS / EAN (DIGITADO OU BIPADO VIA LEITOR USB)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                  ⚡ Leitor USB Ativo
                </span>
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input 
                  ref={barcodeInputRef}
                  type="text" 
                  placeholder="Digite ou bipe o código de barras com o leitor USB..."
                  className="form-control"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScanOrVerifyBarcode(barcode);
                    }
                  }}
                  style={{ color: 'black', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem', flex: 1, minWidth: '220px', border: '1px solid #3b82f6', background: '#ffffff' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleScanOrVerifyBarcode(barcode)}
                  disabled={checkingBarcode}
                  title="Testar ou Bipar Código via Leitor USB"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontWeight: 600, padding: '0 16px' }}
                >
                  {checkingBarcode ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />} 
                  {checkingBarcode ? 'Bipando...' : 'Bipar / Verificar'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    const generated = 'INT-' + Math.floor(1000000000 + Math.random() * 9000000000);
                    setBarcode(generated);
                    setFeedback({ type: 'success', message: `Código interno gerado: ${generated}` });
                  }}
                  title="Gerar código interno automático"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                >
                  Gerar Código Interno
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Dioptria Inicial para Saldo em Estoque */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
            Dioptria Inicial para Saldo em Estoque (Opcional)
          </h4>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            Preencha caso deseje alimentar o estoque desta dioptria no momento do cadastro do modelo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {(matrixType === 'LP_GRADE' || matrixType === 'GRADE_167') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>ESFÉRICO (ESF)</label>
                <input 
                  type="number" 
                  step="0.25"
                  placeholder="Ex: -2.00"
                  className="form-control"
                  value={spherical}
                  onChange={(e) => setSpherical(e.target.value)}
                  style={{ color: 'black', fontWeight: 'bold', fontSize: '1rem' }}
                />
              </div>
            )}

            {(matrixType === 'LP_GRADE' || matrixType === 'GRADE_167') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>CILÍNDRICO (CIL)</label>
                <input 
                  type="number" 
                  step="0.25"
                  placeholder="Ex: -1.00"
                  className="form-control"
                  value={cylindrical}
                  onChange={(e) => setCylindrical(e.target.value)}
                  style={{ color: 'black', fontWeight: 'bold', fontSize: '1rem' }}
                />
              </div>
            )}

            {(matrixType === 'BLOCO_VS' || matrixType === 'MF_BLOCO' || matrixType === 'MF_ACB') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>CURVA BASE *</label>
                <input 
                  type="number" 
                  step="0.25"
                  placeholder="Ex: 4.00"
                  className="form-control"
                  value={baseCurve}
                  onChange={(e) => setBaseCurve(e.target.value)}
                  style={{ color: 'black', fontWeight: 'bold', fontSize: '1rem' }}
                />
              </div>
            )}

            {(matrixType === 'MF_ACB' || matrixType === 'MF_BLOCO') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>ADIÇÃO (ADD) *</label>
                <input 
                  type="number" 
                  step="0.25"
                  placeholder="Ex: +2.00"
                  className="form-control"
                  value={addition}
                  onChange={(e) => setAddition(e.target.value)}
                  style={{ color: 'black', fontWeight: 'bold', fontSize: '1rem' }}
                />
              </div>
            )}

            {(matrixType === 'MF_ACB' || matrixType === 'MF_BLOCO') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#1e40af' }}>OLHO (D/E) *</label>
                <select 
                  className="form-control"
                  value={eye || 'OD'}
                  onChange={(e) => setEye(e.target.value)}
                  style={{ color: 'black', fontWeight: 600 }}
                >
                  <option value="OD">Somente OD (Olho Direito)</option>
                  <option value="OE">Somente OE (Olho Esquerdo)</option>
                  <option value="OD_OE">Par Completo (OD + OE Simultâneo)</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">GAVETA / LOCALIZAÇÃO</label>
              <input 
                type="text" 
                placeholder="GAVETA-01"
                className="form-control"
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>
          </div>
        </div>

        {/* Valores Financeiros e Quantidade */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold' }}>PREÇO DE CUSTO (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className="form-control"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
              💰 PREÇO DE VENDA (R$) *
            </label>
            <input 
              type="number" 
              step="0.01"
              placeholder="0.00"
              className="form-control"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              style={{ color: 'black', fontWeight: 'bold', fontSize: '1rem' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
              📦 QUANTIDADE DE LENTES A INSERIR *
            </label>
            <input 
              type="number" 
              min="1"
              className="form-control"
              value={quantity}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setQuantity(val);
                setIncrementQty(val);
              }}
              style={{ color: 'black', fontWeight: 'bold', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.4)' }}
              required
            />
          </div>

          {/* Banner de Aplicação da Política de Preço por Grau */}
          {matrixType === 'LP_GRADE' && (() => {
            const calc = getPresetLiveCalculatedPrice();
            if (calc.hasDegreeInput) {
              if (calc.isHigh) {
                return (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.5)',
                    color: '#854d0e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}>
                    <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>⚡ Política de Preço por Grau: APLICADA (Grau Alto)</div>
                      <div style={{ fontSize: '0.83rem', opacity: 0.9, marginTop: '2px' }}>
                        O grau informado (Esférico: {spherical || '0.00'}, Cilíndrico: {cylindrical || '0.00'}) atinge o critério de Grau Alto (|ESF| &gt; 4.00D ou |CIL| &gt; {calc.thresh.toFixed(2)}D). Preço de venda ajustado para R$ {calc.price.toFixed(2)}.
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.5)',
                    color: '#14532d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}>
                    <CheckCircle size={22} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>✅ Política de Preço por Grau: NÃO APLICADA (Grau Padrão)</div>
                      <div style={{ fontSize: '0.83rem', opacity: 0.9, marginTop: '2px' }}>
                        O grau informado (Esférico: {spherical || '0.00'}, Cilíndrico: {cylindrical || '0.00'}) está dentro da faixa base (≤ {calc.thresh.toFixed(2)}D CIL). Preço de venda base mantido em R$ {calc.price.toFixed(2)}.
                      </div>
                    </div>
                  </div>
                );
              }
            } else {
              return (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 600
                }}>
                  <FileText size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>ℹ️ Avaliação da Política de Preço por Grau</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>
                      Insira as dioptrias esférica/cilíndrica acima para verificar se a política de grau alto (&gt; {calc.thresh.toFixed(2)}D CIL) será aplicada a este item.
                    </div>
                  </div>
                </div>
              );
            }
          })()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontWeight: 700, fontSize: '0.95rem' }}>
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Check size={20} />}
            {saving ? "Salvando Lente..." : "Registrar Entrada no Estoque"}
          </button>
        </div>
      </form>
    </div>
  );
}
