import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { DollarSign, TrendingUp, TrendingDown, Layers, Users, FileText, RefreshCw, BarChart3, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';

export default function DashboardDRE() {
  const [dreData, setDreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDRE = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/finance-corp/dre');
      setDreData(res.data);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar os dados da DRE Consolidada.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDRE();
  }, []);

  const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
        <p style={{ color: 'white', fontWeight: 700 }}>Calculando Demonstração do Resultado do Exercício (DRE)...</p>
      </div>
    );
  }

  if (error || !dreData) {
    return (
      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
        <p>{error || "Erro de carregamento."}</p>
        <button onClick={fetchDRE} className="btn btn-primary" style={{ marginTop: '10px' }}>Tentar Novamente</button>
      </div>
    );
  }

  const isProfit = dreData.net_profit >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Cabeçalho */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '1.4rem' }}>
            <BarChart3 size={28} style={{ color: 'hsl(var(--primary))' }} />
            DRE Consolidado - Demonstração do Resultado do Exercício
          </h1>
          <p className="page-subtitle" style={{ margin: 0, marginTop: '4px' }}>
            Faturamento Bruto - CMV Real (Estoque) - Despesas - Folha = Lucro Líquido Real
          </p>
        </div>
        <button onClick={fetchDRE} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', border: '1px solid var(--border-glass)' }}>
          <RefreshCw size={16} /> Atualizar DRE
        </button>
      </div>

      {/* CARDS DE RESUMO DE ALTO NÍVEL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Faturamento Bruto */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #38bdf8' }}>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>Faturamento Bruto</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>
            {formatMoney(dreData.gross_revenue)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <ArrowUpRight size={14} /> Receitas de Faturas
          </span>
        </div>

        {/* CMV Real */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>CMV Real (Estoque)</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b', marginTop: '6px' }}>
            {formatMoney(dreData.cmv_real)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <ArrowDownRight size={14} /> Custo de Lentes/Blocos (CMP)
          </span>
        </div>

        {/* Margem Bruta */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #a855f7' }}>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>Margem Bruta</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#a855f7', marginTop: '6px' }}>
            {formatMoney(dreData.gross_margin)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: '4px', display: 'block' }}>
            Receita - CMV
          </span>
        </div>

        {/* Lucro Líquido */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: `4px solid ${isProfit ? '#22c55e' : '#ef4444'}` }}>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>Lucro Líquido</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: isProfit ? '#22c55e' : '#ef4444', marginTop: '6px' }}>
            {formatMoney(dreData.net_profit)}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isProfit ? '#22c55e' : '#ef4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />} Margem Líquida: {dreData.net_margin_pct}%
          </span>
        </div>
      </div>

      {/* TABELA DE ESTRUTURA DETALHADA DA DRE */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ color: 'white', fontSize: '1.1rem', marginTop: 0, marginBottom: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} className="text-secondary" /> Demonstrativo de Resultado Estruturado
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', color: 'hsl(var(--text-secondary))' }}>
                <th style={{ padding: '12px 16px' }}>Linha da DRE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor (R$)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>% em Relação ao Faturamento</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', fontWeight: 800, color: '#38bdf8' }}>
                <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={16} /> (+) Faturamento Bruto de Vendas & Serviços
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(dreData.gross_revenue)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>100.00%</td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: '#f59e0b' }}>
                <td style={{ padding: '12px 16px', paddingLeft: '32px' }}>
                  (-) CMV Real (Custo Médio Ponderado das Lentes/Blocos Baixados)
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>- {formatMoney(dreData.cmv_real)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {dreData.gross_revenue > 0 ? ((dreData.cmv_real / dreData.gross_revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-glass)', fontWeight: 800, background: 'rgba(168, 85, 247, 0.08)', color: '#a855f7' }}>
                <td style={{ padding: '12px 16px' }}>
                  (=) MARGEM BRUTA
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(dreData.gross_margin)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {dreData.gross_revenue > 0 ? ((dreData.gross_margin / dreData.gross_revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: '#ec4899' }}>
                <td style={{ padding: '12px 16px', paddingLeft: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} /> (-) Folha de Pagamento & Salários
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>- {formatMoney(dreData.payroll)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {dreData.gross_revenue > 0 ? ((dreData.payroll / dreData.gross_revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: '#f43f5e' }}>
                <td style={{ padding: '12px 16px', paddingLeft: '32px' }}>
                  (-) Outras Despesas Operacionais & Fornecedores
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>- {formatMoney(dreData.other_expenses)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {dreData.gross_revenue > 0 ? ((dreData.other_expenses / dreData.gross_revenue) * 100).toFixed(2) : '0.00'}%
                </td>
              </tr>

              <tr style={{ fontWeight: 900, fontSize: '1.05rem', background: isProfit ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isProfit ? '#22c55e' : '#ef4444' }}>
                <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} /> (=) LUCRO LÍQUIDO DO EXERCÍCIO
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatMoney(dreData.net_profit)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>{dreData.net_margin_pct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
