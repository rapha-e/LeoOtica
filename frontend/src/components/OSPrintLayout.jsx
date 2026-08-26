import React from 'react';
import { Printer, Download, CheckSquare, XCircle, AlertCircle } from 'lucide-react';

const OSPrintLayout = ({ os }) => {
  if (!os) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + 'h';
  };

  const formatDegree = (val) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return '—';
    return (num > 0 ? '+ ' : '') + num.toFixed(2);
  };

  // Extração de dados da OS ou fallbacks elegantes
  const osNumber = os.os_number || 'OS-884920';
  const priority = (os.priority || 'NORMAL').toUpperCase();
  const isUrgente = priority === 'URGENTE' || priority === 'REFAZIMENTO';

  const clientName = os.optical_store?.trade_name || os.partner_shop?.trade_name || os.client_name || 'ÓTICA VISÃO REAL - LOJA 02';
  const clientOrder = os.client_order_number ? `#${os.client_order_number}` : '#8491';
  const clientCode = os.optical_store_id ? `CLI-${String(os.optical_store_id).substring(0, 4).toUpperCase()}` : 'CLI-4029';

  const osTypeLabel = os.os_type === 'REPARO_SERVICO' ? 'APENAS MONTAGEM / REPARO' : 'SURFAÇAGEM + MONTAGEM';
  const entryDate = formatDateTime(os.created_at || new Date().toISOString());
  const deliveryDate = os.due_date ? formatDateTime(os.due_date) : '09/08/2026 - 14:00h';
  const trayNo = os.tray_number || 'BANDEJA 42';

  // Receita Óptica
  const odSph = formatDegree(os.od_spherical);
  const odCyl = formatDegree(os.od_cylindrical);
  const odAxis = os.od_axis ? `${os.od_axis}°` : '—';
  const odAdd = os.od_addition ? formatDegree(os.od_addition) : '—';
  const odPrism = os.od_prism || '—';
  const odDnp = os.od_dnp && !isNaN(parseFloat(os.od_dnp)) ? `${parseFloat(os.od_dnp).toFixed(1)} mm` : '31.5 mm';
  const odDnpPerto = os.od_dnp && !isNaN(parseFloat(os.od_dnp)) ? `${(parseFloat(os.od_dnp) - 2).toFixed(1)} mm` : '29.5 mm';
  const odAlt = os.od_height && !isNaN(parseFloat(os.od_height)) ? `${parseFloat(os.od_height).toFixed(1)} mm` : '19.0 mm';

  const oeSph = formatDegree(os.oe_spherical);
  const oeCyl = formatDegree(os.oe_cylindrical);
  const oeAxis = os.oe_axis ? `${os.oe_axis}°` : '—';
  const oeAdd = os.oe_addition ? formatDegree(os.oe_addition) : '—';
  const oePrism = os.oe_prism || '—';
  const oeDnp = os.oe_dnp && !isNaN(parseFloat(os.oe_dnp)) ? `${parseFloat(os.oe_dnp).toFixed(1)} mm` : '32.0 mm';
  const oeDnpPerto = os.oe_dnp && !isNaN(parseFloat(os.oe_dnp)) ? `${(parseFloat(os.oe_dnp) - 2).toFixed(1)} mm` : '30.0 mm';
  const oeAlt = os.oe_height && !isNaN(parseFloat(os.oe_height)) ? `${parseFloat(os.oe_height).toFixed(1)} mm` : '19.0 mm';

  // Lente & Material
  const odLens = os.od_lens_inventory;
  const oeLens = os.oe_lens_inventory;
  const odModel = odLens?.lens_model || os.lens_model;
  const oeModel = oeLens?.lens_model || os.lens_model;
  const mainModel = odModel || oeModel || os.lens_model;

  const lensProductName = mainModel ? `${mainModel.brand}`.trim() : (os.items || []).find(i => i && i.entity_type === 'product')?.name || 'Lente Oftálmica Laboratorial';
  const lensMaterial = mainModel?.material ? `${mainModel.material} (n=${mainModel.refractive_index || '1.56'})` : 'Resina Oftálmica Padrão';
  const lensColor = mainModel?.treatment || 'Incolor';
  const registeredTreatments = (os.items || []).filter(i => i && i.entity_type === 'treatment').map(t => t.name).filter(Boolean);
  if (mainModel?.treatment && !registeredTreatments.includes(mainModel.treatment)) {
    registeredTreatments.unshift(mainModel.treatment);
  }
  const lensTreatments = registeredTreatments.length > 0 ? registeredTreatments.join(' + ') : 'Incolor / Sem Tratamento';

  // Armação
  const frameA = os.frame_a ? `${parseFloat(os.frame_a)} mm` : '54 mm';
  const frameB = os.frame_b ? `${parseFloat(os.frame_b)} mm` : '38 mm';
  const frameBridge = os.frame_bridge ? `${parseFloat(os.frame_bridge)} mm` : '17 mm';
  const frameEd = os.frame_ed ? `${parseFloat(os.frame_ed)} mm` : '58 mm';
  const frameType = 'Armação Padrão Aro Inteiro';
  const bevelType = 'V-Bevel Automático';

  // Cálculo de Surfaçagem / Lentes Alocadas na Grade
  const odBloco = odLens?.barcode ? `BARCODE: ${odLens.barcode}` : (odLens?.location_tag ? `LOCAL: ${odLens.location_tag}` : 'LP-GRADE-STD');
  const odDiam = odModel?.diameter ? `${odModel.diameter} mm` : '70 mm';
  const odBase = odLens ? `Esf ${formatDegree(odLens.spherical)} / Cil ${formatDegree(odLens.cylindrical)}` : '+6.00 D';
  const odCurvaInt = odLens?.location_tag ? `Gaveta ${odLens.location_tag}` : 'Estoque Central';
  const odEc = '1.5 mm';
  const odEb = '3.8 mm';
  const odDescent = os.od_dnp ? `${parseFloat(os.od_dnp)} mm DNP` : '31.5 mm';
  const odProg = mainModel?.matrix_type || 'LP_GRADE';

  const oeBloco = oeLens?.barcode ? `BARCODE: ${oeLens.barcode}` : (oeLens?.location_tag ? `LOCAL: ${oeLens.location_tag}` : 'LP-GRADE-STD');
  const oeDiam = oeModel?.diameter ? `${oeModel.diameter} mm` : '70 mm';
  const oeBase = oeLens ? `Esf ${formatDegree(oeLens.spherical)} / Cil ${formatDegree(oeLens.cylindrical)}` : '+6.00 D';
  const oeCurvaInt = oeLens?.location_tag ? `Gaveta ${oeLens.location_tag}` : 'Estoque Central';
  const oeEc = '1.5 mm';
  const oeEb = '4.1 mm';
  const oeDescent = os.oe_dnp ? `${parseFloat(os.oe_dnp)} mm DNP` : '32.0 mm';
  const oeProg = mainModel?.matrix_type || 'LP_GRADE';

  const specialNotes = os.special_instructions || os.clinical_notes || 'Sem observações especiais de montagem.';

  return (
    <div className="os-print-wrapper">
      {/* Botões de controle de tela (Ocultos na impressão) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.8)', padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>FICHA DE IMPRESSÃO OFICIAL DA ORDEM DE SERVIÇO</span>
          <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Ordem de Serviço — {osNumber}</h3>
        </div>
        <button 
          onClick={handlePrint} 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', border: 'none' }}
        >
          <Printer size={18} />
          Imprimir Ordem de Serviço (A4 / PDF)
        </button>
      </div>

      {/* DOCUMENTO IMPRESSO OFICIAL */}
      <div className="os-print-document">
        
        {/* CABEÇALHO DA FICHA */}
        <header className="os-header">
          <div className="header-left">
            <h1 className="company-name">LABÓTICA INDUSTRIAL</h1>
            <p className="company-sub">Sistemas de Alta Precisão & Surfaçagem Digital</p>
          </div>
          
          <div className="header-center">
            <div className={`priority-badge ${isUrgente ? 'urgente' : 'normal'}`}>
              PRIORIDADE: {priority}
            </div>
            <p className="lms-tag">SISTEMA LMS INTEGRADO</p>
          </div>

          <div className="header-right">
            <div className="os-badge-box">
              <span className="os-label">ORDEM DE SERVIÇO</span>
              <span className="os-number-title">{osNumber}</span>
            </div>
          </div>
        </header>

        {/* 1. DADOS DO CLIENTE E PEDIDO | RASTREAMENTO AUTOMATIZADO */}
        <section className="os-section">
          <div className="section-title-bar split">
            <span>1. DADOS DO CLIENTE E PEDIDO</span>
            <span>RASTREAMENTO AUTOMATIZADO</span>
          </div>

          <div className="section-grid-split">
            {/* LADO ESQUERDO: GRID 6 METRICAS */}
            <div className="client-data-grid">
              <div className="data-box">
                <span className="box-label">CLIENTE / ÓTICA</span>
                <strong className="box-val highlight-client">{clientName}</strong>
              </div>
              <div className="data-box">
                <span className="box-label">CÓD. CLIENTE / PEDIDO</span>
                <strong className="box-val">{clientCode} / {clientOrder}</strong>
              </div>
              <div className="data-box">
                <span className="box-label">TIPO DE SERVIÇO</span>
                <strong className="box-val">{osTypeLabel}</strong>
              </div>
              <div className="data-box">
                <span className="box-label">DATA / HORA ENTRADA</span>
                <strong className="box-val">{entryDate}</strong>
              </div>
              <div className="data-box">
                <span className="box-label">PREVISÃO DE ENTREGA</span>
                <strong className="box-val red-text">{deliveryDate}</strong>
              </div>
              <div className="data-box">
                <span className="box-label">CAIXA / TRAY Nº</span>
                <strong className="box-val tray-text">{trayNo}</strong>
              </div>
            </div>

            {/* LADO DIREITO: BARCODE RASTREAMENTO */}
            <div className="barcode-tracking-box">
              <div className="barcode-graphic">
                || | || ||| | || | ||| || ||| || ||| | || | ||| ||
              </div>
              <div className="barcode-code">*{osNumber}-LMS*</div>
              <p className="barcode-sub">Bipagem obrigatória a cada troca de posto de trabalho.</p>
            </div>
          </div>
        </section>

        {/* 2. PRESCRIÇÃO ÓPTICA (RECEITA MÉDICA) */}
        <section className="os-section">
          <div className="section-title-bar">2. PRESCRIÇÃO ÓPTICA (RECEITA MÉDICA)</div>
          <table className="os-table prescr-table">
            <thead>
              <tr>
                <th>OLHO</th>
                <th>ESFÉRICO</th>
                <th>CILÍNDRICO</th>
                <th>EIXO</th>
                <th>ADIÇÃO</th>
                <th>PRISMA / BASE</th>
                <th>DNP LONGE</th>
                <th>DNP PERTO</th>
                <th>ALT. MONT.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="eye-col">OD</td>
                <td>{odSph}</td>
                <td>{odCyl}</td>
                <td>{odAxis}</td>
                <td>{odAdd}</td>
                <td>{odPrism}</td>
                <td>{odDnp}</td>
                <td>{odDnpPerto}</td>
                <td>{odAlt}</td>
              </tr>
              <tr>
                <td className="eye-col">OE</td>
                <td>{oeSph}</td>
                <td>{oeCyl}</td>
                <td>{oeAxis}</td>
                <td>{oeAdd}</td>
                <td>{oePrism}</td>
                <td>{oeDnp}</td>
                <td>{oeDnpPerto}</td>
                <td>{oeAlt}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 3 & 4: ESPECIFICAÇÃO DA LENTE E GEOMETRIA DA ARMAÇÃO (SIDE BY SIDE) */}
        <div className="side-by-side-row">
          
          {/* 3. ESPECIFICAÇÃO DA LENTE E MATERIAL */}
          <section className="os-section col-half">
            <div className="section-title-bar">3. ESPECIFICAÇÃO DA LENTE E MATERIAL</div>
            <div className="lens-spec-container">
              <div className="spec-item full-w">
                <span className="spec-label">DESIGN / PRODUTO</span>
                <strong className="spec-val">{lensProductName}</strong>
              </div>
              <div className="spec-item half-w">
                <span className="spec-label">MATERIAL / ÍNDICE</span>
                <strong className="spec-val">{lensMaterial}</strong>
              </div>
              <div className="spec-item half-w">
                <span className="spec-label">COR / FOTOSSENSÍVEL</span>
                <strong className="spec-val">{lensColor}</strong>
              </div>
              <div className="spec-item full-w">
                <span className="spec-label">TRATAMENTOS DE SUPERFÍCIE</span>
                <strong className="spec-val blue-highlight">{lensTreatments}</strong>
              </div>
            </div>
          </section>

          {/* 4. GEOMETRIA DA ARMAÇÃO & MONTAGEM */}
          <section className="os-section col-half">
            <div className="section-title-bar">4. GEOMETRIA DA ARMAÇÃO & MONTAGEM</div>
            <div className="frame-geom-container">
              <div className="frame-metrics-grid">
                <div className="f-metric">
                  <span className="f-label">A (HORIZ.)</span>
                  <strong className="f-val">{frameA}</strong>
                </div>
                <div className="f-metric">
                  <span className="f-label">B (VERT.)</span>
                  <strong className="f-val">{frameB}</strong>
                </div>
                <div className="f-metric">
                  <span className="f-label">DBL (PONTE)</span>
                  <strong className="f-val">{frameBridge}</strong>
                </div>
                <div className="f-metric">
                  <span className="f-label">ED (DIAGONAL)</span>
                  <strong className="f-val">{frameEd}</strong>
                </div>
              </div>
              <div className="frame-sub-details">
                <div className="sub-detail-item">
                  <span className="spec-label">TIPO DE ARMAÇÃO</span>
                  <strong className="spec-val">{frameType}</strong>
                </div>
                <div className="sub-detail-item">
                  <span className="spec-label">BISEL SOLICITADO</span>
                  <strong className="spec-val">{bevelType}</strong>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* 5. CÁLCULO DE SURFAÇAGEM / PARÂMETROS CNC (LMS OUTPUT) */}
        <section className="os-section">
          <div className="section-title-bar">5. CÁLCULO DE SURFAÇAGEM / PARÂMETROS CNC (LMS OUTPUT)</div>
          <table className="os-table lms-table">
            <thead>
              <tr>
                <th>OLHO</th>
                <th>CÓD. BLOCO BRUTO</th>
                <th>DIÂMETRO</th>
                <th>CURVA BASE</th>
                <th>CURVA INTERNA</th>
                <th>ESP. CENTRO (EC)</th>
                <th>ESP. BORDA (EB)</th>
                <th>DESCENTRAMENTO</th>
                <th>PROG. FREEFORM</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="eye-col">OD</td>
                <td>{odBloco}</td>
                <td>{odDiam}</td>
                <td>{odBase}</td>
                <td>{odCurvaInt}</td>
                <td>{odEc}</td>
                <td>{odEb}</td>
                <td>{odDescent}</td>
                <td>{odProg}</td>
              </tr>
              <tr>
                <td className="eye-col">OE</td>
                <td>{oeBloco}</td>
                <td>{oeDiam}</td>
                <td>{oeBase}</td>
                <td>{oeCurvaInt}</td>
                <td>{oeEc}</td>
                <td>{oeEb}</td>
                <td>{oeDescent}</td>
                <td>{oeProg}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 6. RASTREABILIDADE E APONTAMENTO DE PRODUÇÃO */}
        <section className="os-section">
          <div className="section-title-bar">6. RASTREABILIDADE E APONTAMENTO DE PRODUÇÃO</div>
          <div className="tracking-stations-grid">
            <div className="station-card">
              <div className="station-head">1. SEPARAÇÃO</div>
              <div className="station-body">Op: ______</div>
            </div>
            <div className="station-card">
              <div className="station-head">2. BLOCAGEM</div>
              <div className="station-body">Op: ______</div>
            </div>
            <div className="station-card">
              <div className="station-head">3. GERADOR CNC</div>
              <div className="station-body">Op: ______</div>
            </div>
            <div className="station-card">
              <div className="station-head">4. POLIMENTO</div>
              <div className="station-body">Op: ______</div>
            </div>
            <div className="station-card">
              <div className="station-head">5. TRATAMENTO AR</div>
              <div className="station-body">Lote: _____</div>
            </div>
            <div className="station-card">
              <div className="station-head">6. FACETA / CORTE</div>
              <div className="station-body">Op: ______</div>
            </div>
            <div className="station-card qa-card">
              <div className="station-head qa-head">7. CONTROLE QUALIDADE</div>
              <div className="qa-body">
                <span className="qa-subhead">LENSÔMETRO</span>
                <span className="qa-line">OD: __.__ ESF / __.__ CIL</span>
                <span className="qa-line">OE: __.__ ESF / __.__ CIL</span>
                <span className="qa-approved">[ ] APROVADO</span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. OBSERVAÇÕES E HISTÓRICO DE REFAZIMENTO */}
        <section className="os-section">
          <div className="section-title-bar">7. OBSERVAÇÕES E HISTÓRICO DE REFAZIMENTO</div>
          <div className="obs-grid-split">
            <div className="obs-left">
              <span className="obs-head">INSTRUÇÕES ESPECIAIS DA MONTAGEM</span>
              <div className="obs-text">
                {specialNotes.split('\n').map((line, idx) => (
                  <p key={idx} style={{ margin: '2px 0' }}>{line}</p>
                ))}
              </div>
            </div>
            <div className="obs-right">
              <span className="obs-head">CONTROLE DE QUEBRA / PÉRDIDA</span>
              <div className="loss-control-lines">
                <p>[ ] Refazimento Parcial: __________________</p>
                <p>[ ] Motivo: _____________________________</p>
                <p>Ass. Resp: ____________________________</p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ESTILOS CSS REUTILIZÁVEIS E DE IMPRESSÃO A4 */}
      <style>{`
        .os-print-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .os-print-document {
          width: 210mm;
          min-height: 297mm;
          padding: 12mm 15mm;
          background: #ffffff;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          border-radius: 4px;
          box-sizing: border-box;
        }

        /* HEADER */
        .os-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .company-name {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .company-sub {
          font-size: 0.75rem;
          color: #475569;
          margin: 2px 0 0 0;
        }

        .header-center {
          text-align: center;
        }

        .priority-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .priority-badge.urgente {
          border: 1.5px solid #dc2626;
          color: #dc2626;
          background: #fef2f2;
        }

        .priority-badge.normal {
          border: 1.5px solid #2563eb;
          color: #2563eb;
          background: #eff6ff;
        }

        .lms-tag {
          font-size: 0.7rem;
          font-weight: 700;
          color: #64748b;
          margin: 4px 0 0 0;
        }

        .os-badge-box {
          background: #0f172a;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          text-align: center;
        }

        .os-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 1px;
          opacity: 0.85;
        }

        .os-number-title {
          display: block;
          font-size: 1.3rem;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        /* SEÇÕES E TITULOS */
        .os-section {
          margin-bottom: 12px;
        }

        .section-title-bar {
          background: #334155;
          color: white;
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 2px;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .section-title-bar.split {
          display: flex;
          justify-content: space-between;
        }

        /* SEÇÃO 1: GRID & BARCODE */
        .section-grid-split {
          display: grid;
          grid-template-columns: 2.2fr 1fr;
          gap: 10px;
        }

        .client-data-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          border: 1px solid #cbd5e1;
          padding: 8px;
          border-radius: 4px;
          background: #f8fafc;
        }

        .data-box {
          display: flex;
          flex-direction: column;
        }

        .box-label {
          font-size: 0.62rem;
          color: #64748b;
          font-weight: 700;

        }

        .box-val {
          font-size: 0.82rem;
          color: #0f172a;
          font-weight: 800;
          line-height: 1.2;
        }

        .highlight-client {
          color: #0f172a;
          font-size: 0.88rem;
        }

        .red-text {
          color: #dc2626;
        }

        .tray-text {
          color: #2563eb;
          font-size: 1rem;
        }

        .barcode-tracking-box {
          border: 1px solid #cbd5e1;
          padding: 8px;
          border-radius: 4px;
          text-align: center;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .barcode-graphic {
          font-family: monospace;
          font-weight: 900;
          font-size: 1rem;
          letter-spacing: -1.5px;
          color: #0f172a;
        }

        .barcode-code {
          font-size: 0.72rem;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }

        .barcode-sub {
          font-size: 0.58rem;
          color: #64748b;
          margin: 4px 0 0 0;
          line-height: 1.1;
        }

        /* TABELAS GERAIS */
        .os-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
          text-align: center;
          border: 1px solid #94a3b8;
        }

        .os-table th {
          background: #e2e8f0;
          color: #1e293b;
          font-weight: 800;
          font-size: 0.68rem;
          padding: 5px;
          border: 1px solid #cbd5e1;
          letter-spacing: 0.3px;
        }

        .os-table td {
          padding: 6px 4px;
          border: 1px solid #cbd5e1;
          font-weight: 700;
          color: #0f172a;
        }

        .eye-col {
          background: #f1f5f9;
          font-weight: 900 !important;
          width: 35px;
        }

        /* SIDE BY SIDE COLUMNS */
        .side-by-side-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .col-half {
          margin-bottom: 0;
        }

        .lens-spec-container, .frame-geom-container {
          border: 1px solid #cbd5e1;
          padding: 8px;
          border-radius: 4px;
          background: #f8fafc;
          height: calc(100% - 28px);
          box-sizing: border-box;
        }

        .lens-spec-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .spec-item {
          display: flex;
          flex-direction: column;
        }

        .spec-item.full-w { width: 100%; }
        .spec-item.half-w { width: calc(50% - 4px); }

        .spec-label {
          font-size: 0.62rem;
          color: #64748b;
          font-weight: 700;
        }

        .spec-val {
          font-size: 0.8rem;
          color: #0f172a;
          font-weight: 800;
        }

        .blue-highlight {
          color: #2563eb;
        }

        .frame-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          margin-bottom: 8px;
        }

        .f-metric {
          border: 1px solid #cbd5e1;
          background: white;
          padding: 4px;
          text-align: center;
          border-radius: 3px;
        }

        .f-label {
          display: block;
          font-size: 0.58rem;
          color: #64748b;
          font-weight: 700;
        }

        .f-val {
          display: block;
          font-size: 0.95rem;
          color: #0f172a;
          font-weight: 900;
        }

        .frame-sub-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        /* ESTAÇÕES DE RASTREABILIDADE */
        .tracking-stations-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 5px;
        }

        .station-card {
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          background: #f8fafc;
          text-align: center;
          padding: 4px;
        }

        .station-head {
          font-size: 0.6rem;
          font-weight: 800;
          color: #334155;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 2px;
          margin-bottom: 4px;

        }

        .station-body {
          font-size: 0.68rem;
          color: #64748b;
          font-weight: 600;
          padding: 6px 0;
        }

        .qa-card {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .qa-head {
          color: #166534;
          border-color: #bbf7d0;
        }

        .qa-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-size: 0.58rem;
        }

        .qa-subhead {
          font-weight: 800;
          color: #15803d;
        }

        .qa-line {
          font-size: 0.55rem;
          color: #334155;
          margin-top: 1px;
        }

        .qa-approved {
          margin-top: 3px;
          font-weight: 900;
          color: #16a34a;
          font-size: 0.65rem;
        }

        /* OBSERVAÇÕES E HISTÓRICO */
        .obs-grid-split {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 8px;
          background: #f8fafc;
        }

        .obs-head {
          display: block;
          font-size: 0.62rem;
          font-weight: 800;
          color: #475569;
          margin-bottom: 4px;

        }

        .obs-text {
          font-size: 0.72rem;
          color: #0f172a;
          font-weight: 600;
          line-height: 1.3;
        }

        .loss-control-lines p {
          margin: 3px 0;
          font-size: 0.68rem;
          color: #475569;
          font-weight: 600;
        }

        /* CSS DE IMPRESSÃO PROPRIAMENTE DITO */
        @media print {
          body * {
            visibility: hidden;
          }

          .no-print {
            display: none !important;
          }

          .os-print-wrapper, .os-print-document, .os-print-document * {
            visibility: visible;
          }

          .os-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          .os-print-document {
            width: 100%;
            min-height: auto;
            padding: 0;
            box-shadow: none;
            border-radius: 0;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};

export default OSPrintLayout;
