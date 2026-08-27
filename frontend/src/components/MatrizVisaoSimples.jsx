import React, { useState, useEffect } from "react";
import {
  Layers, Save, CheckCircle2, RefreshCw, Plus, Minus, PackageCheck,
  Sparkles, Eye, EyeOff, Info, ShieldAlert, FileText, Box, Edit, X
} from "lucide-react";
import api, { InventoryService } from "../services/api";

// ============================================================
// CONFIGURACAO DA GRADE BLOCO VISAO SIMPLES
// Suporta colunas dinamicas para novos tratamentos cadastrados
// ============================================================

const STANDARD_BASES = [
  { key: "0", label: "Base 0.00", fullLabel: "Curva Base 0.00", color: "#06b6d4" },
  { key: "2", label: "Base 2.00", fullLabel: "Curva Base 2.00", color: "#3b82f6" },
  { key: "4", label: "Base 4.00", fullLabel: "Curva Base 4.00", color: "#a855f7" },
  { key: "6", label: "Base 6.00", fullLabel: "Curva Base 6.00", color: "#22c55e" },
];

const STANDARD_LENS_COLUMNS = [
  { key: "incolor",              label: "INCOLOR",              treatments: ["incolor", "sem tratamento", "branco", "incolor hc", "padrao"], index167: false },
  { key: "ar",                   label: "AR",                   treatments: ["ar", "anti reflexo", "antirreflexo", "anti-reflexo", "anti-reflexo ar", "anti reflexo ar", "crizal", "trio"], index167: false },
  { key: "filtro_azul_ar",       label: "FILTRO AZUL AR",       treatments: ["filtro azul ar", "filtro azul", "blue cut", "blue uv", "blue", "blue block"], index167: false },
  { key: "photo_ar",             label: "PHOTO AR",             treatments: ["photo ar", "fotossensivel", "transitions", "photo", "foto"], index167: false },
  { key: "photo_filtro_azul_ar", label: "PHOTO FILTRO AZUL AR", treatments: ["photo filtro azul ar", "photo blue", "photo filtro azul", "transitions blue"], index167: false },
  { key: "lens_167_ar",          label: "1.67 AR",              treatments: ["ar", "anti reflexo", "antirreflexo", "anti-reflexo ar"], index167: true  },
  { key: "lens_167_fa",          label: "1.67 FA",              treatments: ["filtro azul ar", "filtro azul", "blue cut", "blue uv"], index167: true  },
];

function getColumnKeyForItem(item, allColumns) {
  const treatment = (item.lens_model?.treatment || item.treatment || "").trim().toLowerCase();
  const refIdx = parseFloat(item.lens_model?.refractive_index || item.refractive_index || 1.56);
  const is167 = Math.abs(refIdx - 1.67) < 0.01;

  if (!treatment) return "incolor";

  // 1. Procura primeiro por match exato com tratamentos registrados nas colunas
  for (const col of allColumns) {
    if (col.treatments.some(t => treatment === t)) {
      if (col.index167 && !is167) continue;
      if (!col.index167 && is167 && !col.isCustom) continue;
      return col.key;
    }
  }

  // 2. Se for custom col correspondente ao slug do tratamento
  const customKey = `custom_${treatment.replace(/[^a-z0-9]/g, '_')}`;
  const foundCustom = allColumns.find(c => c.key === customKey);
  if (foundCustom) return customKey;

  // 3. Procura por substring nas colunas
  for (const col of allColumns) {
    if (col.index167 && !is167) continue;
    if (!col.index167 && is167 && !col.isCustom) continue;
    if (col.treatments.some(t => treatment.includes(t))) return col.key;
  }

  return "incolor";
}

function getBaseKeyForItem(item, allBases) {
  const raw = item.base_curve !== null && item.base_curve !== undefined ? item.base_curve : item.spherical;
  if (raw === null || raw === undefined || raw === "") return allBases[0]?.key || "4";
  const cleaned = String(raw).replace(/[^0-9.,-]/g, '').replace(',', '.');
  const bc = parseFloat(cleaned);
  if (isNaN(bc)) return allBases[0]?.key || "4";

  const key2 = bc.toFixed(2);
  const keyRound = String(Math.round(bc));
  const found = allBases.find(b => b.key === key2 || b.key === keyRound || Math.abs(parseFloat(b.key) - bc) < 0.01);
  if (found) return found.key;

  return key2;
}

