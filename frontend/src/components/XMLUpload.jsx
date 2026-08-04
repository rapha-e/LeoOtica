import React, { useState } from 'react';
import { FileUp, CheckCircle, AlertCircle, Plus, FileText } from 'lucide-react';
import { NfeService, LensService, InventoryService } from '../services/api';

const XMLUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Lote de pendências (itens inéditos)
  const [unmappedList, setUnmappedList] = useState([]);
  const [activePendingItem, setActivePendingItem] = useState(null); // Item atualmente em reconciliação
  const [models, setModels] = useState([]);
  
  // Campos do formulário de cadastro do item ativo
  const [useExistingModel, setUseExistingModel] = useState(true);
  const [lensModelId, setLensModelId] = useState('');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [refractiveIndex, setRefractiveIndex] = useState('');
  const [treatment, setTreatment] = useState('');
  const [diameter, setDiameter] = useState('70');
  
  const [spherical, setSpherical] = useState('');
  const [cylindrical, setCylindrical] = useState('');
  const [locationTag, setLocationTag] = useState('');
  const [pendingQty, setPendingQty] = useState(1);
  const [registeringError, setRegisteringError] = useState(null);
  const [registeringLoading, setRegisteringLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
      setUnmappedList([]);
      setActivePendingItem(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Por favor, selecione um arquivo XML.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await NfeService.importXml(file);
      setResult(response.data);
      setUnmappedList(response.data.unmapped || []);
      setFile(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Erro ao processar a importação de NF-e.");
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const response = await LensService.getModels();
      setModels(response.data);
      if (response.data.length > 0) {
        setLensModelId(response.data[0].id.toString());
      } else {
        setUseExistingModel(false);
      }
    } catch (err) {
      console.error("Erro ao carregar modelos base:", err);
    }
  };

  const startReconciliation = async (item) => {
    setActivePendingItem(item);
    setSpherical('');
    setCylindrical('');
    setLocationTag('');
    setPendingQty(item.quantity || 1);
    setRegisteringError(null);
    await loadModels();
  };

  const handleRegisterFallbackInline = async (e) => {
    e.preventDefault();
    if (!activePendingItem) return;

    const parseLocaleFloat = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      const str = String(val).replace(',', '.');
      const parsed = parseFloat(str);
      return isNaN(parsed) ? 0 : parsed;
    };

    if (spherical === '' || cylindrical === '') {
      setRegisteringError("Os graus esférico e cilíndrico são obrigatórios.");
      return;
    }

    setRegisteringLoading(true);
    setRegisteringError(null);

    const payload = {
      spherical: parseLocaleFloat(spherical),
      cylindrical: parseLocaleFloat(cylindrical),
      barcode: activePendingItem.barcode,
      location_tag: locationTag || null,
      quantity_available: parseInt(pendingQty) || 1
    };

    if (useExistingModel) {
      if (!lensModelId) {
        setRegisteringError("Por favor, selecione um modelo de lente.");
        setRegisteringLoading(false);
        return;
      }
      payload.lens_model_id = parseInt(lensModelId);
    } else {
      if (!brand || !material || !refractiveIndex || !treatment || !diameter) {
        setRegisteringError("Todos os atributos do modelo de lente são obrigatórios.");
        setRegisteringLoading(false);
        return;
      }
      payload.brand = brand;
      payload.material = material;
      payload.refractive_index = parseLocaleFloat(refractiveIndex);
      payload.treatment = treatment;
      payload.diameter = parseInt(diameter);
    }


    try {
      await InventoryService.registerFallback(payload);
      // Remove da fila local de pendências
      setUnmappedList(prev => prev.filter(p => p.barcode !== activePendingItem.barcode));
      setActivePendingItem(null);
    } catch (err) {
      console.error(err);
      setRegisteringError(err.response?.data?.detail || "Erro ao cadastrar lente física. Verifique os dados.");
    } finally {
      setRegisteringLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'white', marginBottom: '4px' }}>Entrada de Estoque via XML de NF-e</h2>
        <p style={{ fontSize: '0.85rem' }}>Importe a Nota Fiscal Eletrônica (XML) enviada pelo fabricante para dar entrada no estoque em lote automaticamente.</p>
      </div>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
        <div style={{
          border: '2px dashed var(--border-glass)',
          borderRadius: '12px',
          width: '100%',
          padding: '30px',
          textAlign: 'center',
          background: 'rgba(8, 10, 18, 0.4)',
          cursor: 'pointer',
          position: 'relative'
        }}>
          <input 
            type="file" 
            accept=".xml" 
            onChange={handleFileChange}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'
            }}
          />
          <FileUp size={40} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
          {file ? (
            <div>
              <p style={{ color: 'white', fontWeight: 600 }}>{file.name}</p>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div>
              <p style={{ color: 'white', fontWeight: 600 }}>Arraste o arquivo XML ou clique para selecionar</p>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Apenas arquivos .xml de notas fiscais são suportados</p>
            </div>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '8px', color: 'hsl(var(--danger))', fontSize: '0.9rem', width: '100%', alignItems: 'center' }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading || !file}
          style={{ width: '100%', maxWidth: '300px' }}
        >
          {loading ? "Processando XML..." : "Importar Nota Fiscal"}
        </button>
      </form>

      {/* Resultados da Importação */}
      {result && (
        <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--success))', marginBottom: '15px' }}>
            <CheckCircle size={24} />
            <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>Nota Fiscal Nº {result.nfe_number} processada!</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '15px', borderLeft: '4px solid hsl(var(--success))' }}>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Itens Mapeados e Inseridos</span>
              <strong style={{ display: 'block', fontSize: '1.8rem', color: 'white', marginTop: '5px' }}>{result.imported_count}</strong>
            </div>
            <div className="glass-panel" style={{ padding: '15px', borderLeft: unmappedList.length > 0 ? '4px solid hsl(var(--warning))' : '4px solid hsl(var(--success))' }}>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Itens Pendentes no Lote</span>
              <strong style={{ display: 'block', fontSize: '1.8rem', color: unmappedList.length > 0 ? 'hsl(var(--warning))' : 'white', marginTop: '5px' }}>{unmappedList.length}</strong>
            </div>
          </div>

          {/* Fila de Reconciliação em Lote */}
          {unmappedList.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: activePendingItem ? '1.1fr 0.9fr' : '1fr', gap: '20px', marginTop: '10px' }}>
              
              {/* Tabela da fila (Lado Esquerdo) */}
              <div>
                <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={18} style={{ color: 'hsl(var(--warning))' }} /> Fila de Reconciliação (Itens Inéditos)
                </h4>
                <p style={{ fontSize: '0.82rem', marginBottom: '15px' }}>
                  Associe cada código de barras inédito da nota fiscal a uma dioptria e gaveta para concluir a entrada no estoque.
                </p>
                
                <div className="grid-container" style={{ margin: 0 }}>
                  <table className="optical-grid" style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', paddingLeft: '15px' }}>Descrição na Nota</th>
                        <th>Cód. Barras (GTIN)</th>
                        <th>Quantidade</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmappedList.map((item, idx) => (
                        <tr key={idx} style={{ background: activePendingItem?.barcode === item.barcode ? 'rgba(234, 179, 8, 0.08)' : 'transparent' }}>
                          <td style={{ textAlign: 'left', paddingLeft: '15px', color: 'white', fontSize: '0.82rem' }}>{item.description}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{item.barcode}</td>
                          <td style={{ fontWeight: 'bold' }}>{item.quantity}</td>
                          <td>
                            {item.barcode && item.barcode !== 'SEM GTIN' ? (
                              <button 
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 12px', fontSize: '0.8rem', border: activePendingItem?.barcode === item.barcode ? '1.5px solid hsl(var(--primary))' : '1px solid var(--border-glass)' }}
                                onClick={() => startReconciliation(item)}
                              >
                                Cadastrar
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Sem GTIN</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Formulário de reconciliação (Lado Direito) */}
              {activePendingItem && (
                <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid hsl(var(--primary) / 0.35)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                    <Plus size={16} style={{ color: 'hsl(var(--primary))' }} />
                    Reconciliar Lente: {activePendingItem.barcode}
                  </h4>

                  <form onSubmit={handleRegisterFallbackInline} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>Modelo Base de Lente</span>
                        {models.length > 0 && (
                          <span 
                            onClick={() => setUseExistingModel(!useExistingModel)}
                            style={{ color: 'hsl(var(--secondary))', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                          >
                            {useExistingModel ? "+ Novo Modelo Base" : "Selecionar Existente"}
                          </span>
                        )}
                      </label>

                      {useExistingModel ? (
                        <select 
                          className="form-control"
                          value={lensModelId}
                          onChange={(e) => setLensModelId(e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                        >
                          {models.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.brand} | {m.material} | {m.treatment} (Ø{m.diameter}mm)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input type="text" placeholder="Marca (Fabricante)" className="form-control" style={{ fontSize: '0.78rem', height: '32px' }} value={brand} onChange={e => setBrand(e.target.value)} />
                            <input type="text" placeholder="Material Lente" className="form-control" style={{ fontSize: '0.78rem', height: '32px' }} value={material} onChange={e => setMaterial(e.target.value)} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <input type="number" step="0.01" placeholder="Índice Refração" className="form-control" style={{ fontSize: '0.78rem', height: '32px' }} value={refractiveIndex} onChange={e => setRefractiveIndex(e.target.value)} />
                            <input type="number" placeholder="Diâmetro mm" className="form-control" style={{ fontSize: '0.78rem', height: '32px' }} value={diameter} onChange={e => setDiameter(e.target.value)} />
                            <input type="text" placeholder="Tratamento" className="form-control" style={{ fontSize: '0.78rem', height: '32px' }} value={treatment} onChange={e => setTreatment(e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Grau Esférico *</label>
                        <input type="number" step="0.25" placeholder="Ex: -3.00" className="form-control" style={{ fontSize: '0.8rem', height: '35px' }} value={spherical} onChange={e => setSpherical(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Grau Cilíndrico *</label>
                        <input type="number" step="0.25" placeholder="Ex: -1.25" className="form-control" style={{ fontSize: '0.8rem', height: '35px' }} value={cylindrical} onChange={e => setCylindrical(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Gaveta Física *</label>
                        <input type="text" placeholder="Ex: GAVETA-A4" className="form-control" style={{ fontSize: '0.8rem', height: '35px' }} value={locationTag} onChange={e => setLocationTag(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Quantidade Entrada *</label>
                        <input type="number" className="form-control" style={{ fontSize: '0.8rem', height: '35px' }} value={pendingQty} onChange={e => setPendingQty(Math.max(1, parseInt(e.target.value) || 0))} />
                      </div>
                    </div>

                    {registeringError && (
                      <div style={{ color: 'hsl(var(--danger))', fontSize: '0.78rem' }}>{registeringError}</div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => setActivePendingItem(null)} disabled={registeringLoading}>
                        Voltar
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px' }} disabled={registeringLoading}>
                        {registeringLoading ? 'Salvando...' : 'Reconciliar Lente'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(34, 197, 94, 0.05)', border: '1px dashed rgba(34, 197, 94, 0.3)', borderRadius: '12px', marginTop: '20px' }}>
              <CheckCircle size={36} style={{ color: 'hsl(var(--success))', marginBottom: '10px' }} />
              <h4 style={{ color: 'white', margin: 0 }}>Conciliação de NF-e Concluída!</h4>
              <p style={{ fontSize: '0.82rem', margin: '4px 0 0 0' }}>Todas as lentes inéditas do lote foram devidamente reconciliadas e salvas no estoque.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default XMLUpload;
