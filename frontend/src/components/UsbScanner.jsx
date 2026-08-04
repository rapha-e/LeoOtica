import React, { useEffect, useRef, useState } from 'react';
import { Barcode, AlertTriangle, CheckCircle, Keyboard, RefreshCw } from 'lucide-react';
import { InventoryService } from '../services/api';

const UsbScanner = ({ onInedito, onScanSuccess }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);

  // Garante que o input invisível receba foco ao carregar o componente
  useEffect(() => {
    focusInput();
  }, []);

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Mantém o foco persistente no input mesmo se o usuário clicar fora
  const handlePanelClick = () => {
    focusInput();
  };

  const handleInputBlur = () => {
    // Pequeno timeout para não travar a UI e permitir interações com botões legítimos
    setTimeout(() => {
      // Só refoca se não estiver exibindo um resultado ou erro que demande atenção
      if (!scanResult && !isProcessing) {
        focusInput();
      }
    }, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const barcode = inputValue.trim();
    if (!barcode) return;

    setInputValue('');
    setIsProcessing(true);
    setError(null);
    setScanResult(null);

    try {
      // Simula uma vibração rápida se suportado
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      const response = await InventoryService.scan(barcode);

      if (response.data.found) {
        setScanResult({
          type: 'success',
          message: `Estoque incrementado (+1) para a lente:`,
          detail: `${response.data.item.lens_model.brand} | ${response.data.item.lens_model.material} | Grau: ${parseFloat(response.data.item.spherical).toFixed(2)} Esf / ${parseFloat(response.data.item.cylindrical).toFixed(2)} Cil | Local: ${response.data.item.location_tag || 'Gaveta não definida'}`,
          barcode: barcode
        });
        if (onScanSuccess) onScanSuccess(response.data.item);
      } else {
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        setScanResult({
          type: 'inedito',
          message: response.data.message,
          barcode: barcode
        });
        
        // Notifica o componente pai sobre o código inédito
        setTimeout(() => {
          onInedito(barcode);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao se conectar com o servidor para processar código.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setInputValue('');
    // Força foco imediato após fechar a tela de resultado
    setTimeout(() => {
      focusInput();
    }, 50);
  };

  return (
    <div 
      className={`glass-panel usb-scanner-panel ${!scanResult && !isProcessing ? 'active' : ''}`}
      onClick={handlePanelClick}
      style={{ cursor: 'pointer', minHeight: '320px' }}
    >
      {/* Input de texto oculto para capturar a digitação do bipador USB */}
      <form onSubmit={handleSubmit} style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
        <input
          ref={inputRef}
          type="text"
          className="usb-hidden-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          autoComplete="off"
        />
      </form>

      {/* Laser animado quando o scanner está ouvindo e processando */}
      {!scanResult && !isProcessing && <div className="usb-scanner-laser" />}

      {!scanResult && !isProcessing && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div className="usb-pulser-container">
            <div className="usb-pulser-ring" />
            <Barcode size={48} className="usb-pulser-icon" />
          </div>
          <h2 style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Bipador USB Ativo</h2>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', maxWidth: '300px', marginBottom: '15px' }}>
            Conecte o leitor de código de barras USB na máquina. O sistema capturará as leituras automaticamente.
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'hsl(var(--primary) / 0.08)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'hsl(var(--primary))'
          }}>
            <Keyboard size={12} /> Aguardando bipagem física...
          </div>
        </div>
      )}

      {isProcessing && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
          <RefreshCw className="animate-spin" size={48} style={{ color: 'hsl(var(--primary))', marginBottom: '15px' }} />
          <p>Consultando banco de dados...</p>
        </div>
      )}

      {error && !scanResult && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
          <AlertTriangle size={48} style={{ color: 'hsl(var(--danger))', marginBottom: '15px' }} />
          <p style={{ marginBottom: '20px' }}>{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            Tentar Novamente
          </button>
        </div>
      )}

      {scanResult && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '10px 0',
          animation: 'modal-appear 0.2s ease-out'
        }}>
          {scanResult.type === 'success' ? (
            <CheckCircle size={52} style={{ color: 'hsl(var(--success))', marginBottom: '12px' }} />
          ) : (
            <AlertTriangle size={52} style={{ color: 'hsl(var(--warning))', marginBottom: '12px' }} />
          )}
          
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>
            {scanResult.message}
          </h3>
          
          {scanResult.detail && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '15px', lineHeight: '1.4', maxWidth: '380px' }}>
              {scanResult.detail}
            </p>
          )}
          
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '20px' }}>
            Cod: {scanResult.barcode}
          </p>
          
          {scanResult.type === 'success' && (
            <button className="btn btn-secondary btn-sm" onClick={handleReset}>
              Continuar Bipagem
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UsbScanner;
