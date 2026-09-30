/**
 * Utilitários de Máscaras e Formatações para Formulários (Brasil)
 */

// Limpa tudo que não for dígito numérico
export const cleanDigits = (val) => {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
};

// Máscara de CNPJ: 00.000.000/0000-00
export const maskCNPJ = (val) => {
  if (!val) return '';
  const clean = cleanDigits(val).substring(0, 14);
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/\/(\d{4})(\d)/, '/$1-$2');
};

// Máscara de CPF: 000.000.000-00
export const maskCPF = (val) => {
  if (!val) return '';
  const clean = cleanDigits(val).substring(0, 11);
  return clean
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

// Máscara Híbrida de CPF ou CNPJ
export const maskCpfCnpj = (val) => {
  if (!val) return '';
  const clean = cleanDigits(val);
  if (clean.length <= 11) {
    return maskCPF(clean);
  }
  return maskCNPJ(clean);
};

// Máscara de Telefone / Celular: (00) 0000-0000 ou (00) 00000-0000
export const maskPhone = (val) => {
  if (!val) return '';
  const clean = cleanDigits(val).substring(0, 11);
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return clean
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

// Máscara de CEP: 00000-000
export const maskCEP = (val) => {
  if (!val) return '';
  const clean = cleanDigits(val).substring(0, 8);
  return clean.replace(/^(\d{5})(\d)/, '$1-$2');
};

// Máscara de Inscrição Estadual:
// Permite dígitos (até 14 dígitos numéricos padrão SEFAZ) ou 'ISENTO'
export const maskIE = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.toUpperCase() === 'ISENTO' || str.toUpperCase().startsWith('ISE')) {
    return 'ISENTO';
  }
  return cleanDigits(str).substring(0, 14);
};

// Máscara Monetária para Inputs (ex: R$ 1.250,50)
export const maskCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const clean = cleanDigits(val);
  if (!clean) return '';
  const number = Number(clean) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(number);
};

// Remove máscara retornando apenas números
export const unmask = cleanDigits;

export default {
  cleanDigits,
  maskCNPJ,
  maskCPF,
  maskCpfCnpj,
  maskPhone,
  maskCEP,
  maskIE,
  maskCurrency,
  unmask
};
