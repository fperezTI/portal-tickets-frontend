import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../utils/tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// withCredentials: true sends the httpOnly refresh-token cookie automatically
const client = axios.create({ baseURL: BASE_URL, withCredentials: true });

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Skip refresh for auth endpoints and already-retried requests
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is sent automatically via the httpOnly cookie
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(original);
      } catch (refreshError) {
        clearAccessToken();
        processQueue(refreshError);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
