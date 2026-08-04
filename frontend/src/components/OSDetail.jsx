import React, { useState, useEffect } from 'react';
import { OSService } from '../services/api';
import { Clock, User, MapPin, ClipboardList, Info, AlertTriangle, Eye, Shield, Activity } from 'lucide-react';

const OSDetail = ({ osId, onClose }) => {
  const [os, setOs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOSDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await OSService.get(osId);
      setOs(response.data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os detalhes desta Ordem de Serviço.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (osId) {
      loadOSDetails();
    }
  }, [osId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'hsl(var(--text-secondary))', gap: '8px' }}>
        <span className="animate-spin">🌀</span>
        <span>Carregando detalhes da Ordem de Serviço...</span>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--danger))' }}>
        <AlertTriangle style={{ margin: '0 auto 10px auto' }} />
        <p>{error || "Ordem de Serviço não localizada."}</p>
        {onClose && <button onClick={onClose} className="btn btn-secondary" style={{ marginTop: '10px' }}>Voltar</button>}
      </div>
    );
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Lógica de cálculo geométrico para o desenho técnico SVG (OD/OE)
  const renderDescentrationSVG = (eye) => {
    const isOD = eye === 'OD';
    const spherical = isOD ? os.od_spherical : os.oe_spherical;
    const cylindrical = isOD ? os.od_cylindrical : os.oe_cylindrical;
    const axis = isOD ? os.od_axis : os.oe_axis;
    const dnp = isOD ? os.od_dnp : os.oe_dnp;
    
    const frame_a = os.frame_a ? parseFloat(os.frame_a) : 52;
    const frame_bridge = os.frame_bridge ? parseFloat(os.frame_bridge) : 18;
    const frame_ed = os.frame_ed ? parseFloat(os.frame_ed) : 54;
    const dnpNum = dnp ? parseFloat(dnp) : 32;
    
    // Fórmulas
    const decentration = ((frame_a + frame_bridge) / 2) - dnpNum;
    const requiredMinDiameter = frame_ed + (2 * decentration) + 2;
    
    // Diâmetro da lente física (do estoque alocado ou fallback padrão)
    const activeInventory = isOD ? os.od_lens_inventory : os.oe_lens_inventory;
    const lensDiameter = activeInventory?.lens_model?.diameter || 70;
    
    const isApproved = lensDiameter >= requiredMinDiameter;

    // Escala para caber no SVG (ex: 2.2 pixels por mm)
    const scale = 2.0;
    const centerBoxX = 130;
    const centerBoxY = 85;
    
    // Desenho do aro: retângulo arredondado de largura 'frame_a' e altura arbitrária 38mm
    const frameW = frame_a * scale;
    const frameH = 38 * scale;
    const frameX = centerBoxX - (frameW / 2);
    const frameY = centerBoxY - (frameH / 2);
    
    // A pupila (centro óptico) é deslocada horizontalmente
    // Em OD: deslocamento nasal é para a esquerda (direção à ponte/centro do rosto)
    // Em OE: deslocamento nasal é para a direita
    const pupilaShift = decentration * scale * (isOD ? -1 : 1);
    const pupilaX = centerBoxX + pupilaShift;
    const pupilaY = centerBoxY; // Desconsiderando altura vertical no MVP

    // Raio da Lente Física
    const lensRadius = (lensDiameter / 2) * scale;
    const reqLensRadius = (requiredMinDiameter / 2) * scale;

    return (
      <div className="glass-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
        <h5 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(var(--secondary))', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
          <span>Esquema Técnico - Olho {eye}</span>
          <span style={{ color: isApproved ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
            {isApproved ? 'Geometria OK' : 'Diâmetro Insuficiente'}
          </span>
        </h5>

        <div style={{ display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
          <svg width="260" height="170" viewBox="0 0 260 170" style={{ overflow: 'visible' }}>
            {/* Grid de fundo */}
            <line x1="0" y1="85" x2="260" y2="85" stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <line x1="130" y1="0" x2="130" y2="170" stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            
            {/* 1. Desenho da Lente Física Redonda (Centralizada na Pupila) */}
            <circle 
              cx={pupilaX} 
              cy={pupilaY} 
              r={lensRadius} 
              fill={isApproved ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'} 
              stroke={isApproved ? '#22c55e' : '#ef4444'} 
              strokeWidth="2" 
              strokeDasharray={isApproved ? "none" : "4 2"} 
            />
            
            {/* 2. Diâmetro mínimo requerido (Pontilhado amarelo) */}
            <circle 
              cx={pupilaX} 
              cy={pupilaY} 
              r={reqLensRadius} 
              fill="none" 
              stroke="rgba(234, 179, 8, 0.4)" 
              strokeWidth="1.5" 
              strokeDasharray="3 3" 
            />

            {/* 3. Retângulo do Aro da Armação (Centralizado no centro geométrico da caixa) */}
            <rect 
              x={frameX} 
              y={frameY} 
              width={frameW} 
              height={frameH} 
              rx="15" 
              fill="none" 
              stroke="white" 
              strokeWidth="1.5" 
              opacity="0.85" 
            />
            
            {/* Centro Geométrico da Caixa do Aro (Cruz cinza) */}
            <line x1={centerBoxX - 6} y1={centerBoxY} x2={centerBoxX + 6} y2={centerBoxY} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <line x1={centerBoxX} y1={centerBoxY - 6} x2={centerBoxX} y2={centerBoxY + 6} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

            {/* 4. Pupila do Paciente / Centro Óptico da Lente (Cruz roxa) */}
            <line x1={pupilaX - 8} y1={pupilaY} x2={pupilaX + 8} y2={pupilaY} stroke="hsl(var(--primary))" strokeWidth="2" />
            <line x1={pupilaX} y1={pupilaY - 8} x2={pupilaX} y2={pupilaY + 8} stroke="hsl(var(--primary))" strokeWidth="2" />
            <circle cx={pupilaX} cy={pupilaY} r="2.5" fill="white" />
            
            {/* Linha indicadora de descentração */}
            <line 
              x1={centerBoxX} 
              y1={centerBoxY + 20} 
              x2={pupilaX} 
              y2={centerBoxY + 20} 
              stroke="hsl(var(--secondary))" 
              strokeWidth="1.5" 
              markerEnd="url(#arrow)" 
            />
            
            {/* Texto de Cota da Descentração */}
            {decentration > 0 && (
              <text x={(centerBoxX + pupilaX) / 2} y={centerBoxY + 32} fill="hsl(var(--secondary))" fontSize="10" textAnchor="middle" fontWeight="bold">
                {decentration.toFixed(1)}mm
              </text>
            )}
            
            <text x={pupilaX} y={pupilaY - 12} fill="hsl(var(--primary))" fontSize="9" fontWeight="bold" textAnchor="middle">Pupila</text>
            <text x={centerBoxX} y={frameY - 6} fill="white" fontSize="9" opacity="0.6" textAnchor="middle">Centro Aro</text>
          </svg>
        </div>

        {/* Informações detalhadas do cálculo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
          <div>Descentração: <strong style={{ color: 'white' }}>{decentration.toFixed(2)} mm</strong></div>
          <div>Ø Mínimo Requerido: <strong style={{ color: 'white' }}>{requiredMinDiameter.toFixed(1)} mm</strong></div>
          <div>Ø Lente Física: <strong style={{ color: isApproved ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>{lensDiameter} mm</strong></div>
          <div>Gaveta: <strong style={{ color: 'white' }}>{activeInventory?.location_tag || 'N/A'}</strong></div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header com botões */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '15px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block' }}>DETALHES E RASTREABILIDADE</span>
          <h2 style={{ fontSize: '1.5rem', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} style={{ color: 'hsl(var(--primary))' }} /> OS {os.os_number}
            {os.is_rework && (
              <span style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'hsl(var(--danger))',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                animation: 'pulse 2s infinite'
              }}>
                Retrabalho Urgente
              </span>
            )}
          </h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontWeight: 700 }}>
            Voltar ao Kanban
          </button>
        )}
      </div>

      {/* Grid Split Screen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        
        {/* LADO ESQUERDO: Dados técnicos da OS e Esquema de Descentração */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Ficha de Receita Visual e Dados da Armação */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
              <Shield size={16} style={{ color: 'hsl(var(--primary))' }} />
              Especificações Clínicas da Receita
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Paciente: <strong style={{ color: 'white' }}>{os.client_name || 'N/A'}</strong></p>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Médico: <strong style={{ color: 'white' }}>{os.doctor_name || 'N/A'}</strong></p>
              </div>
              <div>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Ótica Parceira: <strong style={{ color: 'white' }}>{os.partner_shop?.trade_name || 'N/A'}</strong></p>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Faturamento Comercial: <strong style={{ color: 'white' }}>{os.optical_store?.fantasy_name || 'N/A'}</strong></p>
              </div>
            </div>

            {/* Layout de Receita oftálmica visual clássica */}
            <div className="glass-panel" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '15px', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'hsl(var(--text-muted))' }}>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Olho</th>
                    <th style={{ padding: '6px' }}>Esférico</th>
                    <th style={{ padding: '6px' }}>Cilíndrico</th>
                    <th style={{ padding: '6px' }}>Eixo</th>
                    <th style={{ padding: '6px' }}>DNP</th>
                    <th style={{ padding: '6px' }}>Adição</th>
                    <th style={{ padding: '6px' }}>Altura</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 6px', textAlign: 'left', fontWeight: 'bold', color: 'hsl(var(--secondary))' }}>OD</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_spherical ? `${parseFloat(os.od_spherical) > 0 ? '+' : ''}${parseFloat(os.od_spherical).toFixed(2)}` : '0.00'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_cylindrical ? `${parseFloat(os.od_cylindrical) > 0 ? '+' : ''}${parseFloat(os.od_cylindrical).toFixed(2)}` : '0.00'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_axis ? `${os.od_axis}°` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_dnp ? `${parseFloat(os.od_dnp).toFixed(1)}mm` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_addition ? `+${parseFloat(os.od_addition).toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.od_height ? `${parseFloat(os.od_height).toFixed(1)}mm` : '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 6px', textAlign: 'left', fontWeight: 'bold', color: 'hsl(var(--secondary))' }}>OE</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_spherical ? `${parseFloat(os.oe_spherical) > 0 ? '+' : ''}${parseFloat(os.oe_spherical).toFixed(2)}` : '0.00'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_cylindrical ? `${parseFloat(os.oe_cylindrical) > 0 ? '+' : ''}${parseFloat(os.oe_cylindrical).toFixed(2)}` : '0.00'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_axis ? `${os.oe_axis}°` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_dnp ? `${parseFloat(os.oe_dnp).toFixed(1)}mm` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_addition ? `+${parseFloat(os.oe_addition).toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '10px 6px', color: 'white', fontWeight: 600 }}>{os.oe_height ? `${parseFloat(os.oe_height).toFixed(1)}mm` : '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Medidas da Armação */}
            <div style={{ marginTop: '15px', background: 'rgba(255, 255, 255, 0.01)', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', fontSize: '0.85rem' }}>
              <div>Aro (A): <strong style={{ color: 'white' }}>{os.frame_a ? `${parseFloat(os.frame_a)} mm` : 'N/A'}</strong></div>
              <div>Ponte (Bridge): <strong style={{ color: 'white' }}>{os.frame_bridge ? `${parseFloat(os.frame_bridge)} mm` : 'N/A'}</strong></div>
              <div>Diagonal Maior (ED): <strong style={{ color: 'white' }}>{os.frame_ed ? `${parseFloat(os.frame_ed)} mm` : 'N/A'}</strong></div>
            </div>

            {/* Observações Clínicas para Busca Semântica */}
            {os.clinical_notes && (
              <div style={{ marginTop: '15px', background: 'rgba(147, 51, 234, 0.04)', border: '1px solid rgba(147, 51, 234, 0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(var(--primary))', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Observações Clínicas (Indexado na Busca Semântica IA)</span>
                <p style={{ margin: 0, fontStyle: 'italic', color: 'white' }}>"{os.clinical_notes}"</p>
              </div>
            )}

            {/* Especificações da Lente, Tratamento, Marca, Modelo e Serviços */}
            <div style={{ marginTop: '15px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '10px' }}>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6', marginBottom: '10px' }}>Especificações da Lente & Serviços Acrescentados</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', marginBottom: '12px' }}>
                <div>Tipo de OS: <strong style={{ color: 'white' }}>{os.os_type === 'REPARO_SERVICO' ? 'Reparo / Serviço Técnico' : 'Padrão (Com Lentes)'}</strong></div>
                <div>Marca / Modelo: <strong style={{ color: 'white' }}>{os.items?.find(i => i.entity_type === 'product')?.name || 'Essilor Crizal Easy 1.56'}</strong></div>
                <div>Tratamento: <strong style={{ color: 'white' }}>{os.items?.find(i => i.entity_type === 'treatment')?.name || 'Antirreflexo Crizal Easy'}</strong></div>
                <div>Total da OS: <strong style={{ color: '#10b981' }}>{formatCurrency(os.total_amount || 0)}</strong></div>
              </div>

              {os.items && os.items.length > 0 && (
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', marginTop: '8px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Item / Serviço</th>
                      <th style={{ padding: '6px' }}>Tipo</th>
                      <th style={{ padding: '6px' }}>Qtd</th>
                      <th style={{ padding: '6px' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '6px', color: '#fff' }}>{item.name || item.entity_type}</td>
                        <td style={{ padding: '6px', color: '#94a3b8' }}>{item.entity_type}</td>
                        <td style={{ padding: '6px', color: '#fff' }}>{item.quantity}</td>
                        <td style={{ padding: '6px', color: '#10b981', fontWeight: 600 }}>{formatCurrency(item.price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* Desenhos de Descentração SVG (OD e OE lado a lado se medidas preenchidas) */}
          {os.frame_a && os.frame_bridge && os.frame_ed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {renderDescentrationSVG('OD')}
              {renderDescentrationSVG('OE')}
            </div>
          )}
        </div>

        {/* LADO DIREITO: Linha do Tempo e Histórico do Workflow */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h4 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
            <Clock size={16} style={{ color: 'hsl(var(--secondary))' }} />
            Bancadas e Rastreabilidade do Workflow
          </h4>

          {os.workflow_history && os.workflow_history.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '18px', marginLeft: '10px', borderLeft: '2px solid var(--border-glass)', flex: 1, overflowY: 'auto', maxHeight: '550px' }}>
              {os.workflow_history.map((h, i) => {
                const getStatusColor = (status) => {
                  switch (status) {
                    case 'Recebida': return 'hsl(var(--primary))';
                    case 'Separação': return '#3b82f6';
                    case 'Produção': return 'rgb(6, 182, 212)';
                    case 'Montagem': return 'rgb(234, 179, 8)';
                    case 'CQ': return 'rgb(147, 51, 234)';
                    case 'Expedição': return 'hsl(var(--success))';
                    case 'Cancelada': return 'hsl(var(--danger))';
                    default: return 'white';
                  }
                };
                
                const getStatusBg = (status) => {
                  switch (status) {
                    case 'Recebida': return 'hsl(var(--primary) / 0.15)';
                    case 'Separação': return 'rgba(59, 130, 246, 0.15)';
                    case 'Produção': return 'rgba(6, 182, 212, 0.15)';
                    case 'Montagem': return 'rgba(234, 179, 8, 0.15)';
                    case 'CQ': return 'rgba(147, 51, 234, 0.15)';
                    case 'Expedição': return 'hsl(var(--success) / 0.15)';
                    case 'Cancelada': return 'hsl(var(--danger) / 0.15)';
                    default: return 'var(--border-glass)';
                  }
                };

                return (
                  <div key={h.id} style={{ position: 'relative', marginBottom: '18px' }}>
                    {/* Indicador na linha */}
                    <div style={{
                      position: 'absolute',
                      left: '-24px',
                      top: '5px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(h.new_status),
                      border: '2px solid rgba(8,10,18,0.9)',
                      boxShadow: `0 0 8px ${getStatusColor(h.new_status)}`
                    }} />

                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold',
                          background: getStatusBg(h.new_status), color: getStatusColor(h.new_status)
                        }}>
                          {h.new_status}
                        </span>
                        
                        <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                          {formatDateTime(h.changed_at)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <User size={10} style={{ color: 'hsl(var(--secondary))' }} />
                          {h.operator ? h.operator.name : 'Sistema'}
                        </span>
                        {h.sector && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={10} style={{ color: 'hsl(var(--primary))' }} />
                            {h.sector}
                          </span>
                        )}
                      </div>

                      {h.operator_notes && (
                        <p style={{ fontSize: '0.76rem', color: 'white', margin: '4px 0 0 0', fontStyle: 'italic', lineHeight: '1.3' }}>
                          "{h.operator_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
              Nenhum histórico de movimentação registrado.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OSDetail;