function computeDynamicColumns(items = []) {
  const standardCols = [...STANDARD_LENS_COLUMNS];
  const customCols = [];
  const knownKeys = new Set(standardCols.map(c => c.key));

  items.forEach(item => {
    const rawTreatment = (item.lens_model?.treatment || item.treatment || "").trim();
    if (!rawTreatment) return;

    const tLower = rawTreatment.toLowerCase();
    // Verifica se corresponde a algum padrão por igualdade
    const isStandard = standardCols.some(col =>
      col.treatments.some(t => tLower === t)
    );

    if (!isStandard) {
      const customKey = `custom_${tLower.replace(/[^a-z0-9]/g, '_')}`;
      if (!knownKeys.has(customKey)) {
        knownKeys.add(customKey);
        customCols.push({
          key: customKey,
          label: rawTreatment.toUpperCase(),
          treatments: [tLower],
          index167: false,
          isCustom: true,
          badgeColor: '#ec4899'
        });
      }
    }
  });

  return [...standardCols, ...customCols];
}

function computeDynamicBases(items = []) {
  const baseMap = new Map();
  STANDARD_BASES.forEach(b => baseMap.set(b.key, b));

  items.forEach(item => {
    const raw = item.base_curve !== null && item.base_curve !== undefined ? item.base_curve : item.spherical;
    if (raw !== null && raw !== undefined && raw !== "") {
      const cleaned = String(raw).replace(/[^0-9.,-]/g, '').replace(',', '.');
      const bc = parseFloat(cleaned);
      if (!isNaN(bc)) {
        const key2 = bc.toFixed(2);
        const keyRound = String(Math.round(bc));
        if (!baseMap.has(keyRound) && !baseMap.has(key2)) {
          baseMap.set(key2, {
            key: key2,
            label: `Base ${key2}`,
            fullLabel: `Curva Base ${key2}`,
            color: "#38bdf8"
          });
        }
      }
    }
  });

  return Array.from(baseMap.values()).sort((a, b) => parseFloat(a.key) - parseFloat(b.key));
}

function buildMatrix(items, allColumns, allBases) {
  const m = {};
  allBases.forEach(b => {
    m[b.key] = {};
    allColumns.forEach(c => { m[b.key][c.key] = { qty: 0, items: [] }; });
  });
  items.forEach(item => {
    const baseKey = getBaseKeyForItem(item, allBases);
    const colKey  = getColumnKeyForItem(item, allColumns);
    if (!m[baseKey]) m[baseKey] = {};
    if (!m[baseKey][colKey]) m[baseKey][colKey] = { qty: 0, items: [] };
    m[baseKey][colKey].qty += (item.quantity_available || 0);
    m[baseKey][colKey].items.push(item);
  });
  return m;
}

