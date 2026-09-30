import React, { useState } from 'react';
import { FinancialTransaction, CompanyTenant } from '../types/finance';
import { AsaasService } from '../services/asaasService';
import { X, QrCode, FileText, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';

interface AsaasModalProps {
  transaction: FinancialTransaction;
  tenant: CompanyTenant;
  onClose: () => void;
  onSuccess: (updatedTx: FinancialTransaction) => void;
}

export const AsaasBoletoModal: React.FC<AsaasModalProps> = ({
  transaction,
  tenant,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!tenant.asaasApiKey) {
      setError('Chave de API do Asaas não configurada para esta empresa.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const asaas = new AsaasService(tenant.asaasApiKey, tenant.asaasEnvironment || 'sandbox');

      // 1. Cadastra ou busca a Ótica
      const customer = await asaas.findOrCreateCustomer({
        name: transaction.entityName,
        cpfCnpj: transaction.entityDocument
      });

      // 2. Emite a Cobrança Híbrida (Boleto + Pix)
      const payment = await asaas.createPayment({
        customerId: customer.id,
        billingType: 'UNDEFINED', // Permite que a ótica escolha Boleto ou Pix
        value: transaction.amount,
        dueDate: transaction.dueDate,
        description: `OS/NF ${transaction.documentNumber} - ${transaction.description || ''}`
      });

      const updated: FinancialTransaction = {
        ...transaction,
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl,
        asaasBankSlipUrl: payment.bankSlipUrl,
        asaasBarCode: payment.barCode,
        asaasDigitableLine: payment.digitableLine,
        asaasPixQrCode: payment.pixQrCode,
        asaasPixCopyPaste: payment.pixCopyPaste,
        asaasStatus: payment.status
      };

      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Falha ao emitir cobrança no Asaas');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'pix' | 'line') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'pix') {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } else {
      setCopiedLine(true);
      setTimeout(() => setCopiedLine(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            Cobrança Asaas (Boleto & Pix)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Ótica Cliente:</span>
              <span className="font-semibold text-slate-800">{transaction.entityName}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Documento / NF:</span>
              <span className="font-mono text-slate-700">{transaction.documentNumber}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Valor Total:</span>
              <span className="font-bold text-emerald-600">
                {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              {error}
            </div>
          )}

          {!transaction.asaasPaymentId ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-4">
                Deseja gerar a cobrança oficial no Asaas com Pix dinâmico e Boleto bancário para esta ordem de serviço?
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm flex justify-center items-center gap-2 transition"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Emitindo no Asaas...' : 'Emitir Boleto & Pix'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Code Pix */}
              {transaction.asaasPixQrCode && (
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <img
                    src={transaction.asaasPixQrCode.startsWith('data:') ? transaction.asaasPixQrCode : `data:image/png;base64,${transaction.asaasPixQrCode}`}
                    alt="QR Code Pix"
                    className="w-44 h-44 rounded-lg shadow-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(transaction.asaasPixCopyPaste || '', 'pix')}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {copiedPix ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copiedPix ? 'Chave Pix Copiada!' : 'Copiar Chave Copia e Cola'}
                  </button>
                </div>
              )}

              {/* Linha Digitável do Boleto */}
              {transaction.asaasDigitableLine && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-400 block mb-1">Linha Digitável:</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-700 break-all">
                      {transaction.asaasDigitableLine}
                    </span>
                    <button
                      onClick={() => copyToClipboard(transaction.asaasDigitableLine || '', 'line')}
                      className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                      title="Copiar linha digitável"
                    >
                      {copiedLine ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Links Externos */}
              <div className="flex gap-2">
                {transaction.asaasBankSlipUrl && (
                  <a
                    href={transaction.asaasBankSlipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 text-center text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF do Boleto
                  </a>
                )}
                {transaction.asaasInvoiceUrl && (
                  <a
                    href={transaction.asaasInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 text-center text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Fatura Web
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AsaasBoletoModal;
