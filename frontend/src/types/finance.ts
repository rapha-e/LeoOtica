export type TransactionStatus = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';

export type OpticalExpenseCategory =
  | 'FORNECEDOR_BLOCOS_LENTES'
  | 'INSUMOS_LABORATORIO'
  | 'MAQUINARIO_MANUTENCAO'
  | 'FORNECEDOR_ARMACOES'
  | 'SALARIOS_LABORATORIO'
  | 'IMPOSTOS_TRIBUTOS'
  | 'FINANCIAMENTOS'
  | 'DESPESAS_OPERACIONAIS'
  | 'DIRETORIA_PROLABORE';

export interface CompanyTenant {
  id?: string;
  name?: string;
  asaasApiKey?: string;
  asaasEnvironment?: 'sandbox' | 'production';
}

export interface FinancialTransaction {
  id: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  entityName: string;
  entityDocument: string;
  documentNumber: string;
  dueDate: string;
  amount: number;
  status: TransactionStatus;
  description: string;
  category?: OpticalExpenseCategory | string;
  asaasPaymentId?: string;
  asaasStatus?: string;
  asaasInvoiceUrl?: string;
  asaasBankSlipUrl?: string;
  asaasBarCode?: string;
  asaasDigitableLine?: string;
  asaasPixQrCode?: string;
  asaasPixCopyPaste?: string;
  createdAt?: string;
  paidAt?: string;
}
