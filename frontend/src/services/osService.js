import api from './api';

export const formatApiError = (error, fallback = 'Erro na operação.') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const detail = error.response?.data?.detail || error.detail || error.message;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        if (typeof item === 'string') return item;
        if (item.msg) return item.msg.replace(/^Value error,\s*/, '');
        return JSON.stringify(item);
      })
      .join(' | ');
  }

  if (typeof detail === 'object' && detail !== null) {
    if (detail.msg) return detail.msg.replace(/^Value error,\s*/, '');
    return JSON.stringify(detail);
  }

  return fallback;
};

export const osService = {
  /**
   * Envia os dados estruturados do formulário de OS de fábrica
   * @param {Object} osData - Payload no formato OSCreateFactorySchema
   */
  registerFactoryOS: async (osData) => {
    try {
      const response = await api.post('/os/factory/register', {
        optical_store_id: osData.opticalStoreId,
        client_order_number: osData.clientOrderNumber,
        tray_number: osData.trayNumber,
        priority: osData.priority || 'NORMAL',
        os_type: osData.osType || 'PADRAO',
        od_prescription: osData.od ? {
          spherical: parseFloat(osData.od.spherical || 0),
          cylindrical: parseFloat(osData.od.cylindrical || 0),
          axis: parseInt(osData.od.axis || 0),
          addition: parseFloat(osData.od.addition || 0),
          prism_value: parseFloat(osData.od.prismValue || 0),
          prism_base: osData.od.prismBase || null,
          dnp: parseFloat(osData.od.dnp || 0),
          height: parseFloat(osData.od.height || 0)
        } : null,
        oe_prescription: osData.oe ? {
          spherical: parseFloat(osData.oe.spherical || 0),
          cylindrical: parseFloat(osData.oe.cylindrical || 0),
          axis: parseInt(osData.oe.axis || 0),
          addition: parseFloat(osData.oe.addition || 0),
          prism_value: parseFloat(osData.oe.prismValue || 0),
          prism_base: osData.oe.prismBase || null,
          dnp: parseFloat(osData.oe.dnp || 0),
          height: parseFloat(osData.oe.height || 0)
        } : null,
        frame_geometry: (osData.osType !== 'REPARO_SERVICO' && osData.frame) ? {
          frame_a: parseFloat(osData.frame.a || 0),
          frame_b: parseFloat(osData.frame.b || 0),
          frame_bridge: parseFloat(osData.frame.bridge || 0),
          frame_ed: parseFloat(osData.frame.ed || 0),
          frame_type: osData.frame.type || 'ACETATO',
          bevel_type: osData.frame.bevelType || 'AUTOMATICO'
        } : null,
        lens_model_id: osData.lensModelId,
        additional_services: (osData.additionalServices || []).map(s => ({
          service_id: s.id || s.service_id,
          name: s.name,
          price: parseFloat(s.price || 0)
        })),
        manual_price_override: osData.manualPrice ? parseFloat(osData.manualPrice) : null,
        price_override_reason: osData.priceOverrideReason || null,
        special_instructions: osData.specialInstructions || null
      });
      return response.data;
    } catch (error) {
      throw formatApiError(error, 'Erro ao registrar Ordem de Serviço na fábrica.');
    }
  }
};
