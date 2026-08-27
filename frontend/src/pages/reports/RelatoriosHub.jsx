import React, { useState } from 'react';
import { 
  BarChart3, Factory, Package, TrendingUp, DollarSign, 
  Sparkles, Lock, FileSpreadsheet
} from 'lucide-react';
import TabProducao from './TabProducao';
import TabEstoque from './TabEstoque';
import TabComercial from './TabComercial';
import TabFinanceiro from './TabFinanceiro';

export default function RelatoriosHub({ currentUser }) {
  const [activeTab, setActiveTab] = useState('comercial'); // 'producao' | 'estoque' | 'comercial' | 'financeiro'

  const isAdmin = currentUser?.role === 'Administrador' || currentUser?.role?.name === 'Administrador';

  const TABS = [
    {
      id: 'comercial',
      label: 'Comercial & Vendas',
      icon: <TrendingUp size={16} />,
      color: 'hsl(142, 75%, 35%)',
      description: 'Ranking de clientes e mix de tratamentos',
    },
    {
      id: 'producao',
      label: 'Produção & MES',
      icon: <Factory size={16} />,
      color: 'hsl(35, 85%, 45%)',
      description: 'Chão de fábrica, rotas, lead times e status',
    },
    {
      id: 'estoque',
      label: 'Estoque & Kardex',
      icon: <Package size={16} />,
      color: 'hsl(190, 85%, 35%)',
      description: 'Posição física, CMP e itens críticos',
    },
    {
      id: 'financeiro',
      label: 'Financeiro & DRE',
      icon: <DollarSign size={16} />,
      color: 'hsl(263, 75%, 50%)',
      description: 'DRE contábil e Aging List de inadimplência',
      adminOnly: true,
    },
  ];

  return (
    <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Header Principal Hero */}
      <div 
        className="glass-panel" 
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--primary))' }}>
            <BarChart3 size={15} />
            <span>Inteligência Gerencial & BI • LeoÓtica 2.0</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.6px', margin: '2px 0 0 0' }}>
            Central de Relatórios & BI
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'hsl(var(--text-secondary))', margin: '2px 0 0 0', maxWidth: '850px' }}>
            Extração analítica com filtros avançados, indicadores consolidados de chão de fábrica, posição valorizada de estoque pelo CMP, ranking de vendas e DRE contábil com exportação em PDF e Excel (.xlsx).
          </p>
        </div>

        {/* Abas de Navegação Principal */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            paddingTop: '18px'
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: isActive ? `2px solid ${tab.color}` : '1px solid rgba(226, 232, 240, 0.9)',
                  background: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(248, 250, 252, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 14px rgba(0, 0, 0, 0.06)' : 'none',
                  transform: isActive ? 'translateY(-2px)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', color: isActive ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))' }}>
                    <span style={{ color: tab.color }}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </div>
                  {tab.adminOnly && (
                    <span 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: 'hsl(35, 85%, 40%)',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <Lock size={10} /> Admin
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tab.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div style={{ width: '100%' }}>
        {activeTab === 'producao' && <TabProducao currentUser={currentUser} />}
        {activeTab === 'estoque' && <TabEstoque currentUser={currentUser} />}
        {activeTab === 'comercial' && <TabComercial currentUser={currentUser} />}
        {activeTab === 'financeiro' && <TabFinanceiro currentUser={currentUser} />}
      </div>
    </div>
  );
}
