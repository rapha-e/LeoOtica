import React, { useState, useEffect, useRef } from 'react';
import { AnalyticsService } from '../services/api';
import { MessageSquare, Send, Sparkles, User, RefreshCcw, HelpCircle, Loader } from 'lucide-react';

const AssistenteIA = () => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Olá! Sou o **Assistente Operacional** da Nova Lab. Posso te ajudar a extrair relatórios rápidos e responder a perguntas analíticas de negócios da fábrica em tempo real.\n\nTente me perguntar uma das opções abaixo ou digite sua dúvida!',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);


  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    // Adiciona a mensagem do usuário ao chat
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setLoading(true);

    try {
      const response = await AnalyticsService.askAssistant(text);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: 'Desculpe, ocorreu um erro de comunicação com o motor de inteligência artificial. Verifique se o servidor está ativo e tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  const renderHtmlTable = (headers, rows) => {
    let html = `<div style="overflow-x: auto; margin: 15px 0; border: 1px solid rgba(0,0,0,0.05); border-radius: 8px;"><table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">`;
    
    // Header
    html += `<thead><tr style="background: rgba(147, 51, 234, 0.08); border-bottom: 2px solid rgba(147, 51, 234, 0.15);">`;
    headers.forEach(h => {
      html += `<th style="padding: 10px 14px; font-weight: 700; color: white;">${h}</th>`;
    });
    html += `</tr></thead>`;
    
    // Body
    html += `<tbody>`;
    rows.forEach((row, rIdx) => {
      const isEven = rIdx % 2 === 0;
      html += `<tr style="background: ${isEven ? 'rgba(255,255,255,0.02)' : 'transparent'}; border-bottom: 1px solid rgba(0,0,0,0.03);">`;
      row.forEach(cell => {
        html += `<td style="padding: 10px 14px; color: hsl(var(--text-primary));">${cell}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
  };

  const parseMessageContent = (text) => {
    if (!text) return '';
    
    // Processa negritos: **texto** -> <strong>texto</strong>
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Processa tags de código/status: `texto` -> <code>texto</code>
    html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85em; color: hsl(var(--primary)); font-weight: bold;">$1</code>');
    
    // Divide por linhas para processar tabelas
    const lines = html.split('\n');
    const processedLines = [];
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('|') && line.endsWith('|')) {
        // É uma linha de tabela
        const parts = line.split('|').map(p => p.trim()).filter((p, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        if (line.includes('---')) {
          // É a linha separadora, ignora
          continue;
        }
        
        if (!inTable) {
          inTable = true;
          tableHeaders = parts;
        } else {
          tableRows.push(parts);
        }
      } else {
        if (inTable) {
          // Fecha a tabela e monta o HTML
          processedLines.push(renderHtmlTable(tableHeaders, tableRows));
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        
        if (line.startsWith('###')) {
          processedLines.push(`<h4 style="font-size: 1.1rem; color: white; margin-top: 18px; margin-bottom: 8px; font-weight: 700;">${line.replace('###', '').trim()}</h4>`);
        } else if (line.startsWith('-') || line.startsWith('*')) {
          // Filtra o marcador
          const content = line.replace(/^[-*]\s*/, '');
          processedLines.push(`<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: disc; line-height: 1.4;">${content}</li>`);
        } else if (line) {
          processedLines.push(`<p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.92rem;">${line}</p>`);
        } else {
          processedLines.push('<div style="height: 6px;"></div>');
        }
      }
    }
    
    if (inTable) {
      processedLines.push(renderHtmlTable(tableHeaders, tableRows));
    }
    
    return processedLines.join('');
  };

  const suggestions = [
    "Quais óticas mais faturaram este mês?",
    "Quanto perdi com retrabalho?",
    "Quais OSs estão pendentes de faturamento?",
    "Quais OS estão atrasadas?",
    "Quais lentes tiveram maior consumo?"
  ];

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.6rem', color: 'hsl(var(--text-primary))', fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} style={{ color: 'hsl(var(--primary))' }} /> Consultor Inteligente IA — Nova Lab
        </h2>

        <span className="logo-badge" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>Gemini Pro</span>
      </div>


      {/* Janela de Chat */}
      <div className="glass-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '550px', 
        padding: '0', 
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.7)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)'
      }}>
        {/* Topo do Chat */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '16px 20px', 
          borderBottom: '1px solid rgba(0,0,0,0.03)',
          background: 'rgba(255,255,255,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: 'hsl(var(--success))',
              boxShadow: '0 0 8px hsl(var(--success))'
            }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--text-primary))' }}>
              Chat de Diagnóstico de Fábrica
            </span>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setMessages([{
              id: 'welcome',
              sender: 'assistant',
              text: 'Olá! Sou o **Assistente Operacional** da Nova Lab. Posso te ajudar a extrair relatórios rápidos e responder a perguntas analíticas de negócios da fábrica em tempo real.\n\nTente me perguntar uma das opções abaixo ou digite sua dúvida!',
              timestamp: new Date()
            }])}
            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCcw size={12} /> Limpar Conversa
          </button>
        </div>

        {/* Área de Histórico das Mensagens */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((msg) => {
            const isAssistant = msg.sender === 'assistant';
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: isAssistant ? 'flex-start' : 'flex-end',
                  alignItems: 'flex-start',
                  gap: '12px',
                  maxWidth: '85%',
                  alignSelf: isAssistant ? 'flex-start' : 'flex-end'
                }}
              >
                {/* Ícone de Avatar do Assistente */}
                {isAssistant && (
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'rgba(147, 51, 234, 0.1)', 
                    color: 'rgb(147, 51, 234)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(147, 51, 234, 0.2)'
                  }}>
                    <Sparkles size={16} />
                  </div>
                )}

                {/* Balão da Mensagem */}
                <div style={{ 
                  background: isAssistant ? 'rgba(255, 255, 255, 0.95)' : 'hsl(var(--primary))',
                  color: isAssistant ? 'hsl(var(--text-primary))' : 'white',
                  border: isAssistant ? '1px solid rgba(224, 230, 240, 0.8)' : 'none',
                  borderRadius: isAssistant ? '0 16px 16px 16px' : '16px 0 16px 16px',
                  padding: '12px 18px',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                  fontSize: '0.92rem'
                }}>
                  <div 
                    dangerouslySetInnerHTML={{ __html: parseMessageContent(msg.text) }} 
                    style={{ overflowWrap: 'break-word' }}
                  />
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: isAssistant ? 'hsl(var(--text-muted))' : 'rgba(255,255,255,0.7)',
                    display: 'block',
                    marginTop: '6px',
                    textAlign: 'right'
                  }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Ícone de Avatar do Usuário */}
                {!isAssistant && (
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'rgba(255,255,255,0.1)', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.2)',
                    backgroundColor: 'hsl(var(--secondary))'
                  }}>
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Estado de Carregamento (IA digitando...) */}
          {loading && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: '12px',
              alignSelf: 'flex-start'
            }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'rgba(147, 51, 234, 0.1)', 
                color: 'rgb(147, 51, 234)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(147, 51, 234, 0.2)'
              }}>
                <Sparkles size={16} className="animate-spin" />
              </div>
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                color: 'hsl(var(--text-secondary))',
                border: '1px solid rgba(224, 230, 240, 0.8)',
                borderRadius: '0 16px 16px 16px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem'
              }}>
                <Loader size={14} className="animate-spin" />
                O assistente está consultando a esteira operacional...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões Rápidas na parte inferior */}
        <div style={{ 
          padding: '12px 20px', 
          background: 'rgba(255,255,255,0.4)', 
          borderTop: '1px solid rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <HelpCircle size={12} /> Perguntas Rápidas de Diagnóstico:
          </span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {suggestions.map((sug, idx) => (
              <button 
                key={idx}
                className="btn btn-secondary btn-sm"
                onClick={() => handleSuggestionClick(sug)}
                disabled={loading}
                style={{ 
                  fontSize: '0.78rem', 
                  borderRadius: '20px',
                  padding: '6px 14px',
                  border: '1px solid rgba(147, 51, 234, 0.15)',
                  background: 'rgba(255,255,255,0.8)',
                  color: 'hsl(var(--primary))',
                  fontWeight: '600',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Caixa de Entrada e Envio */}
        <div style={{ 
          padding: '16px 20px', 
          borderTop: '1px solid rgba(0,0,0,0.03)',
          background: 'rgba(255,255,255,0.6)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <input 
            type="text"
            className="form-control"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
            placeholder="Pergunte sobre faturamento de óticas, consumo de lentes ou OSs atrasadas..."
            style={{ 
              flex: 1, 
              borderRadius: '10px',
              padding: '12px 16px',
              border: '1px solid rgba(224, 230, 240, 0.8)',
              background: 'white'
            }}
          />
          <button 
            className="btn btn-primary"
            onClick={() => handleSend()}
            disabled={loading || !inputValue.trim()}
            style={{ 
              padding: '12px 20px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
          >
            <Send size={16} /> Enviar
          </button>
        </div>

      </div>
    </div>
  );
};

export default AssistenteIA;
