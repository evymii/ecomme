import axios from 'axios';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawApiUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is required in production');
}

// Use localhost only for local development when env is not set
const API_URL = rawApiUrl || 'http://localhost:5001/api';

// Normalize API URL - ensure it ends with /api (without double /api or trailing slashes)
let normalizedApiUrl = API_URL.trim().replace(/\/+$/, ''); // Remove trailing slashes
if (!normalizedApiUrl.endsWith('/api')) {
  normalizedApiUrl = `${normalizedApiUrl}/api`;
}

// Log API URL in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔗 API URL:', normalizedApiUrl);
}

const api = axios.create({
  baseURL: normalizedApiUrl,
  withCredentials: true,
  timeout: 12000, // Default timeout with buffer for cold starts
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE_STATUS = [408, 425, 429, 500, 502, 503, 504];

// Add auth token to requests and handle Content-Type
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('token');
    if (!token) {
      try {
        const persisted = localStorage.getItem('auth-storage');
        if (persisted) {
          const parsed = JSON.parse(persisted);
          token = parsed?.state?.token || null;
        }
      } catch (_e) {
        // Ignore parse errors and continue without token
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    // For other requests, set JSON content type if not already set
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type'] && config.data) {
      config.headers['Content-Type'] = 'application/json';
    }
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as any;
    const method = (config?.method || 'get').toLowerCase();
    const retryCount = config?._retryCount || 0;
    const status = error?.response?.status;
    const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
    const isNetworkError = !error?.response;
    const shouldRetryMethod = ['get', 'head', 'options'].includes(method);
    const shouldRetryStatus = status && RETRYABLE_STATUS.includes(status);

    if (config && shouldRetryMethod && retryCount < 2 && (isTimeout || isNetworkError || shouldRetryStatus)) {
      config._retryCount = retryCount + 1;
      const retryDelay = 400 * Math.pow(2, retryCount); // 400ms, 800ms
      await sleep(retryDelay);
      return api(config);
    }

    // Don't automatically clear tokens on 401 errors
    // Let individual components/hooks handle auth errors
    // This prevents clearing tokens on temporary network issues or admin pages
    // The useAdminAuth hook and AuthProvider will handle token clearing appropriately
    return Promise.reject(error);
  }
);

export default api;
