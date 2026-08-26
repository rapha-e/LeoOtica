// GradeOptica.jsx - Dynamic Grid View for Visão Simples LP
import React, { useEffect, useState } from 'react';
import { LensService, InventoryService, DegreePolicyService } from '../services/api';
import { ShieldAlert, MapPin, Eye, EyeOff, Search, Layers, Edit, Save, Plus, Minus, BarChart2, ShieldCheck, FileText, DollarSign } from 'lucide-react';

const GradeOptica = ({ onOpenManualInsert }) => {

  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [activePolicy, setActivePolicy] = useState(null);
  
  // Estados para edição manual

  const [editingItemId, setEditingItemId] = useState(null);
  const [editQty, setEditQty] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  
  // Filtro de sinal de dioptria (positiva vs negativa)
  const [signFilter, setSignFilter] = useState('negative');
  
  // Filtros de busca rápida
  const [searchSph, setSearchSph] = useState('');
  const [searchCyl, setSearchCyl] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');
  const [showRuptureAlertModal, setShowRuptureAlertModal] = useState(false);

  // Controle de exibição da grade inteira ou apenas área útil
  const [showFullRange, setShowFullRange] = useState(true);

  const loadPolicy = async () => {
    try {
      const res = await DegreePolicyService.getPolicy();
      if (res.data && res.data.is_active) {
        setActivePolicy(res.data);
      }
    } catch (err) {
      console.warn("Erro ao carregar política de grau no GradeOptica:", err);
    }
  };

  const loadModels = async () => {
    try {
      const response = await LensService.getModels();
      const lpModels = (response.data || []).filter(
        m => m.matrix_type === 'LP_GRADE' || !m.matrix_type
      );
      setModels(lpModels);
      setSelectedModelId('');
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
    }
  };

  const loadGrid = async (modelId) => {
    setLoading(true);
    try {
      const response = await InventoryService.getGrid(modelId || null);
      const transposedData = (response.data || []).map(item => {
        const cyl = parseFloat(item.cylindrical);
        if (cyl > 0) {
          const sph = parseFloat(item.spherical);
          return {
            ...item,
            spherical: (sph + cyl).toFixed(2),
            cylindrical: (-cyl).toFixed(2)
          };
        }
        return item;
      });

      const finalGrid = transposedData.filter(item => {
        const mType = item.lens_model?.matrix_type;
        if (mType) {
          if (mType !== 'LP_GRADE') return false;
        } else {
          if (parseFloat(item.lens_model?.refractive_index) === 1.67) return false;
        }
        if (modelId && String(item.lens_model_id || item.lens_model?.id) !== String(modelId)) return false;
        return true;
      });
      setGridData(finalGrid);
    } catch (err) {
      console.error("Erro ao carregar grade:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDiopterPriceInfo = (spherical, cylindrical, lensModel, policy) => {
    let sph = parseFloat(spherical) || 0.0;
    let cyl = parseFloat(cylindrical) || 0.0;

    if (cyl > 0) {
      sph = sph + cyl;
      cyl = -cyl;
    }

    const absSph = Math.abs(sph);
    const absCyl = Math.abs(cyl);

    const threshold = lensModel?.degree_threshold 
      ? parseFloat(lensModel.degree_threshold) 
      : policy?.degree_threshold 
        ? parseFloat(policy.degree_threshold) 
        : 2.00;

    const priceBase = lensModel?.sale_price 
      ? parseFloat(lensModel.sale_price) 
      : policy?.default_sale_price_le 
        ? parseFloat(policy.default_sale_price_le) 
        : 75.00;

    const priceOver = lensModel?.sale_price_over_threshold 
      ? parseFloat(lensModel.sale_price_over_threshold) 
      : policy?.default_sale_price_gt 
        ? parseFloat(policy.default_sale_price_gt) 
        : 95.00;

    const isOver = absSph > 4.00 || absCyl > threshold;
    const finalPrice = isOver ? priceOver : priceBase;

    return {
      sph,
      cyl,
      absSph,
      absCyl,
      threshold,
      isOver,
      finalPrice,
      priceBase,
      priceOver,
      label: isOver ? "Grau Alto / Sobretaxa" : "Grau Padrão"
    };
  };

  useEffect(() => {
    loadModels();
    loadPolicy();
  }, []);

  useEffect(() => {
    loadGrid(selectedModelId);
  }, [selectedModelId]);

  // Faixa de dioptrias padrão para Visão Simples LP (Esférico -6.00 a +6.00 / Cilíndrico 0.00 a -4.00)
  const getDefaultRanges = () => {
    let sphs = [];
    let cyls = [];

    if (signFilter === 'positive') {
      // Positivas: 0.00 a +6.00 (passo +0.25)
      for (let s = 0; s <= 600; s += 25) {
        sphs.push(s / 100);
      }
    } else {
      // Negativas: 0.00 a -6.00 (passo -0.25)
      for (let s = 0; s >= -600; s -= 25) {
        sphs.push(s / 100);
      }
    }

    // Cilíndrico: 0.00 a -4.00 (passo -0.25)
    for (let c = 0; c >= -400; c -= 25) {
      cyls.push(c / 100);
    }

    return { sphs, cyls };
  };

  const { sphs, cyls } = getDefaultRanges();

  const [filterMatrix, setFilterMatrix] = useState('');

  // Mapeia os dados do banco para busca rápida por dioptria
  const getCellData = (sph, cyl) => {
    let matchingItems = gridData.filter(item => {
      const mType = item.lens_model?.matrix_type;
      if (mType && mType !== 'LP_GRADE') return false;
      return Math.abs(parseFloat(item.spherical) - sph) < 0.01 && 
             Math.abs(parseFloat(item.cylindrical) - cyl) < 0.01;
    });

    if (filterTreatment) {
      const targetLower = filterTreatment.trim().toLowerCase();
      matchingItems = matchingItems.filter(item => {
        const itemTreatment = (item.lens_model?.treatment || item.treatment || '').trim().toLowerCase();
        return itemTreatment === targetLower;
      });
    }

    if (matchingItems.length === 0) return null;
    
    // Se temos um modelo específico selecionado, retornamos o item exato daquele modelo
    if (selectedModelId) {
      const exactMatch = matchingItems.find(i => String(i.lens_model_id) === String(selectedModelId));
      return exactMatch || matchingItems[0];
    }
    
    // Senão, consolidamos
    return {
      isConsolidated: true,
      quantity_available: matchingItems.reduce((sum, item) => sum + (item.quantity_available || 0), 0),
      items: matchingItems
    };
  };


  const getCellClass = (item) => {
    if (!item) return 'lens-cell empty';
    const qty = item.quantity_available !== undefined ? item.quantity_available : 0;
    if (qty === 0) return 'lens-cell rupture';

    if (item.isConsolidated && item.items && item.items.length > 0) {
      const hasRupture = item.items.some(i => (i.quantity_available || 0) === 0);
      const hasCritical = item.items.some(i => (i.quantity_available || 0) >= 1 && (i.quantity_available || 0) <= 2);
      const hasLow = item.items.some(i => (i.quantity_available || 0) >= 3 && (i.quantity_available || 0) <= 4);
      if (hasRupture) return 'lens-cell rupture';
      if (hasCritical) return 'lens-cell critical';
      if (hasLow) return 'lens-cell low';
    }

    if (qty >= 1 && qty <= 2) return 'lens-cell critical';
    if (qty >= 3 && qty <= 4) return 'lens-cell low';
    return 'lens-cell normal';
  };


  const handleCellClick = (sph, cyl, item) => {
    setSelectedCell({
      spherical: sph,
      cylindrical: cyl,
      item: item || null
    });
    setEditingItemId(null);
    setUpdateError(null);
    if (item && !item.isConsolidated) {
      setEditQty(item.quantity_available);
      setEditLocation(item.location_tag || '');
      setEditBarcode(item.barcode || '');
    } else {
      setEditQty(0);
      setEditLocation('');
      setEditBarcode('');
    }
  };

  const startEditingItem = (item) => {
    setEditingItemId(item.id);
    setEditQty(item.quantity_available);
    setEditLocation(item.location_tag || '');
    setEditBarcode(item.barcode || '');
  };

  const handleSaveEdit = async () => {
    const itemId = editingItemId || (selectedCell?.item && !selectedCell.item.isConsolidated ? selectedCell.item.id : null);
    if (!itemId) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const payload = {
        quantity_available: parseInt(editQty) || 0,
        location_tag: editLocation || null,
        barcode: editBarcode || null
      };
      const response = await InventoryService.update(itemId, payload);
      
      const updatedItem = response.data;
      
      // Atualiza na memória (gridData)
      setGridData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      
      // Atualiza na visualização do modal (selectedCell)
      setSelectedCell(prev => {
        if (!prev) return null;
        if (prev.item.isConsolidated) {
          const updatedItems = prev.item.items.map(item => item.id === updatedItem.id ? updatedItem : item);
          const totalQty = updatedItems.reduce((sum, item) => sum + (item.quantity_available || 0), 0);
          return {
            ...prev,
            item: {
              ...prev.item,
              quantity_available: totalQty,
              items: updatedItems
            }
          };
        } else {
          return {
            ...prev,
            item: updatedItem
          };
        }
      });
      
      setEditingItemId(null);
    } catch (err) {
      console.error(err);
      setUpdateError(err.response?.data?.detail || "Erro ao salvar alterações.");
    } finally {
      setUpdating(false);
    }
  };

  // Filtragem rápida de busca na grade
  const filteredSph = sphs
    .filter(s => searchSph === '' || s.toFixed(2).includes(searchSph));

  const filteredCyl = cyls
    .filter(c => searchCyl === '' || c.toFixed(2).includes(searchCyl));

  const selectedModel = models.find(m => m.id.toString() === selectedModelId);

  // Lista deduplicada case-insensitive de tratamentos (buscando em modelos e itens de estoque)
  const uniqueTreatmentsMap = new Map();
  models.forEach(m => {
    if (m.treatment && m.treatment.trim()) {
      const raw = m.treatment.trim();
      const key = raw.toLowerCase();
      if (!uniqueTreatmentsMap.has(key)) {
        uniqueTreatmentsMap.set(key, raw);
      }
    }
  });
  gridData.forEach(item => {
    const treat = item.lens_model?.treatment || item.treatment;
    if (treat && treat.trim()) {
      const raw = treat.trim();
      const key = raw.toLowerCase();
      if (!uniqueTreatmentsMap.has(key)) {
        uniqueTreatmentsMap.set(key, raw);
      }
    }
  });
  const uniqueTreatments = Array.from(uniqueTreatmentsMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const handleExportPDF = (itemsList = null) => {
    const criticalItems = gridData.filter(i => (i.quantity_available || 0) <= 2);
    const itemsToExport = itemsList || criticalItems;
    const modelName = selectedModel ? `${selectedModel.brand} - ${selectedModel.name}` : 'Todas as Marcas e Modelos';
    const nowStr = new Date().toLocaleString('pt-BR');

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      alert("Por favor, permita pop-ups para gerar o relatório PDF.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatorio_Lentes_Ruptura_NovaLab</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 22px; font-weight: 800; color: #0f172a; }
            .logo span { color: #0284c7; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
            .meta { margin-bottom: 16px; font-size: 12px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 700; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .status-rupture { color: #dc2626; font-weight: 800; }
            .status-alert { color: #d97706; font-weight: 800; }
            .footer { margin-top: 25px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">NOVA <span>LAB</span></div>
              <div class="subtitle">Laboratório Óptico & Controle de Inventário de Lentes Acabadas</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Data: <strong>${nowStr}</strong></div>
              <div>Filtro: <strong>${modelName}</strong></div>
            </div>
          </div>

          <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 6px;">Relatório de Estoque Crítico / Ruptura (Grade de Lentes Acabadas)</h3>
          <div class="meta">
            Total de Dioptrias Listadas: <strong>${itemsToExport.length} células</strong> | Critério: <strong>Estoque &le; 2 unidades</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Modelo de Lente / Marca</th>
                <th>Tratamento</th>
                <th>Esférico (SPH)</th>
                <th>Cilíndrico (CYL)</th>
                <th style="text-align: center;">Qtd Atual</th>
                <th>Localização</th>
                <th>Código de Barras</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToExport.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.lens_model?.name || item.brand || 'Lente Acabada'}</strong></td>
                  <td>${item.lens_model?.treatment || 'Incolor'}</td>
                  <td>${parseFloat(item.spherical) > 0 ? '+' : ''}${parseFloat(item.spherical).toFixed(2)}</td>
                  <td>${parseFloat(item.cylindrical).toFixed(2)}</td>
                  <td style="text-align: center;" class="${item.quantity_available === 0 ? 'status-rupture' : 'status-alert'}">
                    ${item.quantity_available} un
                  </td>
                  <td>${item.location_tag || 'GAVETA-S/N'}</td>
                  <td style="font-family: monospace;">${item.barcode || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Documento gerado automaticamente pelo Sistema Nova LAB Ótica - Relatório de Inventário de Lentes Acabadas
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      <div className="page-header" style={{ marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Visão Simples LP</h1>
          <p className="page-subtitle">Visualize e pesquise a quantidade e localização física de cada lente no estoque.</p>
        </div>

        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => handleExportPDF()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <FileText size={16} />
            Exportar PDF
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowFullRange(!showFullRange)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {showFullRange ? <EyeOff size={16} /> : <Eye size={16} />}
            {showFullRange ? "Focar Área Útil" : "Mostrar Grade Completa"}
          </button>
        </div>
      </div>

      {gridData.some(i => (i.quantity_available !== undefined ? i.quantity_available : 0) <= 2) && (
        <div 
          onClick={() => setShowRuptureAlertModal(true)}
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color="#dc2626" />
            <span>Atenção: Existem <strong>{gridData.filter(i => (i.quantity_available || 0) <= 2).length} dioptrias</strong> em nível Crítico (1-2 un) ou Ruptura (0 un).</span>
          </div>
          <button style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
            Ver Lentes no Alerta ➔
          </button>
        </div>
      )}

      {/* Banner de Política Global de Precificação por Grau */}
      {activePolicy && (
        <div style={{ 
          background: 'rgba(59,130,246,0.08)', 
          border: '1px solid rgba(59,130,246,0.3)', 
          borderRadius: '12px', 
          padding: '14px 18px', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '12px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={22} style={{ color: '#2563eb' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e40af', fontWeight: 700 }}>
                Política Global de Precificação por Grau (Visão Simples LP)
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#3b82f6' }}>
                Lentes até ≤ 4.00D ESF e ≤ {parseFloat(activePolicy.degree_threshold || 2).toFixed(2)}D CIL: <strong>R$ {parseFloat(activePolicy.default_sale_price_le || 75).toFixed(2)}</strong> | Acima do limite: <strong>R$ {parseFloat(activePolicy.default_sale_price_gt || 95).toFixed(2)}</strong>
              </p>
            </div>
          </div>
          <span className="badge badge-info" style={{ fontWeight: 700, padding: '6px 12px', fontSize: '0.8rem' }}>
            Limite de Corte: {parseFloat(activePolicy.degree_threshold || 2).toFixed(2)} D CIL
          </span>
        </div>
      )}

      {/* Busca por Graus & Tratamento */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '280px' }}>
          <label className="form-label">Busca Rápida por Grau</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Esférico (Ex: -2.00)" 
              className="form-control"
              value={searchSph}
              onChange={(e) => setSearchSph(e.target.value)}
              style={{ color: 'black' }}
            />
            <input 
              type="text" 
              placeholder="Cilíndrico (Ex: -1.00)" 
              className="form-control"
              value={searchCyl}
              onChange={(e) => setSearchCyl(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label className="form-label">Filtrar por Tratamento</label>
          <select
            className="form-control"
            value={filterTreatment || ''}
            onChange={(e) => setFilterTreatment(e.target.value)}
            style={{ color: 'black' }}
          >
            <option value="">Todos os Tratamentos ({uniqueTreatments.length})</option>
            {uniqueTreatments.map((treat, idx) => (
              <option key={idx} value={treat}>{treat}</option>
            ))}
          </select>
        </div>
      </div>



      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Layers className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
          <p>Carregando matriz de dioptrias...</p>
        </div>
      ) : (
        <div>
          {/* Alternador de Grade: Lentes Negativas (-) / Lentes Positivas (+) */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '10px' }}>
            <button
              type="button"
              className={`btn btn-sm ${signFilter === 'negative' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSignFilter('negative')}
              style={{ flex: 1, padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Lentes Negativas (-) [{gridData.filter(i => parseFloat(i.spherical) <= 0).length}]
            </button>
            <button
              type="button"
              className={`btn btn-sm ${signFilter === 'positive' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSignFilter('positive')}
              style={{ flex: 1, padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Lentes Positivas (+) [{gridData.filter(i => parseFloat(i.spherical) > 0).length}]
            </button>
          </div>

          <div className="grid-container no-scroll">
            <table className="optical-grid fit-grid-table">
            <thead>
              <tr>
                <th style={{ width: '100px', position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))' }}>
                  Esf / Cil
                </th>
                {filteredCyl.map(c => (
                  <th key={c}>
                    {c > 0 ? `+${c.toFixed(2)}` : c.toFixed(2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSph.map(s => (
                <tr key={s}>
                  <td className="sph-header" style={{ position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))', fontWeight: 'bold' }}>
                    {s > 0 ? `+${s.toFixed(2)}` : s.toFixed(2)}
                  </td>
                  {filteredCyl.map(c => {
                    const cellItem = getCellData(s, c);
                    return (
                      <td 
                        key={`${s}_${c}`} 
                        className={getCellClass(cellItem)}
                        onClick={() => handleCellClick(s, c, cellItem)}
                      >
                        <div className="lens-cell-inner">
                          <span className="lens-qty">
                            {cellItem ? cellItem.quantity_available : 0}
                          </span>
                          {cellItem && !cellItem.isConsolidated && cellItem.location_tag && (
                            <span className="lens-loc">
                              {cellItem.location_tag}
                            </span>
                          )}
                          {cellItem && cellItem.isConsolidated && cellItem.quantity_available > 0 && (
                            <span className="lens-loc" style={{ opacity: 0.9, fontWeight: 'bold' }}>
                              {`${cellItem.items.length} Mod.`}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal Lateral / Detalhamento da Célula Clicada */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '15px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              Dioptria Selecionada
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase' }}>Grau Esférico</span>
                <strong style={{ fontSize: '1.4rem' }}>
                  {selectedCell.spherical > 0 ? `+${selectedCell.spherical.toFixed(2)}` : selectedCell.spherical.toFixed(2)}
                </strong>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase' }}>Grau Cilíndrico</span>
                <strong style={{ fontSize: '1.4rem' }}>
                  {selectedCell.cylindrical > 0 ? `+${selectedCell.cylindrical.toFixed(2)}` : selectedCell.cylindrical.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* Card de Precificação Calculada por Grau */}
            {(() => {
              const modelObj = models.find(m => String(m.id) === String(selectedModelId)) || 
                               selectedCell.item?.lens_model || 
                               selectedCell.item?.items?.[0]?.lens_model;
              const priceInfo = getDiopterPriceInfo(selectedCell.spherical, selectedCell.cylindrical, modelObj, activePolicy);
              return (
                <div style={{ 
                  background: priceInfo.isOver ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', 
                  border: priceInfo.isOver ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(34,197,94,0.4)', 
                  borderRadius: '10px', 
                  padding: '12px 16px', 
                  marginBottom: '20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontWeight: 'bold', display: 'block' }}>
                      💰 Preço da Dioptria (Regra de Grau)
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: priceInfo.isOver ? '#b45309' : '#15803d' }}>
                      R$ {priceInfo.finalPrice.toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '0.75rem', display: 'block', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
                      {priceInfo.isOver 
                        ? `Sobretaxa aplicada: Excede limite de ${priceInfo.threshold.toFixed(2)}D CIL ou 4.00D ESF` 
                        : `Faixa Padrão: ≤ 4.00D ESF e ≤ ${priceInfo.threshold.toFixed(2)}D CIL`}
                    </span>
                  </div>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '0.78rem', 
                    fontWeight: 700, 
                    background: priceInfo.isOver ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)', 
                    color: priceInfo.isOver ? '#854d0e' : '#166534',
                    border: priceInfo.isOver ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(34,197,94,0.5)'
                  }}>
                    {priceInfo.label}
                  </span>
                </div>
              );
            })()}

            {selectedCell.item ? (
              editingItemId !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {(() => {
                    const editingItem = selectedCell.item.isConsolidated 
                      ? selectedCell.item.items.find(i => i.id === editingItemId)
                      : selectedCell.item;
                    const model = editingItem?.lens_model;
                    return (
                      <>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Modelo de Lente:</span>
                          <p style={{ fontWeight: 600 }}>
                            {model?.brand} | {model?.material} (Refração {model?.refractive_index ? parseFloat(model.refractive_index).toFixed(2) : 'N/A'})
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                            Tratamento: {model?.treatment} | Diâmetro: Ø{model?.diameter}mm
                          </p>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={16} style={{ color: 'hsl(var(--secondary))' }} /> Localização Física (Gaveta)
                          </label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={editLocation} 
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="Ex: GAVETA-A1"
                            style={{ color: 'black' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">Código de Barras</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ fontFamily: 'monospace', color: 'black' }}
                            value={editBarcode} 
                            onChange={(e) => setEditBarcode(e.target.value)}
                            placeholder="Sem código de barras"
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                          <label className="form-label">Estoque Físico Disponível</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button 
                              type="button"
                              className="btn btn-secondary" 
                              onClick={() => setEditQty(q => Math.max(0, q - 1))}
                              style={{ padding: '8px 12px', minWidth: '40px' }}
                            >
                              <Minus size={16} />
                            </button>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'black' }}
                              value={editQty} 
                              onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                            />
                            <button 
                              type="button"
                              className="btn btn-secondary" 
                              onClick={() => setEditQty(q => q + 1)}
                              style={{ padding: '8px 12px', minWidth: '40px' }}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>

                        {updateError && (
                          <div style={{ color: 'hsl(var(--danger))', fontSize: '0.85rem', marginBottom: '10px' }}>{updateError}</div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => { setEditingItemId(null); setUpdateError(null); }}
                            style={{ flex: 1 }}
                            disabled={updating}
                          >
                            Cancelar
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            onClick={handleSaveEdit}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            disabled={updating}
                          >
                            <Save size={16} />
                            {updating ? "Salvando..." : "Salvar"}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : selectedCell.item.isConsolidated ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                    Existe um total de <strong>{selectedCell.item.quantity_available} unidades</strong> físicas em estoque divididas nos seguintes modelos:
                  </p>
                  {selectedCell.item.items.map(item => (
                    <div key={item.id} style={{ padding: '16px', border: '1px solid rgba(147, 51, 234, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #a855f7, #06b6d4)', borderRadius: '12px 12px 0 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>{item.lens_model?.brand}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                            {item.lens_model?.material} | Refração {item.lens_model?.refractive_index ? parseFloat(item.lens_model.refractive_index).toFixed(2) : 'N/A'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                            Tratamento: {item.lens_model?.treatment} (Ø{item.lens_model?.diameter}mm)
                          </span>
                          {item.lens_model && (() => {
                            const subPriceInfo = getDiopterPriceInfo(selectedCell.spherical, selectedCell.cylindrical, item.lens_model, activePolicy);
                            return (
                              <div style={{ fontSize: '0.8rem', color: subPriceInfo.isOver ? '#b45309' : '#15803d', fontWeight: 700, marginTop: '4px' }}>
                                💰 Preço da Dioptria: R$ {subPriceInfo.finalPrice.toFixed(2)} ({subPriceInfo.label})
                              </div>
                            );
                          })()}
                        </div>
                        <span style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: 'bold', 
                          color: item.quantity_available <= 0 ? 'hsl(var(--danger))' : item.quantity_available <= 2 ? 'hsl(var(--warning))' : 'hsl(var(--success))'
                        }}>
                          {item.quantity_available} un
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={14} style={{ color: 'hsl(var(--secondary))' }} />
                          <span>Gaveta: <strong>{item.location_tag || 'N/A'}</strong></span>
                        </div>
                        <div>
                          <span>Cód: <span style={{ fontFamily: 'monospace' }}>{item.barcode || 'N/A'}</span></span>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => startEditingItem(item)}
                        style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}
                      >
                        <Edit size={14} /> Ajustar Estoque
                      </button>
                    </div>
                  ))}
                  
                  <div style={{ marginTop: '10px', borderTop: '1px dashed var(--border-glass)', paddingTop: '15px' }}>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Modelo de Lente:</span>
                    <p style={{ fontWeight: 600 }}>
                      {selectedCell.item.lens_model?.brand} | {selectedCell.item.lens_model?.material} (Refração {selectedCell.item.lens_model?.refractive_index ? parseFloat(selectedCell.item.lens_model.refractive_index).toFixed(2) : 'N/A'})
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} style={{ color: 'hsl(var(--secondary))' }} />
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', display: 'block' }}>Localização Física:</span>
                      <strong>{selectedCell.item.location_tag || 'GAVETA NÃO CONFIGURADA'}</strong>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Código de Barras:</span>
                    <p style={{ fontFamily: 'monospace', color: 'var(--text-primary)', background: 'rgba(15, 23, 42, 0.05)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.9rem', width: 'fit-content' }}>
                      {selectedCell.item.barcode || 'Sem código associado'}
                    </p>
                  </div>
                  {selectedCell.item.lens_model && (() => {
                    const priceInfo = getDiopterPriceInfo(selectedCell.spherical, selectedCell.cylindrical, selectedCell.item.lens_model, activePolicy);
                    return (
                      <div style={{ background: priceInfo.isOver ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', border: priceInfo.isOver ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(34,197,94,0.4)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.78rem', display: 'block' }}>Preço de Revenda (Tabela por Grau):</span>
                        <strong style={{ fontSize: '1.1rem', color: priceInfo.isOver ? '#b45309' : '#15803d' }}>
                          R$ {priceInfo.finalPrice.toFixed(2)}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginLeft: '8px' }}>
                          ({priceInfo.label})
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.02)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
                    <span>Estoque Físico Disponível:</span>
                    <span style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 'bold', 
                      color: selectedCell.item.quantity_available <= 0 ? 'hsl(var(--danger))' : selectedCell.item.quantity_available <= 2 ? 'hsl(var(--warning))' : 'hsl(var(--success))'
                    }}>
                      {selectedCell.item.quantity_available} unidades
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => startEditingItem(selectedCell.item)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Edit size={16} /> Ajustar Estoque Manualmente
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.02)', borderRadius: '10px' }}>
                <ShieldAlert size={36} style={{ color: 'hsl(var(--text-muted))', marginBottom: '10px' }} />
                <p>Nenhuma lente com esta dioptria está registrada física ou logicamente.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', marginBottom: '0', color: 'hsl(var(--text-muted))' }}>
                  Acesse o <strong>Cadastrador Unificado de Lentes & Bipador</strong> no menu principal para dar entrada nesta dioptria.
                </p>
              </div>
            )}

            <button 
              className="btn btn-primary" 
              onClick={() => setSelectedCell(null)}
              style={{ width: '100%', marginTop: '20px' }}
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}

      {/* Modal Interativo do Alerta de Ruptura / Crítico */}
      {showRuptureAlertModal && (
        <div className="modal-overlay" onClick={() => setShowRuptureAlertModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={22} /> Central de Alerta de Ruptura & Estoque Crítico
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Relação detalhada de dioptrias com saldo igual a 0 (Ruptura) ou 1 a 2 unidades (Estoque Crítico).
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Marca / Tratamento</th>
                    <th style={{ padding: '10px' }}>Esférico</th>
                    <th style={{ padding: '10px' }}>Cilíndrico</th>
                    <th style={{ padding: '10px' }}>Localização</th>
                    <th style={{ padding: '10px' }}>Saldo Atual</th>
                    <th style={{ padding: '10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gridData.filter(i => (i.quantity_available || 0) <= 2).map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {item.lens_model ? `${item.lens_model.brand} - ${item.lens_model.treatment}` : 'Lente Matriz'}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>
                        {parseFloat(item.spherical) > 0 ? `+${parseFloat(item.spherical).toFixed(2)}` : parseFloat(item.spherical).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{parseFloat(item.cylindrical).toFixed(2)}</td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{item.location_tag || 'Gaveta Matriz'}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: item.quantity_available === 0 ? '#ef4444' : '#f97316' }}>
                        {item.quantity_available} un
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: item.quantity_available === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)', color: item.quantity_available === 0 ? '#ef4444' : '#f97316' }}>
                          {item.quantity_available === 0 ? 'RUPTURA' : 'CRÍTICO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => handleExportPDF(gridData.filter(i => (i.quantity_available || 0) <= 2))} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <FileText size={16} /> Exportar Relatório em PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRuptureAlertModal(false)}>
                Fechar Alerta
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};



export default GradeOptica;
