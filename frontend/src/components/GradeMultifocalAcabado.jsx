import React, { useEffect, useState } from 'react';
import { LensService, InventoryService } from '../services/api';
import { Layers, Plus, Minus, Save, Edit, RefreshCw, X, ShieldAlert, Eye, EyeOff, Box, MapPin, Check, FileText } from 'lucide-react';

const GradeMultifocalAcabado = () => {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

  // Curvas Base Padrão: 0.00 até 8.00
  const defaultBases = [
    0.00, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75,
    4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00, 7.25, 7.50, 7.75, 8.00
  ];

  // Adições Padrão: 1.00 até 4.00
  const defaultAdditions = [
    1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00
  ];

  // Filtros de busca rápida por grau
  const [searchBase, setSearchBase] = useState('');
  const [searchAdd, setSearchAdd] = useState('');
  const [showFullRange, setShowFullRange] = useState(true);

  // Estado para edição manual de uma célula da grade
  const [editQty, setEditQty] = useState(0);
  const [editMinStock, setEditMinStock] = useState(2);
  const [editLocation, setEditLocation] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [updatingCell, setUpdatingCell] = useState(false);
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
      const mfModels = (response.data || []).filter(
        m => m.matrix_type === 'MF_ACB'
      );
      setModels(mfModels);
      setSelectedModelId('');
    } catch (err) {
      console.error("Erro ao carregar modelos para Multifocal Acabado:", err);
    }
  };

  const loadGrid = async (modelId) => {
    setLoading(true);
    try {
      const response = await InventoryService.getGrid(modelId || null);
      const data = response.data || [];
      const filtered = data.filter(item => {
        if (item.lens_model?.matrix_type !== 'MF_ACB') return false;
        if (modelId && String(item.lens_model_id || item.lens_model?.id) !== String(modelId)) return false;
        return true;
      });
      setGridData(filtered);
    } catch (err) {
      console.error("Erro ao carregar matriz Multifocal Acabado:", err);
    } finally {
      setLoading(false);
    }
  };

  const presentBases = new Set(defaultBases);
  const presentAdditions = new Set(defaultAdditions);
  
  gridData.forEach(item => {
    const rawBase = (item.base_curve !== null && item.base_curve !== undefined) 
      ? item.base_curve 
      : (item.spherical !== null && item.spherical !== undefined ? item.spherical : 0);
    const rawAdd = (item.addition !== null && item.addition !== undefined) 
      ? item.addition 
      : (item.cylindrical !== null && item.cylindrical !== undefined ? item.cylindrical : 0);
    presentBases.add(parseFloat(rawBase) || 0.0);
    presentAdditions.add(parseFloat(rawAdd) || 0.0);
  });

  const verticalRange = Array.from(presentBases).sort((a, b) => a - b);
  const horizontalRange = Array.from(presentAdditions).sort((a, b) => a - b);

  const itemsMap = {};
  gridData.forEach(item => {
    const rawBase = (item.base_curve !== null && item.base_curve !== undefined) 
      ? item.base_curve 
      : (item.spherical !== null && item.spherical !== undefined ? item.spherical : 0);
    const rawAdd = (item.addition !== null && item.addition !== undefined) 
      ? item.addition 
      : (item.cylindrical !== null && item.cylindrical !== undefined ? item.cylindrical : 0);

    const baseVal = parseFloat(rawBase || 0).toFixed(2);
    const addVal = parseFloat(rawAdd || 0).toFixed(2);
    const eyeRaw = (item.eye || item.eye_side || 'OD').toString().toUpperCase().trim();
    const side = (eyeRaw.includes('E') || eyeRaw === 'OE') ? 'OE' : 'OD';

    const key = `${baseVal}_${addVal}_${side}`;

    if (!itemsMap[key]) {
      itemsMap[key] = { 
        base_curve: parseFloat(baseVal),
        addition: parseFloat(addVal),
        eye_side: side, 
        quantity_available: item.quantity_available || 0, 
        items: [item] 
      };
    } else {
      itemsMap[key].quantity_available += (item.quantity_available || 0);
      itemsMap[key].items.push(item);
    }
  });

  const getItemForSide = (base, add, side) => {
    const bStr = Number(base || 0).toFixed(2);
    const aStr = Number(add || 0).toFixed(2);
    const sideNorm = (side === 'OE' || side === 'E') ? 'OE' : 'OD';
    const key = `${bStr}_${aStr}_${sideNorm}`;

    if (itemsMap[key]) {
      return itemsMap[key];
    }

    return {
      base_curve: base,
      addition: add,
      eye_side: sideNorm,
      quantity_available: 0,
      items: []
    };
  };

  const filteredBases = verticalRange.filter(b => searchBase === '' || b.toFixed(2).includes(searchBase));
  const filteredAdditions = horizontalRange.filter(a => searchAdd === '' || a.toFixed(2).includes(searchAdd));

  let ruptureCount = 0;
  let criticalItems = [];
  gridData.forEach(item => {
    if ((item.quantity_available || 0) <= 2) {
      ruptureCount++;
      criticalItems.push(item);
    }
  });

  // Classe CSS idêntica à Grade Multifocal (GradeBlocos.jsx) para alinhamento perfeito de tipografia e opacidade
  const getCellClass = (item) => {
    if (!item) return 'lens-cell empty';
    const qty = item?.quantity_available || 0;
    if (qty === 0) return 'lens-cell empty';
    if (qty >= 1 && qty <= 2) return 'lens-cell rupture';
    if (qty >= 3 && qty <= 4) return 'lens-cell alert';
    return 'lens-cell normal';
  };

  const handleOpenCellModal = (base, add, item) => {
    const cellSide = (item?.eye_side || 'OD').toString().toUpperCase().trim();
    setSelectedCell({
      base_curve: base,
      addition: add,
      eye_side: cellSide,
      item
    });
    setEditingItemId(null);
    setEditQty(0);
    setEditLocation('');
    setEditBarcode('');
  };

  const startEditingSubItem = (subItem) => {
    setEditingItemId(subItem.id);
    setEditQty(subItem.quantity_available || 0);
    setEditMinStock(2);
    setEditLocation(subItem.location_tag || '');
    setEditBarcode(subItem.barcode || '');
  };

  const getCellItemsList = () => {
    if (!selectedCell || !selectedCell.item) return [];
    const targetSide = selectedCell.eye_side === 'OE' ? 'OE' : 'OD';
    let rawList = selectedCell.item.items || [];
    return rawList.filter(i => {
      const itemEye = (i.eye || i.eye_side || 'OD').toString().toUpperCase().trim();
      const isItemOE = itemEye.includes('E') || itemEye === 'OE';
      return (targetSide === 'OE') === isItemOE;
    });
  };

  const getTotalQtyInCell = () => {
    if (!selectedCell || !selectedCell.item) return 0;
    return selectedCell.item.quantity_available || 0;
  };

  const getEditingItemObj = () => {
    if (!editingItemId) return null;
    const items = getCellItemsList();
    return items.find(i => i.id === editingItemId) || selectedCell?.item;
  };

  const handleSaveCellEdit = async (e) => {
    e.preventDefault();
    if (!editingItemId) return;
    setUpdatingCell(true);

    try {
      const payload = {
        quantity_available: parseInt(editQty) || 0,
        location_tag: editLocation || null,
        barcode: editBarcode || null
      };

      await InventoryService.update(editingItemId, payload);
      await loadGrid(selectedModelId);

      setSelectedCell(prev => {
        if (!prev || !prev.item || !prev.item.items) return null;
        const updatedItems = prev.item.items.map(i => i.id === editingItemId ? {
          ...i,
          quantity_available: parseInt(editQty) || 0,
          location_tag: editLocation || null,
          barcode: editBarcode || null
        } : i);
        const totalQty = updatedItems.reduce((sum, i) => sum + (i.quantity_available || 0), 0);
        return {
          ...prev,
          item: {
            ...prev.item,
            quantity_available: totalQty,
            items: updatedItems
          }
        };
      });

      setEditingItemId(null);
    } catch (err) {
      console.error("Erro ao atualizar item de estoque:", err);
      alert("Erro ao salvar alterações desta lente.");
    } finally {
      setUpdatingCell(false);
    }
  };

  const handleExportPDF = (itemsList = null) => {
    const itemsToExport = itemsList || criticalItems;
    const modelName = models.find(m => String(m.id) === String(selectedModelId))?.name || 'Todos os Modelos';
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
          <title>Relatorio_Multifocal_Acabado_NovaLab</title>
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
            .side-d { color: #0284c7; font-weight: 800; }
            .side-e { color: #9333ea; font-weight: 800; }
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
              <div class="subtitle">Laboratório Óptico & Controle de Inventário de Multifocal Acabado</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Data: <strong>${nowStr}</strong></div>
              <div>Filtro: <strong>${modelName}</strong></div>
            </div>
          </div>

          <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 6px;">Relatório de Estoque Crítico / Ruptura (Grade Multifocal Acabado)</h3>
          <div class="meta">
            Total de Itens Listados: <strong>${itemsToExport.length} células</strong> | Critério: <strong>Estoque &le; 2 unidades</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Modelo / Marca de Lente</th>
                <th>Base</th>
                <th>Adição</th>
                <th>Olho / Lado</th>
                <th style="text-align: center;">Qtd Atual</th>
                <th>Localização</th>
                <th>Código de Barras</th>
              </tr>
            </thead>
            <tbody>
              ${itemsToExport.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.lens_model?.name || item.brand || 'Modelo Multifocal'}</strong></td>
                  <td>${parseFloat(item.base_curve || item.spherical || 0).toFixed(2)}</td>
                  <td>+${parseFloat(item.addition || item.cylindrical || 0).toFixed(2)}</td>
                  <td class="${(item.eye || item.eye_side) === 'OE' ? 'side-e' : 'side-d'}">${item.eye || item.eye_side || 'OD'}</td>
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
            Documento gerado automaticamente pelo Sistema Nova LAB Ótica - Relatório de Inventário Multifocal Acabado
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
      
      {/* Cabeçalho da Página (Visualmente Idêntico à Grade Multifocal) */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">Multifocal Acabado</h1>
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

      {/* Alerta de Ruptura / Estoque Crítico (Visualmente Idêntico à Grade Multifocal) */}
      {ruptureCount > 0 && (
        <div 
          onClick={() => setShowRuptureAlertModal(true)}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#dc2626',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color="#dc2626" />
            <span>Atenção: Existem <strong>{ruptureCount} células de lentes</strong> em nível Crítico (1-2 un) ou Ruptura (0 un).</span>
          </div>
          <button style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
            Ver Lentes no Alerta ➔
          </button>
        </div>
      )}

      {/* Busca por Grau (Base / Adição) & Filtro por Tratamento */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '280px' }}>
          <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            BUSCA RÁPIDA POR GRAU
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Curva Base (Ex: 4.00)" 
              className="form-control"
              value={searchBase}
              onChange={(e) => setSearchBase(e.target.value)}
              style={{ color: 'black' }}
            />
            <input 
              type="text" 
              placeholder="Adição (Ex: +2.00)" 
              className="form-control"
              value={searchAdd}
              onChange={(e) => setSearchAdd(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
          <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            FILTRAR POR TRATAMENTO
          </label>
          <select
            className="form-control"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            style={{ color: 'black' }}
          >
            <option value="">Todas as Marcas e Tratamentos Multifocal Acabado (Visão Consolidada)</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.brand} — {m.material} ({m.treatment}) [Rota: {m.production_route || 'EXPRESSA_FACETAMENTO'}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela Gráfica da Grade Multifocal Acabado (Visualmente Idêntica à Grade Multifocal) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Layers className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
          <p>Carregando matriz de multifocal acabado...</p>
        </div>
      ) : (
        <div className="grid-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="optical-grid block-grid-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '70px', position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))', verticalAlign: 'middle', borderRight: '2px solid var(--border-glass)', fontSize: '0.78rem', padding: '4px 2px' }}>
                  Base / Add
                </th>
                {filteredAdditions.map(add => (
                  <th key={add} colSpan={2} style={{ textAlign: 'center', borderBottom: '1px solid var(--border-glass)', borderRight: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255, 255, 255, 0.06)', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', padding: '4px 1px' }}>
                    +{add.toFixed(2)}
                  </th>
                ))}
              </tr>
              <tr>
                {filteredAdditions.map(add => (
                  <React.Fragment key={`sub-${add}`}>
                    <th className="sub-header-d">
                      D
                    </th>
                    <th className="sub-header-e">
                      E
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBases.map(base => (
                <tr key={base}>
                  <td className="sph-header" style={{ position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))', fontWeight: 'bold' }}>
                    {base.toFixed(2)}
                  </td>
                  {filteredAdditions.map(add => {
                    const itemD = getItemForSide(base, add, 'D');
                    const itemE = getItemForSide(base, add, 'E');

                    const cellClassD = getCellClass(itemD);
                    const cellClassE = getCellClass(itemE);

                    return (
                      <React.Fragment key={`cell-${base}-${add}`}>
                        {/* Subcoluna Olho Direito D */}
                        <td 
                          className={cellClassD}
                          onClick={() => handleOpenCellModal(base, add, itemD)}
                          style={{ cursor: 'pointer', textAlign: 'center' }}
                        >
                          <div className="lens-cell-inner">
                            <span className="lens-qty">
                              {itemD.quantity_available}
                            </span>
                            {itemD.location_tag && (
                              <span className="lens-loc">{itemD.location_tag}</span>
                            )}
                          </div>
                        </td>

                        {/* Subcoluna Olho Esquerdo E */}
                        <td 
                          className={cellClassE}
                          onClick={() => handleOpenCellModal(base, add, itemE)}
                          style={{ cursor: 'pointer', textAlign: 'center' }}
                        >
                          <div className="lens-cell-inner">
                            <span className="lens-qty">
                              {itemE.quantity_available}
                            </span>
                            {itemE.location_tag && (
                              <span className="lens-loc">{itemE.location_tag}</span>
                            )}
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL LATERAL / DETALHAMENTO DA DIOPTRIA SELECIONADA (IDÊNTICO À GRADE MULTIFOCAL) */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Dioptria Selecionada
              </h3>
              <button onClick={() => setSelectedCell(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Header Cards: Curva Base e Adição */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Curva Base</span>
                <strong style={{ fontSize: '1.4rem' }}>
                  {selectedCell.base_curve?.toFixed(2)}
                </strong>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Adição</span>
                <strong style={{ fontSize: '1.4rem' }}>
                  {selectedCell.addition === 0 ? '0.00' : `+${selectedCell.addition?.toFixed(2)}`}
                </strong>
              </div>
            </div>

            {/* Conteúdo: Modo Edição de Item vs Lista de Modelos */}
            {editingItemId ? (
              /* Inline Edit View */
              <form onSubmit={handleSaveCellEdit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {(() => {
                  const editingItem = getEditingItemObj();
                  return (
                    <>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Modelo de Lente:</span>
                        <p style={{ fontWeight: 700, fontSize: '1rem', margin: '2px 0' }}>
                          {editingItem?.brand || editingItem?.lens_model?.brand || 'Marca Própria'} - {editingItem?.name || editingItem?.lens_model?.name || 'Multifocal Acabado'}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', margin: 0 }}>
                          Material: {editingItem?.material || editingItem?.lens_model?.material || 'Resina'} | Tratamento: {editingItem?.treatment || editingItem?.lens_model?.treatment || 'Incolor'}
                        </p>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Estoque Físico Disponível</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setEditQty(q => Math.max(0, parseInt(q) - 1))}
                            style={{ padding: '8px 14px', minWidth: '42px', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 'bold', color: 'black' }}
                            value={editQty} 
                            onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                          />
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setEditQty(q => parseInt(q) + 1)}
                            style={{ padding: '8px 14px', minWidth: '42px', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700 }}>Estoque Mínimo</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={editMinStock} 
                            onChange={(e) => setEditMinStock(e.target.value)}
                            style={{ color: 'black' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700 }}>Localização (Gaveta)</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={editLocation} 
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="Ex: GAV-MF01"
                            style={{ color: 'black' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Código de Barras EAN/USB</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={editBarcode} 
                          onChange={(e) => setEditBarcode(e.target.value)}
                          placeholder="Sem código de barras"
                          style={{ fontFamily: 'monospace', color: 'black' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={() => setEditingItemId(null)}
                          style={{ flex: 1 }}
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          disabled={updatingCell}
                          className="btn btn-primary" 
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Save size={16} />
                          {updatingCell ? "Salvando..." : "Salvar Alterações"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </form>
            ) : (
              /* Lista de Modelos na Dioptria (Visualmente Idêntico à Grade Multifocal) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
                  Existe um total de <strong>{getTotalQtyInCell()} unidades</strong> físicas em estoque divididas nos seguintes modelos:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
                  {getCellItemsList().map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      style={{ 
                        padding: '16px', 
                        border: '1px solid rgba(147, 51, 234, 0.2)', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '10px', 
                        background: 'rgba(255,255,255,0.95)', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        color: '#1e293b'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block' }}>
                            {item.lens_model?.brand || item.brand || 'Marca Própria'} {item.lens_model?.name ? `— ${item.lens_model.name}` : ''}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {item.lens_model?.material || 'Resina'} ({item.lens_model?.treatment || 'Incolor'}) — Rota: {item.lens_model?.production_route || 'EXPRESSA_FACETAMENTO'}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 800, 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          background: item.quantity_available <= 2 ? '#fee2e2' : '#dcfce7',
                          color: item.quantity_available <= 2 ? '#dc2626' : '#16a34a'
                        }}>
                          {item.quantity_available} un
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingTop: '8px', borderTop: '1px border-glass' }}>
                        <div>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Gaveta: </span>
                          <strong style={{ color: '#0284c7' }}>{item.location_tag || 'GAVETA-S/N'}</strong>
                          {item.barcode && (
                            <span style={{ marginLeft: '12px', fontFamily: 'monospace', color: '#64748b' }}>
                              EAN: {item.barcode}
                            </span>
                          )}
                        </div>

                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditingSubItem(item)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          <Edit size={14} /> Editar
                        </button>
                      </div>
                    </div>
                  ))}
                  {getCellItemsList().length === 0 && (
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                      Nenhum item físico registrado nesta dioptria.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Alertas de Ruptura / Nível Crítico (Visualmente Idêntico à Grade Multifocal) */}
      {showRuptureAlertModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239,68,68,0.3)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} /> Alertas de Ruptura e Nível Crítico (Multifocal Acabado)
              </h3>
              <button className="btn btn-icon" onClick={() => setShowRuptureAlertModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '14px' }}>
                Listagem de dioptrias de Multifocal Acabado com quantidade zerada ou em nível crítico (≤ 2 un).
              </p>

              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.6)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '10px' }}>Modelo / Tratamento</th>
                      <th style={{ padding: '10px' }}>Curva Base</th>
                      <th style={{ padding: '10px' }}>Adição</th>
                      <th style={{ padding: '10px' }}>Olho</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Qtd Atual</th>
                      <th style={{ padding: '10px' }}>Gaveta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.filter(i => (i.quantity_available || 0) <= 2).length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                          Nenhuma dioptria crítica encontrada para o filtro atual.
                        </td>
                      </tr>
                    ) : (
                      gridData.filter(i => (i.quantity_available || 0) <= 2).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>
                            {item.lens_model?.brand || item.brand || 'Multifocal'} ({item.lens_model?.treatment || 'Incolor'})
                          </td>
                          <td style={{ padding: '10px' }}>Base {parseFloat(item.base_curve || item.spherical || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px' }}>+{parseFloat(item.addition || item.cylindrical || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: (item.eye || item.eye_side) === 'OE' ? '#38bdf8' : '#a855f7' }}>{item.eye || item.eye_side || 'OD'}</td>
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
                  onClick={() => handleExportPDF()}
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

export default GradeMultifocalAcabado;
