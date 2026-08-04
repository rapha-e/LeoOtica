import React, { useEffect, useState, useRef } from 'react';
import { LensService, InventoryService } from '../services/api';
import { X, CheckCircle, HelpCircle } from 'lucide-react';

const FallbackModal = ({ 
  barcode = '', 
  initialQty = 1, 
  initialSpherical = '', 
  initialCylindrical = '', 
  initialLensModelId = '', 
  onClose, 
  onSuccess 
}) => {
  const [models, setModels] = useState([]);
  const [useExistingModel, setUseExistingModel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  const [material, setMaterial] = useState('');
  const [refractiveIndex, setRefractiveIndex] = useState('');
  const [treatment, setTreatment] = useState('');
  const [diameter, setDiameter] = useState('70');

  useEffect(() => {
    setLocalBarcode(barcode || '');
  }, [barcode]);

  useEffect(() => {
    loadModels();
  }, []);

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
      quantity_available: parseInt(qty) || 1
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
      payload.material = material;
      payload.refractive_index = parseLocaleFloat(refractiveIndex);
      payload.treatment = treatment;
      payload.diameter = parseInt(diameter);
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="form-group">
            <label className="form-label">Código de Barras</label>
            <input 
              ref={barcodeInputRef}
              type="text" 
              className="form-control" 
              value={localBarcode} 
              onChange={e => setLocalBarcode(e.target.value)}
              placeholder="Digite, bipe com o leitor USB ou deixe em branco para código aleatório"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const nextInput = document.getElementById('spherical-input');
                  if (nextInput) nextInput.focus();
                }
              }}
              style={{ 
                fontFamily: 'monospace', 
                color: 'black' 
              }}
            />
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
                    <label className="form-label">Marca (Fabricante)</label>
                    <input type="text" placeholder="Ex: Essilor" className="form-control" value={brand} onChange={e => setBrand(e.target.value)} style={{ color: 'black' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Material</label>
                    <input type="text" placeholder="Ex: Resina" className="form-control" value={material} onChange={e => setMaterial(e.target.value)} style={{ color: 'black' }} />
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
                  <label className="form-label">Tratamento</label>
                  <input type="text" placeholder="Ex: Antirreflexo HMC" className="form-control" value={treatment} onChange={e => setTreatment(e.target.value)} style={{ color: 'black' }} />
                </div>
              </div>
            )}
          </div>

          {/* Graus e Localização */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Grau Esférico</label>
              <input 
                id="spherical-input"
                type="number" 
                step="0.25" 
                placeholder="Ex: -4.00" 
                className="form-control" 
                value={spherical} 
                onChange={e => setSpherical(e.target.value)}
                style={{ color: 'black' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Grau Cilíndrico</label>
              <input 
                type="number" 
                step="0.25" 
                placeholder="Ex: -1.50" 
                className="form-control" 
                value={cylindrical} 
                onChange={e => setCylindrical(e.target.value)}
                style={{ color: 'black' }}
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
