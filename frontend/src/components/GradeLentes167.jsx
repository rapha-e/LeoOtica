import React, { useEffect, useState } from 'react';
import { LensService, InventoryService } from '../services/api';
import { ShieldAlert, MapPin, Eye, EyeOff, Search, Layers, Edit, Save, Plus, Minus, ShieldCheck, FileText, Sparkles, RefreshCw } from 'lucide-react';

const GradeLentes167 = ({ onOpenManualInsert }) => {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  // Estados para edição manual
  const [editingItemId, setEditingItemId] = useState(null);
  const [editQty, setEditQty] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Filtros de busca rápida
  const [searchSph, setSearchSph] = useState('');
  const [searchCyl, setSearchCyl] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');
  const [showRuptureAlertModal, setShowRuptureAlertModal] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    loadGrid(selectedModelId);
  }, [selectedModelId]);

  const loadModels = async () => {
    try {
      const response = await LensService.getModels();
      const models167 = (response.data || []).filter(
        m => m.matrix_type === 'GRADE_167'
      );
      setModels(models167);
      setSelectedModelId('');
    } catch (err) {
      console.error("Erro ao carregar modelos de lentes 1.67:", err);
    }
  };

  const loadGrid = async (modelId) => {
    setLoading(true);
    try {
      const response = await InventoryService.getGrid(modelId || null, 'GRADE_167');
      const data = response.data || [];
      const transposedData = data.map(item => {
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
        if (item.lens_model?.matrix_type !== 'GRADE_167') return false;
        if (item.base_curve !== null && item.base_curve !== undefined) return false;
        if (item.addition !== null && item.addition !== undefined) return false;
        if (item.eye !== null && item.eye !== undefined) return false;
        if (modelId && String(item.lens_model_id || item.lens_model?.id) !== String(modelId)) return false;
        return true;
      });

      setGridData(finalGrid);
    } catch (err) {
      console.error("Erro ao carregar grade de lentes 1.67:", err);
    } finally {
      setLoading(false);
    }
  };

  // Faixa de dioptrias específica para LENTES 1.67
  // Esférico: 0.00 a 12.00 com passo de 0.25
  // Cilíndrico: 0.00 a -4.00 com passo de 0.25
  const get167Ranges = () => {
    let sphs = [];
    let cyls = [];

    // Esférico: de 0.00 a 12.00 (passo 0.25)
    for (let s = 0; s <= 1200; s += 25) sphs.push(s / 100);

    // Cilíndrico: de 0.00 a -4.00 (passo -0.25)
    for (let c = 0; c >= -400; c -= 25) cyls.push(c / 100);

    return { sphs, cyls };
  };

  const { sphs, cyls } = get167Ranges();

  const getCellData = (sph, cyl) => {
    let matchingItems = gridData.filter(item => {
      if (item.lens_model?.matrix_type !== 'GRADE_167') return false;
      if (item.base_curve !== null && item.base_curve !== undefined) return false;
      if (item.addition !== null && item.addition !== undefined) return false;
      if (item.eye !== null && item.eye !== undefined) return false;
      const itemSph = Math.abs(parseFloat(item.spherical));
      const targetSph = Math.abs(sph);
      const itemCyl = Math.abs(parseFloat(item.cylindrical));
      const targetCyl = Math.abs(cyl);
      return Math.abs(itemSph - targetSph) < 0.01 && Math.abs(itemCyl - targetCyl) < 0.01;
    });

    if (filterTreatment) {
      // Filtra pelo tratamento do modelo selecionado via seu ID
      matchingItems = matchingItems.filter(item => String(item.lens_model_id || item.lens_model?.id) === String(filterTreatment));
    }

    if (matchingItems.length === 0) return null;

    if (filterTreatment || selectedModelId) {
      return matchingItems[0];
    }

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

      setGridData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));

      setSelectedCell(prev => {
        if (!prev) return null;
        if (prev.item?.isConsolidated) {
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

  const filteredSph = sphs.filter(s => searchSph === '' || s.toFixed(2).includes(searchSph));
  const filteredCyl = cyls.filter(c => searchCyl === '' || c.toFixed(2).includes(searchCyl));
  const selectedModel = models.find(m => m.id.toString() === selectedModelId);

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
  const uniqueTreatments = Array.from(uniqueTreatmentsMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const handleExportPDF = (itemsList = null) => {
    const criticalItems = gridData.filter(i => (i.quantity_available || 0) <= 2);
    const itemsToExport = itemsList || criticalItems;
    const modelName = selectedModel ? `${selectedModel.brand} - ${selectedModel.name}` : 'Lentes 1.67 (Todas as Marcas)';
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
          <title>Relatorio_Lentes_167_NovaLab</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #a855f7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 22px; font-weight: 800; color: #0f172a; }
            .logo span { color: #a855f7; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
            .meta { margin-bottom: 16px; font-size: 12px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 700; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .status-rupture { color: #dc2626; font-weight: 800; }
            .status-alert { color: #d97706; font-weight: 800; }
            .footer { margin-top: 25px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">NOVA <span>LAB</span></div>
              <div class="subtitle">Grade Especial de Lentes Alto Índice 1.67</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Data: <strong>${nowStr}</strong></div>
              <div>Filtro: <strong>${modelName}</strong></div>
            </div>
          </div>

          <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 6px;">Relatório de Grade de Lentes 1.67 (Esférico 0 a 12 | Cilíndrico 0 a 4)</h3>
          <div class="meta">
            Total de Dioptrias Listadas: <strong>${itemsToExport.length} células</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Modelo / Marca</th>
                <th>Tratamento</th>
                <th>Esférico (SPH)</th>
                <th>Cilíndrico (CYL)</th>
                <th style="text-align: center;">Qtd Atual</th>
                <th>Gaveta / Local</th>
                <th>Código de Barras</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToExport.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.lens_model?.name || item.brand || 'Lente 1.67'}</strong></td>
                  <td>${item.lens_model?.treatment || 'Incolor/AR'}</td>
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
          <div class="footer">Documento gerado automaticamente pelo Sistema Nova LAB - Grade Lentes 1.67</div>
          <script>window.onload = function() { window.print(); }</script>
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
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={28} style={{ color: 'hsl(var(--primary))' }} />
            1.67 Lentes Prontas
          </h1>
          <p className="page-subtitle">
            Grade tridimensional para controle de estoque de lentes 1.67 — Esférico de 0 a 12.00 (passo 0.25) e Cilíndrico de 0 a -4.00 (passo 0.25).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => handleExportPDF()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <FileText size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      {gridData.some(i => (i.quantity_available !== undefined ? i.quantity_available : 0) <= 2) && (
        <div 
          onClick={() => setShowRuptureAlertModal(true)}
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color="#dc2626" />
            <span>Atenção: Existem <strong>{gridData.filter(i => (i.quantity_available || 0) <= 2).length} dioptrias</strong> de Lentes 1.67 em nível Crítico/Ruptura.</span>
          </div>
          <button style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
            Ver Alertas ➔
          </button>
        </div>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '280px' }}>
          <label className="form-label">Filtrar por Tratamento (1.67)</label>
          <select 
            className="form-control" 
            value={filterTreatment} 
            onChange={(e) => { setFilterTreatment(e.target.value); setSelectedModelId(e.target.value ? e.target.value : ''); }}
          >
            <option value="">Todas as Marcas e Tratamentos 1.67 (Visão Consolidada)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} — {m.material} ({m.treatment}) [ø{m.diameter}mm]
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="form-group">
            <label className="form-label">Busca Rápida Esférico</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: 2.00"
              value={searchSph}
              onChange={(e) => setSearchSph(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Busca Rápida Cilíndrico</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: -1.00"
              value={searchCyl}
              onChange={(e) => setSearchCyl(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DA GRADE 1.67 - MESMO CSS E ESTRUTURA DE GRADE OPTICA */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '10px' }} />
          <p>Carregando grade de lentes 1.67...</p>
        </div>
      ) : (
        <div className="grid-container no-scroll">
          <table className="optical-grid fit-grid-table">
            <thead>
              <tr>
                <th style={{ width: '100px', position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))' }}>
                  Esf / Cil
                </th>
                {filteredCyl.map(c => (
                  <th key={c}>
                    {c.toFixed(2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSph.map(s => (
                <tr key={s}>
                  <td className="sph-header" style={{ position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))', fontWeight: 'bold' }}>
                    {s.toFixed(2)}
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
      )}

      {/* MODAL DETALHES DA CÉLULA DA GRADE */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: 'hsl(var(--primary))' }} />
                Dioptria 1.67: Esférico {selectedCell.spherical.toFixed(2)} | Cilíndrico {selectedCell.cylindrical.toFixed(2)}
              </h2>
              <button onClick={() => setSelectedCell(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            {selectedCell.item ? (
              selectedCell.item.isConsolidated ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '14px' }}>
                    Estoque total consolidado nesta dioptria: <strong>{selectedCell.item.quantity_available} unidades</strong>
                  </p>

                  <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedCell.item.items.map(subItem => {
                      const isEditingThis = editingItemId === subItem.id;
                      return (
                        <div key={subItem.id} style={{ background: isEditingThis ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)', border: isEditingThis ? '1px solid #3b82f6' : '1px solid var(--border-glass)', padding: '14px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'hsl(var(--primary))' }}>
                                {subItem.lens_model?.brand || 'Lente 1.67'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
                                {subItem.lens_model?.material || 'Alto Índice 1.67'} | Tratamento: {subItem.lens_model?.treatment || 'AR'}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                                Gaveta: <strong>{subItem.location_tag || 'N/A'}</strong> | EAN: <span style={{ fontFamily: 'monospace' }}>{subItem.barcode || 'N/A'}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#4ade80' }}>
                                {subItem.quantity_available} un
                              </span>
                              {!isEditingThis && (
                                <div style={{ marginTop: '6px' }}>
                                  <button
                                    className="btn btn-xs btn-outline"
                                    onClick={() => startEditingItem(subItem)}
                                    style={{ fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Edit size={14} /> Ajustar Estoque
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {isEditingThis && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(59,130,246,0.2)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Qtd Estoque</label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditQty(Math.max(0, parseInt(editQty || 0) - 1))}>
                                      <Minus size={14} />
                                    </button>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={editQty}
                                      onChange={(e) => setEditQty(e.target.value)}
                                      style={{ color: 'black', fontWeight: 800, textAlign: 'center' }}
                                    />
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditQty(parseInt(editQty || 0) + 1)}>
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Gaveta</label>
                                  <input type="text" className="form-control" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} style={{ color: 'black' }} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Cód. Barras</label>
                                  <input type="text" className="form-control" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} style={{ color: 'black' }} />
                                </div>
                              </div>
                              {updateError && <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '6px' }}>{updateError}</div>}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingItemId(null)}>Cancelar</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={updating}>
                                  <Save size={14} /> Salvar Este Item
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Quantidade em Estoque</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button className="btn btn-secondary" onClick={() => setEditQty(Math.max(0, parseInt(editQty || 0) - 1))}>
                        <Minus size={16} />
                      </button>
                      <input 
                        type="number" 
                        className="form-control" 
                        min="0"
                        value={editQty} 
                        onChange={(e) => setEditQty(e.target.value)}
                        style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem' }}
                      />
                      <button className="btn btn-secondary" onClick={() => setEditQty(parseInt(editQty || 0) + 1)}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gaveta / Localização Física</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: GAVETA-167-A1"
                      value={editLocation} 
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Código de Barras</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Código EAN/Barras da Lente"
                      value={editBarcode} 
                      onChange={(e) => setEditBarcode(e.target.value)}
                    />
                  </div>

                  {updateError && (
                    <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>
                      {updateError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setSelectedCell(null)}>
                      Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveEdit} disabled={updating}>
                      <Save size={16} /> Salvar Alterações
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                  Nenhum registro físico cadastrado no estoque para esta dioptria de lente 1.67.
                </p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', marginBottom: '0', color: 'hsl(var(--text-muted))' }}>
                  Acesse o <strong>Cadastrador Unificado de Lentes & Bipador</strong> no menu principal para cadastrar esta dioptria.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Alertas de Ruptura / Estoque Crítico 1.67 */}
      {showRuptureAlertModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239,68,68,0.3)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} /> Alertas de Ruptura e Nível Crítico (Lentes 1.67)
              </h3>
              <button className="btn btn-icon" onClick={() => setShowRuptureAlertModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '14px' }}>
                Listagem de todas as dioptrias de Lentes 1.67 com quantidade zerada ou crítica em estoque (≤ 2 un).
              </p>

              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.6)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '10px' }}>Modelo / Marca</th>
                      <th style={{ padding: '10px' }}>Esférico</th>
                      <th style={{ padding: '10px' }}>Cilíndrico</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Qtd Atual</th>
                      <th style={{ padding: '10px' }}>Gaveta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.filter(i => (i.quantity_available || 0) <= 2).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                          Nenhuma dioptria crítica encontrada para o filtro atual.
                        </td>
                      </tr>
                    ) : (
                      gridData.filter(i => (i.quantity_available || 0) <= 2).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{item.lens_model?.name || item.brand || 'Lente 1.67'}</td>
                          <td style={{ padding: '10px' }}>{parseFloat(item.spherical) > 0 ? '+' : ''}{parseFloat(item.spherical).toFixed(2)}</td>
                          <td style={{ padding: '10px' }}>{parseFloat(item.cylindrical).toFixed(2)}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: item.quantity_available === 0 ? '#ef4444' : '#f59e0b' }}>
                            {item.quantity_available || 0} un
                          </td>
                          <td style={{ padding: '10px' }}>{item.location_tag || 'GAVETA-S/N'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => handleExportPDF(gridData.filter(i => (i.quantity_available || 0) <= 2))}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={16} /> Exportar PDF de Ruptura
                </button>
                <button className="btn btn-secondary" onClick={() => setShowRuptureAlertModal(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeLentes167;
