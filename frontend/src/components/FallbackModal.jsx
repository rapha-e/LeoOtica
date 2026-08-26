import React, { useEffect, useState, useRef } from 'react';
import { LensService, InventoryService, DegreePolicyService } from '../services/api';
import { X, CheckCircle, HelpCircle, AlertTriangle, Sliders, Barcode } from 'lucide-react';

const FallbackModal = ({ 
  barcode = '', 
  initialQty = 1, 
  initialSpherical = '', 
  initialCylindrical = '', 
  initialLensModelId = '', 
  initialRefractiveIndex = '',
  is167Mode = false,
  onClose, 
  onSuccess 
}) => {
  const [models, setModels] = useState([]);
  const [useExistingModel, setUseExistingModel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const is167Active = is167Mode || initialRefractiveIndex === 1.67 || initialRefractiveIndex === '1.67';

  // Política Global por Grau
  const [activePolicy, setActivePolicy] = useState(null);
  const [policyWarning, setPolicyWarning] = useState(false);
  const [calculatedMagnitude, setCalculatedMagnitude] = useState(null);

  // Código de barras local
  const [localBarcode, setLocalBarcode] = useState(barcode || '');

  const barcodeInputRef = useRef(null);

  useEffect(() => {
    if (!barcode && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current.focus(), 150);
    }
  }, [barcode]);

  // Campos da Dioptria
  const [spherical, setSpherical] = useState(initialSpherical || '');
  const [cylindrical, setCylindrical] = useState(initialCylindrical || '');
  const [locationTag, setLocationTag] = useState('');
  const [qty, setQty] = useState(initialQty);

  // Campos do modelo de lente (se for inédito)
  const [lensModelId, setLensModelId] = useState(initialLensModelId || '');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState(is167Active ? 'Grade 1.67 Asférica' : '');
  const [matrixType, setMatrixType] = useState(is167Active ? 'GRADE_167' : 'LP_GRADE');
  const [material, setMaterial] = useState(is167Active ? '1.67 High Index' : '');
  const [refractiveIndex, setRefractiveIndex] = useState(is167Active ? '1.67' : (initialRefractiveIndex ? String(initialRefractiveIndex) : ''));
  const [treatment, setTreatment] = useState(is167Active ? '1.67 AR' : '');
  const [diameter, setDiameter] = useState('70');
  const [costPrice, setCostPrice] = useState(is167Active ? '45.00' : '25.00');
  const [salePrice, setSalePrice] = useState(is167Active ? '150.00' : '75.00');
  const [degreeThreshold, setDegreeThreshold] = useState('2.00');
  const [salePriceOverThreshold, setSalePriceOverThreshold] = useState(is167Active ? '180.00' : '95.00');
  const [systemParams, setSystemParams] = useState({});

  const LP_TREATMENTS_OPTIONS = [
    { id: 'LP incolor 1.50', label: 'LP incolor 1.50', material: 'Resina', refractive_index: '1.50', keyPrefix: 'lp_incolor_150', defaultBase: '60.00', defaultOver: '80.00' },
    { id: 'LP Ar 1.56', label: 'LP Ar 1.56', material: 'Resina', refractive_index: '1.56', keyPrefix: 'lp_ar_156', defaultBase: '75.00', defaultOver: '95.00' },
    { id: 'LP filtro Azul AR 1.56', label: 'LP filtro Azul AR 1.56', material: 'Resina', refractive_index: '1.56', keyPrefix: 'lp_filtro_azul_ar_156', defaultBase: '95.00', defaultOver: '125.00' },
    { id: 'LP POLY AR 1.59', label: 'LP POLY AR 1.59', material: 'Policarbonato', refractive_index: '1.59', keyPrefix: 'lp_poly_ar_159', defaultBase: '110.00', defaultOver: '140.00' },
    { id: 'LP POLY FILTRO AZUL AR 1.59', label: 'LP POLY FILTRO AZUL AR 1.59', material: 'Policarbonato', refractive_index: '1.59', keyPrefix: 'lp_poly_filtro_azul_ar_159', defaultBase: '130.00', defaultOver: '165.00' },
    { id: 'LP PHOTO AR 1.56', label: 'LP PHOTO AR 1.56', material: 'Fotocromática', refractive_index: '1.56', keyPrefix: 'lp_photo_ar_156', defaultBase: '145.00', defaultOver: '185.00' },
    { id: 'LP PHOTO FILTRO AZUL AR 1.56', label: 'LP PHOTO FILTRO AZUL AR 1.56', material: 'Fotocromática', refractive_index: '1.56', keyPrefix: 'lp_photo_filtro_azul_ar_156', defaultBase: '170.00', defaultOver: '215.00' }
  ];

  const OPTIONS_167 = [
    { id: '1.67 AR', label: '1.67 AR', material: '1.67 High Index', refractive_index: '1.67', defaultCost: '45.00', defaultSale: '150.00', defaultOver: '180.00' },
    { id: '1.67 FA', label: '1.67 FA', material: '1.67 High Index', refractive_index: '1.67', defaultCost: '55.00', defaultSale: '180.00', defaultOver: '210.00' }
  ];

  const loadSystemParams = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('factory_token');
      const res = await fetch('/api/v1/system-parameters/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSystemParams(data);
      }
    } catch (err) {
      console.warn("Erro ao buscar parâmetros no FallbackModal:", err);
    }
  };

  const loadPolicyAndModels = async () => {
    try {
      const polRes = await DegreePolicyService.getPolicy();
      if (polRes.data && polRes.data.is_active) {
        setActivePolicy(polRes.data);
        setDegreeThreshold(polRes.data.degree_threshold?.toString() || '2.00');
        setSalePrice(polRes.data.default_sale_price_le?.toString() || '75.00');
        setSalePriceOverThreshold(polRes.data.default_sale_price_gt?.toString() || '95.00');
        setPolicyWarning(false);
      } else {
        setPolicyWarning(true);
      }
    } catch (err) {
      console.warn("Erro ao carregar política:", err);
    }
  };

  const handleSelectLpTreatment = (treatmentId, currentParams = systemParams) => {
    const item = LP_TREATMENTS_OPTIONS.find(t => t.id === treatmentId) || LP_TREATMENTS_OPTIONS[0];
    const baseKey = `${item.keyPrefix}_price_base`;
    const overKey = `${item.keyPrefix}_price_over`;
    const threshKey = `${item.keyPrefix}_cyl_threshold`;

    const priceBase = currentParams[baseKey] || item.defaultBase;
    const priceOver = currentParams[overKey] || item.defaultOver;
    const cylThresh = currentParams[threshKey] || '2.00';

    setTreatment(item.id);
    setMaterial(item.material);
    setRefractiveIndex(item.refractive_index);
    setSalePrice(parseFloat(priceBase).toFixed(2));
    setSalePriceOverThreshold(parseFloat(priceOver).toFixed(2));
    setDegreeThreshold(parseFloat(cylThresh).toFixed(2));
  };

  const handleSelectTreatment = (treatmentId) => {
    if (is167Active) {
      const item = OPTIONS_167.find(t => t.id === treatmentId) || OPTIONS_167[0];
      setTreatment(item.id);
      setMaterial(item.material);
      setRefractiveIndex(item.refractive_index);
      setCostPrice(item.defaultCost);
      setSalePrice(item.defaultSale);
      setSalePriceOverThreshold(item.defaultOver);
      setBrand(`NovaLab ${item.id}`);
    } else {
      handleSelectLpTreatment(treatmentId);
    }
  };

  const loadModels = async () => {
    try {
      const response = await LensService.getModels();
      setModels(response.data);
      if (initialLensModelId) {
        setLensModelId(initialLensModelId.toString());
      } else if (response.data.length > 0) {
        setLensModelId(response.data[0].id.toString());
      } else {
        setUseExistingModel(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPolicyAndModels();
    loadSystemParams();
    loadModels();
  }, []);

  // Efeito de Cálculo Automático do Preço de Venda com base nos Graus informados e na Regra Global
  useEffect(() => {
    if (spherical !== '' || cylindrical !== '') {
      const parseLocaleFloat = (val) => {
        if (val === undefined || val === null || val === '') return 0;
        const str = String(val).replace(',', '.');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
      };

      const sphVal = parseLocaleFloat(spherical);
      const cylVal = parseLocaleFloat(cylindrical);

      let finalSph = sphVal;
      let finalCyl = cylVal;

      if (cylVal > 0) {
        finalSph = sphVal + cylVal;
        finalCyl = -cylVal;
      }

      const absSph = Math.abs(finalSph);
      const absCyl = Math.abs(finalCyl);
      setCalculatedMagnitude(Math.max(absSph, absCyl));

      if (activePolicy) {
        const threshold = parseFloat(activePolicy.degree_threshold || 2.00);
        const isOverThreshold = absSph > 4.00 || absCyl > threshold;
        const priceBase = activePolicy.default_sale_price_le?.toString() || '75.00';
        const priceOver = activePolicy.default_sale_price_gt?.toString() || '95.00';

        setSalePrice(isOverThreshold ? priceOver : priceBase);
        setSalePriceOverThreshold(priceOver);
      }
    }
  }, [spherical, cylindrical, activePolicy]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parseLocaleFloat = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      const str = String(val).replace(',', '.');
      const parsed = parseFloat(str);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Validações básicas
    if (spherical === '' || cylindrical === '') {
      setError("Os graus esférico e cilíndrico são obrigatórios.");
      setLoading(false);
      return;
    }

    let finalBarcode = localBarcode.trim();
    if (!finalBarcode) {
      // Gera código de barras automático caso seja manual e não tenha sido informado
      finalBarcode = 'GEN-' + Date.now() + Math.floor(Math.random() * 1000);
    }

    const sphVal = parseLocaleFloat(spherical);
    const cylVal = parseLocaleFloat(cylindrical);

    let finalSph = sphVal;
    let finalCyl = cylVal;

    // Se o Grau Cilíndrico for positivo, transpõe para Cilíndrico Negativo
    if (cylVal > 0) {
      finalSph = sphVal + cylVal;
      finalCyl = -cylVal;
    }

    const payload = {
      spherical: finalSph,
      cylindrical: finalCyl,
      barcode: finalBarcode,
      location_tag: locationTag || null,
      quantity_available: parseInt(qty) || 1,
      quantity: parseInt(qty) || 1
    };

    console.log("FallbackModal Submit Debug:", {
      useExistingModel,
      lensModelId,
      brand,
      material,
      refractiveIndex,
      treatment,
      diameter,
      spherical,
      cylindrical,
      qty
    });

    if (useExistingModel) {
      if (!lensModelId) {
        setError("Por favor, selecione um modelo de lente.");
        setLoading(false);
        return;
      }
      payload.lens_model_id = lensModelId;
    } else {
      if (!brand || !material || !refractiveIndex || !treatment || !diameter) {
        setError("Todos os atributos do modelo de lente são obrigatórios.");
        setLoading(false);
        return;
      }
      payload.brand = brand;
      payload.name = name || brand;
      payload.matrix_type = matrixType || 'LP_GRADE';
      payload.material = material;
      payload.refractive_index = parseLocaleFloat(refractiveIndex);
      payload.treatment = treatment;
      payload.diameter = parseInt(diameter);
      payload.cost_price = parseLocaleFloat(costPrice);
      payload.average_cost_price = parseLocaleFloat(costPrice);
    }


    try {
      const response = await InventoryService.registerFallback(payload);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Erro ao registrar a lente. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle style={{ color: 'hsl(var(--warning))' }} /> {barcode ? "Código de Barras Inédito" : "Inserir Lente Manualmente"}
          </h3>
          <p style={{ fontSize: '0.85rem' }}>
            {barcode 
              ? "Identificamos um código não registrado. Vincule-o a uma dioptria e gaveta física." 
              : "Preencha os dados abaixo para cadastrar uma nova lente no estoque."}
          </p>
        </div>

        {policyWarning && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>⚠️ Atenção: A regra de preço por grau não está cadastrada. Por favor, acesse o menu <strong>Sistema & IA &gt; Parâmetros do Sistema</strong> para cadastrar a tabela de preços.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group" style={{ background: 'rgba(59,130,246,0.08)', padding: '14px', borderRadius: '10px', border: '1.5px solid rgba(59,130,246,0.4)' }}>
            <label className="form-label" style={{ fontWeight: 'bold', color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                <Barcode size={20} style={{ color: '#2563eb' }} /> CÓDIGO DE BARRAS / EAN (LEITOR BIPADOR USB OU MANUAL)
              </span>
              <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>
                ⚡ Bipe com o leitor USB ou digite o código
              </span>
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input 
                ref={barcodeInputRef}
                type="text" 
                className="form-control" 
                value={localBarcode} 
                onChange={e => setLocalBarcode(e.target.value)}
                placeholder="Escaneie com o leitor USB ou digite o código EAN..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextInput = document.getElementById('spherical-input');
                    if (nextInput) nextInput.focus();
                  }
                }}
                style={{ 
                  fontFamily: 'monospace', 
                  color: 'black',
                  fontWeight: 'bold',
                  fontSize: '1.05rem',
                  flex: 1,
                  minWidth: '220px',
                  border: '2px solid #3b82f6',
                  background: '#ffffff',
                  height: '42px'
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                    barcodeInputRef.current.select();
                  }
                }}
                title="Ativar e Focar no campo para leitura via Bipador USB"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontWeight: 700, padding: '0 16px', height: '42px' }}
              >
                <Barcode size={18} /> Bipar USB
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const generated = 'INT-' + Math.floor(1000000000 + Math.random() * 9000000000);
                  setLocalBarcode(generated);
                }}
                title="Gerar código interno automático"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontWeight: 600, height: '42px' }}
              >
                🎲 Gerar Código
              </button>
            </div>
          </div>

          {/* Escolha do Modelo */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'between', width: '100%' }}>
              <span>Modelo de Lente</span>
              {models.length > 0 && (
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setUseExistingModel(!useExistingModel); }}
                  style={{ color: 'hsl(var(--secondary))', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  {useExistingModel ? "+ Criar Nova Lente" : "Selecionar Existente"}
                </a>
              )}
            </label>

            {useExistingModel ? (
              <select 
                className="form-control"
                value={lensModelId}
                onChange={(e) => setLensModelId(e.target.value)}
                style={{ color: 'black' }}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id} style={{ color: 'black' }}>
                    {m.brand} | {m.material} | {m.treatment} (Ø{m.diameter}mm)
                  </option>
                ))}
              </select>
            ) : (
              <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 'bold' }}>CADASTRO DE MODELO BASE</span>
                
                <div className="form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Marca (Fabricante) *</label>
                    <input type="text" placeholder="Ex: Essilor" className="form-control" value={brand} onChange={e => setBrand(e.target.value)} style={{ color: 'black' }} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Modelo / Nome *</label>
                    <input type="text" placeholder="Ex: Crizal Sapphire" className="form-control" value={name} onChange={e => setName(e.target.value)} style={{ color: 'black' }} required />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Grade / Matriz Óptica *</label>
                    <select 
                      className="form-control" 
                      value={matrixType || 'LP_GRADE'} 
                      onChange={e => setMatrixType(e.target.value)} 
                      style={{ color: 'black', fontWeight: 'bold' }}
                      required
                    >
                      <option value="LP_GRADE">Visão Simples Lente Pronta (LP_GRADE)</option>
                      <option value="GRADE_167">Grade 1.67 Alto Índice (GRADE_167)</option>
                      <option value="MF_ACB">Multifocal Acabado (MF_ACB)</option>
                      <option value="BLOCO_VS">Bloco Visão Simples (BLOCO_VS)</option>
                      <option value="MF_BLOCO">Bloco Multifocal (MF_BLOCO)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Material *</label>
                    <input type="text" placeholder="Ex: Resina" className="form-control" value={material} onChange={e => setMaterial(e.target.value)} style={{ color: 'black' }} required />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Índice Refração</label>
                    <input type="number" step="0.01" placeholder="Ex: 1.56" className="form-control" value={refractiveIndex} onChange={e => setRefractiveIndex(e.target.value)} style={{ color: 'black' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Diâmetro (mm)</label>
                    <input type="number" placeholder="Ex: 70" className="form-control" value={diameter} onChange={e => setDiameter(e.target.value)} style={{ color: 'black' }} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#8b5cf6' }}>
                    {is167Active ? 'Tratamento (1.67) *' : 'Tratamento / Família LP *'}
                  </label>
                  <select 
                    className="form-control" 
                    value={treatment || (is167Active ? '1.67 AR' : 'LP Ar 1.56')} 
                    onChange={e => handleSelectTreatment(e.target.value)} 
                    style={{ color: '#4c1d95', fontWeight: 'bold', border: '1px solid #8b5cf6' }}
                    required
                  >
                    {(is167Active ? OPTIONS_167 : LP_TREATMENTS_OPTIONS).map(lp => (
                      <option key={lp.id} value={lp.id}>
                        {lp.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid" style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
                  <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>PREÇO DE CUSTO (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Ex: 25.00" 
                      className="form-control" 
                      value={costPrice} 
                      onChange={e => setCostPrice(e.target.value)} 
                      style={{ color: 'black', fontWeight: '500', height: '42px', boxSizing: 'border-box' }} 
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>PREÇO DE VENDA (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Auto conforme o Grau" 
                      className="form-control" 
                      value={salePrice} 
                      onChange={e => setSalePrice(e.target.value)} 
                      style={{ color: 'black', fontWeight: 'bold', height: '42px', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  {calculatedMagnitude !== null ? (
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>
                      ✨ Preço de venda preenchido automaticamente pela regra (Magnitude: {calculatedMagnitude.toFixed(2)} D)
                    </span>
                  ) : (
                    "Defina o Grau Esférico e Cilíndrico abaixo para calcular o preço de venda automaticamente."
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Graus e Localização */}
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
            <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ minHeight: '22px', marginBottom: '6px' }}>Grau Esférico</label>
              <input 
                id="spherical-input"
                type="number" 
                step="0.25" 
                placeholder="Ex: -4.00" 
                className="form-control" 
                value={spherical} 
                onChange={e => setSpherical(e.target.value)}
                style={{ color: 'black', height: '42px', boxSizing: 'border-box' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ minHeight: '22px', marginBottom: '6px' }}>Grau Cilíndrico</label>
              <input 
                type="number" 
                step="0.25" 
                placeholder="Ex: -1.50" 
                className="form-control" 
                value={cylindrical} 
                onChange={e => setCylindrical(e.target.value)}
                style={{ color: 'black', height: '42px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Qtd. Inicial Estoque</label>
            <input 
              type="number" 
              className="form-control" 
              value={qty} 
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ color: 'black' }}
            />
          </div>

          {error && (
            <div style={{ color: 'hsl(var(--danger))', fontSize: '0.85rem' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Cadastrando..." : "Cadastrar Estoque"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FallbackModal;
