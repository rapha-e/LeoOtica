import QRCode from 'qrcode';

/**
 * Normaliza strings para o padrão EMVCo (sem acentos e caracteres especiais)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
}

/**
 * Formata um campo no padrão TLV (Type - Length - Value)
 */
function formatTLV(id, value) {
  if (value === undefined || value === null || value === '') return '';
  const strVal = String(value);
  const len = strVal.length.toString().padStart(2, '0');
  return `${id}${len}${strVal}`;
}

/**
 * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 */
function calculateCRC16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera o payload Pix BRCode estático compatível com Banco Central (BACEN / EMVCo)
 */
export function generatePixPayload({
  pixKey = '+5561992667281',
  merchantName = 'NOVA LAB OTICA',
  merchantCity = 'BRASILIA',
  amount = null,
  txid = '***',
  description = ''
}) {
  // Trata chave Pix (garante formato +55 para chave de telefone)
  let cleanKey = String(pixKey).trim();
  const digitsOnly = cleanKey.replace(/\D/g, '');
  if ((digitsOnly.length === 10 || digitsOnly.length === 11) && !cleanKey.startsWith('+')) {
    cleanKey = `+55${digitsOnly}`;
  } else {
    cleanKey = cleanKey.replace(/[^a-zA-Z0-9@+.-]/g, '');
  }

  const cleanMerchant = normalizeText(merchantName).substring(0, 25) || 'NOVA LAB OTICA';
  const cleanCity = normalizeText(merchantCity).substring(0, 15) || 'BRASILIA';
  const cleanTxid = String(txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  // 00: Payload Format Indicator
  let payload = formatTLV('00', '01');

  // 26: Merchant Account Information (GUI + Chave + Descrição opcional)
  let merchantAccountInfo = formatTLV('00', 'br.gov.bcb.pix');
  merchantAccountInfo += formatTLV('01', cleanKey);
  if (description) {
    merchantAccountInfo += formatTLV('02', normalizeText(description).substring(0, 40));
  }
  payload += formatTLV('26', merchantAccountInfo);

  // 52: Merchant Category Code
  payload += formatTLV('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += formatTLV('53', '986');

  // 54: Transaction Amount (opcional)
  if (amount && Number(amount) > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    payload += formatTLV('54', formattedAmount);
  }

  // 58: Country Code
  payload += formatTLV('58', 'BR');

  // 59: Merchant Name
  payload += formatTLV('59', cleanMerchant);

  // 60: Merchant City
  payload += formatTLV('60', cleanCity);

  // 62: Additional Data Field (TxID)
  const additionalData = formatTLV('05', cleanTxid);
  payload += formatTLV('62', additionalData);

  // 63: CRC16
  payload += '6304';
  const crc = calculateCRC16(payload);
  payload += crc;

  return payload;
}

/**
 * Gera Data URL em Base64 do QR Code para exibição em <img> ou Canvas
 */
export async function generatePixQrCodeDataUrl(payload, options = {}) {
  const defaultOpts = {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: options.width || 120,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    },
    ...options
  };

  try {
    return await QRCode.toDataURL(payload, defaultOpts);
  } catch (err) {
    console.error('Erro ao gerar QRCode do Pix:', err);
    return '';
  }
}
