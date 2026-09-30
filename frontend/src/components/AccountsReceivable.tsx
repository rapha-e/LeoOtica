import React, { useState, useMemo } from 'react';
import { FinancialTransaction, TransactionStatus } from '../types/finance';
import { 
  Search, Plus, QrCode, CheckCircle2, AlertCircle, 
  Calendar, ExternalLink, Filter, ArrowUpRight
} from 'lucide-react';

interface AccountsReceivableProps {
  transactions: FinancialTransaction[];
  onOpenNewModal: () => void;
  onOpenAsaasModal: (transaction: FinancialTransaction) => void;
  onSettleTransaction: (id: string) => void;
}

export const AccountsReceivable: React.FC<AccountsReceivableProps> = ({
  transactions,
  onOpenNewModal,
  onOpenAsaasModal,
  onSettleTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => t.type === 'RECEIVABLE')
      .filter(t => {
        const entityName = t.entityName || '';
        const docNumber = t.documentNumber || '';
        const entityDoc = t.entityDocument || '';

        const matchesSearch = 
          entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entityDoc.includes(searchTerm);
        
        const matchesStatus = statusFilter === 'TODOS' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [transactions, searchTerm, statusFilter]);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'PAGO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Liquidado</span>;
      case 'VENCIDO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Vencido</span>;
      case 'CANCELADO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Cancelado</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pendente</span>;
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Cabeçalho e Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            Contas a Receber (Óticas Clientes)
          </h2>
          <p className="text-sm text-slate-500">
            Faturamento de ordens de serviço de surfaçagem, montagem e tratamentos AR
          </p>
        </div>
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Novo Faturamento
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ótica cliente, CNPJ ou Nº da OS/NF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="VENCIDO">Vencidos</option>
            <option value="PAGO">Liquidados</option>
          </select>
        </div>
      </div>

      {/* Tabela de Títulos */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 font-semibold">Ótica Cliente / CNPJ</th>
              <th className="py-3 px-4 font-semibold">OS / NF</th>
              <th className="py-3 px-4 font-semibold">Vencimento</th>
              <th className="py-3 px-4 font-semibold">Valor</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Cobrança Asaas</th>
              <th className="py-3 px-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Nenhum título a receber encontrado.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{tx.entityName}</div>
                    <div className="text-xs text-slate-400">{tx.entityDocument}</div>
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
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {formatMoney(tx.amount)}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="py-3 px-4">
                    {tx.asaasPaymentId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                          {tx.asaasStatus || 'EMITIDO'}
                        </span>
                        {tx.asaasInvoiceUrl && (
                          <a
                            href={tx.asaasInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-indigo-600"
                            title="Ver Fatura Asaas"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => onOpenAsaasModal(tx)}
                        disabled={tx.status === 'PAGO'}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Gerar Boleto/Pix
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tx.status !== 'PAGO' ? (
                      <button
                        onClick={() => onSettleTransaction(tx.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Baixar
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
export default AccountsReceivable;
