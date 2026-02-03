import axios from 'axios';

// Get API URL from environment variable or default to localhost
// In production, NEXT_PUBLIC_API_URL should be set in Vercel environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

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
  timeout: 5000, // 5 second timeout for faster responses
});

// Add auth token to requests and handle Content-Type
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
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
  (error) => {
    // Don't automatically clear tokens on 401 errors
    // Let individual components/hooks handle auth errors
    // This prevents clearing tokens on temporary network issues or admin pages
    // The useAdminAuth hook and AuthProvider will handle token clearing appropriately
    return Promise.reject(error);
  }
);

export default api;
