import React, { useState, useMemo } from 'react';
import { FinancialTransaction, TransactionStatus, OpticalExpenseCategory } from '../types/finance';
import { 
  Search, Plus, CheckCircle2, Calendar, 
  Filter, ArrowDownRight, Tag
} from 'lucide-react';

interface AccountsPayableProps {
  transactions: FinancialTransaction[];
  onOpenNewModal: () => void;
  onSettleTransaction: (id: string) => void;
}

const CATEGORY_LABELS: Record<OpticalExpenseCategory, string> = {
  FORNECEDOR_BLOCOS_LENTES: 'Blocos & Lentes',
  INSUMOS_LABORATORIO: 'Insumos de Polimento & AR',
  MAQUINARIO_MANUTENCAO: 'Manutenção de Máquinas',
  FORNECEDOR_ARMACOES: 'Armações & Receituários',
  SALARIOS_LABORATORIO: 'Salários & Operacional',
  IMPOSTOS_TRIBUTOS: 'Impostos & Tributos',
  FINANCIAMENTOS: 'Financiamentos',
  DESPESAS_OPERACIONAIS: 'Despesas Gerais',
  DIRETORIA_PROLABORE: 'Pró-Labore'
};

export const AccountsPayable: React.FC<AccountsPayableProps> = ({
  transactions,
  onOpenNewModal,
  onSettleTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => t.type === 'PAYABLE')
      .filter(t => {
        const entityName = t.entityName || '';
        const docNumber = t.documentNumber || '';
        const description = t.description || '';

        const matchesSearch = 
          entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          description.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'TODOS' || t.status === statusFilter;
        const matchesCategory = categoryFilter === 'TODAS' || t.category === categoryFilter;
        
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [transactions, searchTerm, statusFilter, categoryFilter]);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'PAGO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Pago</span>;
      case 'VENCIDO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Vencido</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">A Pagar</span>;
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowDownRight className="w-6 h-6 text-rose-600" />
            Contas a Pagar (Insumos & Operacional Fabril)
          </h2>
          <p className="text-sm text-slate-500">
            Fornecedores de blocos, abrasivos, manutenção técnica e custos fixos
          </p>
        </div>
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fornecedor, NF ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="VENCIDO">Vencidos</option>
            <option value="PAGO">Pagos</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
          >
            <option value="TODAS">Todas as Categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 font-semibold">Fornecedor</th>
              <th className="py-3 px-4 font-semibold">Categoria</th>
              <th className="py-3 px-4 font-semibold">NF / Doc</th>
              <th className="py-3 px-4 font-semibold">Vencimento</th>
              <th className="py-3 px-4 font-semibold">Valor</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Nenhum título a pagar encontrado.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{tx.entityName}</div>
                    <div className="text-xs text-slate-500">{tx.description}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {tx.category ? (CATEGORY_LABELS[tx.category as OpticalExpenseCategory] || tx.category) : 'Geral'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                    {tx.documentNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(tx.dueDate).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-600">
                    {formatMoney(tx.amount)}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tx.status !== 'PAGO' ? (
                      <button
                        onClick={() => onSettleTransaction(tx.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pagar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Liquidado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AccountsPayable;
