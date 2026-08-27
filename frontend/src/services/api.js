import axios from 'axios';

// Infere o IP do servidor baseado no acesso do browser do smartphone
const getBaseUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8000/api/v1`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Interceptor de Request: injeta o token JWT automaticamente ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('factory_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Interceptor de Response: tratamento global de erros ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    if (status === 401) {
      // Token expirado ou inválido — limpa sessão e redireciona para login
      console.warn('[API] Sessão expirada ou inválida. Redirecionando para login.');
      localStorage.removeItem('factory_token');
      localStorage.removeItem('factory_user_role');
      localStorage.removeItem('factory_user_name');
      // Dispara evento para que o App.jsx reaja sem importação circular
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: detail || 'Sessão expirada' } }));
    } else if (status === 403) {
      console.warn('[API] Acesso negado:', detail || 'Permissão insuficiente');
    } else if (status >= 500) {
      console.error('[API] Erro interno do servidor:', status, detail);
    }

    return Promise.reject(error);
  }
);

// Helper para logout explícito (chamado pelo botão de sair)
export const logout = () => {
  localStorage.removeItem('factory_token');
  localStorage.removeItem('factory_user_role');
  localStorage.removeItem('factory_user_name');
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'logout_manual' } }));
};


export const LensService = {
  getModels: () => api.get('/lens-models/'),
  createModel: (data) => api.post('/lens-models/', data),
  getModel: (id) => api.get(`/lens-models/${id}`),
  updateModel: (id, data) => api.put(`/lens-models/${id}`, data),
  deleteModel: (id) => api.delete(`/lens-models/${id}`),
  getPresets: () => api.get('/lens-models/presets'),
  saveDegreePolicy: (data) => api.post('/degree-policy/range', data),
};

export const BlockService = {
  getModels: (activeOnly = false) => api.get(`/blocks/models${activeOnly ? '?active_only=true' : ''}`),
  createModel: (data) => api.post('/blocks/models', data),
  updateModel: (id, data) => api.put(`/blocks/models/${id}`, data),
  deleteModel: (id) => api.delete(`/blocks/models/${id}`),
  getGrid: (modelId) => api.get(`/blocks/grid/${modelId}`),
  updateGridItem: (itemId, data) => api.put(`/blocks/grid-item/${itemId}`, data),
  bipIncrement: (barcode, quantity = 1) => api.post('/blocks/bip-increment', { barcode, quantity }),
};

export const InventoryService = {
  getGrid: (modelId, matrixType) => {
    const params = new URLSearchParams();
    if (modelId) params.append('lens_model_id', modelId);
    if (matrixType) params.append('matrix_type', matrixType);
    const queryString = params.toString();
    const url = queryString ? `/inventory/grid?${queryString}` : '/inventory/grid';
    return api.get(url);
  },
  scan: (data, quantity = 1) => {
    let payload = {};
    if (typeof data === 'string') {
      const q = parseInt(quantity, 10) || 1;
      payload = { barcode: data, quantity: q, quantity_available: q };
    } else if (typeof data === 'object' && data !== null) {
      const q = parseInt(data.quantity || data.quantity_available || quantity, 10) || 1;
      payload = { ...data, quantity: q, quantity_available: q };
    } else {
      payload = { barcode: String(data), quantity: 1, quantity_available: 1 };
    }
    return api.post('/inventory/scan', payload);
  },
  registerFallback: (data) => api.post('/inventory/register-fallback', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  deleteItem: (id) => api.delete(`/inventory/${id}`),
};





export const MovementService = {
  getMovements: (skip = 0, limit = 100) => api.get(`/movements/?skip=${skip}&limit=${limit}`),
  reserve: (data) => api.post('/movements/reserve', data),
};

export const NfeService = {
  importXml: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/nfe/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const AlertService = {
  getPredictions: (leadTime = 7, safety = 5, coverage = 15) => 
    api.get(`/alerts/predictive?lead_time_days=${leadTime}&safety_days=${safety}&coverage_days=${coverage}`),
  getExportUrl: (leadTime = 7, safety = 5, coverage = 15) => 
    `${getBaseUrl()}/alerts/export-purchases?lead_time_days=${leadTime}&safety_days=${safety}&coverage_days=${coverage}`,
  getExportPdfUrl: (leadTime = 7, safety = 5, coverage = 15) => 
    `${getBaseUrl()}/alerts/export-pdf?lead_time_days=${leadTime}&safety_days=${safety}&coverage_days=${coverage}`,
  exportPdf: (leadTime = 7, safety = 5, coverage = 15) =>
    api.get(`/alerts/export-pdf?lead_time_days=${leadTime}&safety_days=${safety}&coverage_days=${coverage}`, { responseType: 'blob' }),
};

export const AdminPartnerService = {
  listPartners: (skip = 0, limit = 100) => api.get(`/admin/partners/?skip=${skip}&limit=${limit}`),
  getPartner: (id) => api.get(`/admin/partners/${id}`),
  createPartner: (data) => api.post('/admin/partners/', data),
  updatePartner: (id, data) => api.put(`/admin/partners/${id}`, data),
  deletePartner: (id) => api.delete(`/admin/partners/${id}`),
  listKeys: (partnerId) => api.get(`/admin/partners/${partnerId}/keys`),
  generateKey: (partnerId, expiresInDays = null) => {
    const url = expiresInDays 
      ? `/admin/partners/${partnerId}/keys?expires_in_days=${expiresInDays}` 
      : `/admin/partners/${partnerId}/keys`;
    return api.post(url);
  },
  revokeKey: (partnerId, keyId) => api.delete(`/admin/partners/${partnerId}/keys/${keyId}`),
};

export const OpticalStoreService = {
  list: (query = '', isActive = null, skip = 0, limit = 100) => {
    let url = `/optical-stores/?skip=${skip}&limit=${limit}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (isActive !== null) url += `&is_active=${isActive}`;
    return api.get(url);
  },
  get: (id) => api.get(`/optical-stores/${id}`),
  create: (data) => api.post('/optical-stores/', data),
  update: (id, data) => api.put(`/optical-stores/${id}`, data),
  delete: (id) => api.delete(`/optical-stores/${id}`),
  export: (query = '', isActive = null) => {
    let url = `/optical-stores/export?`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (isActive !== null) url += `&is_active=${isActive}`;
    return api.get(url, { responseType: 'blob' });
  }
};

