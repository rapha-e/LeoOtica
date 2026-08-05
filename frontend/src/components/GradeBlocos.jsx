import React, { useEffect, useState } from 'react';
import { BlockService } from '../services/api';
import { Layers, Plus, Save, Edit, RefreshCw, X, ShieldAlert, Eye, EyeOff, Box, MapPin, Check, FileText } from 'lucide-react';

const GradeBlocos = () => {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

  // Filtros de busca rápida por grau
  const [searchBase, setSearchBase] = useState('');
  const [searchAdd, setSearchAdd] = useState('');
  const [showFullRange, setShowFullRange] = useState(true);

  // Estado para cadastro de novo modelo de bloco
  const [showNewModelModal, setShowNewModelModal] = useState(false);
  const [newModelForm, setNewModelForm] = useState({
    brand: '',
    name: '',
    material: 'CR-39',
    refractive_index: 1.56,
    cost_price: 35.00,
    sale_price: 95.00,
    is_active: true,
    base_curves_config: '2.00, 4.00, 6.00, 8.00',
    additions_config: '0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
  });
  const [creatingModel, setCreatingModel] = useState(false);

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
    loadMatrix(selectedModelId);
  }, [selectedModelId]);

  const loadModels = async () => {
    try {
      const response = await BlockService.getModels();
      setModels(response.data);
      if (response.data.length > 0 && !selectedModelId) {
        setSelectedModelId(response.data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar modelos de blocos:", err);
    }
  };

  const loadMatrix = async (modelId) => {
    setLoading(true);
    try {
      if (modelId) {
        const response = await BlockService.getGrid(modelId);
        setMatrixData(response.data);
      } else {
        // Busca todos os modelos e consolida a matriz
        const modelsRes = await BlockService.getModels();
        const allModels = modelsRes.data;
        
        let consolidatedMap = {};
        const targetBases = [2.00, 4.00, 6.00];
        const targetAdds = [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25];

        for (const m of allModels) {
          try {
            const gridRes = await BlockService.getGrid(m.id);
            const map = gridRes.data.items_map || {};

            Object.keys(map).forEach(k => {
              if (!consolidatedMap[k]) {
                consolidatedMap[k] = {
                  base_curve: map[k].base_curve,
                  addition: map[k].addition,
                  eye_side: map[k].eye_side || 'AMBOS',
                  quantity_available: 0,
                  location_tag: '',
                  items: []
                };
              }
              consolidatedMap[k].quantity_available += (map[k].quantity_available || 0);
              
              const itemWithModel = {
                ...map[k],
                block_model: m,
                brand: m.brand,
                name: m.name,
                material: m.material,
                refractive_index: m.refractive_index
              };
              consolidatedMap[k].items.push(itemWithModel);
            });
          } catch (e) {
            console.error("Erro ao buscar modelo:", m.id, e);
          }
        }

        Object.keys(consolidatedMap).forEach(k => {
          const item = consolidatedMap[k];
          item.isConsolidated = true;
          item.location_tag = `${item.items.length} Mod.`;
        });

        setMatrixData({
          model: { id: '', brand: 'Todos', name: 'Todos os Modelos', material: '', refractive_index: 0 },
          base_curves: targetBases,
          additions: targetAdds,
          items_map: consolidatedMap
        });
      }
    } catch (err) {
      console.error("Erro ao carregar matriz de blocos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModel = async (e) => {
    e.preventDefault();
    if (!newModelForm.brand.trim() || !newModelForm.name.trim()) return;
    setCreatingModel(true);
    try {
      const response = await BlockService.createModel(newModelForm);
      setShowNewModelModal(false);
      setNewModelForm({ 
        brand: '', 
        name: '', 
        material: 'CR-39', 
        refractive_index: 1.56,
        cost_price: 35.00,
        sale_price: 95.00,
        is_active: true,
        base_curves_config: '2.00, 4.00, 6.00',
        additions_config: '0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00'
      });
      await loadModels();
      setSelectedModelId(response.data.id);
    } catch (err) {
      alert("Erro ao cadastrar modelo de bloco: " + (err.response?.data?.detail || err.message));
    } finally {
      setCreatingModel(false);
    }
  };

  const handleOpenCellModal = (base, add, cellItem) => {
    setSelectedCell({
      base_curve: base,
      addition: add,
      item: cellItem
    });
    setEditingItemId(null);
  };

  const startEditingCellItem = (item) => {
    setEditingItemId(item.id);
    setEditQty(item.quantity_available || 0);
    setEditMinStock(item.min_stock || 2);
    setEditLocation(item.location_tag || '');
    setEditBarcode(item.barcode || '');
  };

  const handleSaveCellEdit = async (e) => {
    e.preventDefault();
    if (!editingItemId) return;
    setUpdatingCell(true);
    try {
      await BlockService.updateGridItem(editingItemId, {
        quantity_available: parseInt(editQty, 10),
        min_stock: parseInt(editMinStock, 10),
        location_tag: editLocation,
        barcode: editBarcode
      });
      setEditingItemId(null);
      await loadMatrix(selectedModelId);

      // Atualiza os dados na célula selecionada em memória
      setSelectedCell(prev => {
        if (!prev) return null;
        if (prev.item && prev.item.items) {
          const updatedItems = prev.item.items.map(i => i.id === editingItemId ? {
            ...i,
            quantity_available: parseInt(editQty, 10),
            min_stock: parseInt(editMinStock, 10),
            location_tag: editLocation,
            barcode: editBarcode
          } : i);
          const totalQty = updatedItems.reduce((acc, curr) => acc + (curr.quantity_available || 0), 0);
          return {
            ...prev,
            item: {
              ...prev.item,
              quantity_available: totalQty,
              items: updatedItems
            }
          };
        } else if (prev.item) {
          return {
            ...prev,
            item: {
              ...prev.item,
              quantity_available: parseInt(editQty, 10),
              min_stock: parseInt(editMinStock, 10),
              location_tag: editLocation,
              barcode: editBarcode
            }
          };
        }
        return prev;
      });
    } catch (err) {
      alert("Erro ao atualizar célula: " + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingCell(false);
    }
  };

  const getCellClass = (item) => {
    if (!item) return 'lens-cell empty';
    const qty = item.quantity_available !== undefined ? item.quantity_available : 0;
    if (qty === 0) return 'lens-cell empty';

    if (item.isConsolidated && item.items && item.items.length > 0) {
      const hasRupture = item.items.some(i => (i.quantity_available || 0) <= 2);
      const hasAlert = item.items.some(i => (i.quantity_available || 0) >= 3 && (i.quantity_available || 0) <= 4);
      if (hasRupture) return 'lens-cell rupture';
      if (hasAlert) return 'lens-cell alert';
    }

    if (qty >= 1 && qty <= 2) return 'lens-cell rupture';
    if (qty >= 3 && qty <= 4) return 'lens-cell alert';
    return 'lens-cell normal';
  };

  const baseCurves = (matrixData?.base_curves || [2.00, 4.00, 6.00]).filter(b => b <= 6.00);
  const additions = (matrixData?.additions || [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25]).filter(a => a >= 0.75 && a <= 3.25);
  const itemsMap = matrixData?.items_map || {};

  const getItemForSide = (base, add, side) => {
    const keySide = `${base.toFixed(2)}_${add.toFixed(2)}_${side}`;
    const keyAgg = `${base.toFixed(2)}_${add.toFixed(2)}`;

    if (itemsMap[keySide]) {
      const item = itemsMap[keySide];
      if (item.isConsolidated && item.items) {
        const sideItems = item.items.filter(i => i.eye_side === side);
        const totalQty = sideItems.reduce((sum, i) => sum + (i.quantity_available || 0), 0);
        return {
          ...item,
          quantity_available: totalQty,
          location_tag: `${sideItems.length} Mod.`
        };
      }
      return item;
    }

    if (itemsMap[keyAgg] && itemsMap[keyAgg].items) {
      const sideItems = itemsMap[keyAgg].items.filter(i => i.eye_side === side);
      if (sideItems.length > 0) {
        const totalQty = sideItems.reduce((sum, i) => sum + (i.quantity_available || 0), 0);
        return {
          base_curve: base,
          addition: add,
          eye_side: side,
          quantity_available: totalQty,
          isConsolidated: true,
          items: sideItems,
          location_tag: `${sideItems.length} Mod.`
        };
      }
    }

    if (itemsMap[keyAgg]) {
      const agg = itemsMap[keyAgg];
      const qty = side === 'D' ? Math.ceil((agg.quantity_available || 0) / 2) : Math.floor((agg.quantity_available || 0) / 2);
      return {
        ...agg,
        eye_side: side,
        quantity_available: qty,
        location_tag: agg.location_tag || (agg.items ? `${agg.items.length} Mod.` : '')
      };
    }

    return {
      base_curve: base,
      addition: add,
      eye_side: side,
      quantity_available: 0
    };
  };

  const filteredBases = baseCurves.filter(b => searchBase === '' || b.toFixed(2).includes(searchBase));
  const filteredAdditions = additions.filter(a => searchAdd === '' || a.toFixed(2).includes(searchAdd));

  let ruptureCount = 0;
  let criticalBlockItems = [];

  Object.values(itemsMap).forEach(item => {
    if (item.isConsolidated && item.items) {
      item.items.forEach(sub => {
        if ((sub.quantity_available || 0) <= 2) {
          ruptureCount++;
          criticalBlockItems.push(sub);
        }
      });
    } else if ((item.quantity_available || 0) <= 2) {
      ruptureCount++;
      criticalBlockItems.push(item);
    }
  });

  // Auxiliares para o modal de detalhamento
  const getCellItemsList = () => {
    if (!selectedCell || !selectedCell.item) return [];
    if (selectedCell.item.items) {
      return selectedCell.item.items;
    }
    // Caso seja modelo único
    return [{
      ...selectedCell.item,
      block_model: matrixData?.model,
      brand: matrixData?.model?.brand || 'Modelo Atual',
      name: matrixData?.model?.name || '',
      material: matrixData?.model?.material || 'CR-39',
      refractive_index: matrixData?.model?.refractive_index || 1.56
    }];
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

  const handleExportPDF = (itemsList = null) => {
    const itemsToExport = itemsList || criticalBlockItems;
    const modelName = matrixData?.model?.name || 'Todos os Modelos';
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
          <title>Relatorio_Blocos_Ruptura_NovaLab</title>
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
              <div class="subtitle">Laboratório Óptico & Controle de Inventário de Blocos</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Data: <strong>${nowStr}</strong></div>
              <div>Filtro: <strong>${modelName}</strong></div>
            </div>
          </div>

          <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 6px;">Relatório de Estoque Crítico / Ruptura (Grade de Blocos)</h3>
          <div class="meta">
            Total de Itens Listados: <strong>${itemsToExport.length} células</strong> | Critério: <strong>Estoque &le; 2 unidades</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Modelo / Marca de Bloco</th>
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
                  <td><strong>${item.block_model?.name || item.brand || 'Modelo de Bloco'}</strong></td>
                  <td>${parseFloat(item.base_curve).toFixed(2)}</td>
                  <td>+${parseFloat(item.addition).toFixed(2)}</td>
                  <td class="${item.eye_side === 'D' ? 'side-d' : (item.eye_side === 'E' ? 'side-e' : '')}">${item.eye_side || 'AMBOS'}</td>
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
            Documento gerado automaticamente pelo Sistema Nova LAB Ótica - Relatório de Inventário de Blocos
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
      
      {/* Cabeçalho da Página */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">Matriz de Blocos (Grade Óptica)</h1>
          <p className="page-subtitle">Visualize e pesquise a quantidade e localização física de cada bloco no estoque.</p>
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
            className="btn btn-primary btn-sm" 
            onClick={() => setShowNewModelModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            + Inserir Bloco Manualmente
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

      {/* Alerta de Ruptura / Estoque Crítico */}
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
            <span>Atenção: Existem <strong>{ruptureCount} células de blocos</strong> em nível Crítico (1-2 un) ou Ruptura (0 un).</span>
          </div>
          <button style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
            Ver Blocos no Alerta ➔
          </button>
        </div>
      )}

      {/* Busca por Grau (Base / Adição) & Filtro por Modelo */}
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
            FILTRAR POR MODELO
          </label>
          <select
            className="form-control"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            style={{ color: 'black' }}
          >
            <option value="">Todos os Modelos ({models.length})</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.brand} - {m.name} (Ind. {m.refractive_index})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela Gráfica da Grade de Blocos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Layers className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
          <p>Carregando matriz de blocos semiacabados...</p>
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

      {/* MODAL: Cadastro de Novo Modelo de Bloco */}
      {showNewModelModal && (
        <div className="modal-overlay" onClick={() => setShowNewModelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Novo Modelo de Bloco Semiacabado</h3>
              <button onClick={() => setShowNewModelModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Marca / Fabricante</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Essilor, Hoya, Zeiss"
                  className="form-control"
                  value={newModelForm.brand}
                  onChange={(e) => setNewModelForm({ ...newModelForm, brand: e.target.value })}
                  style={{ color: 'black' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Nome do Modelo de Bloco</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bloco Freeform 1.56"
                  className="form-control"
                  value={newModelForm.name}
                  onChange={(e) => setNewModelForm({ ...newModelForm, name: e.target.value })}
                  style={{ color: 'black' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Material</label>
                  <select
                    className="form-control"
                    value={newModelForm.material}
                    onChange={(e) => setNewModelForm({ ...newModelForm, material: e.target.value })}
                    style={{ color: 'black' }}
                  >
                    <option value="CR-39">CR-39</option>
                    <option value="Policarbonato">Policarbonato</option>
                    <option value="Trivex">Trivex</option>
                    <option value="Resina Alto Índice">Resina Alto Índice</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Índice Refração</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="form-control"
                    value={newModelForm.refractive_index}
                    onChange={(e) => setNewModelForm({ ...newModelForm, refractive_index: parseFloat(e.target.value) })}
                    style={{ color: 'black' }}
                  />
                </div>
              </div>

              {/* Curvas Base & Adições Customizadas */}
              <div style={{ background: 'rgba(147, 51, 234, 0.05)', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'hsl(var(--primary))' }}>
                  📐 Definir Curvas Base & Adições da Grade
                </span>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Curvas Base (Separadas por vírgula)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 2.00, 4.00, 6.00, 8.00"
                    className="form-control"
                    value={newModelForm.base_curves_config}
                    onChange={(e) => setNewModelForm({ ...newModelForm, base_curves_config: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Adições da Grade (Separadas por vírgula)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00"
                    className="form-control"
                    value={newModelForm.additions_config}
                    onChange={(e) => setNewModelForm({ ...newModelForm, additions_config: e.target.value })}
                    style={{ color: 'black' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowNewModelModal(false)} className="btn btn-secondary btn-sm">Cancelar</button>
                <button type="submit" disabled={creatingModel} className="btn btn-primary btn-sm">
                  {creatingModel ? 'Gerando Grade...' : 'Cadastrar e Gerar Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LATERAL / DETALHAMENTO DA DIOPTRIA SELECIONADA (IDÊNTICO À GRADE DE LENTES) */}
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
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Modelo de Bloco:</span>
                        <p style={{ fontWeight: 700, fontSize: '1rem', margin: '2px 0' }}>
                          {editingItem?.brand || editingItem?.block_model?.brand || 'Essilor'} - {editingItem?.name || editingItem?.block_model?.name || 'Bloco Freeform'}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', margin: 0 }}>
                          Material: {editingItem?.material || editingItem?.block_model?.material || 'CR-39'} | Refração: {editingItem?.refractive_index || editingItem?.block_model?.refractive_index || '1.56'}
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
                            placeholder="Ex: GAV-B04"
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
              /* Display List of Models View (Identical to Lens Grid) */
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
                        position: 'relative' 
                      }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #a855f7, #06b6d4)', borderRadius: '12px 12px 0 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
                            {item.brand || item.block_model?.brand || 'Essilor'}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '2px' }}>
                            {item.material || item.block_model?.material || 'CR-39'} | Refração {item.refractive_index || item.block_model?.refractive_index || '1.56'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                            {item.name || item.block_model?.name || 'Modelo de Bloco'}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '1.2rem', 
                          fontWeight: 'bold', 
                          color: (item.quantity_available || 0) <= 0 ? 'hsl(var(--danger))' : (item.quantity_available || 0) <= 2 ? 'hsl(var(--warning))' : 'hsl(var(--success))'
                        }}>
                          {item.quantity_available || 0} un
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '10px', color: 'hsl(var(--text-secondary))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={14} style={{ color: 'hsl(var(--secondary))' }} />
                          <span>Gaveta: <strong>{item.location_tag || 'GAVETA NÃO CONFIGURADA'}</strong></span>
                        </div>
                        <div>
                          <span>Cód: <span style={{ fontFamily: 'monospace' }}>{item.barcode || 'N/A'}</span></span>
                        </div>
                      </div>

                      {item.id && (
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => startEditingCellItem(item)}
                          style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', fontWeight: 700 }}
                        >
                          <Edit size={14} /> Ajustar Estoque
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-glass)', paddingTop: '15px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', borderRadius: '10px', padding: '12px', fontWeight: 800, fontSize: '0.95rem' }}
                    onClick={() => setSelectedCell(null)}
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de Alertas de Ruptura em Blocos */}
      {showRuptureAlertModal && (
        <div className="modal-overlay" onClick={() => setShowRuptureAlertModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#dc2626', fontSize: '1.2rem' }}>Relatório de Blocos em Nível Crítico / Ruptura</h3>
              </div>
              <button className="btn-close" onClick={() => setShowRuptureAlertModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', marginBottom: '16px' }}>
              Abaixo estão listadas as células de blocos com saldo baixo (1-2 un) ou esgotado (0 un).
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Modelo / Marca</th>
                    <th style={{ padding: '8px 12px' }}>Base</th>
                    <th style={{ padding: '8px 12px' }}>Adição</th>
                    <th style={{ padding: '8px 12px' }}>Lado</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd Atual</th>
                    <th style={{ padding: '8px 12px' }}>Localização</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalBlockItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: item.quantity_available === 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.block_model?.name || item.brand || 'Modelo de Bloco'}</td>
                      <td style={{ padding: '8px 12px' }}>{parseFloat(item.base_curve).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px' }}>+{parseFloat(item.addition).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: item.eye_side === 'D' ? '#00f2fe' : '#c084fc' }}>{item.eye_side || 'AMBOS'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: item.quantity_available === 0 ? '#dc2626' : '#d97706' }}>
                        {item.quantity_available} un
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '0.75rem', opacity: 0.85 }}>{item.location_tag || 'GAVETA-S/N'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => handleExportPDF(criticalBlockItems)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <FileText size={16} /> Exportar Relatório em PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRuptureAlertModal(false)}>
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeBlocos;
