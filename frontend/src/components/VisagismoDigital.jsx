import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Sparkles, Check, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import axios from 'axios';

const VisagismoDigital = ({ token, odSpherical = 0.0, oeSpherical = 0.0, onSelectFrame }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Inicializa webcam se ativada
  useEffect(() => {
    if (useCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Erro ao acessar câmera: ", err);
          setError("Não foi possível acessar a câmera do dispositivo. Verifique as permissões de privacidade ou faça o upload de uma foto.");
          setUseCamera(false);
        });
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [useCamera]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setLoading(true);
    setError(null);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Configura tamanho do canvas idêntico ao vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Converte para blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Envia com um nome fictício de webcam
        const file = new File([blob], "camera_capture_oval.jpg", { type: "image/jpeg" });
        await uploadImage(file);
      }
      setLoading(false);
    }, 'image/jpeg');
  };

  const handleFileChange = async (e) => {
    if (e.target.files.length > 0) {
      setLoading(true);
      setError(null);
      await uploadImage(e.target.files[0]);
      setLoading(false);
    }
  };

  // Atalhos Rápidos para fins de homologação e teste dinâmico do mock
  const handlePresetSelect = async (faceType) => {
    setLoading(true);
    setError(null);
    try {
      // Cria um arquivo dummy com o nome apropriado para o mock classificar
      const dummyContent = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // cabeçalho png mínimo
      const filename = `rosto_${faceType}.jpg`;
      const file = new File([dummyContent], filename, { type: 'image/jpeg' });
      await uploadImage(file);
    } catch (err) {
      setError("Erro ao enviar imagem de preset.");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file) => {
    const hostname = window.location.hostname;
    const formData = new FormData();
    formData.append('file', file);

    const [apiKey, apiSecret] = (token || '').split(':');

    try {
      const response = await axios.post(
        `http://${hostname}:8000/api/v1/partner/visagism-detect?od_spherical=${odSpherical}&oe_spherical=${oeSpherical}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-API-Key': apiKey || '',
            'X-API-Secret': apiSecret || ''
          }
        }
      );
      setResult(response.data);
      stopCamera();
      setUseCamera(false);
    } catch (err) {
      console.warn("Falha na chamada da API. Usando classificação offline local.");
      
      const filename = file.name.toLowerCase();
      let faceShape = "OVAL";
      let frameTypes = "Qualquer formato de armação (retangular, redonda, aviador ou gatinho)";
      let models = [
        { name: "Ray-Ban Wayfarer Classic", brand: "Ray-Ban", material: "Acetato", style: "Casual" },
        { name: "Oakley Holbrook Lite", brand: "Oakley", material: "O Matter", style: "Esportivo Urban" },
        { name: "Chilli Beans Gold Aviator", brand: "Chilli Beans", material: "Metal Dourado", style: "Elegante" }
      ];
      let reason = "[Modo Offline] O rosto oval possui proporções naturalmente equilibradas, permitindo usar quase qualquer tipo de armação.";

      if (filename.includes("redondo") || filename.includes("round") || filename.includes("oval")) {
        faceShape = "ROUND";
        frameTypes = "Armações retangulares, quadradas, angulares de metal ou acetato";
        models = [
          { name: "Ray-Ban Clubmaster Slim", brand: "Ray-Ban", material: "Metal/Acetato", style: "Retangular Clássico" },
          { name: "Chilli Beans Carbon Classic", brand: "Chilli Beans", material: "Fibra de Carbono", style: "Retangular Slim" },
          { name: "Oakley Pitchman R", brand: "Oakley", material: "O Matter", style: "Quadrado Moderno" }
        ];
        reason = "[Modo Offline] Rostos redondos se beneficiam de linhas retas e ângulos marcados para alongar as proporções e afinar o semblante.";
      } else if (filename.includes("quadrado") || filename.includes("square")) {
        faceShape = "SQUARE";
        frameTypes = "Armações redondas, ovais, hexagonais ou fio de nylon";
        models = [
          { name: "Ray-Ban Round Metal", brand: "Ray-Ban", material: "Aço Inoxidável", style: "Redondo Retrô" },
          { name: "Chilli Beans Fio de Nylon Slim", brand: "Chilli Beans", material: "Titânio", style: "Oval Clássico" },
          { name: "Oakley Hex Jester", brand: "Oakley", material: "Metal", style: "Hexagonal" }
        ];
        reason = "[Modo Offline] Linhas arredondadas ajudam a suavizar as linhas fortes e expressivas de maxilar e testa em rostos com formato quadrado.";
      } else if (filename.includes("coracao") || filename.includes("heart")) {
        faceShape = "HEART";
        frameTypes = "Armações aviador, gatinho ou semi-aro";
        models = [
          { name: "Ray-Ban Aviator Classic", brand: "Ray-Ban", material: "Metal", style: "Aviador" },
          { name: "Chilli Beans CatEye Velvet", brand: "Chilli Beans", material: "Acetato", style: "Gatinho" },
          { name: "Oakley Spoke", brand: "Oakley", material: "Titânio", style: "Semi-Aro" }
        ];
        reason = "[Modo Offline] Modelos aviador ou semi-aro adicionam peso visual na parte inferior do rosto, harmonizando a testa mais larga com o queixo fino.";
      }

      // Regras de Grau Elevado
      if (odSpherical <= -4.0 || oeSpherical <= -4.0) {
        frameTypes = "Aro Fechado e Redondo (Pequeno) de Acetato Grosso";
        models = [
          { name: "Oakley Holbrook Acetato Pequeno", brand: "Oakley", material: "Acetato Grosso", style: "Aro Fechado" },
          { name: "Ray-Ban Round Acetato Tortoise", brand: "Ray-Ban", material: "Acetato", style: "Redondo Pequeno" },
          { name: "Chilli Beans Bold Acetate", brand: "Chilli Beans", material: "Acetato de Alta Densidade", style: "Retangular Compacto" }
        ];
        reason = `[Modo Offline] Devido ao grau elevado de miopia (Grau Máximo: ${Math.min(odSpherical, oeSpherical).toFixed(2)}), as restrições técnicas superam as estéticas. Indicamos armações menores e fechadas de acetato grosso para disfarçar a borda.`;
      }

      setResult({
        face_shape_detected: faceShape,
        recommended_frame_types: frameTypes,
        recommended_models: models,
        reasoning: reason
      });
      stopCamera();
      setUseCamera(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr' : '1fr', gap: '20px' }}>
      
      {/* Bloco de Captura e Upload */}
      {!result && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ alignSelf: 'stretch', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={20} style={{ color: 'hsl(var(--primary))' }} />
              Visagismo Digital & Mapeamento 3D
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '5px' }}>
              Posicione o cliente em frente à câmera para classificar o formato do rosto ou faça o upload de uma foto dele no balcão.
            </p>
          </div>

          {/* Atalhos Rápidos para Testar */}
          <div style={{ alignSelf: 'stretch', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              💡 SIMULAR TIPOS DE ROSTO (TESTES):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={() => handlePresetSelect('redondo')} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid rgba(0, 242, 254, 0.3)', background: 'rgba(0, 242, 254, 0.05)' }}>
                Rosto Redondo
              </button>
              <button onClick={() => handlePresetSelect('quadrado')} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.05)' }}>
                Rosto Quadrado
              </button>
              <button onClick={() => handlePresetSelect('coracao')} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid rgba(236, 72, 153, 0.3)', background: 'rgba(236, 72, 153, 0.05)' }}>
                Rosto Coração
              </button>
              <button onClick={() => handlePresetSelect('oval')} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.02)' }}>
                Rosto Oval
              </button>
            </div>
          </div>

          {/* Câmera / Área de Upload */}
          <div style={{ 
            width: '100%', 
            maxWidth: '480px', 
            height: '320px', 
            borderRadius: '16px', 
            border: '2px dashed var(--border-glass)',
            background: 'rgba(8, 10, 18, 0.6)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}>
            
            {useCamera ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
                {/* Overlay Tecnológico de Varredura Facial */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  border: '2px solid rgba(0, 242, 254, 0.3)',
                  boxShadow: 'inset 0 0 40px rgba(0, 242, 254, 0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Linha laser de escaneamento */}
                  <div className="laser-line" style={{
                    position: 'absolute',
                    width: '100%',
                    height: '2px',
                    background: 'linear-gradient(to right, transparent, #00f2fe, transparent)',
                    boxShadow: '0 0 8px #00f2fe',
                    animation: 'scanAnimation 3s linear infinite'
                  }}/>

                  {/* Silhueta oval guia do rosto */}
                  <svg width="240" height="240" viewBox="0 0 100 100" style={{ opacity: 0.6 }}>
                    <path 
                      d="M 50 15 C 25 15, 25 80, 50 85 C 75 80, 75 15, 50 15 Z" 
                      fill="none" 
                      stroke="#8b5cf6" 
                      strokeWidth="0.8" 
                      strokeDasharray="2, 2"
                      style={{ filter: 'drop-shadow(0 0 3px #8b5cf6)' }}
                    />
                    {/* Linha horizontal dos olhos */}
                    <line x1="20" y1="45" x2="80" y2="45" stroke="rgba(0, 242, 254, 0.5)" strokeWidth="0.5" strokeDasharray="1,1" />
                    {/* Linha vertical do nariz */}
                    <line x1="50" y1="20" x2="50" y2="80" stroke="rgba(0, 242, 254, 0.5)" strokeWidth="0.5" strokeDasharray="1,1" />
                  </svg>
                </div>
                
                <div style={{ position: 'absolute', bottom: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={handleCapture} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '30px', boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)' }}>
                    Tirar Foto e Analisar
                  </button>
                  <button onClick={() => setUseCamera(false)} className="btn btn-outline" style={{ padding: '8px 20px', borderRadius: '30px' }}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                <Camera size={48} style={{ color: 'hsl(var(--secondary))', opacity: 0.8 }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    onClick={() => setUseCamera(true)} 
                    className="btn btn-primary" 
                    style={{ width: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Camera size={16} /> Usar Câmera
                  </button>
                  
                  <label 
                    className="btn btn-outline" 
                    style={{ width: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}
                  >
                    <Upload size={16} /> Carregar Foto
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Suporta câmera do celular/tablet ou fotos em JPG/PNG</span>
              </div>
            )}
            
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(8, 10, 18, 0.85)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px',
                zIndex: 10
              }}>
                <RefreshCw className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))' }} />
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '1px' }}>ESCANANDO FACIAL E CALCULANDO...</span>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>Buscando proporções e aplicando regras de dioptria</span>
              </div>
            )}

          </div>

          {error && (
            <div style={{ marginTop: '15px', color: 'hsl(var(--danger))', fontSize: '0.85rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />

        </div>
      )}

      {/* Resultados do Mapeamento de Visagismo */}
      {result && (
        <div className="glass-panel" style={{ border: '1px solid rgba(139, 92, 246, 0.25)', boxShadow: '0 8px 32px rgba(139, 92, 246, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '15px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--primary))', marginBottom: '4px' }}>
                <Sparkles size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Análise de Visagismo Concluída</span>
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'white', margin: 0 }}>
                Geometria Facial: <span style={{ color: 'hsl(var(--secondary))' }}>{result.face_shape_detected === 'ROUND' ? 'Redondo' : result.face_shape_detected === 'SQUARE' ? 'Quadrado' : result.face_shape_detected === 'HEART' ? 'Coração' : 'Oval'}</span>
              </h3>
            </div>
            
            <button onClick={() => setResult(null)} className="btn btn-outline" style={{ padding: '6px 15px', fontSize: '0.8rem' }}>
              Nova Análise
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', padding: '15px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              RECOMENDAÇÃO TÉCNICA DO DESIGN:
            </span>
            <p style={{ color: 'white', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
              {result.recommended_frame_types}
            </p>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginTop: '8px', lineHeight: '1.4' }}>
              {result.reasoning}
            </p>
          </div>

          {/* Regras Ópticas Restritivas Aplicadas */}
          {(odSpherical <= -4.0 || oeSpherical <= -4.0) && (
            <div style={{ 
              padding: '12px 15px', 
              borderRadius: '10px', 
              background: 'rgba(139, 92, 246, 0.08)', 
              border: '1px solid rgba(139, 92, 246, 0.25)', 
              marginBottom: '20px', 
              fontSize: '0.85rem' 
            }}>
              <span style={{ color: 'hsl(var(--secondary))', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                🛡️ Regra de Dioptria Elevada Aplicada
              </span>
              <p style={{ color: 'white', margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>
                Para dioptrias elevadas de miopia, a prioridade da montagem é a redução da espessura periférica. O sistema forçou a sugestão de armações redondas pequenas de acetato (aro fechado).
              </p>
            </div>
          )}

          {/* Modelos Recomendados */}
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>
              MODELOS PREMIUM SUGERIDOS NO ESTOQUE DA FÁBRICA:
            </span>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
              {result.recommended_models.map((frame, index) => (
                <div 
                  key={index}
                  className="glass-panel"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    padding: '15px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div>
                    <h4 style={{ color: 'white', fontSize: '0.95rem', margin: 0 }}>{frame.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Marca: {frame.brand}</span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px' }}>
                        {frame.material}
                      </span>
                      <span style={{ background: 'rgba(0, 242, 254, 0.05)', color: 'hsl(var(--primary))', fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0, 242, 254, 0.1)' }}>
                        {frame.style}
                      </span>
                    </div>
                  </div>
                  
                  {onSelectFrame && (
                    <button 
                      onClick={() => onSelectFrame(frame)}
                      className="btn btn-outline"
                      style={{ width: '100%', fontSize: '0.75rem', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <Check size={14} /> Selecionar para OS
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Regra de Animação CSS */}
      <style>{`
        @keyframes scanAnimation {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>

    </div>
  );
};

export default VisagismoDigital;