export const ProductService = {
  list: (query = '', isActive = null, skip = 0, limit = 100) => {
    let url = `/catalog/products/?skip=${skip}&limit=${limit}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (isActive !== null) url += `&is_active=${isActive}`;
    return api.get(url);
  },
  get: (id) => api.get(`/catalog/products/${id}`),
  create: (data) => api.post('/catalog/products/', data),
  update: (id, data) => api.put(`/catalog/products/${id}`, data),
  delete: (id) => api.delete(`/catalog/products/${id}`),
  getPriceHistory: (id) => api.get(`/catalog/products/${id}/price-history`),
};

export const TreatmentService = {
  list: (query = '', isActive = null, skip = 0, limit = 100) => {
    let url = `/catalog/treatments/?skip=${skip}&limit=${limit}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (isActive !== null) url += `&is_active=${isActive}`;
    return api.get(url);
  },
  get: (id) => api.get(`/catalog/treatments/${id}`),
  create: (data) => api.post('/catalog/treatments/', data),
  update: (id, data) => api.put(`/catalog/treatments/${id}`, data),
  delete: (id) => api.delete(`/catalog/treatments/${id}`),
  getPriceHistory: (id) => api.get(`/catalog/treatments/${id}/price-history`),
};

export const TechnicalServiceService = {
  list: (query = '', isActive = null, skip = 0, limit = 100) => {
    let url = `/catalog/technical-services/?skip=${skip}&limit=${limit}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (isActive !== null) url += `&is_active=${isActive}`;
    return api.get(url);
  },
  get: (id) => api.get(`/catalog/technical-services/${id}`),
  create: (data) => api.post('/catalog/technical-services/', data),
  update: (id, data) => api.put(`/catalog/technical-services/${id}`, data),
  delete: (id) => api.delete(`/catalog/technical-services/${id}`),
  getPriceHistory: (id) => api.get(`/catalog/technical-services/${id}/price-history`),
};

export const CustomerPriceService = {
  listTables: (storeId = null) => {
    const url = storeId ? `/price-tables/?optical_store_id=${storeId}` : '/price-tables/';
    return api.get(url);
  },
  getTable: (id) => api.get(`/price-tables/${id}`),
  createTable: (data) => api.post('/price-tables/', data),
  updateTable: (id, data) => api.put(`/price-tables/${id}`, data),
  deleteTable: (id) => api.delete(`/price-tables/${id}`) ,
  listItems: (tableId) => api.get(`/price-tables/${tableId}/items/`),
  createItem: (tableId, data) => api.post(`/price-tables/${tableId}/items/`, data),
  updateItem: (tableId, itemId, data) => api.put(`/price-tables/${tableId}/items/${itemId}`, data),
  deleteItem: (tableId, itemId) => api.delete(`/price-tables/${tableId}/items/${itemId}`),
  calculatePrice: (opticalStoreId, entityType, entityId) => 
    api.post('/price-tables/calculate', {
      optical_store_id: opticalStoreId,
      entity_type: entityType,
      entity_id: entityId
    }),
};

export const OSService = {
  list: (status = null, query = '', semanticQuery = '', skip = 0, limit = 100) => {
    let url = `/os/?skip=${skip}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (semanticQuery) url += `&semantic_query=${encodeURIComponent(semanticQuery)}`;
    return api.get(url);
  },
  get: (id) => api.get(`/os/${id}`),
  create: (data) => api.post('/os/', data),
  update: (id, data) => api.put(`/os/${id}`, data),
  cancel: (id, cancellationReason) => api.post(`/os/${id}/cancel`, { cancellation_reason: cancellationReason }),
  uploadReceita: (file, opticalStoreId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = opticalStoreId ? `/os/upload-receita?optical_store_id=${opticalStoreId}` : '/os/upload-receita';
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  allocateLenses: (id, data) => api.post(`/os/${id}/allocate`, data),
  updateStatus: (id, status, notes = '') => 
    api.post(`/os/${id}/status`, { status, operator_notes: notes }),
  reprocess: (id, notes) => 
    api.post(`/os/${id}/reprocess`, { operator_notes: notes }),
  getDashboardKpis: () => api.get('/os/dashboard/kpis'),
  addItem: (osId, entityType, entityId, quantity = 1, overridePrice = null, priceOverrideReason = null) => 
    api.post(`/os/${osId}/items/`, { 
      entity_type: entityType, 
      entity_id: entityId, 
      quantity,
      override_price: overridePrice,
      price_override_reason: priceOverrideReason
    }),
  removeItem: (osId, itemId) => api.delete(`/os/${osId}/items/${itemId}`),
  registerCQ: (osId, cqData) => api.post(`/os/${osId}/cq`, cqData),
};



export const BillingService = {
  getPendingGroups: () => api.get('/billing/pending'),
  getPendingOrdersByStore: (storeId) => api.get(`/billing/pending/${storeId}`),
  createCycle: (data) => api.post('/billing/', data),
  payCycle: (cycleId) => api.post(`/billing/${cycleId}/pay`),
  getCycle: (cycleId) => api.get(`/billing/${cycleId}`),
  listCycles: (opticalStoreId = null) => {
    let url = '/billing/';
    if (opticalStoreId) {
      url += `?optical_store_id=${opticalStoreId}`;
    }
    return api.get(url);
  },
  exportPdf: (cycleId) => api.get(`/billing/${cycleId}/export-pdf`, { responseType: 'blob' }),
  exportExcel: (cycleId) => api.get(`/billing/${cycleId}/export-excel`, { responseType: 'blob' }),
  getBillingKpis: () => api.get('/billing/kpis'),
  emitNfe: (cycleId) => api.post(`/billing/${cycleId}/nfe`),
  cancelNfe: (cycleId) => api.post(`/billing/${cycleId}/nfe/cancel`),
  getNfeXml: (cycleId) => api.get(`/billing/${cycleId}/nfe/xml`, { responseType: 'blob' }),
  getNfeDanfe: (cycleId) => api.get(`/billing/${cycleId}/nfe/danfe`, { responseType: 'blob' }),
};



export const UserService = {
  list: (query = '', skip = 0, limit = 100) => {
    let url = `/admin/users/?skip=${skip}&limit=${limit}`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    return api.get(url);
  },
  get: (id) => api.get(`/admin/users/${id}`),
  create: (data) => api.post('/admin/users/', data),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  delete: (id) => api.delete(`/admin/users/${id}`),
  listRoles: () => api.get('/admin/users/roles'),
};

export const AnalyticsService = {
  getDashboardAnalytics: () => api.get('/analytics/dashboard'),
  askAssistant: (message) => api.post('/analytics/assistant', { message }),
};




export const CRMService = {
  getPipeline: () => api.get('/crm/pipeline'),
  updateStage: (storeId, pipelineStage) => api.put(`/crm/stores/${storeId}/stage`, { pipeline_stage: pipelineStage }),
  updateCrmDetails: (storeId, data) => api.put(`/crm/stores/${storeId}/crm-details`, data),
  scheduleNext: (storeId, nextContactDate, nextContactType, nextContactNotes) =>
    api.post(`/crm/stores/${storeId}/schedule-next`, {
      next_contact_date: nextContactDate,
      next_contact_type: nextContactType,
      next_contact_notes: nextContactNotes
    }),
  addInteraction: (storeId, interactionType, summary) =>
    api.post(`/crm/stores/${storeId}/interactions`, { interaction_type: interactionType, summary }),
  get360View: (storeId) => api.get(`/crm/stores/${storeId}/360`),
  uploadDocument: (storeId, documentType, notes, contractExpiration, file) => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    if (notes) formData.append('notes', notes);
    if (contractExpiration) formData.append('contract_expiration', contractExpiration);
    formData.append('file', file);
    return api.post(`/crm/stores/${storeId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  listDocuments: (storeId) => api.get(`/crm/stores/${storeId}/documents`),
  deleteDocument: (storeId, docId) => api.delete(`/crm/stores/${storeId}/documents/${docId}`),
  getRankingAndEvolution: () => api.get('/crm/ranking-evolution'),
};

export const DegreePolicyService = {
  getPolicy: () => api.get('/degree-policy/'),
  savePolicy: (policyData, cascadeUpdate = false) => api.post(`/degree-policy/?cascade_update=${cascadeUpdate}`, policyData),
};

export const ReportService = {
  getProductionAnalytic: (params = {}) => api.get('/reports/production/analytic', { params }),
  getInventoryKardex: (params = {}) => api.get('/reports/inventory/kardex', { params }),
  getCommercialRanking: (params = {}) => api.get('/reports/commercial/ranking', { params }),
  getFinancialDRE: (params = {}) => api.get('/reports/financial/dre', { params }),
  getFinancialAging: (params = {}) => api.get('/reports/financial/aging', { params }),
  exportPdf: (params = {}) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
  exportExcel: (params = {}) => api.get('/reports/export/excel', { params, responseType: 'blob' }),
};

export default api;





