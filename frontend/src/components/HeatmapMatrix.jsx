import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LensService } from '../services/api';
import { Flame, Eye, EyeOff, Layers } from 'lucide-react';

const HeatmapMatrix = ({ refreshTrigger }) => {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [signFilter, setSignFilter] = useState('negative');

  const getBaseUrl = () => {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000/api/v1`;
  };

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    loadHeatmap();
  }, [selectedBrand, refreshTrigger]);

  const loadBrands = async () => {
    try {
      const response = await LensService.getModels();
      // Extrai marcas únicas
      const uniqueBrands = [...new Set(response.data.map(m => m.brand))];
      setBrands(uniqueBrands);
      if (uniqueBrands.length > 0) {
        setSelectedBrand(uniqueBrands[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHeatmap = async () => {
    if (!selectedBrand) return;
    setLoading(true);
    try {
      const response = await axios.get(`${getBaseUrl()}/analytics/matrix-heat?brand=${selectedBrand}`);
      setHeatmapData(response.data);
    } catch (err) {
      console.error("Erro ao carregar mapa térmico:", err);
    } finally {
      setLoading(false);
    }
  };

  const getGridRanges = () => {
    let sphs = [];
    let cyls = [];

    if (showFullGrid) {
      // Grade completa
      for (let s = 4.0; s >= -8.0; s -= 0.5) sphs.push(s);
      for (let c = -4.0; c <= 0.0; c += 0.5) cyls.push(c);
    } else {
      // Grade compacta inteligente garantindo esférico até -6/+6 e cilíndrico até -4
      if (heatmapData.length === 0) {
        for (let s = 6.0; s >= -6.0; s -= 0.5) sphs.push(s);
        for (let c = -4.0; c <= 0.0; c += 0.5) cyls.push(c);
      } else {
        const sphValues = heatmapData.map(d => parseFloat(d.spherical));
        const cylValues = heatmapData.map(d => parseFloat(d.cylindrical));
        
        const minSph = Math.min(...sphValues, -6.0);
        const maxSph = Math.max(...sphValues, 6.0);
        const minCyl = Math.min(...cylValues, -4.0);
        const maxCyl = Math.max(...cylValues, 0.0);
        
        // Passos de 0.50 para visualização compacta de calor
        for (let s = maxSph; s >= minSph; s -= 0.5) sphs.push(Math.round(s * 100) / 100);
        for (let c = minCyl; c <= maxCyl; c += 0.5) cyls.push(Math.round(c * 100) / 100);
      }
    }
    return { sphs, cyls };
  };

  const { sphs, cyls } = getGridRanges();

  // Filtragem e ordenação dos graus para exibição correta nas abas e eixos
  const filteredSph = sphs
    .filter(s => (signFilter === 'positive' ? s > 0 : s <= 0))
    .sort((a, b) => (signFilter === 'positive' ? a - b : b - a));

  const filteredCyl = cyls.sort((a, b) => b - a);

  const getCellData = (sph, cyl) => {
    // Retorna todos os itens nessa dioptria (pode haver mais de um material da mesma marca)
    // Para simplificar a visualização do mapa térmico de uma marca, somamos os saldos
    // e calculamos a média de consumo.
    const items = heatmapData.filter(
      item => Math.abs(parseFloat(item.spherical) - sph) < 0.01 && 
              Math.abs(parseFloat(item.cylindrical) - cyl) < 0.01
    );

    if (items.length === 0) return null;

    return {
      quantity_available: items.reduce((sum, i) => sum + i.quantity_available, 0),
      units_consumed_30_days: items.reduce((sum, i) => sum + i.units_consumed_30_days, 0),
      daily_burn_rate: items.reduce((sum, i) => sum + i.daily_burn_rate, 0)
    };
  };

  const getHeatmapCellStyle = (cell) => {
    if (!cell) return { background: 'rgba(255,255,255,0.01)', color: 'hsl(var(--text-muted))', opacity: 0.2 };

    const consumed = cell.units_consumed_30_days;
    const qty = cell.quantity_available;

    // Regra Lógica Térmica:
    // Consumo Alto e estoque zerado (Ruptura crítica) -> Vermelho/Rosa Neon Intenso Piscante
    if (consumed >= 5 && qty === 0) {
      return {
        background: 'rgba(239, 68, 68, 0.7)',
        color: 'white',
        border: '1.5px solid rgb(239, 68, 68)',
        boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
        fontWeight: 'bold'
      };
    }
    
    // Consumo Alto e estoque em alerta (ROP atingido) -> Laranja/Amarelo brilhante
    if (consumed >= 3 && qty <= 2 && qty > 0) {
      return {
        background: 'rgba(249, 115, 22, 0.7)',
        color: 'white',
        border: '1.5px solid rgb(249, 115, 22)',
        boxShadow: '0 0 8px rgba(249, 115, 22, 0.4)'
      };
    }

    // Consumo Alto e estoque saudável -> Verde/Ciano com opacidade alta
    if (consumed >= 3) {
      return {
        background: 'rgba(6, 182, 212, 0.65)',
        color: 'white',
        fontWeight: 'bold'
      };
    }

    // Consumo Moderado -> Ciano suave
    if (consumed > 0) {
      const opacity = Math.min(0.2 + (consumed * 0.1), 0.5);
      return {
        background: `rgba(6, 182, 212, ${opacity})`,
        color: 'white'
      };
    }

    // Sem consumo nos últimos 30 dias (Giro zero) -> Roxo escuro apagado
    if (qty > 0) {
      return {
        background: 'rgba(147, 51, 234, 0.15)',
        color: 'hsl(var(--text-secondary))'
      };
    }

    // Zerado e Sem Consumo -> Fosco escuro
    return {
      background: 'rgba(255, 255, 255, 0.02)',
      color: 'hsl(var(--text-muted))',
      opacity: 0.4
    };
  };

  return (
    <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'between', flexWrap: 'wrap', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={18} style={{ color: 'hsl(var(--accent))' }} /> Mapa Térmico de Giro da Grade
        </h3>

        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowFullGrid(!showFullGrid)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {showFullGrid ? <EyeOff size={14} /> : <Eye size={14} />}
            {showFullGrid ? "Grade Curta" : "Grade Completa"}
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: '20px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filtrar Fabricante</label>
          <select 
            className="form-control" 
            value={selectedBrand} 
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">Selecione...</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Legenda Cromática do Mapa de Calor */}
        <div className="glass-panel" style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.005)', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          <strong style={{ color: 'white' }}>LEGENDA TÉRMICA:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.7)' }} />
            <span>Ruptura Alto Giro (Comprar urgente)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(249, 115, 22, 0.7)' }} />
            <span>Estoque Crítico / Consumo Alto</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(6, 182, 212, 0.65)' }} />
            <span>Saídas frequentes (Giro Alto)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(147, 51, 234, 0.15)' }} />
            <span>Sem saídas (Sem Giro)</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>Processando velocidades de consumo...</div>
      ) : selectedBrand ? (
        <div style={{ position: 'relative' }}>
          {/* Alternador de Grade Positiva / Negativa */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '10px' }}>
            <button
              type="button"
              className={`btn btn-sm ${signFilter === 'negative' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSignFilter('negative')}
              style={{ flex: 1, padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Lentes Negativas (-)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${signFilter === 'positive' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSignFilter('positive')}
              style={{ flex: 1, padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Lentes Positivas (+)
            </button>
          </div>

          <div className="grid-container">
            <table className="optical-grid" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px', position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-card))' }}>Esf/Cil</th>
                  {filteredCyl.map(c => (
                    <th key={c}>{c > 0 ? `+${c.toFixed(2)}` : c.toFixed(2)}</th>
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
                      const cell = getCellData(s, c);
                      const style = getHeatmapCellStyle(cell);
                      
                      return (
                        <td 
                          key={`${s}_${c}`} 
                          style={style}
                          onMouseEnter={() => cell && setHoveredCell({ sph: s, cyl: c, data: cell })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {cell ? cell.quantity_available : 0}
                          </div>
                          {cell && cell.units_consumed_30_days > 0 && (
                            <span style={{ fontSize: '0.6rem', opacity: 0.8, display: 'block', marginTop: '2px' }}>
                              🔥{cell.units_consumed_30_days}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Popover flutuante para detalhes de hover da célula térmica */}
          {hoveredCell && (
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(13, 17, 28, 0.95)', border: '1px solid var(--border-glass)',
              borderRadius: '8px', padding: '12px', fontSize: '0.8rem', zIndex: 100,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '220px'
            }}>
              <strong style={{ color: 'white', display: 'block', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>
                Dioptria: {hoveredCell.sph > 0 ? `+${hoveredCell.sph.toFixed(2)}` : hoveredCell.sph.toFixed(2)} Esf / {hoveredCell.cyl.toFixed(2)} Cil
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ color: 'white' }}>Estoque físico: <strong>{hoveredCell.data.quantity_available} unids</strong></p>
                <p style={{ color: 'white' }}>Saídas (30 dias): <strong>{hoveredCell.data.units_consumed_30_days} unids</strong></p>
                <p style={{ color: 'white' }}>Giro diário médio: <strong>{hoveredCell.data.daily_burn_rate.toFixed(2)}/dia</strong></p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px' }}>Selecione um fabricante acima para carregar o mapa de calor.</div>
      )}
    </div>
  );
};

export default HeatmapMatrix;