// ============================================================
export default function MatrizVisaoSimples({ onOpenManualInsert }) {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [columns,       setColumns]          = useState(STANDARD_LENS_COLUMNS);
  const [bases,         setBases]            = useState(STANDARD_BASES);
  const [gridMatrix,    setGridMatrix]       = useState({});
  const [loading,       setLoading]          = useState(false);
  const [showFullRange, setShowFullRange]    = useState(true);
  const [showRuptureAlertModal, setShowRuptureAlertModal] = useState(false);
  const [selectedCell,  setSelectedCell]     = useState(null);
  const [editingItemId, setEditingItemId]    = useState(null);
  const [editQty,       setEditQty]          = useState(0);
  const [editLocation,  setEditLocation]     = useState("");
  const [updating,      setUpdating]         = useState(false);
  const [updateError,   setUpdateError]      = useState(null);
  // Filtros
  const [searchBase,    setSearchBase]       = useState('');
  const [filterColKey,  setFilterColKey]     = useState('');

  useEffect(() => { loadInventory(); }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await InventoryService.getGrid(null);
      const bvs = (res.data || []).filter(it => it.lens_model?.matrix_type === "BLOCO_VS");
      const dynCols = computeDynamicColumns(bvs);
      const dynBases = computeDynamicBases(bvs);
      setColumns(dynCols);
      setBases(dynBases);
      setInventoryItems(bvs);
      setGridMatrix(buildMatrix(bvs, dynCols, dynBases));
    } catch (err) {
      console.error("Erro ao carregar Bloco VS:", err);
    } finally {
      setLoading(false);
    }
  };

  const cell  = (bk, ck) => gridMatrix[bk]?.[ck] || { qty: 0, items: [] };
  const cellQ = (bk, ck) => cell(bk, ck).qty;
  const cellI = (bk, ck) => cell(bk, ck).items;

  const rowTotal   = bk => columns.reduce((a, c) => a + cellQ(bk, c.key), 0);
  const colTotal   = ck => bases.reduce((a, b) => a + cellQ(b.key, ck), 0);
  const grandTotal = ()  => bases.reduce((a, b) => a + rowTotal(b.key), 0);

  // Conta celulas com estoque <= 2 (ruptura ou critico)
  let ruptureCount = 0;
  bases.forEach(b => columns.forEach(c => { if (cellQ(b.key, c.key) <= 2) ruptureCount++; }));

  const getCellClass = (qty, items = []) => {
    if (qty === 0) return 'lens-cell empty';
    if (items && items.length > 0) {
      const hasRupture = items.some(i => (i.quantity_available || 0) === 0);
      const hasCritical = items.some(i => (i.quantity_available || 0) >= 1 && (i.quantity_available || 0) <= 2);
      const hasLow = items.some(i => (i.quantity_available || 0) >= 3 && (i.quantity_available || 0) <= 4);
      if (hasRupture) return 'lens-cell rupture';
      if (hasCritical) return 'lens-cell critical';
      if (hasLow) return 'lens-cell low';
    }
    if (qty >= 1 && qty <= 2) return 'lens-cell critical';
    if (qty >= 3 && qty <= 4) return 'lens-cell low';
    return 'lens-cell normal';
  };

  const handleOpenCellModal = (base, col) => {
    setSelectedCell({ base, col });
    setEditingItemId(null);
    setEditQty(0);
    setEditLocation("");
    setUpdateError(null);
  };

  const startEditingItem = (item) => {
    setEditingItemId(item.id);
    setEditQty(item.quantity_available || 0);
    setEditLocation(item.location_tag || "");
    setUpdateError(null);
  };

  const handleSaveSingleItem = async (itemId) => {
    if (!itemId) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await InventoryService.update(itemId, {
        quantity_available: parseInt(editQty) || 0,
        location_tag: editLocation || null,
      });
      await loadInventory();
      // Atualiza selectedCell com dados frescos
      if (selectedCell) {
        const freshItems = buildMatrix(inventoryItems, columns, bases)[selectedCell.base.key]?.[selectedCell.col.key]?.items || [];
        setSelectedCell(prev => ({ ...prev }));
      }
      setEditingItemId(null);
    } catch (err) {
      setUpdateError(err.response?.data?.detail || "Erro ao salvar item.");
    } finally {
      setUpdating(false);
    }
  };

  // Exportar PDF
  const handleExportPDF = () => {
    const critical = [];
    bases.forEach(b => {
      columns.forEach(c => {
        const q = cellQ(b.key, c.key);
        if (q <= 2) critical.push({ base: b.fullLabel, treatment: c.label, qty: q, items: cellI(b.key, c.key) });
      });
    });

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Permita pop-ups para exportar o relatorio."); return; }
    const now = new Date().toLocaleString("pt-BR");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Relatorio Bloco Visao Simples - Nova LAB</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; }
        .header { border-bottom: 2px solid #06b6d4; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; }
        .logo { font-size: 20px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .rup { color: #dc2626; font-weight: 800; }
      </style></head><body>
      <div class="header">
        <div class="logo">NOVA LAB &mdash; Bloco Visao Simples (Relatorio de Estoque)</div>
        <div>Data: ${now}</div>
      </div>
      <h3>Itens em Nivel Critico ou Ruptura (&le; 2 un)</h3>
      <table>
        <thead><tr><th>#</th><th>Curva Base</th><th>Tratamento</th><th>Qtd Atual</th><th>Modelos Cadastrados</th></tr></thead>
        <tbody>
          ${critical.map((it, i) => `
            <tr>
              <td>${i+1}</td>
              <td><strong>${it.base}</strong></td>
              <td>${it.treatment}</td>
              <td class="${it.qty === 0 ? 'rup' : ''}"><strong>${it.qty} un</strong></td>
              <td>${it.items.map(m => m.lens_model?.brand || "Bloco VS").join(", ") || "Sem modelo"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p style="margin-top:20px; font-size:11px; color:#94a3b8; text-align:center;">Nova LAB Sistema de Gestao &bull; Gerado automaticamente</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const visibleColumns = (() => {
    let cols = showFullRange ? columns : columns.filter(c => !c.key.includes("167"));
    if (filterColKey) cols = cols.filter(c => c.key === filterColKey);
    return cols;
  })();
  const visibleBases = searchBase
    ? bases.filter(b => b.label.toLowerCase().includes(searchBase.toLowerCase()) || b.key === searchBase || b.fullLabel.toLowerCase().includes(searchBase.toLowerCase()))
    : bases;
  const gt = grandTotal();

  // Celulas selecionadas (para o modal)
  const selItems = selectedCell ? cellI(selectedCell.base.key, selectedCell.col.key) : [];
  const selQty   = selectedCell ? cellQ(selectedCell.base.key, selectedCell.col.key) : 0;

  return (
    <div className="glass-panel" style={{ width: "100%" }}>

      {/* ── CABECALHO (identico a Grade 1.67 e Grade Optica) ── */}
      <div className="page-header" style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers size={28} style={{ color: "hsl(var(--primary))" }} />
            Bloco Visão Simples
          </h1>
          <p className="page-subtitle">
            Grade tridimensional para controle de estoque de Blocos Visão Simples — Curva Base (0 a 6.00) x Tratamento.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportPDF}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
            <FileText size={16} /> Exportar PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFullRange(!showFullRange)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {showFullRange ? <EyeOff size={16} /> : <Eye size={16} />}
            {showFullRange ? "Focar Área Útil" : "Mostrar Grade Completa"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadInventory} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── BANNER ALERTA (identico a Grade 1.67) ── */}
      {ruptureCount > 0 && (
        <div onClick={() => setShowRuptureAlertModal(true)}
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", padding: "12px 16px", borderRadius: "10px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#dc2626", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldAlert size={20} color="#dc2626" />
            <span>Atenção: Existem <strong>{ruptureCount} dioptrias</strong> de Blocos Visão Simples em nível Crítico/Ruptura.</span>
          </div>
          <button style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
            Ver Alertas ➔
          </button>
        </div>
      )}

      {/* ── FILTROS (identico a Grade 1.67 e Grade Optica) ── */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '280px' }}>
          <label className="form-label">Filtrar por Tratamento</label>
          <select
            className="form-control"
            value={filterColKey}
            onChange={e => setFilterColKey(e.target.value)}
          >
            <option value="">Todos os Tratamentos (Visão Consolidada)</option>
            {columns.map(col => (
              <option key={col.key} value={col.key}>
                {col.label} {col.isCustom ? '(Personalizado)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="form-group">
            <label className="form-label">Busca Rápida Curva Base</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: 4.00"
              value={searchBase}
              onChange={e => setSearchBase(e.target.value)}
              style={{ color: 'black' }}
            />
          </div>
          {searchBase && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchBase('')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '42px' }}
              >
                <X size={15} /> Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── TABELA (identica a Grade 1.67 e Grade Optica) ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <RefreshCw className="animate-spin" size={28} style={{ color: "hsl(var(--primary))", marginBottom: "10px" }} />
          <p>Carregando grade de Bloco Visão Simples...</p>
        </div>
      ) : (
        <div className="grid-container no-scroll">
          <table className="optical-grid fit-grid-table">
            <thead>
              <tr>
                <th style={{ width: '110px', position: "sticky", left: 0, zIndex: 10, background: "hsl(var(--bg-card))" }}>
                  Curva Base
                </th>
                {visibleColumns.map(col => (
                  <th key={col.key} style={{ textAlign: "center" }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span>{col.label}</span>
                      {col.isCustom && (
                        <span style={{ fontSize: '0.65rem', background: '#ec4899', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          NOVO
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleBases.map(row => {
                return (
                  <tr key={row.key}>
                    <td className="sph-header" style={{ position: "sticky", left: 0, zIndex: 10, background: "hsl(var(--bg-card))", fontWeight: "bold" }}>
                      {row.label}
                    </td>

                    {visibleColumns.map(col => {
                      const qty   = cellQ(row.key, col.key);
                      const items = cellI(row.key, col.key);
                      return (
                        <td key={col.key} className={getCellClass(qty, items)}
                          onClick={() => handleOpenCellModal(row, col)}>
                          <div className="lens-cell-inner">
                            <span className="lens-qty">{qty}</span>
                            {items.length > 1 && qty > 0 && (
                              <span className="lens-loc" style={{ opacity: 0.9, fontWeight: 'bold' }}>
                                {items.length} Mod.
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL CELULA (identico ao GradeMultifocalAcabado) ── */}
      {selectedCell && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "650px" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={20} style={{ color: "hsl(var(--primary))" }} />
                Bloco VS: <span style={{ color: selectedCell.base.color }}>{selectedCell.base.fullLabel}</span>
                &nbsp;|&nbsp;Tratamento: <span style={{ color: selectedCell.col.badgeColor }}>{selectedCell.col.label}</span>
              </h3>
              <button className="btn btn-icon" onClick={() => { setSelectedCell(null); setEditingItemId(null); }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: "16px" }}>
              <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginBottom: "14px" }}>
                Estoque total nesta celula: <strong>{selQty} un</strong>
              </p>

              {selItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                  <p>Nenhum registro de estoque nesta celula.</p>
                  <p style={{ fontSize: "0.82rem", marginTop: "6px" }}>Use o Cadastrador Unificado de Lentes para inserir lentes Bloco Visao Simples (BLOCO_VS).</p>
                </div>
              ) : (
                <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {selItems.map(subItem => {
                    const isEditingThis = editingItemId === subItem.id;
                    return (
                      <div key={subItem.id} style={{ background: isEditingThis ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.03)", border: isEditingThis ? "1px solid #3b82f6" : "1px solid var(--border-glass)", padding: "14px", borderRadius: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "hsl(var(--primary))" }}>
                              {subItem.lens_model?.brand || "Bloco VS"}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "#38bdf8", fontWeight: 600, marginTop: "2px" }}>
                              Material: {subItem.lens_model?.material || "Resina"} | Tratamento: {subItem.lens_model?.treatment || "Incolor"}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))", marginTop: "2px" }}>
                              Rota: <span style={{ color: "#0284c7", fontWeight: 700 }}>{subItem.lens_model?.production_route || "SURFACAGEM_CNC"}</span> | Curva Base: <strong>{subItem.base_curve}</strong> | Gaveta: <strong>{subItem.location_tag || "N/A"}</strong> | EAN: <span style={{ fontFamily: "monospace" }}>{subItem.barcode || "N/A"}</span>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#4ade80" }}>
                              {subItem.quantity_available} un
                            </span>
                            {!isEditingThis && (
                              <div style={{ marginTop: "6px" }}>
                                <button className="btn btn-xs btn-outline" onClick={() => startEditingItem(subItem)}
                                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
                                  <Edit size={13} /> Ajustar Estoque
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isEditingThis && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(59,130,246,0.2)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                              <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.75rem" }}>Quantidade em Estoque</label>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditQty(Math.max(0, parseInt(editQty || 0) - 1))}><Minus size={14} /></button>
                                  <input type="number" className="form-control" value={editQty} onChange={e => setEditQty(e.target.value)}
                                    style={{ color: "black", fontWeight: 800, textAlign: "center" }} />
                                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditQty(parseInt(editQty || 0) + 1)}><Plus size={14} /></button>
                                </div>
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.75rem" }}>Gaveta / Localizacao</label>
                                <input type="text" className="form-control" value={editLocation} onChange={e => setEditLocation(e.target.value)} style={{ color: "black" }} />
                              </div>
                            </div>
                            {updateError && <div style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: "8px" }}>{updateError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <button className="btn btn-secondary" type="button" onClick={() => setEditingItemId(null)}>Cancelar</button>
                              <button className="btn btn-primary" type="button" onClick={() => handleSaveSingleItem(subItem.id)} disabled={updating}>
                                <Save size={15} /> Salvar Este Item
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RELATORIO RUPTURA (identico ao GradeMultifocalAcabado) ── */}
      {showRuptureAlertModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "640px" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px", color: "#f87171" }}>
                <ShieldAlert size={20} /> Relatorio de Alertas — Bloco Visao Simples
              </h3>
              <button className="btn btn-icon" onClick={() => setShowRuptureAlertModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginTop: "16px", maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {BASES.flatMap(b =>
                LENS_COLUMNS.filter(col => cellQ(b.key, col.key) <= 2).map(col => {
                  const qty = cellQ(b.key, col.key);
                  return (
                    <div key={b.key + "-" + col.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: qty === 0 ? "rgba(239,68,68,0.06)" : "rgba(249,115,22,0.06)", border: "1px solid " + (qty === 0 ? "rgba(239,68,68,0.25)" : "rgba(249,115,22,0.25)"), padding: "12px 16px", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "white" }}>{b.fullLabel} x {col.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginTop: "2px" }}>{b.description}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 900, color: qty === 0 ? "#f87171" : "#f97316" }}>{qty} un</span>
                        <div>
                          <span style={{ background: qty === 0 ? "#dc2626" : "#f97316", color: "#fff", borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 800 }}>
                            {qty === 0 ? "RUPTURA" : "CRITICO"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {ruptureCount === 0 && (
                <div style={{ textAlign: "center", padding: "30px", color: "#4ade80", fontWeight: 700 }}>Nenhuma celula em alerta no momento!</div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button className="btn btn-secondary" onClick={() => setShowRuptureAlertModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
