import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { InventoryService } from '../services/api';

const CameraScanner = ({ onInedito, onScanSuccess }) => {
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const qrCodeRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  const startScanner = async () => {
    setError(null);
    setScanResult(null);
    setIsScanning(true);

    try {
      // Pequeno delay para garantir que a div de renderização está pronta no DOM
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const html5Qrcode = new Html5Qrcode("reader");
      html5QrcodeScannerRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: (width, height) => {
          // Caixa de escaneamento retangular ideal para códigos de barras longos
          return { width: Math.min(width * 0.8, 300), height: 120 };
        },
        aspectRatio: 1.0,
      };

      await html5Qrcode.start(
        { facingMode: "environment" }, // Utiliza a câmera traseira
        config,
        async (decodedText) => {
          // Bip / Sucesso de leitura no hardware móvel
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          // Pausa temporariamente o escaneamento para processar
          await stopScanner();
          processBarcode(decodedText);
        },
        (errorMessage) => {
          // Erros de scanner comuns em loops de frames podem ser ignorados silenciosamente
        }
      );
      setCameraPermission(true);
    } catch (err) {
      console.error("Erro ao iniciar câmera: ", err);
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError("Câmera Bloqueada! O navegador Edge/Chrome bloqueia o acesso à câmera em conexões HTTP na rede local. Consulte o manual de instalação para liberar a câmera nas configurações do navegador.");
      } else {
        setError("Permissão de câmera negada. Certifique-se de conceder acesso à câmera nas configurações do navegador (clicando no ícone de cadeado ao lado do endereço).");
      }
      setIsScanning(false);
      setCameraPermission(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeScannerRef.current && html5QrcodeScannerRef.current.isScanning) {
      try {
        await html5QrcodeScannerRef.current.stop();
      } catch (err) {
        console.error("Erro ao parar câmera: ", err);
      }
    }
    setIsScanning(false);
  };

  const processBarcode = async (barcode) => {
    try {
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
        // Código inédito - aciona fluxo de fallback
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]); // Vibração dupla indicando atenção
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
      setError("Erro ao se conectar com o servidor para processar código.");
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="glass-panel scanner-container">
      <div style={{ width: '100%', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Bipagem de Lentes</h2>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Aponte a câmera para o código de barras na caixa da lente.</p>
      </div>

      <div className="scanner-viewport">
        {isScanning && <div className="scanner-laser" />}
        <div id="reader" style={{ width: '100%', height: '100%', border: 'none' }} />
        
        {!isScanning && !scanResult && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.95)', padding: '20px', textAlign: 'center'
          }}>
            <Camera size={48} style={{ color: 'hsl(var(--primary))', marginBottom: '15px' }} />
            <p style={{ marginBottom: '15px' }}>{error || "Câmera inativa"}</p>
            <button className="btn btn-primary" onClick={startScanner}>
              <RefreshCw size={16} /> Ativar Câmera
            </button>
          </div>
        )}

        {scanResult && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.98)', padding: '24px', textAlign: 'center',
            border: scanResult.type === 'success' ? '2px solid hsl(var(--success))' : '2px solid hsl(var(--warning))'
          }}>
            {scanResult.type === 'success' ? (
              <CheckCircle size={52} style={{ color: 'hsl(var(--success))', marginBottom: '12px' }} />
            ) : (
              <AlertTriangle size={52} style={{ color: 'hsl(var(--warning))', marginBottom: '12px' }} />
            )}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>{scanResult.message}</h3>
            {scanResult.detail && (
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '15px', lineHeight: '1.4' }}>
                {scanResult.detail}
              </p>
            )}
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '20px' }}>
              Cod: {scanResult.barcode}
            </p>
            {scanResult.type === 'success' && (
              <button className="btn btn-secondary btn-sm" onClick={startScanner}>
                Continuar Bipagem
              </button>
            )}
          </div>
        )}
      </div>

      {isScanning && (
        <button className="btn btn-secondary" onClick={stopScanner}>
          Parar Câmera
        </button>
      )}
    </div>
  );
};

export default CameraScanner;
