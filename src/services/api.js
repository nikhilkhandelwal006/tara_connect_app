import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '3000'
    ? `http://${window.location.hostname}:5000/api`
    : 'https://app.taramed.in/api');


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  verifyRepPhone: (phone) => api.post('/auth/representative/verify-phone', { phone }),
  repSignup: (data) => api.post('/auth/representative/signup', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  getLinkedAccounts: () => api.get('/auth/linked-accounts'),
  switchAccount: (targetUserId) => api.post('/auth/switch-account', { targetUserId }),
  verifyResetDetails: (data) => api.post('/auth/verify-reset-details', data),
  resetPasswordDirect: (data) => api.post('/auth/reset-password-direct', data),
};

// Users
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  updateStatus: (id, data) => api.patch(`/users/${id}/status`, data),
  updateRole: (id, data) => api.patch(`/users/${id}/role`, data),
  updatePermissions: (id, permissions) => api.patch(`/users/${id}/permissions`, { permissions }),
  delete: (id) => api.delete(`/users/${id}`),
  // Send rows as JSON chunks — avoids multipart/form-data CORS preflight issues
  importMasterCustomer: (rows) => {
    const CHUNK_SIZE = 500;
    const chunks = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }
    // Send all chunks sequentially, return final result
    return chunks.reduce((promise, chunk, idx) =>
      promise.then(() =>
        api.post('/users/import-master-customer', { rows: chunk, chunkIndex: idx, totalChunks: chunks.length })
      ), Promise.resolve()
    );
  },
  resetBuyerPasswords: () => api.post('/users/reset-buyer-passwords'),
  block: (id, isBlocked) => api.patch(`/users/${id}/block`, { isBlocked }),
};

// Medicines
export const medicinesAPI = {
  getAll: (params) => api.get('/medicines', { params }),
  getOne: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  uploadItemMaster: (formData) => api.post('/medicines/import-item-master', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  importItemMasterChunk: (records) => api.post('/medicines/import-item-master-chunk', { records }),
  finalizeItemMaster: (codes) => api.post('/medicines/import-item-master-finalize', { codes }),
  getDiscontinued: () => api.get('/medicines/discontinued'),
};

// Orders
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getOne: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  getStats: () => api.get('/orders/stats/overview'),
};

// Outstanding
export const outstandingAPI = {
  getAll: (params) => api.get('/outstanding', { params }),
  getSummary: (params) => api.get('/outstanding/summary', { params }),
  getStats: () => api.get('/outstanding/stats'),
  getPrefixes: () => api.get('/outstanding/prefixes'),
  importDefault: () => api.post('/outstanding/import-default'),
  importFile: (formData) => api.post('/outstanding/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// Representatives
export const representativesAPI = {
  getAll: (params) => {
    return api.get('/representatives', { params });
  },
  importDefault: () => api.post('/representatives/import-default'),
  importFile: (formData, config = {}) => api.post('/representatives/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  createRep: (data) => api.post('/representatives/create', data),
  getSsCompaniesNotInReps: () => api.get('/representatives/ss-companies-not-in-reps'),
  deleteRep: (id) => api.delete(`/representatives/${id}`),
  toggleStatus: (id) => api.patch(`/representatives/${id}/toggle`),
  updatePhone: (id, phone, repName, phone2, password, email, force, companyName, ssDownloadLimit, cwDownloadLimit) => api.patch(`/representatives/${id}/phone`, { phone, repName, phone2, password, email, force, companyName, ssDownloadLimit, cwDownloadLimit }),
  uploadStock: (formData, config = {}) => api.post('/representatives/stock/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getStock: (params) => api.get('/representatives/stock', { params }),
  uploadStatement: (formData, config = {}) => api.post('/representatives/statement/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getUploadStatus: (jobId) => api.get(`/representatives/statement/upload/status/${jobId}`),
  uploadOldStatement: (formData, config = {}) => api.post('/representatives/statement/upload-old', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getHistoricalMonths: () => api.get('/representatives/statement/historical-months'),
  getStatementPeriods: () => api.get('/representatives/statement/available-periods'),
  archiveCurrentStatement: (data) => api.post('/representatives/statement/archive-current', data),
  getStatement: (params) => api.get('/representatives/statement', { params }),
  getStatementAll: (params) => api.get('/representatives/statement/download-all', { params }),
  emailStatement: (data) => api.post('/representatives/statement/email', data),
  uploadCustomerWise: (formData, config = {}) => api.post('/representatives/customer-wise/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  uploadOldCustomerWise: (formData, config = {}) => api.post('/representatives/customer-wise/upload-old', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getCWHistoricalMonths: () => api.get('/representatives/customer-wise/historical-months'),
  getCWPeriods: () => api.get('/representatives/customer-wise/available-periods'),
  uploadCustomerWiseChunk: (data) => api.post('/representatives/customer-wise/chunk', data),
  getCustomerWise: (params) => api.get('/representatives/customer-wise', { params }),
  getCustomerWiseAll: (params) => api.get('/representatives/customer-wise/download-all', { params }),
  toggleCustomerWisePermission: (id) => api.patch(`/representatives/toggle-customer-wise-permission/${id}`),
  togglePoPermission: (id) => api.patch(`/representatives/toggle-po-permission/${id}`),
  bulkPoPermission: (enable) => api.patch('/representatives/bulk-po-permission', { enable }),
  uploadPurchaseOrder: (formData, config = {}) => api.post('/representatives/purchase-order/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getPurchaseOrder: (params) => api.get('/representatives/purchase-order', { params }),
  getAvailableCompanies: (id) => api.get(`/representatives/${id}/available-companies`),
  addCompany: (id, mfacCode, mfacName) => api.patch(`/representatives/${id}/add-company`, { mfacCode, mfacName }),
  removeCompany: (id, mfacCode) => api.patch(`/representatives/${id}/remove-company`, { mfacCode }),
  getCWFieldPermissions: (mfacCode) => api.get('/representatives/customer-wise/field-permissions', { params: { mfacCode } }),
  updateCWFieldPermissions: (mfacCode, fields) => api.patch('/representatives/customer-wise/field-permissions', { mfacCode, fields }),
  getStats: () => api.get('/representatives/stats'),
  toggleBranchSsPermission: (id) => api.patch(`/representatives/toggle-branch-ss-permission/${id}`),
  toggleBranchCwPermission: (id) => api.patch(`/representatives/toggle-branch-cw-permission/${id}`),
  uploadBranchStatement: (formData, config = {}) => api.post('/representatives/branch-statement/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  uploadOldBranchStatement: (formData, config = {}) => api.post('/representatives/branch-statement/upload-old', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getBranchStatementPeriods: () => api.get('/representatives/branch-statement/available-periods'),
  getBranchStatement: (params) => api.get('/representatives/branch-statement', { params }),
  getBranchStatementAll: (params) => api.get('/representatives/branch-statement/download-all', { params }),
  uploadBranchCustomerWise: (formData, config = {}) => api.post('/representatives/branch-customer-wise/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  uploadOldBranchCustomerWise: (formData, config = {}) => api.post('/representatives/branch-customer-wise/upload-old', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  uploadBranchCustomerWiseChunk: (data) => api.post('/representatives/branch-customer-wise/chunk', data),
  getBranchCWPeriods: () => api.get('/representatives/branch-customer-wise/available-periods'),
  getBranchCustomerWise: (params) => api.get('/representatives/branch-customer-wise', { params }),
  getBranchCustomerWiseAll: (params) => api.get('/representatives/branch-customer-wise/download-all', { params }),
};

export default api;
