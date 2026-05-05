const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
export const BASE_URL = isLocal ? envUrl : envUrl.replace(/^http:\/\//i, 'https://');

const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const headers = (extra: Record<string, string> = {}) => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: headers(options.headers as Record<string, string>),
    ...options,
  });

  // Auto-logout on token expiry/invalidity — prevents "Failed to load" errors
  // after server restarts or when the browser holds a stale JWT.
  if (resp.status === 401 || (resp.status === 403)) {
    if (typeof window !== 'undefined') {
      const body = await resp.json().catch(() => ({}));
      const msg: string = body?.error || '';
      // Only auto-logout for auth errors, not permission errors like "Not your quote"
      // Also skip auto-logout for the /auth/google route itself (it IS the login endpoint)
      const isGoogleAuthEndpoint = path === '/auth/google';
      if (
        !isGoogleAuthEndpoint &&
        (
          msg.toLowerCase().includes('token') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('access token') ||
          resp.status === 401
        )
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired. Please log in again.')) as any;
      }
      throw new Error(msg || 'Forbidden');
    }
  }

  const data = await resp.json();
  if (!resp.ok) {
    const msg =
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors.map((e: any) => e.msg).join(', ') : null) ||
      'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

// Auth
export const authApi = {
  register: (body: object) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: object) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  googleAuth: (body: object) => request('/auth/google', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  updateProfile: (body: object) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  uploadAvatar: (formData: FormData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/auth/upload-avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      return d as { avatarUrl: string };
    });
  },
};

// Designs
export const designApi = {
  upload: (formData: FormData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/design/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      return d;
    });
  },
  myFiles: () => request('/design/my-files'),
  delete: (id: string) => request(`/design/my-files/${id}`, { method: 'DELETE' }),
};

// Quotes
export const quoteApi = {
  request: (body: object) => request('/quotes/request', { method: 'POST', body: JSON.stringify(body) }),
  vendorRequests: (showAll: boolean = false) => request(`/quotes/vendor-requests?showAll=${showAll}`),
  submit: (body: object) => request('/quotes/submit', { method: 'POST', body: JSON.stringify(body) }),
  customerQuotes: (showAll: boolean = false) => request(`/quotes/customer?showAll=${showAll}`),
  reject: (quoteId: string) => request('/quotes/reject', { method: 'POST', body: JSON.stringify({ quoteId }) }),
  hideQuote: (id: string) => request(`/quotes/${id}/customer-hide`, { method: 'POST' }),
};

// Orders
export const orderApi = {
  create: (body: object) => request('/orders/create', { method: 'POST', body: JSON.stringify(body) }),
  customerOrders: (showAll: boolean = false) => request(`/orders/customer?showAll=${showAll}`),
  vendorOrders: (showAll: boolean = false) => request(`/orders/vendor?showAll=${showAll}`),
  updateStatus: (body: object) => request('/orders/update-status', { method: 'POST', body: JSON.stringify(body) }),
  getStatus: (orderId: string) => request(`/orders/status/${orderId}`),
  confirmReceipt: (orderId: string) => request('/orders/confirm-receipt', { method: 'POST', body: JSON.stringify({ orderId }) }),
  hideOrder: (id: string) => request(`/orders/${id}/customer-hide`, { method: 'POST' }),
};

// Products
export const productApi = {
  uploadImage: (formData: FormData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/products/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      return d as { imageUrl: string };
    });
  },
  create: (body: object) => request('/products/create', { method: 'POST', body: JSON.stringify(body) }),
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/products${query}`);
  },
  get: (id: string) => request(`/products/${id}`),
  update: (id: string, body: object) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  restock: (id: string, quantity: number) => request(`/products/${id}/restock`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  delete: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),
  vendorInventory: () => request('/products/vendor/inventory'),
};

// Cart
export const cartApi = {
  add: (body: object) => request('/cart/add', { method: 'POST', body: JSON.stringify(body) }),
  get: () => request('/cart'),
  remove: (itemId: string) => request(`/cart/${itemId}`, { method: 'DELETE' }),
  clear: () => request('/cart/all/clear', { method: 'DELETE' }),
  updateQuantity: (itemId: string, quantity: number) => request(`/cart/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  checkout: (body: object) => request('/cart/checkout', { method: 'POST', body: JSON.stringify(body) }),
};

// Vendors
export const vendorApi = {
  list: () => request('/vendors'),
  getProfile: (id: string) => request(`/vendors/${id}`),
  updateProfile: (body: object) => request('/vendors/me', { method: 'PUT', body: JSON.stringify(body) }),
  rate: (id: string, body: object) => request(`/vendors/${id}/rate`, { method: 'POST', body: JSON.stringify(body) }),
  uploadLogo: (formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(`${BASE_URL}/vendors/upload-logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },
};

// Payments
export const paymentApi = {
  createOrder: (orderId: string) => request('/payments/create-order', { method: 'POST', body: JSON.stringify({ orderId }) }),
  verify: (body: object) => request('/payments/verify', { method: 'POST', body: JSON.stringify(body) }),
  getForOrder: (orderId: string) => request(`/payments/order/${orderId}`),
};

// Refunds
export const refundApi = {
  request: (body: object) => request('/refunds/request', { method: 'POST', body: JSON.stringify(body) }),
  customerRefunds: () => request('/refunds/customer'),
  vendorRefunds: () => request('/refunds/vendor'),
  vendorRespond: (id: string, body: object) => request(`/refunds/${id}/vendor-respond`, { method: 'POST', body: JSON.stringify(body) }),
  vendorShipReplacement: (id: string, trackingId: string) =>
    request(`/refunds/${id}/vendor-ship-replacement`, { method: 'POST', body: JSON.stringify({ trackingId }) }),
  customerConfirm: (id: string) => request(`/refunds/${id}/customer-confirm`, { method: 'POST' }),
  uploadProof: (id: string, formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(`${BASE_URL}/refunds/${id}/upload-proof`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },
  uploadVendorProof: (id: string, formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(`${BASE_URL}/refunds/${id}/vendor-upload-proof`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },
};

// Cancellations
export const cancellationApi = {
  request: (body: object) => request('/cancellations/request', { method: 'POST', body: JSON.stringify(body) }),
  feePreview: (orderId: string) => request(`/cancellations/fee-preview/${orderId}`),
  customerHistory: () => request('/cancellations/customer'),
};

// Admin
export const adminApi = {
  login: (body: object) => {
    return fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Login failed');
      return data as { token: string; email: string };
    });
  },
  disputes: (token: string) =>
    fetch(`${BASE_URL}/admin/disputes`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    }),
  resolve: (token: string, id: string, body: object) =>
    fetch(`${BASE_URL}/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    }),
  stats: (token: string) =>
    fetch(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    }),
};

